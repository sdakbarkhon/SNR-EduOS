import { createClient } from "@/lib/supabase/server";
import { getProjectWithStages, getProjectSubmissions, getGroupStudents } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { notFound } from "next/navigation";
import { safeQuery } from "@/lib/safe-query";
import { TeacherProjectDetailView } from "./TeacherProjectDetailView";

export default async function TeacherProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  // Промт 6: getProjectWithStages больше не глушится — сбой раньше вёл к
  // notFound(), неотличимо от "проекта правда нет".
  const project = await getProjectWithStages(db, id);
  if (!project) notFound();
  const [teacherRes, submissionsRes, studentsRes] = await Promise.all([
    safeQuery(Promise.resolve(getMyTeacher(db)), null, "TeacherProjectDetailPage.teacher"),
    safeQuery(getProjectSubmissions(db, id), [], "TeacherProjectDetailPage.submissions"),
    safeQuery(Promise.resolve(getGroupStudents(db, project.group_id)), [], "TeacherProjectDetailPage.students"),
  ]);
  return (
    <TeacherProjectDetailView
      project={project as never}
      teacherId={(teacherRes.data as { id?: string } | null)?.id ?? ""}
      submissions={submissionsRes.data as never[]}
      students={studentsRes.data as never[]}
    />
  );
}
