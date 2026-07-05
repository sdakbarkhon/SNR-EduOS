-- =====================================================================
-- Migration 74 — Iteration 6, Prompt 2: parent role foundation.
-- Adds parents, parent_students (many-to-many, max 2 parents/student),
-- parent_invites (one-time registration codes), the is_my_child() RLS
-- helper, and parent-visibility SELECT policies on 10 existing tables.
--
-- DEVIATION FROM SPEC: Part 2.1 said `user_id uuid UNIQUE NOT NULL`,
-- but Part 7.3's own create flow requires creating a parents row with
-- user_id still unknown (the school admin creates the record + invite
-- before the parent has registered; the parent only gets a user_id
-- once they complete /parent/join). NOT NULL would make that flow
-- impossible. Made user_id nullable — populated by the join flow,
-- enforced UNIQUE only across non-null values (default btree UNIQUE
-- already allows multiple NULLs in Postgres, which is exactly what's
-- needed for multiple not-yet-registered parents to coexist).
--
-- "Max 2 parents per student" (Part 2.2): implemented as a BEFORE
-- INSERT trigger, not a CHECK — Postgres CHECK constraints cannot run
-- cross-row subqueries, so a trigger is the only enforcement mechanism
-- that actually works here.
--
-- All passwords are never embedded in this file: parents.user_id is
-- NULL at creation time and only set later by the /parent/join server
-- action, which creates the auth.users row via the service-role admin
-- API using a password the parent themselves types in — never SQL.
--
-- All school_id columns carry DEFAULT public.current_school_id(),
-- matching the fix from migration 72 (no NOT NULL column without a
-- default this time). All new RLS policies use the corrected grouping
-- from migration 73: is_super_admin() OR'd at the top level, never
-- nested inside an AND.
--
-- Idempotent: CREATE TABLE/INDEX use IF NOT EXISTS; CREATE POLICY is
-- NOT idempotent in Postgres (no IF NOT EXISTS) but this migration
-- only runs once against a schema confirmed clean in Part 0.
-- =====================================================================

-- =====================================================================
-- PART A — parents table
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.parents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  school_id uuid NOT NULL REFERENCES public.schools(id) DEFAULT public.current_school_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_parents_school_id ON public.parents(school_id);

ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- PART B — parent_students (many-to-many, max 2 parents per student)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.parent_students (
  parent_id uuid NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) DEFAULT public.current_school_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_students_parent_id ON public.parent_students(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_student_id ON public.parent_students(student_id);

ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enforce_max_two_parents_per_student()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.parent_students WHERE student_id = NEW.student_id) >= 2 THEN
    RAISE EXCEPTION 'Student already has the maximum of 2 linked parents';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_max_two_parents_per_student ON public.parent_students;
CREATE TRIGGER trg_max_two_parents_per_student
  BEFORE INSERT ON public.parent_students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_two_parents_per_student();

-- =====================================================================
-- PART C — parent_invites (one-time registration codes)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.parent_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  parent_id uuid NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) DEFAULT public.current_school_id(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_invites_code ON public.parent_invites(code);

ALTER TABLE public.parent_invites ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- PART D — is_my_child() helper
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_my_child(p_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parents p
    JOIN public.parent_students ps ON ps.parent_id = p.id
    WHERE p.user_id = auth.uid()
      AND ps.student_id = p_student_id
  )
$$;

-- =====================================================================
-- PART E — RLS on parents / parent_students / parent_invites
-- =====================================================================

CREATE POLICY "parent reads own record" ON public.parents
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR (school_id = current_school_id() AND fn_is_admin()) OR is_super_admin());

CREATE POLICY "admin creates parents" ON public.parents
  FOR INSERT TO authenticated
  WITH CHECK ((school_id = current_school_id() AND fn_is_admin()) OR is_super_admin());

CREATE POLICY "parent updates own record" ON public.parents
  FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) OR (school_id = current_school_id() AND fn_is_admin()) OR is_super_admin())
  WITH CHECK ((user_id = auth.uid()) OR (school_id = current_school_id() AND fn_is_admin()) OR is_super_admin());

CREATE POLICY "admin deletes parents" ON public.parents
  FOR DELETE TO authenticated
  USING ((school_id = current_school_id() AND fn_is_admin()) OR is_super_admin());

CREATE POLICY "parent reads own children links" ON public.parent_students
  FOR SELECT TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM public.parents p WHERE p.id = parent_students.parent_id AND p.user_id = auth.uid()))
    OR (school_id = current_school_id() AND fn_is_admin())
    OR is_super_admin()
  );

CREATE POLICY "admin manages parent_students" ON public.parent_students
  FOR ALL TO authenticated
  USING ((school_id = current_school_id() AND fn_is_admin()) OR is_super_admin())
  WITH CHECK ((school_id = current_school_id() AND fn_is_admin()) OR is_super_admin());

CREATE POLICY "admin manages parent_invites" ON public.parent_invites
  FOR ALL TO authenticated
  USING ((school_id = current_school_id() AND fn_is_admin()) OR is_super_admin())
  WITH CHECK ((school_id = current_school_id() AND fn_is_admin()) OR is_super_admin());

-- =====================================================================
-- PART F — parent SELECT visibility on existing tables
-- =====================================================================

CREATE POLICY "parent reads own children lessons" ON public.lessons
  FOR SELECT TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM public.student_groups sg WHERE sg.group_id = lessons.group_id AND is_my_child(sg.student_id)))
    OR (school_id = current_school_id() AND fn_is_admin())
    OR is_super_admin()
  );

CREATE POLICY "parent reads own children lesson stages" ON public.lesson_stages
  FOR SELECT TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.student_groups sg ON sg.group_id = l.group_id
      WHERE l.id = lesson_stages.lesson_id AND is_my_child(sg.student_id)
    ))
    OR (school_id = current_school_id() AND fn_is_admin())
    OR is_super_admin()
  );

CREATE POLICY "parent reads own children homework" ON public.homework
  FOR SELECT TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM public.student_groups sg WHERE sg.group_id = homework.group_id AND is_my_child(sg.student_id)))
    OR (school_id = current_school_id() AND fn_is_admin())
    OR is_super_admin()
  );

CREATE POLICY "parent reads own children homework submissions" ON public.homework_submissions
  FOR SELECT TO authenticated
  USING (is_my_child(student_id) OR (school_id = current_school_id() AND fn_is_admin()) OR is_super_admin());

CREATE POLICY "parent reads own children grades" ON public.grades
  FOR SELECT TO authenticated
  USING (is_my_child(student_id) OR (school_id = current_school_id() AND fn_is_admin()) OR is_super_admin());

CREATE POLICY "parent reads own children attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (is_my_child(student_id) OR (school_id = current_school_id() AND fn_is_admin()) OR is_super_admin());

CREATE POLICY "parent reads own children payments" ON public.payments
  FOR SELECT TO authenticated
  USING (is_my_child(student_id) OR (school_id = current_school_id() AND fn_is_admin()) OR is_super_admin());

CREATE POLICY "parent reads own children course materials" ON public.course_materials
  FOR SELECT TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM public.student_groups sg WHERE sg.group_id = course_materials.group_id AND is_my_child(sg.student_id)))
    OR (school_id = current_school_id() AND fn_is_admin())
    OR is_super_admin()
  );

CREATE POLICY "parent reads own children lesson grades" ON public.lesson_grades
  FOR SELECT TO authenticated
  USING (is_my_child(student_id) OR (school_id = current_school_id() AND fn_is_admin()) OR is_super_admin());

CREATE POLICY "parent reads own children raised hands" ON public.lesson_raised_hands
  FOR SELECT TO authenticated
  USING (is_my_child(student_id) OR (school_id = current_school_id() AND fn_is_admin()) OR is_super_admin());
