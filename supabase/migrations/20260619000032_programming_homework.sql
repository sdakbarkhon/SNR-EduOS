-- ====================================================================
-- Migration 32: Programming homework type (visual scaffold; no execution)
-- ====================================================================

-- 1. content_type is an enum (migration 17) → add the 'programming' value.
--    (Not used within this migration, so safe inside the txn on PG12+.)
ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'programming';

-- 2. Programming fields on homework
ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS programming_language        text
    CHECK (programming_language IN ('python', 'cpp')),
  ADD COLUMN IF NOT EXISTS starter_code                text,
  ADD COLUMN IF NOT EXISTS expected_output             text,
  ADD COLUMN IF NOT EXISTS tests_attachment_path       text,
  ADD COLUMN IF NOT EXISTS tests_attachment_filename   text,
  ADD COLUMN IF NOT EXISTS tests_attachment_size_bytes bigint;

-- 3. Student code on submissions
ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS code_text text;

-- 4. Storage bucket for the teacher's test files (private, 10 MB)
--    Path convention: homework-tests/<teacher_id>/<homework_id>/tests/<filename>
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('homework-tests', 'homework-tests', false, 10485760)
ON CONFLICT (id) DO UPDATE SET file_size_limit = excluded.file_size_limit;

DROP POLICY IF EXISTS "read homework-tests bucket"   ON storage.objects;
DROP POLICY IF EXISTS "teacher writes homework-tests" ON storage.objects;
DROP POLICY IF EXISTS "teacher updates homework-tests" ON storage.objects;
DROP POLICY IF EXISTS "teacher deletes homework-tests" ON storage.objects;

-- SELECT: the owning teacher, or a student in the homework's group
CREATE POLICY "read homework-tests bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework-tests'
    AND (
      (storage.foldername(name))[1] = (public.current_teacher_id())::text
      OR EXISTS (
        SELECT 1 FROM public.homework h
        WHERE h.id::text = (storage.foldername(name))[2]
          AND public.is_my_group(h.group_id)
      )
    )
  );

CREATE POLICY "teacher writes homework-tests"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'homework-tests'
    AND (storage.foldername(name))[1] = (public.current_teacher_id())::text
  );

CREATE POLICY "teacher updates homework-tests"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'homework-tests'
    AND (storage.foldername(name))[1] = (public.current_teacher_id())::text
  );

CREATE POLICY "teacher deletes homework-tests"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'homework-tests'
    AND (storage.foldername(name))[1] = (public.current_teacher_id())::text
  );
