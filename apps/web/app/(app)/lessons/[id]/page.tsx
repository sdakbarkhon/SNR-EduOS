import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLessonById, getMaterialDownloadUrl } from "@snr/core";
import { LessonView } from "./LessonView";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createClient();
  const lesson = await getLessonById(db, id).catch(() => null);
  if (!lesson) notFound();

  const materialUrls: Record<string, string> = {};
  for (const m of lesson.materials) {
    if (m.storage_path) {
      try {
        materialUrls[m.id] = await getMaterialDownloadUrl(db, m.storage_path, m.title);
      } catch {
        // material file missing or inaccessible — skip silently
      }
    } else if (m.file_url) {
      materialUrls[m.id] = m.file_url;
    } else if (m.link_url) {
      materialUrls[m.id] = m.link_url;
    }
  }

  return <LessonView lesson={lesson} materialUrls={materialUrls} />;
}
