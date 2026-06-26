-- Migration 53: subjects table — teacher-subject-group mapping
-- teachers are now assigned per-subject in a group, not just per-group.
-- groups.teacher_id is KEPT for RLS backward-compat; is_my_teacher_group updated to also check subjects.

-- ── 1. subjects table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subjects (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  group_id   uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  teacher_id uuid        REFERENCES public.teachers(id) ON DELETE SET NULL,
  icon       text        NOT NULL DEFAULT 'BookOpen',
  color      text        NOT NULL DEFAULT '#64748B',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, group_id)
);

CREATE INDEX IF NOT EXISTS idx_subjects_group_id   ON public.subjects(group_id);
CREATE INDEX IF NOT EXISTS idx_subjects_teacher_id ON public.subjects(teacher_id);

-- ── 2. Add subject_id to lessons (nullable; existing rows get NULL) ──────────
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_subject_id ON public.lessons(subject_id);

-- ── 3. Seed one subject per group from groups.subject text key ───────────────
INSERT INTO public.subjects (name, group_id, teacher_id, icon, color)
SELECT
  CASE g.subject
    WHEN 'robotics'    THEN 'Робототехника'
    WHEN 'math'        THEN 'Математика'
    WHEN 'english'     THEN 'Английский язык'
    WHEN 'informatics' THEN 'Информатика'
    WHEN 'programming' THEN 'Программирование'
    WHEN 'physics'     THEN 'Физика'
    WHEN 'biology'     THEN 'Биология'
    WHEN 'chemistry'   THEN 'Химия'
    WHEN 'history'     THEN 'История'
    ELSE g.name
  END,
  g.id,
  g.teacher_id,
  CASE g.subject
    WHEN 'robotics'    THEN 'Bot'
    WHEN 'math'        THEN 'Calculator'
    WHEN 'english'     THEN 'Languages'
    WHEN 'informatics' THEN 'Monitor'
    WHEN 'programming' THEN 'Code'
    WHEN 'physics'     THEN 'Atom'
    WHEN 'biology'     THEN 'Leaf'
    WHEN 'chemistry'   THEN 'FlaskConical'
    WHEN 'history'     THEN 'Scroll'
    ELSE               'BookOpen'
  END,
  CASE g.subject
    WHEN 'robotics'    THEN '#2D5BFF'
    WHEN 'math'        THEN '#F5A623'
    WHEN 'english'     THEN '#F0556B'
    WHEN 'informatics' THEN '#7A4DFF'
    WHEN 'programming' THEN '#0EA5E9'
    WHEN 'physics'     THEN '#39B6F5'
    WHEN 'biology'     THEN '#2DBE7E'
    WHEN 'chemistry'   THEN '#9B5DE5'
    WHEN 'history'     THEN '#B5793A'
    ELSE               '#64748B'
  END
FROM public.groups g
ON CONFLICT (name, group_id) DO NOTHING;

-- ── 4. Clear old seed lessons (user confirmed OK; no real data yet) ──────────
DELETE FROM public.lessons;

-- ── 5. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read subjects (not sensitive)
CREATE POLICY "subjects_select_authenticated"
  ON public.subjects FOR SELECT TO authenticated USING (true);

-- Only admin can write
CREATE POLICY "subjects_insert_admin"
  ON public.subjects FOR INSERT TO authenticated
  WITH CHECK (public.fn_is_admin());

CREATE POLICY "subjects_update_admin"
  ON public.subjects FOR UPDATE TO authenticated
  USING (public.fn_is_admin()) WITH CHECK (public.fn_is_admin());

CREATE POLICY "subjects_delete_admin"
  ON public.subjects FOR DELETE TO authenticated
  USING (public.fn_is_admin());

GRANT SELECT ON public.subjects TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.subjects TO authenticated;

-- ── 6. Update is_my_teacher_group to also check subjects ─────────────────────
-- A teacher "owns" a group if they are the group's primary teacher (groups.teacher_id)
-- OR if they are assigned to at least one subject in that group (subjects.teacher_id).
CREATE OR REPLACE FUNCTION public.is_my_teacher_group(p_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = p_group_id
        AND teacher_id = (SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.subjects
      WHERE group_id = p_group_id
        AND teacher_id = (SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1)
    )
$$;

-- ── 7. updated_at auto-trigger ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_subjects_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.fn_subjects_updated_at();
