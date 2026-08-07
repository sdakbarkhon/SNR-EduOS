import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resetCurriculumPlanForRetry, markCurriculumPlanError } from "@snr/core";

// Большой фикс, Блок 6, ЗАДАЧА 1 — кнопка "Попробовать снова" на странице
// плана в status='error'. Сбрасывает в 'processing' и заново триггерит
// фоновый парсинг тем же fire-and-forget паттерном, что create-processing.

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacher } = await (db as any)
    .from("teachers").select("id").eq("user_id", user.id).single();
  if (!teacher) return NextResponse.json({ error: "Not a teacher" }, { status: 403 });

  const { id: planId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan } = await (db as any)
    .from("curriculum_plans").select("id, teacher_id, status").eq("id", planId).maybeSingle();
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if (plan.teacher_id !== teacher.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (plan.status !== "error") return NextResponse.json({ error: "Plan is not in error status" }, { status: 400 });

  try {
    await resetCurriculumPlanForRetry(db, planId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка" }, { status: 500 });
  }

  // Тот же фикс, что в create-processing (07.08.2026): голый fetch без await
  // умирал вместе с замороженной serverless-функцией, и «Попробовать снова»
  // возвращало план в 'processing' навсегда. См. подробный комментарий там.
  after(async () => {
    const fail = async (reason: string) => {
      console.error("[retry-parse] background-parse trigger failed:", reason);
      try {
        await markCurriculumPlanError(createAdminClient(), planId, `Не удалось запустить разбор файла: ${reason}`);
      } catch (e) {
        console.error("[retry-parse] markCurriculumPlanError also failed:", (e as Error)?.message);
      }
    };

    if (!process.env.CRON_SECRET) return fail("CRON_SECRET не задан");

    try {
      const res = await fetch(`${req.nextUrl.origin}/api/curriculum-plans/${planId}/background-parse`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      if (!res.ok) await fail(`background-parse ответил ${res.status}`);
    } catch (e) {
      await fail((e as Error)?.message ?? "сетевая ошибка");
    }
  });

  return NextResponse.json({ ok: true });
}
