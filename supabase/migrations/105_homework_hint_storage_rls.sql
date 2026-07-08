-- =====================================================================
-- Migration 105 — БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 8: RLS для чтения подсказки
-- ученику. uploadHomeworkHint пишет в homework-files по пути
-- <teacherId>/<homeworkId>/hint/<file> — существующая политика
-- "student reads homework attachment" матчит ТОЛЬКО 3-й сегмент
-- 'attachment', поэтому подсказка (сегмент 'hint') была не видна
-- студенту (createSignedUrl отдавал 404 Object not found — RLS,
-- не отсутствие файла). Зеркальная политика, тот же паттерн.
-- =====================================================================

CREATE POLICY "student reads homework hint" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'homework-files'
  AND (storage.foldername(name))[3] = 'hint'
  AND EXISTS (
    SELECT 1
    FROM public.homework h
    JOIN public.student_groups sg ON sg.group_id = h.group_id
    WHERE h.teacher_id::text = (storage.foldername(objects.name))[1]
      AND h.id::text = (storage.foldername(objects.name))[2]
      AND sg.student_id = current_student_id()
  )
);
