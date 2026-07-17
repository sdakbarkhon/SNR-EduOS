import { createClient } from "@/lib/supabase/server";
import { getStudentLessonView, getLessonMaterialUrl, getHomeworkByLessonId } from "@snr/core";
import { getMyStudent } from "@/lib/cached-queries";
import { notFound } from "next/navigation";
import { safeQuery } from "@/lib/safe-query";
import { LessonView } from "./LessonView";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createClient();

  // Промт 6: getStudentLessonView(id) раньше глушилось .catch(() => null) —
  // РЕАЛЬНЫЙ сбой запроса (throw) и "урока правда нет" оба вели на
  // notFound(), т.е. настоящую ошибку показывали как 404 "не найдено" —
  // хуже, чем просто пустое состояние (ученик решил бы, что ссылка
  // битая). Не глушим здесь: если getStudentLessonView бросает — пусть
  // бросает дальше (Next покажет страницу ошибки), notFound() остаётся
  // только для случая "функция вернула null" (урок действительно не найден
  // / RLS не пускает).
  const [lesson, studentRes] = await Promise.all([
    getStudentLessonView(db, id),
    safeQuery(Promise.resolve(getMyStudent(db)), null, "LessonPage.student"),
  ]);
  const student = studentRes.data;
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
      // Пачка 4 — видео-материал не в Storage (file_storage_path=null),
      // getLessonMaterialUrl упал бы на нём; embed-URL уже готов на записи.
      if (m.content_type !== "file") {
        if (m.external_url) materialUrls[m.id] = m.external_url;
        return;
      }
      try {
        materialUrls[m.id] = await getLessonMaterialUrl(db, m.file_storage_path!, undefined, m.kb_bucket ?? "lesson-materials");
      } catch { /* skip if URL generation fails */ }
    }),
  );

  // Only relevant once the lesson has ended — the completed-review screen
  // links straight to any homework created from this lesson.
  const linkedHomework = lesson.status === "completed"
    ? (await safeQuery(getHomeworkByLessonId(db, id), [], "LessonPage.linkedHomework")).data
    : [];

  return (
    <LessonView
      lesson={lesson}
      materialUrls={materialUrls}
      studentId={student?.id ?? null}
      linkedHomework={linkedHomework}
    />
  );
}
