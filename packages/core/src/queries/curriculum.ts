// Промт 4 — учебные планы (migration 116). Существующие уроки эти функции
// никогда не изменяют: lessons.curriculum_topic_id пишется только при
// СОЗДАНИИ нового урока (см. createLesson в index.ts), не при редактировании.

import type { Db } from "../supabase/factory";
import type { CurriculumPlan, CurriculumPlanTopic, CurriculumPlanWithTopics, CurriculumTopicWithUsage } from "../types";
import { unwrap } from "./helpers";
import { mySchoolStoragePath } from "../storage/path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

/** Все планы учителя (по всем его группам/предметам) с темами и именами группы/предмета. */
export async function getCurriculumPlansForTeacher(db: Db, teacherId: string): Promise<CurriculumPlanWithTopics[]> {
  const { data, error } = await (db as AnyDb)
    .from("curriculum_plans")
    .select("*, group:groups(name), subject:subjects(name), topics:curriculum_plan_topics(*)")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<CurriculumPlan & { group: { name: string } | null; subject: { name: string } | null; topics: CurriculumPlanTopic[] }>)
    .map((p) => ({
      ...p,
      group_name: p.group?.name,
      subject_name: p.subject?.name,
      topics: (p.topics ?? []).sort((a, b) => a.order_index - b.order_index),
    }));
}

/** Существующий план для пары (группа, предмет) — для формы загрузки
 *  ("План уже существует. Заменить?") и для селектора темы в форме урока. */
export async function getCurriculumPlanForGroupSubject(
  db: Db,
  groupId: string,
  subjectId: string,
): Promise<CurriculumPlanWithTopics | null> {
  const { data, error } = await (db as AnyDb)
    .from("curriculum_plans")
    .select("*, group:groups(name), subject:subjects(name), topics:curriculum_plan_topics(*)")
    .eq("group_id", groupId)
    .eq("subject_id", subjectId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const p = data as CurriculumPlan & { group: { name: string } | null; subject: { name: string } | null; topics: CurriculumPlanTopic[] };
  return {
    ...p,
    group_name: p.group?.name,
    subject_name: p.subject?.name,
    topics: (p.topics ?? []).sort((a, b) => a.order_index - b.order_index),
  };
}

/** Один план по id (страница деталей плана: клик по карточке). Та же форма
 *  ответа, что getCurriculumPlanForGroupSubject, просто другой фильтр. */
export async function getCurriculumPlanById(db: Db, planId: string): Promise<CurriculumPlanWithTopics | null> {
  const { data, error } = await (db as AnyDb)
    .from("curriculum_plans")
    .select("*, group:groups(name), subject:subjects(name), topics:curriculum_plan_topics(*)")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const p = data as CurriculumPlan & { group: { name: string } | null; subject: { name: string } | null; topics: CurriculumPlanTopic[] };
  return {
    ...p,
    group_name: p.group?.name,
    subject_name: p.subject?.name,
    topics: (p.topics ?? []).sort((a, b) => a.order_index - b.order_index),
  };
}

/** Правка темы (Часть 1 — переименование). Описание намеренно не редактируется
 *  из UI детали плана — только название, как в спеке задачи. */
export async function updateCurriculumPlanTopic(
  db: Db,
  topicId: string,
  patch: { title: string },
): Promise<void> {
  const { error } = await (db as AnyDb)
    .from("curriculum_plan_topics")
    .update({ title: patch.title })
    .eq("id", topicId);
  if (error) throw error;
}

/** Переставляет темы плана — order_index := позиция в массиве orderedTopicIds. */
export async function reorderCurriculumPlanTopics(
  db: Db,
  orderedTopicIds: string[],
): Promise<void> {
  const results = await Promise.all(
    orderedTopicIds.map((id, i) => (db as AnyDb).from("curriculum_plan_topics").update({ order_index: i }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function deleteCurriculumPlanTopic(db: Db, topicId: string): Promise<void> {
  const { error } = await (db as AnyDb).from("curriculum_plan_topics").delete().eq("id", topicId);
  if (error) throw error;
}

/** Темы плана + сколько НОВЫХ уроков (curriculum_topic_id) уже используют
 *  каждую, и ссылка на самый ранний из них.
 *
 *  Ссылка нужна кнопке «Создать урок» рядом с темой: если урок уже есть,
 *  кнопка обязана вести к нему, а не создавать второй. Раньше возвращался
 *  только счётчик, поэтому показать урок было нечем — только надпись
 *  «Урок создан», никуда не ведущая.
 *
 *  Сортировка по starts_at, а не по created_at: «первый урок по теме» для
 *  человека — тот, что раньше в расписании. */
export async function getCurriculumTopicsWithUsage(db: Db, planId: string): Promise<CurriculumTopicWithUsage[]> {
  const [{ data: topics, error: topicsErr }, { data: lessons, error: lessonsErr }] = await Promise.all([
    (db as AnyDb).from("curriculum_plan_topics").select("*").eq("plan_id", planId).order("order_index"),
    (db as AnyDb)
      .from("lessons")
      .select("id, curriculum_topic_id, starts_at")
      .not("curriculum_topic_id", "is", null)
      .order("starts_at"),
  ]);
  if (topicsErr) throw topicsErr;
  if (lessonsErr) throw lessonsErr;

  const usageCount = new Map<string, number>();
  const firstLesson = new Map<string, { id: string; starts_at: string }>();
  for (const l of (lessons ?? []) as Array<{ id: string; curriculum_topic_id: string; starts_at: string }>) {
    usageCount.set(l.curriculum_topic_id, (usageCount.get(l.curriculum_topic_id) ?? 0) + 1);
    // Список уже отсортирован по времени — первым встреченным и будет самый
    // ранний, поэтому переписывать запись не нужно.
    if (!firstLesson.has(l.curriculum_topic_id)) {
      firstLesson.set(l.curriculum_topic_id, { id: l.id, starts_at: l.starts_at });
    }
  }

  return ((topics ?? []) as CurriculumPlanTopic[]).map((t) => ({
    ...t,
    used_in_lessons: usageCount.get(t.id) ?? 0,
    lesson_id: firstLesson.get(t.id)?.id ?? null,
    lesson_starts_at: firstLesson.get(t.id)?.starts_at ?? null,
  }));
}

/** Добавить свою тему в план — рядом с теми, что пришли из разбора файла.
 *
 *  ВСТАЁТ В КОНЕЦ. order_index = максимальный + 1. Так предсказуемее всего:
 *  учитель дописывает то, чего не хватило в файле, а это почти всегда
 *  продолжение, а не вставка в середину. Переставить её потом можно теми же
 *  стрелками, что и любую другую тему, — отдельного механизма вставки «куда
 *  укажу» не заводим, он дублировал бы уже работающую перестановку.
 *
 *  Нумерация не ломается: order_index у существующих тем не трогается вовсе,
 *  а номер в списке — это позиция при показе, а не хранимое поле. */
export async function createCurriculumPlanTopic(
  db: Db,
  input: { planId: string; title: string; description?: string | null; estimatedLessons?: number },
): Promise<CurriculumPlanTopic> {
  const { data: last, error: lastErr } = await (db as AnyDb)
    .from("curriculum_plan_topics")
    .select("order_index")
    .eq("plan_id", input.planId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) throw lastErr;

  const nextIndex = ((last as { order_index: number } | null)?.order_index ?? -1) + 1;

  const { data, error } = await (db as AnyDb)
    .from("curriculum_plan_topics")
    .insert({
      plan_id: input.planId,
      order_index: nextIndex,
      title: input.title,
      description: input.description ?? null,
      estimated_lessons: input.estimatedLessons ?? 1,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CurriculumPlanTopic;
}

/** Загружает файл плана в бакет curriculum-plans (миграция 116) — путь
 *  ${teacherId}/... как у materials/books (RLS-владение по папке). Не
 *  создаёт ничего в БД — только Storage; caller (createCurriculumPlan)
 *  пишет source_file_url отдельно. */
export async function uploadCurriculumPlanFile(
  db: Db,
  input: { teacherId: string; file: File },
): Promise<{ storagePath: string }> {
  const rawExt = input.file.name.includes(".") ? input.file.name.split(".").pop()! : "";
  const safeExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const id = crypto.randomUUID();
  const path = await mySchoolStoragePath(db, input.teacherId, safeExt ? `${id}.${safeExt}` : id);
  const { error } = await db.storage
    .from("curriculum-plans")
    .upload(path, input.file, { contentType: input.file.type || undefined });
  if (error) throw error;
  return { storagePath: path };
}

/** Создаёт план + все темы. Если по (group_id, subject_id) уже есть план —
 *  бросает (UNIQUE constraint) — caller должен явно вызвать
 *  replaceCurriculumPlan для замены (предупреждение "Заменить?" — Часть 4). */
export async function createCurriculumPlan(
  db: Db,
  input: {
    groupId: string;
    subjectId: string;
    teacherId: string;
    title: string;
    sourceFileUrl: string | null;
    sourceFileType: "pdf" | "docx" | null;
    topics: Array<{ title: string; description: string | null; estimatedLessons: number }>;
  },
): Promise<CurriculumPlan> {
  const plan = await (db as AnyDb)
    .from("curriculum_plans")
    .insert({
      group_id: input.groupId,
      subject_id: input.subjectId,
      teacher_id: input.teacherId,
      title: input.title,
      source_file_url: input.sourceFileUrl,
      source_file_type: input.sourceFileType,
    })
    .select("*")
    .single()
    .then(unwrap);

  if (input.topics.length > 0) {
    const { error: topicsErr } = await (db as AnyDb).from("curriculum_plan_topics").insert(
      input.topics.map((t, i) => ({
        plan_id: (plan as CurriculumPlan).id,
        order_index: i,
        title: t.title,
        description: t.description,
        estimated_lessons: t.estimatedLessons,
      })),
    );
    if (topicsErr) throw topicsErr;
  }

  return plan as CurriculumPlan;
}

/** "Заменить?" — удаляет существующий план (CASCADE снимает topics;
 *  lessons.curriculum_topic_id у уроков, ссылавшихся на удалённые темы,
 *  становится NULL через ON DELETE SET NULL — сами уроки НЕ удаляются и
 *  НЕ редактируются никаким другим полем), затем создаёт новый. */
export async function replaceCurriculumPlan(
  db: Db,
  existingPlanId: string,
  input: Parameters<typeof createCurriculumPlan>[1],
): Promise<CurriculumPlan> {
  const { error: delErr } = await (db as AnyDb).from("curriculum_plans").delete().eq("id", existingPlanId);
  if (delErr) throw delErr;
  return createCurriculumPlan(db, input);
}

export async function deleteCurriculumPlan(db: Db, planId: string): Promise<void> {
  const { error } = await (db as AnyDb).from("curriculum_plans").delete().eq("id", planId);
  if (error) throw error;
}

// ── Большой фикс, Блок 6, ЗАДАЧА 1 — фоновый парсинг (migration 160) ────────
// Загрузка больше не блокирует страницу на 10-30с: план создаётся СРАЗУ со
// status='processing', БЕЗ тем, учитель мгновенно попадает на его страницу.
// Реальный парсинг делает apps/web/app/api/curriculum-plans/[id]/
// background-parse/route.ts (отдельный serverless-вызов, fire-and-forget) —
// он и вызывает updateCurriculumPlanProgress/markCurriculumPlanReady/
// markCurriculumPlanError ниже.

/** Создаёт план БЕЗ тем, сразу в status='processing' — темы дописывает
 *  background-parse через markCurriculumPlanReady. Как и createCurriculumPlan,
 *  бросает при конфликте UNIQUE(group_id, subject_id) — caller должен явно
 *  вызвать replaceCurriculumPlanProcessing для замены. */
export async function createCurriculumPlanProcessing(
  db: Db,
  input: {
    groupId: string;
    subjectId: string;
    teacherId: string;
    title: string;
    sourceFileUrl: string;
    sourceFileType: "pdf" | "docx";
  },
): Promise<CurriculumPlan> {
  const plan = await (db as AnyDb)
    .from("curriculum_plans")
    .insert({
      group_id: input.groupId,
      subject_id: input.subjectId,
      teacher_id: input.teacherId,
      title: input.title,
      source_file_url: input.sourceFileUrl,
      source_file_type: input.sourceFileType,
      status: "processing",
      progress_percent: 10,
    })
    .select("*")
    .single()
    .then(unwrap);
  return plan as CurriculumPlan;
}

/** "Заменить?" под фоновый флоу — тот же delete-then-insert, что
 *  replaceCurriculumPlan, но создаёт processing-план без тем. */
export async function replaceCurriculumPlanProcessing(
  db: Db,
  existingPlanId: string,
  input: Parameters<typeof createCurriculumPlanProcessing>[1],
): Promise<CurriculumPlan> {
  const { error: delErr } = await (db as AnyDb).from("curriculum_plans").delete().eq("id", existingPlanId);
  if (delErr) throw delErr;
  return createCurriculumPlanProcessing(db, input);
}

/** Симулированный прогресс (10→30→60→90→100), пишется background-parse на
 *  каждой стадии — клиент подхватывает через Realtime (см. useRealtimeChannel
 *  в CurriculumPlanDetailView.tsx). */
export async function updateCurriculumPlanProgress(db: Db, planId: string, percent: number): Promise<void> {
  const { error } = await (db as AnyDb).from("curriculum_plans").update({ progress_percent: percent }).eq("id", planId);
  if (error) throw error;
}

/** Финальный шаг парсинга — дописывает темы и переводит план в status='ready'. */
export async function markCurriculumPlanReady(
  db: Db,
  planId: string,
  topics: Array<{ title: string; description: string | null; estimatedLessons: number }>,
): Promise<void> {
  if (topics.length > 0) {
    const { error: topicsErr } = await (db as AnyDb).from("curriculum_plan_topics").insert(
      topics.map((t, i) => ({
        plan_id: planId,
        order_index: i,
        title: t.title,
        description: t.description,
        estimated_lessons: t.estimatedLessons,
      })),
    );
    if (topicsErr) throw topicsErr;
  }
  const { error } = await (db as AnyDb)
    .from("curriculum_plans")
    .update({ status: "ready", progress_percent: 100 })
    .eq("id", planId);
  if (error) throw error;
}

export async function markCurriculumPlanError(db: Db, planId: string, message: string): Promise<void> {
  const { error } = await (db as AnyDb)
    .from("curriculum_plans")
    .update({ status: "error", error_message: message.slice(0, 2000) })
    .eq("id", planId);
  if (error) throw error;
}

/** "Попробовать снова" — сбрасывает план в status='processing' (без старых
 *  тем, если такие остались от предыдущей частично-успешной попытки не
 *  трогаем: markCurriculumPlanReady — единственное место, что пишет topics,
 *  а до него мы сюда не доходим при ошибке). Caller (retry-parse route)
 *  после этого заново триггерит background-parse. */
export async function resetCurriculumPlanForRetry(db: Db, planId: string): Promise<void> {
  const { error } = await (db as AnyDb)
    .from("curriculum_plans")
    .update({ status: "processing", progress_percent: 10, error_message: null })
    .eq("id", planId);
  if (error) throw error;
}

// ── Учебный план из книги (миграция 212) ────────────────────────────────────
//
// Разбирает книгу ТОТ ЖЕ background-parse, что разбирает файл плана: меняется
// только место, откуда берутся байты, и то, чем всё кончается — не 'ready', а
// 'preview' (темы предложены, учитель ещё не согласился). Второго разборщика
// не появилось.

/** Книги школы, годные как источник плана: только те, у которых есть файл.
 *  Внешняя ссылка (external_url) источником быть не может — файл нужно
 *  скачать и извлечь текст, а по чужой ссылке этого не сделать. */
export async function getBooksForPlanSource(
  db: Db,
  subjectSlug?: string | null,
): Promise<Array<{ id: string; title: string; author: string | null; subject: string | null; file_size_bytes: number | null }>> {
  let q = (db as AnyDb)
    .from("books")
    .select("id, title, author, subject, file_size_bytes")
    .not("file_storage_path", "is", null)
    .order("title");
  if (subjectSlug) q = q.eq("subject", subjectSlug);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; title: string; author: string | null; subject: string | null; file_size_bytes: number | null }>;
}

/** Создаёт план-заготовку из книги: сразу 'processing', тем ещё нет.
 *  Дальше его разбирает background-parse — см. шапку выше. */
export async function createCurriculumPlanFromBook(
  db: Db,
  input: { groupId: string; subjectId: string; teacherId: string; title: string; bookId: string },
): Promise<CurriculumPlan> {
  const plan = await (db as AnyDb)
    .from("curriculum_plans")
    .insert({
      group_id: input.groupId,
      subject_id: input.subjectId,
      teacher_id: input.teacherId,
      title: input.title,
      source_book_id: input.bookId,
      status: "processing",
      progress_percent: 5,
      progress_stage: "queued",
    })
    .select("*")
    .single()
    .then(unwrap);
  return plan as CurriculumPlan;
}

/** «Заменить?» под книжный источник — тот же delete-then-insert. */
export async function replaceCurriculumPlanFromBook(
  db: Db,
  existingPlanId: string,
  input: Parameters<typeof createCurriculumPlanFromBook>[1],
): Promise<CurriculumPlan> {
  const { error } = await (db as AnyDb).from("curriculum_plans").delete().eq("id", existingPlanId);
  if (error) throw error;
  return createCurriculumPlanFromBook(db, input);
}

/** Чем сервер занят прямо сейчас. Пишется на каждом настоящем шаге разбора —
 *  в отличие от процентов, которые расставлены по коду приметами. */
export async function updateCurriculumPlanStage(
  db: Db,
  planId: string,
  stage: "queued" | "download" | "extract" | "outline" | "model" | "save",
  percent: number,
): Promise<void> {
  const { error } = await (db as AnyDb)
    .from("curriculum_plans")
    .update({ progress_stage: stage, progress_percent: percent })
    .eq("id", planId);
  if (error) throw error;
}

/** Темы разобраны и предложены учителю. План ещё НЕ рабочий: пока он в
 *  'preview', уроки по нему не создают. */
export async function markCurriculumPlanPreview(
  db: Db,
  planId: string,
  topics: Array<{ title: string; description: string | null; estimatedLessons: number }>,
): Promise<void> {
  if (topics.length > 0) {
    const { error: topicsErr } = await (db as AnyDb).from("curriculum_plan_topics").insert(
      topics.map((t, i) => ({
        plan_id: planId,
        order_index: i,
        title: t.title,
        description: t.description,
        estimated_lessons: t.estimatedLessons,
      })),
    );
    if (topicsErr) throw topicsErr;
  }
  const { error } = await (db as AnyDb)
    .from("curriculum_plans")
    .update({ status: "preview", progress_percent: 100, progress_stage: null })
    .eq("id", planId);
  if (error) throw error;
}

/** Учитель согласился — план становится обычным. Темы к этому моменту уже
 *  им поправлены теми же кнопками, что и у любого другого плана. */
export async function confirmCurriculumPlan(db: Db, planId: string): Promise<void> {
  const { error } = await (db as AnyDb)
    .from("curriculum_plans")
    .update({ status: "ready", progress_percent: 100, progress_stage: null })
    .eq("id", planId);
  if (error) throw error;
}
