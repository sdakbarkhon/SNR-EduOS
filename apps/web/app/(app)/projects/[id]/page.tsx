import { createClient } from "@/lib/supabase/server";
import { getProjectDetailForStudent } from "@snr/core";
import { getMyStudent } from "@/lib/cached-queries";
import { notFound } from "next/navigation";
import { ProjectDetailView } from "./ProjectDetailView";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  // Промт 6: ни getMyStudent, ни getProjectDetailForStudent больше не
  // глушатся — сбой раньше вёл к notFound(), неотличимо от "правда нет".
  const student = await getMyStudent(db);
  const detail = await getProjectDetailForStudent(db, id, student.id);
  if (!detail) notFound();
  return (
    <ProjectDetailView
      studentId={(student as { id: string }).id}
      project={detail.project as never}
      initialSubmission={detail.submission}
      initialProgress={detail.progress}
      initialAttachments={detail.attachments}
    />
  );
}
