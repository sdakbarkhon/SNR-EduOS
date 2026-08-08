// 08.08.2026 — обработка очереди эмбеддингов ОДНОГО этапа.
//
// Логика целиком перенесена из /api/cron/rag-process-queue (тело цикла по
// очереди) без изменений: те же чанки, та же чистка старых, те же attempts
// при ошибке. Крон удалён — бесплатный тариф Vercel даёт два крона на проект,
// а их было пять; по решению заказчика очередь теперь разбирается на СОБЫТИИ
// создания этапа, тем же приёмом fire-and-forget, что уже работает для
// картинок (4dc2299, единая точка — packages/core::addLessonStage).
//
// Накопившиеся 424 записи этим НЕ разгребаются: событие обрабатывает только
// свой этап. Разовая обработка старой очереди — отдельная задача.

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeEmbedding } from "@/lib/ai/embeddings";
import { extractChunks } from "@/lib/ai/chunk-extractor";

const INTER_CALL_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type StageEmbeddingResult = {
  processed: number;
  embedded_chunks: number;
  deleted_stale: number;
  errors: number;
};

/**
 * Разбирает очередь эмбеддингов для одного этапа. Идемпотентно: старые чанки
 * удаляются перед перезаписью, запись очереди снимается по завершении.
 * `admin` — service-role клиент.
 */
export async function processStageEmbeddings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  stageId: string,
): Promise<StageEmbeddingResult> {
  const results: StageEmbeddingResult = { processed: 0, embedded_chunks: 0, deleted_stale: 0, errors: 0 };

  // lesson_stage_embeddings / lesson_stages_embedding_queue отсутствуют в
  // сгенерированном Database-типе (миграция 139) — тот же as-any приём, что
  // был в кроне.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ragDb = admin as any;

  const { data: row } = await ragDb
    .from("lesson_stages_embedding_queue")
    .select("lesson_stage_id, school_id, attempts")
    .eq("lesson_stage_id", stageId)
    .maybeSingle();
  // Нет записи в очереди — значит триггер её не создал или она уже разобрана.
  if (!row) return results;

  try {
    const { data: stage, error: stageErr } = await admin
      .from("lesson_stages")
      .select("id, stage_role, content_type, slides, description, teacher_notes, school_id")
      .eq("id", stageId)
      .single();

    if (stageErr || !stage) {
      // Этап удалён — ретраить бессмысленно, снимаем из очереди.
      await ragDb.from("lesson_stages_embedding_queue").delete().eq("lesson_stage_id", stageId);
      return results;
    }

    let quizQuestions: Array<{ question_text: string; options: string[] }> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = stage as any;
    if (st.content_type === "quiz_qia" || st.content_type === "quiz_kahoot") {
      const { data: questions } = await admin
        .from("quiz_questions")
        .select("question_text, options")
        .eq("stage_id", stageId)
        .order("position");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quizQuestions = (questions ?? []) as any;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chunks = extractChunks(stage as any, quizQuestions);

    // Чистим старые чанки до перезаписи: если текста стало МЕНЬШЕ, upsert по
    // (lesson_stage_id, chunk_index) оставил бы "призрачные" хвосты, которые
    // retrieval продолжал бы находить.
    const { error: deleteErr } = await ragDb
      .from("lesson_stage_embeddings")
      .delete()
      .eq("lesson_stage_id", stageId);
    if (deleteErr) throw new Error(deleteErr.message);
    results.deleted_stale++;

    if (chunks.length === 0) {
      // Нечего индексировать (описание ещё не заполнено, внешний embed без
      // своего текста) — не ошибка.
      await ragDb.from("lesson_stages_embedding_queue").delete().eq("lesson_stage_id", stageId);
      results.processed++;
      return results;
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const embedding = await computeEmbedding(chunk);
      const { error: insertErr } = await ragDb.from("lesson_stage_embeddings").insert({
        lesson_stage_id: stageId,
        chunk_index: i,
        chunk_text: chunk,
        embedding,
        school_id: row.school_id,
      });
      if (insertErr) throw new Error(insertErr.message);
      results.embedded_chunks++;
      if (i < chunks.length - 1) await sleep(INTER_CALL_DELAY_MS);
    }

    await ragDb.from("lesson_stages_embedding_queue").delete().eq("lesson_stage_id", stageId);
    results.processed++;
  } catch (e) {
    const message = (e as Error)?.message ?? String(e);
    console.error(`[process-stage-embeddings] failed for stage ${stageId}:`, message);
    await ragDb
      .from("lesson_stages_embedding_queue")
      .update({ attempts: (row.attempts ?? 0) + 1, last_error: message })
      .eq("lesson_stage_id", stageId);
    results.errors++;
  }

  return results;
}
