import { createClient } from "@/lib/supabase/server";
import { getTeacherProjects, getTeacherGroups } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { safeQuery } from "@/lib/safe-query";
import { TeacherProjectsView } from "./TeacherProjectsView";

export default async function TeacherProjectsPage() {
  const db = await createClient();
  const [teacherRes, projectsRes, groupsRes] = await Promise.all([
    safeQuery(Promise.resolve(getMyTeacher(db)), null, "TeacherProjectsPage.teacher"),
    safeQuery(getTeacherProjects(db), [], "TeacherProjectsPage.projects"),
    safeQuery(Promise.resolve(getTeacherGroups(db)), [], "TeacherProjectsPage.groups"),
  ]);
  const groups = ((groupsRes.data ?? []) as Array<{ id: string; name: string; subject: string }>).map((g) => ({
    id: g.id, name: g.name, subject: g.subject,
  }));
  return <TeacherProjectsView teacherId={(teacherRes.data as { id?: string } | null)?.id ?? ""} projects={projectsRes.data} groups={groups} />;
}
