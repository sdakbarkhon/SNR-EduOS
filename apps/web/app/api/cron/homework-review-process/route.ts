// Пачка 5.3 — Vercel Cron (daily, см. vercel.json — Hobby-план не
// позволяет чаще раза в сутки, тот же ограничение, что уже упёрлись в
// Пачке 5.1). Обрабатывает ai_homework_review_queue — вызывает
// reviewHomework() и переводит сдачи в ai_reviewed_pending_teacher.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processHomeworkReviewQueueBatch } from "@/lib/ai/process-homework-review-queue";

const BATCH_LIMIT = 10;

export async function POST(req: NextRequest) {
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
