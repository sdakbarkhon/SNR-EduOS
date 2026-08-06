// Пачка 5.3 — Vercel Cron (daily, см. vercel.json — Hobby-план не
// позволяет чаще раза в сутки). Обрабатывает ai_homework_review_queue —
// вызывает reviewHomework() и переводит сдачи в ai_reviewed_pending_teacher.
//
// 05.08.2026, фикс E.3: как и E.1 (rag-process-queue), реальная причина —
// экспортирован был только POST, а Vercel Cron всегда шлёт GET
// (https://vercel.com/docs/cron-jobs) → 405 на каждый реальный вызов
// планировщика. GET и POST теперь оба вызывают общий handler(). maxDuration
// =300 — потолок Hobby-плана через Fluid Compute (подтверждено:
// resourceConfig.fluid=true, functionDefaultTimeout=300 у этого проекта),
// не Pro-only. BATCH_LIMIT поднят 10→30 под этот бюджет времени
// (reviewHomework — генеративный Gemini-вызов с длинным промптом, дороже
// по времени чем embedding, отсюда меньший batch чем у RAG).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processHomeworkReviewQueueBatch } from "@/lib/ai/process-homework-review-queue";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BATCH_LIMIT = 30;

async function handler(req: NextRequest) {
  const cronSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  // ai_homework_review_queue / ai_grade / ai_feedback / ai_review_status —
  // из миграции 140, ещё не применена, нет в сгенерированном Database-типе.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const homeworkDb = db as any;

  try {
    const result = await processHomeworkReviewQueueBatch(homeworkDb, BATCH_LIMIT);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message ?? String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
