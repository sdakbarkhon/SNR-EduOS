-- =====================================================================
-- Migration 24 — Lesson Module
-- · lessons.title + lessons.description (teacher editable)
-- · lesson_materials  (per-lesson file attachments)
-- · lesson_stages     (teacher-controlled 6-stage progress)
-- · Storage bucket "lesson-materials"
-- · RLS + GRANTs
-- =====================================================================

-- ── 1. Extend lessons ──────────────────────────────────────────────────
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS title       text,
  ADD COLUMN IF NOT EXISTS description text;

-- ── 2. lesson_materials ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lesson_materials (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id          uuid        NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  title              text        NOT NULL,
  file_storage_path  text        NOT NULL,
  file_size_bytes    bigint,
  file_original_name text,
  uploaded_by        uuid        REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lesson_materials_lesson_id_idx ON public.lesson_materials (lesson_id);

-- ── 3. lesson_stages ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lesson_stages (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id      uuid        NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  stage_key      text        NOT NULL
    CHECK (stage_key IN ('goal','theory','practice','classwork','review','summary')),
  order_index    int         NOT NULL CHECK (order_index BETWEEN 1 AND 6),
  is_completed   boolean     NOT NULL DEFAULT false,
  teacher_notes  text,
  completed_at   timestamptz,
  UNIQUE (lesson_id, stage_key)
);
CREATE INDEX IF NOT EXISTS lesson_stages_lesson_id_idx ON public.lesson_stages (lesson_id);

-- ── 4. Storage bucket ──────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('lesson-materials', 'lesson-materials', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- ── 5. RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.lesson_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_stages    ENABLE ROW LEVEL SECURITY;

-- lesson_materials: read — student in group OR teacher of group
CREATE POLICY "lesson_materials: read"
  ON public.lesson_materials FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_id AND public.is_my_group(l.group_id))
    OR
    EXISTS (SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id))
  );

-- lesson_materials: insert — teacher of the lesson's group
CREATE POLICY "lesson_materials: insert"
  ON public.lesson_materials FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = public.current_teacher_id()
    AND EXISTS (SELECT 1 FROM public.lessons l
                WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id))
  );

-- lesson_materials: update/delete — only the uploader
CREATE POLICY "lesson_materials: update"
  ON public.lesson_materials FOR UPDATE TO authenticated
  USING (uploaded_by = public.current_teacher_id());

CREATE POLICY "lesson_materials: delete"
  ON public.lesson_materials FOR DELETE TO authenticated
  USING (uploaded_by = public.current_teacher_id());

-- lesson_stages: read — student in group OR teacher of group
CREATE POLICY "lesson_stages: read"
  ON public.lesson_stages FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_id AND public.is_my_group(l.group_id))
    OR
    EXISTS (SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id))
  );

-- lesson_stages: insert/update/delete — teacher of the lesson's group
CREATE POLICY "lesson_stages: insert"
  ON public.lesson_stages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id))
  );

CREATE POLICY "lesson_stages: update"
  ON public.lesson_stages FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id))
  );

CREATE POLICY "lesson_stages: delete"
  ON public.lesson_stages FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.lessons l
            WHERE l.id = lesson_id AND public.is_my_teacher_group(l.group_id))
  );

-- lessons: teacher may update title/description of own group's lesson
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lessons' AND policyname = 'teacher updates own group lessons'
  ) THEN
    CREATE POLICY "teacher updates own group lessons"
      ON public.lessons FOR UPDATE TO authenticated
      USING    (public.is_my_teacher_group(group_id))
      WITH CHECK (public.is_my_teacher_group(group_id));
  END IF;
END $$;

-- ── 6. Storage policies ────────────────────────────────────────────────
CREATE POLICY "lesson-materials: authenticated reads"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-materials');

CREATE POLICY "lesson-materials: teacher uploads own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-materials'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM public.teachers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "lesson-materials: teacher deletes own files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'lesson-materials'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM public.teachers WHERE user_id = auth.uid()
    )
  );

-- ── 7. GRANTs ──────────────────────────────────────────────────────────
GRANT SELECT                 ON public.lesson_materials TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.lesson_materials TO authenticated;
GRANT SELECT                 ON public.lesson_stages    TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.lesson_stages    TO authenticated;
