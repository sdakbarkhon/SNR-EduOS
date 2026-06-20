import { createClient } from "@/lib/supabase/server";
import { getMyTeacher, getTeacherProjects, getTeacherGroups } from "@snr/core";
import { TeacherProjectsView } from "./TeacherProjectsView";

export default async function TeacherProjectsPage() {
  const db = await createClient();
  const [teacher, projects, groupsRaw] = await Promise.all([
    Promise.resolve(getMyTeacher(db)).catch(() => null),
    getTeacherProjects(db).catch(() => []),
    Promise.resolve(getTeacherGroups(db)).catch(() => []),
  ]);
  const groups = ((groupsRaw ?? []) as Array<{ id: string; name: string; subject: string }>).map((g) => ({
    id: g.id, name: g.name, subject: g.subject,
  }));
  return <TeacherProjectsView teacherId={(teacher as { id?: string } | null)?.id ?? ""} projects={projects} groups={groups} />;
}
