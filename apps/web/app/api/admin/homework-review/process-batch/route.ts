// Пачка 5.3 — ручная разовая обработка ai_homework_review_queue (тот же
// паттерн, что /api/admin/rag/process-batch из Пачки 5.1) — Vercel Hobby
// daily cron обработал бы всю накопившуюся очередь слишком медленно для
// первого прогона, поэтому админ может продрейнить её батчами вручную.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth";
import { processHomeworkReviewQueueBatch, HOMEWORK_QUEUE_MAX_ATTEMPTS } from "@/lib/ai/process-homework-review-queue";

const BATCH_LIMIT = 20;

export async function POST(req: NextRequest) {
  console.log("[batch] start");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getCurrentUserRole(supabase, user.id);
  // Z.1, 06.08.2026: super_admin убран из гейта — см. app/api/admin/chats/route.ts.
  // Роут мутирует глобальную ai_homework_review_queue без школьного скоупа, то
  // есть суперадмин трогал бы данные демо-школы. Крон ходит своим путём
  // (/api/cron/homework-review-process, CRON_SECRET) и не задет.
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  console.log("[batch] auth checked, role:", role);

  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const homeworkDb = db as any;

  let result;
  try {
    result = await processHomeworkReviewQueueBatch(homeworkDb, BATCH_LIMIT);
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message ?? String(e) }, { status: 500 });
  }

  const [{ count: remaining }, { count: totalDone }] = await Promise.all([
    homeworkDb
      .from("ai_homework_review_queue")
      .select("*", { count: "exact", head: true })
      .lt("attempts", HOMEWORK_QUEUE_MAX_ATTEMPTS),
    homeworkDb
      .from("homework_submissions")
      .select("*", { count: "exact", head: true })
      .eq("ai_review_status", "ai_reviewed_pending_teacher"),
  ]);

  return NextResponse.json({
    processed: result.processed,
    failed: result.errors,
    remaining: remaining ?? 0,
    total_done: totalDone ?? 0,
  });
}
