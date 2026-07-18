// Пачка 5.1 — Vercel Cron (см. vercel.json): обрабатывает
// lesson_stages_embedding_queue — считает эмбеддинги и пишет их в
// lesson_stage_embeddings.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeEmbedding } from "@/lib/ai/embeddings";
import { extractChunks } from "@/lib/ai/chunk-extractor";

const BATCH_LIMIT = 20;
const MAX_ATTEMPTS = 3;
const INTER_CALL_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  // lesson_stage_embeddings / lesson_stages_embedding_queue — новые таблицы
  // из миграции 139, которая ещё не применена к БД, поэтому их нет в
  // сгенерированном Database-типе (@snr/core). Тот же as-any приём, что
  // уже используется в packages/core для lesson_materials video-колонок
  // (миграция 138, до regen типов).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ragDb = db as any;

  const { data: queueRows, error: queueErr } = await ragDb
    .from("lesson_stages_embedding_queue")
    .select("lesson_stage_id, school_id, attempts")
    .lt("attempts", MAX_ATTEMPTS)
    .order("enqueued_at", { ascending: true })
    .limit(BATCH_LIMIT);
  if (queueErr) return NextResponse.json({ error: queueErr.message }, { status: 500 });

  const results = { processed: 0, embedded_chunks: 0, deleted_stale: 0, errors: 0 };

  for (const row of queueRows ?? []) {
    try {
      const { data: stage, error: stageErr } = await db
        .from("lesson_stages")
        .select("id, stage_role, content_type, slides, description, teacher_notes, school_id")
        .eq("id", row.lesson_stage_id)
        .single();

      if (stageErr || !stage) {
        // Этап удалён (ON DELETE CASCADE обычно уже унёс и очередь вместе
        // с ним, но на случай гонки/аномалии — ретраить бессмысленно,
        // удаляем сразу, не тратя attempts).
        await ragDb.from("lesson_stages_embedding_queue").delete().eq("lesson_stage_id", row.lesson_stage_id);
        continue;
      }

      let quizQuestions: Array<{ question_text: string; options: string[] }> = [];
      if (stage.content_type === "quiz_qia" || stage.content_type === "quiz_kahoot") {
        const { data: questions } = await db
          .from("quiz_questions")
          .select("question_text, options")
          .eq("stage_id", stage.id)
          .order("position");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quizQuestions = (questions ?? []) as any;
      }

      // stage.slides из Database-типа — широкий Json; extractChunks
      // ожидает конкретную форму слайдов (title/content).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chunks = extractChunks(stage as any, quizQuestions);

      // Чистим старые чанки перед перезаписью в любом случае — если этап
      // отредактировали и текста стало МЕНЬШЕ (например, было 5 чанков,
      // стало 3), upsert по (lesson_stage_id, chunk_index) обновил бы
      // только 0..2, оставив 3 и 4 висеть как "призрачные" устаревшие
      // чанки, которые retrieval продолжал бы находить.
      const { error: deleteErr } = await ragDb
        .from("lesson_stage_embeddings")
        .delete()
        .eq("lesson_stage_id", row.lesson_stage_id);
      if (deleteErr) throw new Error(deleteErr.message);
      results.deleted_stale++;

      if (chunks.length === 0) {
        // Пусто (например, description/teacher_notes ещё не заполнены,
        // либо content_type — внешний embed без своего текста) — не
        // ошибка, просто нечего индексировать сейчас.
        await ragDb.from("lesson_stages_embedding_queue").delete().eq("lesson_stage_id", row.lesson_stage_id);
        results.processed++;
        continue;
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!; // guarded by i < chunks.length
        const embedding = await computeEmbedding(chunk);
        const { error: insertErr } = await ragDb.from("lesson_stage_embeddings").insert({
          lesson_stage_id: row.lesson_stage_id,
          chunk_index: i,
          chunk_text: chunk,
          embedding,
          school_id: row.school_id,
        });
        if (insertErr) throw new Error(insertErr.message);
        results.embedded_chunks++;
        if (i < chunks.length - 1) await sleep(INTER_CALL_DELAY_MS);
      }

      await ragDb.from("lesson_stages_embedding_queue").delete().eq("lesson_stage_id", row.lesson_stage_id);
      results.processed++;
      await sleep(INTER_CALL_DELAY_MS);
    } catch (e) {
      const message = (e as Error)?.message ?? String(e);
      console.error(`[rag-process-queue] failed for stage ${row.lesson_stage_id}:`, message);
      await ragDb
        .from("lesson_stages_embedding_queue")
        .update({ attempts: row.attempts + 1, last_error: message })
        .eq("lesson_stage_id", row.lesson_stage_id);
      results.errors++;
    }
  }

  return NextResponse.json(results);
}
