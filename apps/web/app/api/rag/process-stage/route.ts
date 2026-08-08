// 08.08.2026 — разбор очереди эмбеддингов для ОДНОГО этапа, по событию его
// создания. Заменяет крон /api/cron/rag-process-queue, снятый вместе с ещё
// двумя: бесплатный тариф Vercel даёт два крона на проект, а их было пять.
//
// Вызывается fire-and-forget из packages/core::addLessonStage — той же
// единой точки вставки, что уже дёргает /api/stage-media/generate (4dc2299).
// Авторизация и проверка владения — 1-в-1 как там: либо CRON_SECRET, либо
// учительская сессия плюс teacher_can_write_lesson(lesson_id). Просто
// прочитать этап через сессионный клиент владения НЕ доказывает: RLS-политика
// "teacher reads visible lesson stages" не ограничивает SELECT своим
// предметом.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processStageEmbeddings } from "@/lib/ai/process-stage-embeddings";

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
  const body = (await req.json().catch(() => null)) as { stageId?: string } | null;
  if (!body?.stageId) {
    return NextResponse.json({ error: "Missing stageId" }, { status: 400 });
  }
  if (!(await isAuthorized(req, body.stageId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const result = await processStageEmbeddings(admin, body.stageId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message ?? String(e) }, { status: 500 });
  }
}
