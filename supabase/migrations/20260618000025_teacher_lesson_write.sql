-- Migration 25: teacher INSERT + DELETE on lessons
-- Migration 14 blanket-grants only SELECT; teachers need full CRUD on their group's lessons.

-- ── 1. GRANT ──────────────────────────────────────────────────────────────────
GRANT INSERT, UPDATE, DELETE ON public.lessons TO authenticated;

-- ── 2. Drop any existing INSERT/DELETE policies on lessons (idempotent) ───────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'lessons'
      AND cmd IN ('INSERT', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.lessons', r.policyname);
  END LOOP;
END $$;

-- ── 3. INSERT policy ──────────────────────────────────────────────────────────
-- is_my_teacher_group checks groups.teacher_id = current teacher (defined in migration 18)
CREATE POLICY "teachers_insert_lessons"
  ON public.lessons FOR INSERT TO authenticated
  WITH CHECK (public.is_my_teacher_group(group_id));

-- ── 4. DELETE policy ──────────────────────────────────────────────────────────
CREATE POLICY "teachers_delete_lessons"
  ON public.lessons FOR DELETE TO authenticated
  USING (public.is_my_teacher_group(group_id));
