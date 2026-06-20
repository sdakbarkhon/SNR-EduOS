-- ====================================================================
-- Migration 33: Projects (student practical-work module)
-- ====================================================================

-- 1. projects
CREATE TABLE public.projects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         uuid NOT NULL REFERENCES public.groups(id)   ON DELETE CASCADE,
  subject          text NOT NULL,
  title            text NOT NULL,
  description      text,
  created_by       uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  deadline         timestamptz,
  cover_image_path text
);
CREATE INDEX projects_group_idx ON public.projects (group_id);

-- 2. project_stages (defined by teacher)
CREATE TABLE public.project_stages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  position    int  NOT NULL,
  title       text NOT NULL,
  description text,
  UNIQUE (project_id, position)
);
CREATE INDEX project_stages_project_idx ON public.project_stages (project_id);

-- 3. project_submissions (per-student progress envelope)
CREATE TABLE public.project_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id)  ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES public.students(id)  ON DELETE CASCADE,
  is_submitted    boolean NOT NULL DEFAULT false,
  submitted_at    timestamptz,
  grade           int CHECK (grade BETWEEN 1 AND 5),
  teacher_comment text,
  graded_at       timestamptz,
  graded_by       uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  UNIQUE (project_id, student_id)
);
CREATE INDEX project_submissions_project_idx ON public.project_submissions (project_id);
CREATE INDEX project_submissions_student_idx ON public.project_submissions (student_id);

-- 4. project_stage_progress (per-student per-stage)
CREATE TABLE public.project_stage_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.project_submissions(id) ON DELETE CASCADE,
  stage_id      uuid NOT NULL REFERENCES public.project_stages(id)      ON DELETE CASCADE,
  is_completed  boolean NOT NULL DEFAULT false,
  completed_at  timestamptz,
  student_notes text,
  UNIQUE (submission_id, stage_id)
);
CREATE INDEX project_stage_progress_sub_idx ON public.project_stage_progress (submission_id);

-- 5. project_attachments (student files, per-stage or general)
CREATE TABLE public.project_attachments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     uuid NOT NULL REFERENCES public.project_submissions(id) ON DELETE CASCADE,
  stage_id          uuid REFERENCES public.project_stages(id) ON DELETE CASCADE,
  storage_path      text NOT NULL,
  original_filename text NOT NULL,
  size_bytes        bigint,
  uploaded_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_attachments_sub_idx ON public.project_attachments (submission_id);

-- 6. Storage bucket project-files (private, 50 MB)
--    Path convention: project-files/<student_id>/<project_id>/<filename>
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-files', 'project-files', false, 52428800)
ON CONFLICT (id) DO UPDATE SET file_size_limit = excluded.file_size_limit;

DROP POLICY IF EXISTS "student manages own project files" ON storage.objects;
DROP POLICY IF EXISTS "student reads own project files"   ON storage.objects;
DROP POLICY IF EXISTS "student deletes own project files" ON storage.objects;
DROP POLICY IF EXISTS "teacher reads group project files" ON storage.objects;

CREATE POLICY "student reads own project files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files'
    AND (storage.foldername(name))[1] = (public.current_student_id())::text);

CREATE POLICY "student manages own project files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files'
    AND (storage.foldername(name))[1] = (public.current_student_id())::text);

CREATE POLICY "student deletes own project files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-files'
    AND (storage.foldername(name))[1] = (public.current_student_id())::text);

CREATE POLICY "teacher reads group project files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND public.is_my_teacher_group(p.group_id)
    ));

-- ── 7. RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.projects               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_stages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_submissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_stage_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_attachments    ENABLE ROW LEVEL SECURITY;

-- projects
CREATE POLICY "student reads group projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_my_group(group_id));
CREATE POLICY "teacher reads group projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_my_teacher_group(group_id));
CREATE POLICY "teacher creates projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.is_my_teacher_group(group_id) AND created_by = public.current_teacher_id());
CREATE POLICY "teacher updates own projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (created_by = public.current_teacher_id())
  WITH CHECK (created_by = public.current_teacher_id());
CREATE POLICY "teacher deletes own projects"
  ON public.projects FOR DELETE TO authenticated
  USING (created_by = public.current_teacher_id());

-- project_stages
CREATE POLICY "student reads project stages"
  ON public.project_stages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_my_group(p.group_id)));
CREATE POLICY "teacher manages project stages"
  ON public.project_stages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_my_teacher_group(p.group_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_my_teacher_group(p.group_id)));

-- project_submissions
CREATE POLICY "student reads own project submission"
  ON public.project_submissions FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());
CREATE POLICY "teacher reads group project submissions"
  ON public.project_submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_my_teacher_group(p.group_id)));
CREATE POLICY "student creates own project submission"
  ON public.project_submissions FOR INSERT TO authenticated
  WITH CHECK (student_id = public.current_student_id()
    AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_my_group(p.group_id)));
CREATE POLICY "student updates own project submission"
  ON public.project_submissions FOR UPDATE TO authenticated
  USING (student_id = public.current_student_id())
  WITH CHECK (student_id = public.current_student_id());
CREATE POLICY "teacher grades project submissions"
  ON public.project_submissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_my_teacher_group(p.group_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND public.is_my_teacher_group(p.group_id)));

-- project_stage_progress
CREATE POLICY "student manages own stage progress"
  ON public.project_stage_progress FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_submissions s WHERE s.id = submission_id AND s.student_id = public.current_student_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.project_submissions s WHERE s.id = submission_id AND s.student_id = public.current_student_id()));
CREATE POLICY "teacher reads stage progress"
  ON public.project_stage_progress FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_submissions s JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = submission_id AND public.is_my_teacher_group(p.group_id)));

-- project_attachments
CREATE POLICY "student manages own project attachments"
  ON public.project_attachments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_submissions s WHERE s.id = submission_id AND s.student_id = public.current_student_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.project_submissions s WHERE s.id = submission_id AND s.student_id = public.current_student_id()));
CREATE POLICY "teacher reads project attachments"
  ON public.project_attachments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_submissions s JOIN public.projects p ON p.id = s.project_id
    WHERE s.id = submission_id AND public.is_my_teacher_group(p.group_id)));

-- ── 8. Grants (RLS restricts rows) ──────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_stages         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_submissions    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_stage_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_attachments    TO authenticated;
