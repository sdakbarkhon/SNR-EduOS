// Пачка 5.1 — общая логика обработки одного батча
// lesson_stages_embedding_queue, извлечённая из /api/cron/rag-process-queue
// для повторного использования в /api/admin/rag/process-batch (ручной
// прогон всей очереди, т.к. daily cron на Vercel Hobby обработал бы 299
// записей за ~15 дней по 20/сутки).
//
// /api/cron/rag-process-queue НЕ переведён на этот helper (сознательно —
// по явному "НЕ трогай существующий cron endpoint" из ТЗ) — там осталась
// своя копия того же кода. Дублирование между cron-роутом и этим файлом,
// а не между двумя НОВЫМИ вызывающими местами.

import { computeEmbedding } from "@/lib/ai/embeddings";
import { extractChunks } from "@/lib/ai/chunk-extractor";

export const QUEUE_MAX_ATTEMPTS = 3;
const INTER_CALL_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ProcessQueueBatchResult = {
  processed: number;
  embedded_chunks: number;
  deleted_stale: number;
  errors: number;
};

/** Обрабатывает один батч (до batchLimit записей) из
 *  lesson_stages_embedding_queue: extractChunks + computeEmbedding +
 *  запись в lesson_stage_embeddings, с очисткой очереди по успеху/ошибке.
 *  db — admin/service-role клиент (таблицы миграции 139 не в
 *  сгенерированном Database-типе, поэтому untyped). */
export async function processEmbeddingQueueBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  batchLimit: number,
): Promise<ProcessQueueBatchResult> {
  const { data: queueRows, error: queueErr } = await db
    .from("lesson_stages_embedding_queue")
    .select("lesson_stage_id, school_id, attempts")
    .lt("attempts", QUEUE_MAX_ATTEMPTS)
    .order("enqueued_at", { ascending: true })
    .limit(batchLimit);
  if (queueErr) throw new Error(queueErr.message);

  const results: ProcessQueueBatchResult = { processed: 0, embedded_chunks: 0, deleted_stale: 0, errors: 0 };

  for (const row of queueRows ?? []) {
    try {
      const { data: stage, error: stageErr } = await db
        .from("lesson_stages")
        .select("id, stage_role, content_type, slides, description, teacher_notes, school_id")
        .eq("id", row.lesson_stage_id)
        .single();

      if (stageErr || !stage) {
        // Этап удалён (ON DELETE CASCADE обычно уже унёс и очередь вместе
        // с ним, но на случай гонки/аномалии — ретраить бессмысленно).
        await db.from("lesson_stages_embedding_queue").delete().eq("lesson_stage_id", row.lesson_stage_id);
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chunks = extractChunks(stage as any, quizQuestions);

      // Чистим старые чанки перед перезаписью в любом случае — если этап
      // отредактировали и текста стало МЕНЬШЕ, insert без delete оставил
      // бы висеть устаревшие "хвостовые" чанки.
      const { error: deleteErr } = await db
        .from("lesson_stage_embeddings")
        .delete()
        .eq("lesson_stage_id", row.lesson_stage_id);
      if (deleteErr) throw new Error(deleteErr.message);
      results.deleted_stale++;

      if (chunks.length === 0) {
        await db.from("lesson_stages_embedding_queue").delete().eq("lesson_stage_id", row.lesson_stage_id);
        results.processed++;
        continue;
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!; // guarded by i < chunks.length
        const embedding = await computeEmbedding(chunk);
        const { error: insertErr } = await db.from("lesson_stage_embeddings").insert({
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

      await db.from("lesson_stages_embedding_queue").delete().eq("lesson_stage_id", row.lesson_stage_id);
      results.processed++;
      await sleep(INTER_CALL_DELAY_MS);
    } catch (e) {
      const message = (e as Error)?.message ?? String(e);
      console.error(`[process-embedding-queue] failed for stage ${row.lesson_stage_id}:`, message);
      await db
        .from("lesson_stages_embedding_queue")
        .update({ attempts: row.attempts + 1, last_error: message })
        .eq("lesson_stage_id", row.lesson_stage_id);
      results.errors++;
    }
  }

  return results;
}
