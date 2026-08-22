// K.2, 05.08.2026 — одиночная фоновая генерация AI-картинки
// для ОДНОГО этапа. Вызывается fire-and-forget сразу после создания нового
// этапа (packages/core::addLessonStage — единая точка вставки и для ручного
// создания, и для AI-генерации через AiGenerateStagesModal, см. resheniya_2.md
// про то, почему /api/ai/generate-stages сам НЕ вставляет этапы), а также
// вручную safety-net краном (/api/cron/stage-media-backfill) для зависших
// этапов.
//
// Авторизация — ИЛИ CRON_SECRET (используется только safety-net краном при
// желании дёрнуть конкретный этап вручную; сам крон обычно обрабатывает
// батч in-process без HTTP, см. cron route), ИЛИ обычная учительская сессия
// (браузер шлёт cookie автоматически на same-origin fetch — тот же паттерн,
// что /api/ai/generate-stages) + владение этапом.
//
// Владение: RLS-политика "teacher reads visible lesson stages" на
// lesson_stages — НЕ ограничивает SELECT своим предметом (проверено живым
// запросом к pg_policies: qual только school_id + EXISTS lesson, без
// teacher_can_write_lesson) — то есть просто прочитать lesson_id через
// сессионный клиент НЕ доказывает владение. Используем ту же функцию, что
// уже гейтит INSERT/UPDATE/DELETE на lesson_stages —
// public.teacher_can_write_lesson(lesson_id) (SECURITY DEFINER, is_subject_
// owner) — как явную проверку прежде, чем идти в admin-клиент (который
// полностью обходит RLS).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processStageMediaForStage } from "@/lib/ai/process-stage-media";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function isAuthorized(req: NextRequest, stageId: string): Promise<boolean> {
  const cronSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret");
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) return true;

  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacher } = await (db as any).from("teachers").select("id").eq("user_id", user.id).maybeSingle();
  if (!teacher) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stage } = await (db as any)
    .from("lesson_stages")
    .select("lesson_id")
    .eq("id", stageId)
    .maybeSingle();
  if (!stage?.lesson_id) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: canWrite } = await (db as any).rpc("teacher_can_write_lesson", { p_lesson_id: stage.lesson_id });
  return canWrite === true;
}

export async function POST(req: NextRequest) {
  // 22.08.2026 — force: заход по кнопке «Перезапустить» у учителя. Без него
  // обработчик пропускает уже обработанный этап, а кнопка показывается ровно
  // на таком — и потому была бы пустышкой. Проверка прав от флага не зависит:
  // она выше и одна на оба случая — учитель и именно своего урока.
  const body = (await req.json().catch(() => null)) as { stageId?: string; force?: boolean } | null;
  if (!body?.stageId) {
    return NextResponse.json({ error: "Missing stageId" }, { status: 400 });
  }

  if (!(await isAuthorized(req, body.stageId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const result = await processStageMediaForStage(admin, body.stageId, { force: body.force === true });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message ?? String(e) }, { status: 500 });
  }
}
