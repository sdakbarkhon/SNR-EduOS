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

  // Только группы, где этот учитель — куратор (groups.teacher_id), не
  // co-teacher/subject-teacher — та же граница, что RLS can_manage_curriculum_plan.
  const groups = (groupsRaw as unknown as Array<{ id: string; name: string; teacher_id: string | null }>)
    .filter((g) => g.teacher_id === teacher.id);

  const groupIds = groups.map((g) => g.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subjectsRaw, error: subjectsErr } = groupIds.length > 0
    ? await (db as any).from("subjects").select("id, name, group_id").in("group_id", groupIds).order("name")
    : { data: [], error: null };
  if (subjectsErr) console.error("[TeacherCurriculumPage.subjects] failed:", subjectsErr.message);

  return (
    <CurriculumPlansView
      plans={plans}
      groups={groups.map((g) => ({ id: g.id, name: g.name }))}
      subjects={(subjectsRaw ?? []) as Array<{ id: string; name: string; group_id: string }>}
      teacherId={teacher.id}
    />
  );
}
