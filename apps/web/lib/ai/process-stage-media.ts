// K.2, 05.08.2026 — общая логика обработки ОДНОГО этапа (в отличие от
// stage-media-prompts.ts, где живут только сами Gemini-примитивы). Решает,
// нужна ли этапу картинка (только Programming/Robotics — остальные
// предметы молча помечаются media_status='generated' и пропускаются),
// генерирует, пишет в lesson_stages.
//
// Используется в двух местах — /api/stage-media/generate (одиночный вызов
// сразу после создания этапа) и /api/cron/stage-media-backfill (safety-net
// batch, вызывает эту же функцию in-process, БЕЗ HTTP self-fetch на себя же
// — тот же паттерн, что apps/web/lib/ai/process-homework-review-queue.ts
// уже использует для cron+admin batch endpoint).
//
// Backfill-скрипт (backfill-stage-media-jul29-aug1.mjs, 29.07-01.08, на
// паузе) НЕ импортирует этот файл и не изменён — у него своя зеркальная
// JS-копия той же логики (.mjs не может импортировать .ts). Эта функция —
// для НОВЫХ этапов, создаваемых после этой задачи.

import { decideStageMedia, generateStageImage, uploadStageImageToStorage } from "./stage-media-prompts";
import { AI_FALLBACK_GRADE, gradeFromGroupName } from "@/lib/group-grade";

// Те же 2 строки, что backfill-stage-media-jul29-aug1.mjs::SUBJECT_NAMES —
// subjects.name (RU), НЕ groups.subject (захардкоженная placeholder-
// константа 'programming' для всех групп, миграция 97 full reset).
const IN_SCOPE_SUBJECTS = ["Программирование", "Робототехника"];

export type ProcessStageMediaResult =
  | { status: "skipped"; reason: "stage_not_found" | "lesson_not_found" | "already_processed" | "subject_not_in_scope" }
  | { status: "generated"; hadImage: boolean }
  | { status: "failed"; error: string };

/** db — admin/service-role клиент (media_status/media_queued_at и др. колонки
 *  миграций 165-168 ещё не в сгенерированном Database-типе, untyped — тот же
 *  приём, что process-homework-review-queue.ts и rag-process-queue route). */
export async function processStageMediaForStage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  stageId: string,
): Promise<ProcessStageMediaResult> {
  const { data: stage, error: stageErr } = await db
    .from("lesson_stages")
    .select("id, lesson_id, title, description, content_type, media_status, school_id")
    .eq("id", stageId)
    .maybeSingle();
  if (stageErr || !stage) return { status: "skipped", reason: "stage_not_found" };

  if (stage.media_status === "generated" || stage.media_status === "failed") {
    return { status: "skipped", reason: "already_processed" };
  }

  const { data: lesson, error: lessonErr } = await db
    .from("lessons")
    .select("title, subject_id, group:groups(name)")
    .eq("id", stage.lesson_id)
    .maybeSingle();
  if (lessonErr || !lesson) return { status: "skipped", reason: "lesson_not_found" };

  let subjectName: string | null = null;
  if (lesson.subject_id) {
    const { data: subjectRow, error: subjectErr } = await db
      .from("subjects").select("name").eq("id", lesson.subject_id).maybeSingle();
    // Ревью K.2: раньше ошибка здесь молча проглатывалась и subjectName
    // схлопывался в null — неотличимо от "предмет реально вне скоупа",
    // из-за чего транзиентный сбой навсегда помечал реально Programming/
    // Robotics этап как media_status='generated' без единого шанса на
    // повторную обработку (крон ищет только 'pending'). Транзиентную
    // ошибку теперь помечаем как 'failed' с диагностикой, не как "вне
    // скоупа".
    if (subjectErr) {
      const errorText = `subjects lookup: ${subjectErr.message}`;
      await db.from("lesson_stages").update({ media_status: "failed", media_error: errorText }).eq("id", stageId);
      return { status: "failed", error: errorText };
    }
    subjectName = subjectRow?.name ?? null;
  }

  if (!subjectName || !IN_SCOPE_SUBJECTS.includes(subjectName)) {
    // Помечаем 'generated' (не 'pending'/'failed') — семантика та же, что
    // backfill: "решение принято (без медиа)", просто причина — предмет вне
    // скоупа, а не decideStageMedia() вернувший false/false.
    await db.from("lesson_stages").update({ media_status: "generated" }).eq("id", stageId);
    return { status: "skipped", reason: "subject_not_in_scope" };
  }

  const grade = gradeFromGroupName(lesson.group?.name) ?? AI_FALLBACK_GRADE;

  // Ревью K.2: атомарный claim — UPDATE условен на ТОМ ЖЕ media_status, что
  // мы только что прочитали (null или уже 'pending' при повторном подборе
  // краном зависшей строки), а не безусловный UPDATE. Две одновременные
  // обработки одного stageId (например повторный POST на этот же этап, пока
  // первый ещё не завершился) — только одна реально "выигрывает" claim
  // (affected rows > 0), вторая тут же останавливается вместо того, чтобы
  // тоже пойти в платные вызовы Gemini.
  let claimQuery = db
    .from("lesson_stages")
    .update({ media_status: "pending", media_queued_at: new Date().toISOString() })
    .eq("id", stageId);
  claimQuery = stage.media_status == null
    ? claimQuery.is("media_status", null)
    : claimQuery.eq("media_status", stage.media_status);
  const { data: claimed, error: claimErr } = await claimQuery.select("id");
  if (claimErr) return { status: "failed", error: `claim: ${claimErr.message}` };
  if (!claimed || claimed.length === 0) {
    return { status: "skipped", reason: "already_processed" };
  }

  const decision = await decideStageMedia(
    { title: stage.title, description: stage.description, content_type: stage.content_type },
    { subject: subjectName, grade, lesson_title: lesson.title },
  );

  let errorText: string | null = null;
  let hadImage = false;

  if (decision.need_image && decision.image_prompt) {
    try {
      const { buffer, source } = await generateStageImage(decision.image_prompt);
      const url = await uploadStageImageToStorage(buffer, stageId, stage.school_id as string);
      await db.from("lesson_stages").update({ image_url: url, media_source: source }).eq("id", stageId);
      hadImage = true;
    } catch (e) {
      errorText = `image: ${((e as Error)?.message ?? String(e)).slice(0, 500)}`;
    }
  }

  // 08.08.2026 — генерация mermaid-схем снята целиком. Генератор системно
  // выдавал невалидный синтаксис (кавычки внутри подписей узлов, слово
  // `end` как имя узла), и ученик видел на экране бомбу «Syntax error»
  // вместо диаграммы. Решение заказчика — схемы убрать. Колонка
  // lesson_stages.mermaid_code оставлена в базе на случай возврата, но
  // больше не заполняется и не показывается.

  // Ревью K.2: 'failed' только если за этот прогон НИЧЕГО полезного не
  // произвели. Раньше любая ошибка (даже только в схеме, при уже успешно
  // загруженной и оплаченной картинке) помечала весь этап 'failed' —
  // 'failed' в этом модуле считается already_processed, так что уже готовая
  // картинка навсегда переставала быть доступной для повторной обработки.
  // Частичный успех теперь — 'generated' с диагностикой в media_error.
  if (errorText && !hadImage) {
    await db.from("lesson_stages").update({ media_status: "failed", media_error: errorText }).eq("id", stageId);
    return { status: "failed", error: errorText };
  }

  await db.from("lesson_stages").update({ media_status: "generated", media_error: errorText }).eq("id", stageId);
  return { status: "generated", hadImage };
}
