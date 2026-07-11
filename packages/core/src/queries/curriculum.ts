// Промт 4 — учебные планы (migration 116). Существующие уроки эти функции
// никогда не изменяют: lessons.curriculum_topic_id пишется только при
// СОЗДАНИИ нового урока (см. createLesson в index.ts), не при редактировании.

import type { Db } from "../supabase/factory";
import type { CurriculumPlan, CurriculumPlanTopic, CurriculumPlanWithTopics, CurriculumTopicWithUsage } from "../types";
import { unwrap } from "./helpers";

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

/** Темы плана + сколько НОВЫХ уроков (curriculum_topic_id) уже используют
 *  каждую — для лейбла "использована в N уроках" в селекторе формы урока. */
export async function getCurriculumTopicsWithUsage(db: Db, planId: string): Promise<CurriculumTopicWithUsage[]> {
  const [{ data: topics, error: topicsErr }, { data: lessons, error: lessonsErr }] = await Promise.all([
    (db as AnyDb).from("curriculum_plan_topics").select("*").eq("plan_id", planId).order("order_index"),
    (db as AnyDb).from("lessons").select("curriculum_topic_id").not("curriculum_topic_id", "is", null),
  ]);
  if (topicsErr) throw topicsErr;
  if (lessonsErr) throw lessonsErr;
  const usageCount = new Map<string, number>();
  for (const l of (lessons ?? []) as Array<{ curriculum_topic_id: string }>) {
    usageCount.set(l.curriculum_topic_id, (usageCount.get(l.curriculum_topic_id) ?? 0) + 1);
  }
  return ((topics ?? []) as CurriculumPlanTopic[]).map((t) => ({ ...t, used_in_lessons: usageCount.get(t.id) ?? 0 }));
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
  const path = safeExt
    ? `${input.teacherId}/${crypto.randomUUID()}.${safeExt}`
    : `${input.teacherId}/${crypto.randomUUID()}`;
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
