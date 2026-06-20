import { createClient } from "@/lib/supabase/server";
import { getMyStudent, getProjectDetailForStudent } from "@snr/core";
import { notFound } from "next/navigation";
import { ProjectDetailView } from "./ProjectDetailView";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const student = await Promise.resolve(getMyStudent(db)).catch(() => null);
  if (!student) notFound();
  const detail = await getProjectDetailForStudent(db, id, (student as { id: string }).id).catch(() => null);
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
