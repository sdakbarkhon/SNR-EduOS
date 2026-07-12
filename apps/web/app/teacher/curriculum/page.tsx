import { createClient } from "@/lib/supabase/server";
import { getCurriculumPlansForTeacher, getTeacherGroups } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { redirect } from "next/navigation";
import { safeQuery } from "@/lib/safe-query";
import { CurriculumPlansView } from "./CurriculumPlansView";

export default async function TeacherCurriculumPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  const teacher = (await safeQuery(getMyTeacher(db), null, "TeacherCurriculumPage.teacher")).data;
  if (!teacher) redirect("/login");

  const [plansRes, groupsRes] = await Promise.all([
    safeQuery(getCurriculumPlansForTeacher(db, teacher.id), [], "TeacherCurriculumPage.plans"),
    safeQuery(Promise.resolve(getTeacherGroups(db)), [], "TeacherCurriculumPage.groups"),
  ]);
  const plans = plansRes.data;
  const groupsRaw = groupsRes.data;

  // Промт: раньше группы фильтровались по groups.teacher_id ("куратор
  // группы") — до миграции 109 это было корректно (1 куратор = все уроки
  // группы), но 109 перешла на модель "1 предмет = 1 учитель"
  // (subjects.teacher_id) и оставила groups.teacher_id указывать только на
  // teacher_karim (куратора-исключения) для всех 3 групп. Итог: все
  // остальные 4 реальных учителя получали здесь пустой список групп и не
  // могли выбрать группу при создании плана. getTeacherGroups уже
  // RLS-ограничен group_teachers (все свои группы, миграция 109) —
  // передаём их как есть; owner-проверка теперь на уровне ПРЕДМЕТА
  // (subjects.teacher_id), не группы — см. фильтр subjects ниже и RLS
  // can_manage_curriculum_plan (миграция 120).
  const groups = groupsRaw as unknown as Array<{ id: string; name: string; teacher_id: string | null }>;

  const groupIds = groups.map((g) => g.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subjectsRaw, error: subjectsErr } = groupIds.length > 0
    ? await (db as any).from("subjects").select("id, name, group_id, teacher_id").in("group_id", groupIds).order("name")
    : { data: [], error: null };
  if (subjectsErr) console.error("[TeacherCurriculumPage.subjects] failed:", subjectsErr.message);

  // Куратор (subject_slug=NULL, напр. teacher_karim) планирует по всем
  // предметам своих групп; предметный учитель — только по своему предмету
  // (subjects.teacher_id), как и в расписании/уроках (getTeacherLessons*).
  const isCurator = !teacher.subject_slug;
  const subjects = (
    (subjectsRaw ?? []) as Array<{ id: string; name: string; group_id: string; teacher_id: string | null }>
  ).filter((s) => isCurator || s.teacher_id === teacher.id);

  return (
    <CurriculumPlansView
      plans={plans}
      groups={groups.map((g) => ({ id: g.id, name: g.name }))}
      subjects={subjects.map((s) => ({ id: s.id, name: s.name, group_id: s.group_id }))}
      teacherId={teacher.id}
    />
  );
}
