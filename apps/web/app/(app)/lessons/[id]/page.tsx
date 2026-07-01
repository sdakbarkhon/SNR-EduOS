import { createClient } from "@/lib/supabase/server";
import { getStudentLessonView, getLessonMaterialUrl, getMyStudent } from "@snr/core";
import { notFound } from "next/navigation";
import { LessonView } from "./LessonView";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createClient();

  const [lesson, student] = await Promise.all([
    getStudentLessonView(db, id).catch(() => null),
    Promise.resolve(getMyStudent(db)).catch(() => null),
  ]);
  if (!lesson) notFound();

  // Pre-generate signed URLs for all lesson materials. No `downloadAs` here —
  // these are used for inline viewing (iframe/img/video in the demo overlay
  // and MaterialViewerModal); passing a filename forces
  // Content-Disposition: attachment on the signed URL, which makes browsers
  // download the file instead of rendering it (white screen for PDFs). The
  // explicit "Download" link in MaterialViewerModal uses the HTML5 `download`
  // attribute instead, so it doesn't need a forced-attachment URL.
  const materialUrls: Record<string, string> = {};
  await Promise.all(
    lesson.materials.map(async (m) => {
      try {
        materialUrls[m.id] = await getLessonMaterialUrl(db, m.file_storage_path);
      } catch { /* skip if URL generation fails */ }
    }),
  );

  return <LessonView lesson={lesson} materialUrls={materialUrls} studentId={student?.id ?? null} />;
}
