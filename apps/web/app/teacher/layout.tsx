import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getMyTeacher, getTeacherGroups, getSubjectConfig } from "@snr/core";
import { TeacherShell } from "@/components/TeacherShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const role = await getCurrentUserRole(supabase, user.id);
  if (role !== "teacher") redirect("/login");

  let teacherName = "";
  let avatarUrl: string | null = null;
  let teacherSubtitle = "";
  try {
    const teacher = await getMyTeacher(supabase);
    teacherName = teacher.full_name ?? "";
    avatarUrl = teacher.avatar_url ?? null;
  } catch (e) {
    console.error("[TeacherLayout] getMyTeacher failed:", e);
  }
  try {
    const groups = (await getTeacherGroups(supabase)) as Array<{ subject: string }>;
    const subjects = Array.from(new Set(groups.map((g) => getSubjectConfig(g.subject).label)));
    teacherSubtitle = subjects.length <= 2
      ? subjects.join(" · ")
      : `${subjects.slice(0, 2).join(" · ")} · ещё ${subjects.length - 2}`;
  } catch (e) {
    console.error("[TeacherLayout] getTeacherGroups failed:", e);
  }

  return (
    <TeacherShell teacherName={teacherName} teacherSubtitle={teacherSubtitle} avatarUrl={avatarUrl}>
      {children}
    </TeacherShell>
  );
}
