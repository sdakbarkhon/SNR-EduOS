import { createClient } from "@/lib/supabase/server";
import { getCurriculumPlansForTeacher, getTeacherGroups } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { redirect } from "next/navigation";
import { CurriculumPlansView } from "./CurriculumPlansView";

export default async function TeacherCurriculumPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  const teacher = await getMyTeacher(db).catch(() => null);
  if (!teacher) redirect("/login");

  const [plans, groupsRaw] = await Promise.all([
    getCurriculumPlansForTeacher(db, teacher.id).catch(() => []),
    Promise.resolve(getTeacherGroups(db)).catch(() => []),
  ]);

  // Только группы, где этот учитель — куратор (groups.teacher_id), не
  // co-teacher/subject-teacher — та же граница, что RLS can_manage_curriculum_plan.
  const groups = (groupsRaw as unknown as Array<{ id: string; name: string; teacher_id: string | null }>)
    .filter((g) => g.teacher_id === teacher.id);

  const groupIds = groups.map((g) => g.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subjectsRaw } = groupIds.length > 0
    ? await (db as any).from("subjects").select("id, name, group_id").in("group_id", groupIds).order("name")
    : { data: [] };

  return (
    <CurriculumPlansView
      plans={plans}
      groups={groups.map((g) => ({ id: g.id, name: g.name }))}
      subjects={(subjectsRaw ?? []) as Array<{ id: string; name: string; group_id: string }>}
      teacherId={teacher.id}
    />
  );
}
