import { createClient } from "@/lib/supabase/server";
import { getStudentLessonView, getLessonMaterialUrl, getHomeworkByLessonId, isDemoSchoolLesson } from "@snr/core";
import { getMyStudent } from "@/lib/cached-queries";
import { notFound } from "next/navigation";
import { safeQuery } from "@/lib/safe-query";
import { ensureMorningCycleRan } from "@/lib/ensureMorningCycleRan";
import { LessonView } from "./LessonView";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createClient();

  // Фолбэк утреннего цикла (закрыть 1-й урок дня / стартануть 2-й) — на
  // случай, если Vercel Cron /api/cron/morning-lesson-cycle не отработал.
  // Тихо игнорируем ошибки: страница урока не должна падать из-за фолбэка.
  try { await ensureMorningCycleRan(); } catch { /* noop */ }

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
      // Пачка 4 — видео-ссылка (youtube/rutube) не в Storage
      // (file_storage_path=null), getLessonMaterialUrl упал бы на ней;
      // embed-URL уже готов на записи.
      if (m.content_type === "video_youtube" || m.content_type === "video_rutube") {
        if (m.external_url) materialUrls[m.id] = m.external_url;
        return;
      }
      // K.1, 05.08.2026 — video_mp4 живёт в Storage (file_storage_path),
      // но в отдельном бакете lesson-videos, не lesson-materials/kb_bucket.
      const bucket = m.content_type === "video_mp4" ? "lesson-videos" : (m.kb_bucket ?? "lesson-materials");
      try {
        materialUrls[m.id] = await getLessonMaterialUrl(db, m.file_storage_path!, undefined, bucket);
      } catch { /* skip if URL generation fails */ }
    }),
  );

  // Only relevant once the lesson has ended — the completed-review screen
  // links straight to any homework created from this lesson.
  const linkedHomework = lesson.status === "completed"
    ? (await safeQuery(getHomeworkByLessonId(db, id), [], "LessonPage.linkedHomework")).data
    : [];

  // schools.is_demo — решает, оставить ли ученику контролы у видео, которое
  // показывает учитель (в демо-школе паузить можно локально, в реальной —
  // только смотреть). Хелпер глотает ошибку и отдаёт false, то есть при сбое
  // применяются правила реальной школы — отказ в безопасную сторону.
  const isDemoSchool = await isDemoSchoolLesson(db, id);

  return (
    <LessonView
      lesson={lesson}
      materialUrls={materialUrls}
      studentId={student?.id ?? null}
      linkedHomework={linkedHomework}
      isDemoSchool={isDemoSchool}
    />
  );
}
