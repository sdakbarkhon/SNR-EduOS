import { createClient } from "@/lib/supabase/server";
import { getProjectWithStages, getProjectSubmissions, getGroupStudents } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { notFound } from "next/navigation";
import { TeacherProjectDetailView } from "./TeacherProjectDetailView";

export default async function TeacherProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const project = await getProjectWithStages(db, id).catch(() => null);
  if (!project) notFound();
  const [teacher, submissions, students] = await Promise.all([
    Promise.resolve(getMyTeacher(db)).catch(() => null),
    getProjectSubmissions(db, id).catch(() => []),
    Promise.resolve(getGroupStudents(db, project.group_id)).catch(() => []),
  ]);
  return (
    <TeacherProjectDetailView
      project={project as never}
      teacherId={(teacher as { id?: string } | null)?.id ?? ""}
      submissions={submissions as never[]}
      students={students as never[]}
    />
  );
}
