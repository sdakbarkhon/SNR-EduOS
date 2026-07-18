// Пачка 5.1 — ручная разовая обработка ВСЕЙ lesson_stages_embedding_queue.
// Vercel Hobby: daily cron только (см. vercel.json — не убирать), 20
// записей/сутки — 299 записей заняли бы ~15 дней. Serverless timeout
// (10с на Hobby) не позволяет обработать всё за один вызов, поэтому
// эндпоинт делает ОДИН батч (20) за вызов и возвращает remaining —
// клиент дёргает эндпоинт в цикле, пока remaining > 0 (см. отчёт).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth";
import { processEmbeddingQueueBatch, QUEUE_MAX_ATTEMPTS } from "@/lib/ai/process-embedding-queue";

const BATCH_LIMIT = 20;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getCurrentUserRole(supabase, user.id);
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createAdminClient();
  // lesson_stage_embeddings / lesson_stages_embedding_queue — таблицы
  // миграции 139, ещё не в сгенерированном Database-типе (@snr/core).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ragDb = db as any;

  let result;
  try {
    result = await processEmbeddingQueueBatch(ragDb, BATCH_LIMIT);
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message ?? String(e) }, { status: 500 });
  }

  const [{ count: remaining }, { count: totalDone }] = await Promise.all([
    ragDb
      .from("lesson_stages_embedding_queue")
      .select("*", { count: "exact", head: true })
      .lt("attempts", QUEUE_MAX_ATTEMPTS),
    ragDb.from("lesson_stage_embeddings").select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    processed: result.processed,
    failed: result.errors,
    remaining: remaining ?? 0,
    total_done: totalDone ?? 0,
  });
}
