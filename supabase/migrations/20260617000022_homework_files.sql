-- =====================================================================
-- Migration 22: homework file attachments via 'homework-files' bucket
-- Teacher attachment: <teacher_id>/<homework_id>/attachment/<filename>
-- Student submission: <teacher_id>/<homework_id>/submissions/<student_id>/<filename>
-- =====================================================================

-- 1. Extend homework table (teacher's single optional attachment)
ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS attachment_storage_path text,
  ADD COLUMN IF NOT EXISTS attachment_size_bytes   bigint,
  ADD COLUMN IF NOT EXISTS attachment_filename     text;

-- 2. Extend homework_submissions (student's single file per submission)
ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS file_storage_path  text,
  ADD COLUMN IF NOT EXISTS file_size_bytes    bigint,
  ADD COLUMN IF NOT EXISTS file_original_name text;

-- 3. Storage bucket: private, 50 MB per file
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('homework-files', 'homework-files', false, 52428800)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = excluded.file_size_limit;

-- 4. Storage RLS (idempotent)
DROP POLICY IF EXISTS "teacher rw homework-files"               ON storage.objects;
DROP POLICY IF EXISTS "student reads homework attachment"        ON storage.objects;
DROP POLICY IF EXISTS "student rw own homework submission files" ON storage.objects;

-- Teacher: full access to own folder (<teacher_id>/...)
CREATE POLICY "teacher rw homework-files"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = (public.current_teacher_id())::text
  )
  WITH CHECK (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = (public.current_teacher_id())::text
  );

-- Student: read teacher attachment for homework they are assigned to
-- Path: <teacher_id>/<homework_id>/attachment/<filename>
CREATE POLICY "student reads homework attachment"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[3] = 'attachment'
    AND EXISTS (
      SELECT 1 FROM public.homework h
      JOIN public.student_groups sg ON sg.group_id = h.group_id
      WHERE h.teacher_id::text = (storage.foldername(name))[1]
        AND h.id::text         = (storage.foldername(name))[2]
        AND sg.student_id      = public.current_student_id()
    )
  );

-- Student: read/write/delete own submission files inside homework-files
-- Path: <teacher_id>/<homework_id>/submissions/<student_id>/<filename>
CREATE POLICY "student rw own homework submission files"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[3] = 'submissions'
    AND (storage.foldername(name))[4] = (public.current_student_id())::text
    AND EXISTS (
      SELECT 1 FROM public.homework h
      JOIN public.student_groups sg ON sg.group_id = h.group_id
      WHERE h.teacher_id::text = (storage.foldername(name))[1]
        AND h.id::text         = (storage.foldername(name))[2]
        AND sg.student_id      = public.current_student_id()
    )
  )
  WITH CHECK (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[3] = 'submissions'
    AND (storage.foldername(name))[4] = (public.current_student_id())::text
    AND EXISTS (
      SELECT 1 FROM public.homework h
      JOIN public.student_groups sg ON sg.group_id = h.group_id
      WHERE h.teacher_id::text = (storage.foldername(name))[1]
        AND h.id::text         = (storage.foldername(name))[2]
        AND sg.student_id      = public.current_student_id()
    )
  );
