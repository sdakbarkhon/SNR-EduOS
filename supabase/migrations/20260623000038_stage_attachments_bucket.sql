-- Migration 38: storage bucket for lesson-stage attachments (Prompt 5).
-- Used by external-service stages (scratch/tinkercad/app_inventor/code_monkey)
-- to store student result screenshots.
--
-- Path convention: <student_id>/<stage_id>/<timestamp>.<ext>
--   foldername[1] = student_id  → student RLS (owns their files)
--   foldername[2] = stage_id    → teacher RLS (join lesson_stages → lessons → group)

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('stage-attachments', 'stage-attachments', false, 10485760)  -- 10 MB
ON CONFLICT (id) DO UPDATE SET file_size_limit = excluded.file_size_limit;

DROP POLICY IF EXISTS "student reads own stage attachments"   ON storage.objects;
DROP POLICY IF EXISTS "student inserts own stage attachments" ON storage.objects;
DROP POLICY IF EXISTS "student deletes own stage attachments" ON storage.objects;
DROP POLICY IF EXISTS "teacher reads group stage attachments" ON storage.objects;

CREATE POLICY "student reads own stage attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stage-attachments'
    AND (storage.foldername(name))[1] = (public.current_student_id())::text);

CREATE POLICY "student inserts own stage attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stage-attachments'
    AND (storage.foldername(name))[1] = (public.current_student_id())::text);

CREATE POLICY "student deletes own stage attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'stage-attachments'
    AND (storage.foldername(name))[1] = (public.current_student_id())::text);

CREATE POLICY "teacher reads group stage attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stage-attachments'
    AND EXISTS (
      SELECT 1
      FROM public.lesson_stages ls
      JOIN public.lessons l ON l.id = ls.lesson_id
      WHERE ls.id::text = (storage.foldername(name))[2]
        AND public.is_my_teacher_group(l.group_id)
    ));
