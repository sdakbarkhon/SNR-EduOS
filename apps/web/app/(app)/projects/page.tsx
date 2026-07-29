import { getStudentProjects } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent, getMyGroups } from "@/lib/cached-queries";
import { ProjectsView } from "./ProjectsView";

export default async function ProjectsPage() {
  const db = await createClient();
  const [student, groups] = await Promise.all([getMyStudent(db), getMyGroups(db)]);
  const projects = await getStudentProjects(db, student.id);
  return <ProjectsView projects={projects} className={groups[0]?.name ?? ""} />;
}
