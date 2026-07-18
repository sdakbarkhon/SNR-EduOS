// Пачка 5.3 — общая логика обработки одного батча
// ai_homework_review_queue, используется и cron (batch=10), и admin
// batch endpoint (batch=20) с самого начала — в отличие от RAG (Пачка
// 5.1), где cron уже существовал и его явно запретили трогать, здесь
// оба вызывающих места новые, дублировать нечего.

import { reviewHomework } from "@/lib/ai/homework-review";

export const HOMEWORK_QUEUE_MAX_ATTEMPTS = 3;

export type ProcessHomeworkQueueBatchResult = {
  processed: number;
  errors: number;
};

function gradeFromGroupName(name: string | null | undefined, fallback = 7): number {
  const m = (name ?? "").match(/(\d{1,2})/);
  const g = m ? parseInt(m[1]!, 10) : NaN;
  return Number.isFinite(g) && g >= 1 && g <= 12 ? g : fallback;
}

/** Обрабатывает один батч (до batchLimit записей) из
 *  ai_homework_review_queue: reviewHomework() + запись
 *  ai_grade/ai_feedback/ai_review_status='ai_reviewed_pending_teacher' на
 *  homework_submissions, с очисткой очереди по успеху/ошибке.
 *  db — admin/service-role клиент (новые таблицы/колонки миграции 140
 *  ещё не в сгенерированном Database-типе, поэтому untyped). */
export async function processHomeworkReviewQueueBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  batchLimit: number,
): Promise<ProcessHomeworkQueueBatchResult> {
  console.log("[batch] start, batchLimit:", batchLimit);
  const { data: queueRows, error: queueErr } = await db
    .from("ai_homework_review_queue")
    .select("submission_id, school_id, attempts")
    .lt("attempts", HOMEWORK_QUEUE_MAX_ATTEMPTS)
    .order("enqueued_at", { ascending: true })
    .limit(batchLimit);
  if (queueErr) throw new Error(queueErr.message);
  console.log("[batch] queue fetched:", (queueRows ?? []).length);

  const results: ProcessHomeworkQueueBatchResult = { processed: 0, errors: 0 };

  for (const row of queueRows ?? []) {
    console.log("[batch] processing item:", row.submission_id);
    try {
      const { data: submission, error: subErr } = await db
        .from("homework_submissions")
        .select("id, homework_id, answer_text, code_text")
        .eq("id", row.submission_id)
        .single();
      if (subErr || !submission) {
        // Сдача удалена (ON DELETE CASCADE обычно уже унёс и очередь) —
        // ретраить бессмысленно, удаляем сразу.
        await db.from("ai_homework_review_queue").delete().eq("submission_id", row.submission_id);
        continue;
      }

      const { data: homework, error: hwErr } = await db
        .from("homework")
        .select("title, description, subject_id, group:groups!inner(name)")
        .eq("id", submission.homework_id)
        .single();
      if (hwErr || !homework) {
        await db.from("ai_homework_review_queue").delete().eq("submission_id", row.submission_id);
        continue;
      }

      // homework.group.subject ('groups.subject') — захардкоженная
      // placeholder-константа ('programming' для всех групп, миграция 97
      // full reset), НЕ реальный предмет. Реальный — subjects.name через
      // homework.subject_id (тот же приём, что /api/ai/generate-stages).
      let subjectName = "Предмет";
      if (homework.subject_id) {
        const { data: subjectRow } = await db
          .from("subjects")
          .select("name")
          .eq("id", homework.subject_id)
          .maybeSingle();
        if (subjectRow?.name) subjectName = subjectRow.name;
      }

      const answerText: string = submission.answer_text || submission.code_text || "";
      console.log("[batch] AI call start:", row.submission_id);
      const review = await reviewHomework({
        homework_title: homework.title,
        homework_description: homework.description ?? "",
        subject_name: subjectName,
        answer_text: answerText,
        group_grade: gradeFromGroupName(homework.group?.name),
      });
      console.log("[batch] AI call end:", row.submission_id);

      const { error: updateErr } = await db
        .from("homework_submissions")
        .update({
          ai_grade: review.grade,
          ai_feedback: review.feedback,
          ai_review_status: "ai_reviewed_pending_teacher",
          ai_reviewed_at: new Date().toISOString(),
        })
        .eq("id", row.submission_id);
      if (updateErr) throw new Error(updateErr.message);

      await db.from("ai_homework_review_queue").delete().eq("submission_id", row.submission_id);
      results.processed++;
    } catch (e) {
      const message = (e as Error)?.message ?? String(e);
      console.error(`[process-homework-review-queue] failed for submission ${row.submission_id}:`, message);
      await db
        .from("ai_homework_review_queue")
        .update({ attempts: row.attempts + 1, last_error: message })
        .eq("submission_id", row.submission_id);
      results.errors++;
    }
  }

  return results;
}
