import { createClient } from "@/lib/supabase/server";
import { getMyStudent, getStudentProjects } from "@snr/core";
import { ProjectsView } from "./ProjectsView";

export default async function ProjectsPage() {
  const db = await createClient();
  const student = await Promise.resolve(getMyStudent(db)).catch(() => null);
  const projects = student ? await getStudentProjects(db, (student as { id: string }).id).catch(() => []) : [];
  return <ProjectsView projects={projects} />;
}
