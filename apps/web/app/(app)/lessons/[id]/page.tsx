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

  // Pre-generate signed URLs for all lesson materials
  const materialUrls: Record<string, string> = {};
  await Promise.all(
    lesson.materials.map(async (m) => {
      try {
        materialUrls[m.id] = await getLessonMaterialUrl(
          db,
          m.file_storage_path,
          m.file_original_name ?? m.title,
        );
      } catch { /* skip if URL generation fails */ }
    }),
  );

  return <LessonView lesson={lesson} materialUrls={materialUrls} studentId={student?.id ?? null} />;
}
