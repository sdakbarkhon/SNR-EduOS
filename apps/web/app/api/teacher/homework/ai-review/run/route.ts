// 08.08.2026 — запуск AI-проверки ДЗ УЧИТЕЛЕМ, по выбранным работам.
//
// Заменяет снятый крон /api/cron/homework-review-process (бесплатный тариф
// Vercel даёт два крона на проект, их было пять — решение заказчика: перенести
// на кнопку). Крон-роут оставлен и по-прежнему вызывается CRON_SECRET'ом.
//
// ЛОГИКА ПРОВЕРКИ И ПРОМПТЫ НЕ ТРОГАЛИСЬ: здесь только другой способ запуска.
// Сама проверка — reviewOneSubmission() из lib/ai/process-homework-review-
// queue.ts, вынесенная из тела батч-цикла один-в-один.
//
// Размер порции — AI_REVIEW_MAX_PER_CALL, общий с клиентом (lib/ai-review-
// batch.ts), там же обоснование числа. Клиент шлёт выбранное такими порциями
// подряд, общее количество работ ничем не ограничено.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reviewOneSubmission } from "@/lib/ai/process-homework-review-queue";
import { AI_REVIEW_MAX_PER_CALL } from "@/lib/ai-review-batch";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export type AiReviewRunResult = {
  results: Array<{ id: string; ok: boolean; error?: string }>;
  /** Обновлённые поля проверенных сдач — чтобы список показал оценку сразу,
   *  без перезагрузки страницы и лишнего запроса. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updated: Array<{ id: string; ai_grade: number | null; ai_feedback: any; ai_review_status: string | null }>;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { submissionIds?: string[] } | null;
  const ids = Array.isArray(body?.submissionIds) ? body!.submissionIds!.filter(Boolean) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Missing submissionIds" }, { status: 400 });
  }
  if (ids.length > AI_REVIEW_MAX_PER_CALL) {
    return NextResponse.json({ error: `Too many at once, max ${AI_REVIEW_MAX_PER_CALL}` }, { status: 400 });
  }

  // Учительская сессия. RLS-политика "teacher reads submissions in own groups"
  // (is_my_teacher_group) сама сужает выборку — поэтому владение проверяем
  // тем, что читаем эти сдачи СЕССИОННЫМ клиентом: что не вернулось, то и не
  // наше. Только после этого идём admin-клиентом, который RLS обходит.
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacher } = await (db as any).from("teachers").select("id").eq("user_id", user.id).maybeSingle();
  if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: visible } = await (db as any)
    .from("homework_submissions")
    .select("id, ai_review_status")
    .in("id", ids);
  const visibleRows = (visible ?? []) as Array<{ id: string; ai_review_status: string | null }>;
  const allowed = new Set(
    visibleRows
      // Уже подтверждённые учителем не перепроверяем — гейт и смысл: оценка
      // выставлена, ИИ тут больше нечего сказать.
      .filter((r) => r.ai_review_status !== "teacher_approved" && r.ai_review_status !== "teacher_declined_manual_grade")
      .map((r) => r.id),
  );

  const admin = createAdminClient();
  const results: AiReviewRunResult["results"] = [];

  for (const id of ids) {
    if (!allowed.has(id)) {
      results.push({ id, ok: false, error: "not allowed" });
      continue;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await reviewOneSubmission(admin as any, id);
      results.push({ id, ok: r.ok, ...(r.error ? { error: r.error } : {}) });
    } catch (e) {
      // Одна упавшая работа не роняет остальные — ошибка возвращается
      // построчно и показывается в списке.
      const message = (e as Error)?.message ?? String(e);
      console.error(`[ai-review/run] submission ${id} failed:`, message);
      results.push({ id, ok: false, error: message });
    }
  }

  const okIds = results.filter((r) => r.ok).map((r) => r.id);
  let updated: AiReviewRunResult["updated"] = [];
  if (okIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("homework_submissions")
      .select("id, ai_grade, ai_feedback, ai_review_status")
      .in("id", okIds);
    updated = (data ?? []) as AiReviewRunResult["updated"];
  }

  return NextResponse.json({ results, updated } satisfies AiReviewRunResult);
}
