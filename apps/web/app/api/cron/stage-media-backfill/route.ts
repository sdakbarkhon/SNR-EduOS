// K.2, 05.08.2026 — Vercel Cron safety net (см. vercel.json), ежедневно
// 02:00 UTC. Подхватывает этапы, для которых фоновый триггер (fire-and-
// forget fetch из packages/core::addLessonStage, см. /api/stage-media/
// generate) не долетел или упал — media_status='pending' дольше 30 минут.
// Обрабатывает батч in-process (processStageMediaForStage напрямую, без
// HTTP self-fetch на себя же) — тот же паттерн, что уже использует
// /api/cron/homework-review-process + lib/ai/process-homework-review-queue.ts.
//
// GET и POST оба вызывают общий handler() — Vercel Cron всегда шлёт GET
// (см. комментарий в rag-process-queue/route.ts про фикс E.1), POST
// оставлен для ручного вызова из dev-инструментов/curl.
//
// Безопасно относительно паузного backfill-stage-media-jul29-aug1.mjs
// (29.07-01.08, 72/162): тот скрипт никогда не устанавливал media_queued_at
// (колонка появилась только в этой задаче, миграция 168) — все его
// 'pending'-строки (если такие остались от прерывания) имеют
// media_queued_at IS NULL, а "media_queued_at < cutoff" на NULL всегда
// false в Postgres — такие строки этим краном НЕ подхватываются, backfill
// остаётся нетронутым.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processStageMediaForStage } from "@/lib/ai/process-stage-media";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BATCH_LIMIT = 30;
const STUCK_AFTER_MS = 30 * 60 * 1000;

async function handler(req: NextRequest) {
  const cronSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  // media_status/media_queued_at (миграции 165-168) ещё не в сгенерированном
  // Database-типе — тот же as-any приём, что rag-process-queue/route.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stageDb = db as any;
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString();

  const { data: stuck, error } = await stageDb
    .from("lesson_stages")
    .select("id")
    .eq("media_status", "pending")
    .lt("media_queued_at", cutoff)
    .limit(BATCH_LIMIT);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = { processed: 0, generated: 0, failed: 0, skipped: 0, errors: 0 };

  for (const row of stuck ?? []) {
    try {
      const r = await processStageMediaForStage(db, row.id);
      results.processed++;
      if (r.status === "generated") results.generated++;
      else if (r.status === "failed") results.failed++;
      else results.skipped++;
    } catch (e) {
      console.error(`[stage-media-backfill] failed for stage ${row.id}:`, (e as Error)?.message ?? e);
      results.errors++;
    }
  }

  return NextResponse.json(results);
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
