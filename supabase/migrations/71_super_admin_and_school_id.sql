-- =====================================================================
-- Migration 71 — Role reform: super_admin + school_id on every business
-- table + school-scoped RLS on top of every existing policy.
--
-- Foundation for Iteration 6 (parent role, chat, mobile). Single-tenant
-- today (one school, "SNR EduOS"), but every table and policy becomes
-- school-aware so a second school can be onboarded later without another
-- pass over 47 tables and 100 policies.
--
-- IMPORTANT DEVIATION FROM THE ORIGINAL SPEC: the task described this as
-- "school_id on 31 tables" (per SNR_EduOS_Iteration_6_Plan_CC.md). Direct
-- introspection of the hosted DB (`SELECT relname FROM pg_class WHERE
-- relrowsecurity` + `SELECT tablename FROM information_schema.tables`)
-- found 47 RLS-enabled tables, not 31 — the original list omitted
-- `groups`, `student_groups`, `messages`, `notifications`, `books`,
-- `book_favorites`, and `announcement_user_reads`. All 47 are included
-- below; using the shorter list would have left several core tables
-- (critically `groups` and `student_groups`) without school isolation,
-- defeating the point of this migration. Flagged for approval before
-- apply — see chat report.
--
-- admins.username does NOT exist (confirmed via information_schema —
-- admins has only id/user_id/full_name/created_at), so the planned
-- `UNIQUE(school_id, username)` rebuild only applies to students and
-- teachers, not admins.
--
-- Idempotent throughout: safe to re-run. ADD COLUMN/CREATE INDEX use
-- IF NOT EXISTS; backfill UPDATEs only touch NULL rows; SET NOT NULL is
-- a no-op if already set; ALTER POLICY always converges to the same
-- final USING/WITH CHECK text regardless of prior state.
-- =====================================================================

-- =====================================================================
-- PART A — schools table + the one existing school
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.schools (id, name, code)
VALUES ('a0a0a0a0-0000-0000-0000-000000000001', 'SNR EduOS', 'SNR')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- PART B — super_admins table + one super-admin auth account
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT 'Супер Администратор',
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  v_user uuid;
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE email = 'superadmin@admins.snr.local';
  IF v_user IS NULL THEN
    v_user := 'b0b0b0b0-0000-0000-0000-000000000001';
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      -- Original password rotated after apply. Live value communicated
      -- out-of-band. Do NOT restore literal password here.
      '00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
      'superadmin@admins.snr.local', extensions.crypt('__ROTATED_AFTER_APPLY__', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"role":"super_admin"}'::jsonb,
      now(), now(), '', '', '', '', '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user, 'superadmin@admins.snr.local',
      jsonb_build_object('sub', v_user::text, 'email', 'superadmin@admins.snr.local'),
      'email', now(), now(), now());
  END IF;

  INSERT INTO public.super_admins (user_id, full_name)
  VALUES (v_user, 'Супер Администратор')
  ON CONFLICT (user_id) DO NOTHING;
END $$;

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- PART C — school_id on all 47 business tables: add, backfill, NOT NULL,
-- index. One block per table, same 4-statement shape throughout.
-- =====================================================================

-- Batch 1 — identity: students, teachers, admins, groups, student_groups, subjects
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.students SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.students ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_school_id ON public.students(school_id);

ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.teachers SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.teachers ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teachers_school_id ON public.teachers(school_id);

ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.admins SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.admins ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admins_school_id ON public.admins(school_id);

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.groups SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.groups ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_groups_school_id ON public.groups(school_id);

ALTER TABLE public.student_groups ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.student_groups SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.student_groups ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_groups_school_id ON public.student_groups(school_id);

ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.subjects SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.subjects ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subjects_school_id ON public.subjects(school_id);

-- Batch 2 — lesson content
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.lessons SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.lessons ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lessons_school_id ON public.lessons(school_id);

ALTER TABLE public.lesson_stages ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.lesson_stages SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.lesson_stages ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lesson_stages_school_id ON public.lesson_stages(school_id);

ALTER TABLE public.lesson_stage_progress ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.lesson_stage_progress SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.lesson_stage_progress ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lesson_stage_progress_school_id ON public.lesson_stage_progress(school_id);

ALTER TABLE public.lesson_materials ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.lesson_materials SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.lesson_materials ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lesson_materials_school_id ON public.lesson_materials(school_id);

ALTER TABLE public.lesson_grades ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.lesson_grades SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.lesson_grades ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lesson_grades_school_id ON public.lesson_grades(school_id);

ALTER TABLE public.lesson_raised_hands ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.lesson_raised_hands SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.lesson_raised_hands ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lesson_raised_hands_school_id ON public.lesson_raised_hands(school_id);

ALTER TABLE public.lesson_excuse_requests ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.lesson_excuse_requests SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.lesson_excuse_requests ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lesson_excuse_requests_school_id ON public.lesson_excuse_requests(school_id);

-- Batch 3 — attendance / grades / homework
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.attendance SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.attendance ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_school_id ON public.attendance(school_id);

ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.grades SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.grades ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grades_school_id ON public.grades(school_id);

ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.homework SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.homework ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_homework_school_id ON public.homework(school_id);

ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.homework_submissions SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.homework_submissions ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_homework_submissions_school_id ON public.homework_submissions(school_id);

-- Batch 4 — payments / announcements / communication
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.payments SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.payments ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_school_id ON public.payments(school_id);

ALTER TABLE public.charges ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.charges SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.charges ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_charges_school_id ON public.charges(school_id);

ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.announcements SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.announcements ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_school_id ON public.announcements(school_id);

ALTER TABLE public.announcement_reads ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.announcement_reads SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.announcement_reads ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_announcement_reads_school_id ON public.announcement_reads(school_id);

ALTER TABLE public.announcement_user_reads ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.announcement_user_reads SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.announcement_user_reads ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_announcement_user_reads_school_id ON public.announcement_user_reads(school_id);

ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.notification_settings SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.notification_settings ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_settings_school_id ON public.notification_settings(school_id);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.notifications SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.notifications ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_school_id ON public.notifications(school_id);

ALTER TABLE public.daily_facts ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.daily_facts SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.daily_facts ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_facts_school_id ON public.daily_facts(school_id);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.messages SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.messages ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_school_id ON public.messages(school_id);

-- Batch 5 — projects / materials / AI / library
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.projects SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.projects ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_school_id ON public.projects(school_id);

ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.project_stages SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.project_stages ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_stages_school_id ON public.project_stages(school_id);

ALTER TABLE public.project_stage_progress ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.project_stage_progress SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.project_stage_progress ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_stage_progress_school_id ON public.project_stage_progress(school_id);

ALTER TABLE public.project_submissions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.project_submissions SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.project_submissions ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_submissions_school_id ON public.project_submissions(school_id);

ALTER TABLE public.project_attachments ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.project_attachments SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.project_attachments ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_attachments_school_id ON public.project_attachments(school_id);

ALTER TABLE public.course_materials ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.course_materials SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.course_materials ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_course_materials_school_id ON public.course_materials(school_id);

ALTER TABLE public.ai_chat_messages ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.ai_chat_messages SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.ai_chat_messages ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_school_id ON public.ai_chat_messages(school_id);

ALTER TABLE public.books ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.books SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.books ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_books_school_id ON public.books(school_id);

ALTER TABLE public.book_favorites ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.book_favorites SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.book_favorites ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_book_favorites_school_id ON public.book_favorites(school_id);

-- Batch 6 — quizzes / tests / classwork / leave requests
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.quiz_questions SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.quiz_questions ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quiz_questions_school_id ON public.quiz_questions(school_id);

ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.quiz_attempts SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.quiz_attempts ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_school_id ON public.quiz_attempts(school_id);

ALTER TABLE public.quiz_answers ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.quiz_answers SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.quiz_answers ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quiz_answers_school_id ON public.quiz_answers(school_id);

ALTER TABLE public.kahoot_sessions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.kahoot_sessions SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.kahoot_sessions ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kahoot_sessions_school_id ON public.kahoot_sessions(school_id);

ALTER TABLE public.test_questions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.test_questions SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.test_questions ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_test_questions_school_id ON public.test_questions(school_id);

ALTER TABLE public.test_question_options ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.test_question_options SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.test_question_options ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_test_question_options_school_id ON public.test_question_options(school_id);

ALTER TABLE public.test_submissions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.test_submissions SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.test_submissions ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_test_submissions_school_id ON public.test_submissions(school_id);

ALTER TABLE public.test_answers ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.test_answers SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.test_answers ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_test_answers_school_id ON public.test_answers(school_id);

ALTER TABLE public.classwork ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.classwork SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.classwork ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_classwork_school_id ON public.classwork(school_id);

ALTER TABLE public.classwork_questions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.classwork_questions SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.classwork_questions ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_classwork_questions_school_id ON public.classwork_questions(school_id);

ALTER TABLE public.classwork_submissions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.classwork_submissions SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.classwork_submissions ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_classwork_submissions_school_id ON public.classwork_submissions(school_id);

ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id);
UPDATE public.leave_requests SET school_id = 'a0a0a0a0-0000-0000-0000-000000000001' WHERE school_id IS NULL;
ALTER TABLE public.leave_requests ALTER COLUMN school_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leave_requests_school_id ON public.leave_requests(school_id);

-- =====================================================================
-- PART D — UNIQUE(username) → UNIQUE(school_id, username) for students
-- and teachers only (admins has no username column — verified via
-- information_schema before writing this migration; see Part 0 of the
-- investigation in the chat report).
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_school_username_key') THEN
    ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_username_key;
    ALTER TABLE public.students ADD CONSTRAINT students_school_username_key UNIQUE (school_id, username);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teachers_school_username_key') THEN
    ALTER TABLE public.teachers DROP CONSTRAINT IF EXISTS teachers_username_key;
    ALTER TABLE public.teachers ADD CONSTRAINT teachers_school_username_key UNIQUE (school_id, username);
  END IF;
END $$;

-- =====================================================================
-- PART E — RLS helpers
-- =====================================================================

CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT school_id FROM public.students WHERE user_id = auth.uid()
  UNION ALL
  SELECT school_id FROM public.teachers WHERE user_id = auth.uid()
  UNION ALL
  SELECT school_id FROM public.admins WHERE user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
$$;

-- super_admins RLS: super admin reads own record; nobody else can read
-- this table at all (no admin/school policy needed — it's a privileged
-- allow-list of a handful of accounts, deliberately opaque to everyone
-- else, including school admins).
CREATE POLICY "super admin reads own record" ON public.super_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- schools RLS: everyone authenticated can read the school list (needed
-- so a school admin's own school name/code can be shown in UI); only a
-- super admin can write.
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated reads schools" ON public.schools
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "super admin manages schools" ON public.schools
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- =====================================================================
-- PART F — rewrite every existing RLS policy to add school scoping.
--
-- General pattern: append `AND (is_super_admin() OR school_id =
-- current_school_id())` to every existing USING/WITH CHECK clause.
--
-- Admin-authority policies (built on fn_is_admin()) get a different
-- combinator per the task spec: fn_is_admin() is replaced with
-- `(fn_is_admin() AND school_id = current_school_id())`, and the whole
-- policy gets `OR is_super_admin()` at the top level, so a super admin
-- bypasses that policy's other conditions entirely (not just ANDed on
-- top), matching what "super admin sees every school" actually requires.
--
-- ALTER POLICY (not DROP+CREATE) — idempotent, converges to the same
-- USING/WITH CHECK text on every re-run, no existence check needed.
-- =====================================================================

-- ---- Batch 1: identity ----

ALTER POLICY "admin full access students" ON public.students
  USING ((fn_is_admin() AND school_id = current_school_id()) OR is_super_admin())
  WITH CHECK ((fn_is_admin() AND school_id = current_school_id()) OR is_super_admin());
ALTER POLICY "student reads own profile" ON public.students
  USING ((user_id = auth.uid()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads students in own groups" ON public.students
  USING ((EXISTS ( SELECT 1
   FROM (student_groups sg
     JOIN groups g ON ((g.id = sg.group_id)))
  WHERE ((sg.student_id = students.id) AND (g.teacher_id = current_teacher_id())))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "admin full access teachers" ON public.teachers
  USING ((fn_is_admin() AND school_id = current_school_id()) OR is_super_admin())
  WITH CHECK ((fn_is_admin() AND school_id = current_school_id()) OR is_super_admin());
ALTER POLICY "auth reads teachers" ON public.teachers
  USING (is_super_admin() OR school_id = current_school_id());
ALTER POLICY "teacher reads own profile" ON public.teachers
  USING ((user_id = auth.uid()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher updates own profile" ON public.teachers
  USING ((user_id = auth.uid()) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((user_id = auth.uid()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "admin reads own record" ON public.admins
  USING ((user_id = auth.uid()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "admin full access groups" ON public.groups
  USING ((fn_is_admin() AND school_id = current_school_id()) OR is_super_admin())
  WITH CHECK ((fn_is_admin() AND school_id = current_school_id()) OR is_super_admin());
ALTER POLICY "student reads own groups" ON public.groups
  USING (is_my_group(id) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads own groups" ON public.groups
  USING ((teacher_id = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "admin full access student_groups" ON public.student_groups
  USING ((fn_is_admin() AND school_id = current_school_id()) OR is_super_admin())
  WITH CHECK ((fn_is_admin() AND school_id = current_school_id()) OR is_super_admin());
ALTER POLICY "student reads own memberships" ON public.student_groups
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads memberships in own groups" ON public.student_groups
  USING ((EXISTS ( SELECT 1
   FROM groups g
  WHERE ((g.id = student_groups.group_id) AND (g.teacher_id = current_teacher_id())))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "subjects_delete_admin" ON public.subjects
  USING ((fn_is_admin() AND school_id = current_school_id()) OR is_super_admin());
ALTER POLICY "subjects_insert_admin" ON public.subjects
  WITH CHECK ((fn_is_admin() AND school_id = current_school_id()) OR is_super_admin());
ALTER POLICY "subjects_select_authenticated" ON public.subjects
  USING (is_super_admin() OR school_id = current_school_id());
ALTER POLICY "subjects_update_admin" ON public.subjects
  USING ((fn_is_admin() AND school_id = current_school_id()) OR is_super_admin())
  WITH CHECK ((fn_is_admin() AND school_id = current_school_id()) OR is_super_admin());

-- ---- Batch 2: lesson content ----

ALTER POLICY "student reads own lessons" ON public.lessons
  USING (is_my_group(group_id) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads lessons in own groups" ON public.lessons
  USING (is_my_teacher_group(group_id) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher updates own group lessons" ON public.lessons
  USING (is_my_teacher_group(group_id) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK (is_my_teacher_group(group_id) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teachers_delete_lessons" ON public.lessons
  USING (is_my_teacher_group(group_id) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teachers_insert_lessons" ON public.lessons
  WITH CHECK (is_my_teacher_group(group_id) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student reads own group lesson stages" ON public.lesson_stages
  USING (is_my_group(( SELECT lessons.group_id
   FROM lessons
  WHERE (lessons.id = lesson_stages.lesson_id)
 LIMIT 1)) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher manages own lesson stages" ON public.lesson_stages
  USING (is_my_teacher_group(( SELECT lessons.group_id
   FROM lessons
  WHERE (lessons.id = lesson_stages.lesson_id)
 LIMIT 1)) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK (is_my_teacher_group(( SELECT lessons.group_id
   FROM lessons
  WHERE (lessons.id = lesson_stages.lesson_id)
 LIMIT 1)) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student inserts own stage progress" ON public.lesson_stage_progress
  WITH CHECK ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student reads own stage progress" ON public.lesson_stage_progress
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student updates own stage progress" ON public.lesson_stage_progress
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher grades stage progress" ON public.lesson_stage_progress
  USING (is_my_teacher_group(( SELECT l.group_id
   FROM (lessons l
     JOIN lesson_stages ls ON ((ls.lesson_id = l.id)))
  WHERE (ls.id = lesson_stage_progress.stage_id)
 LIMIT 1)) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher inserts stage progress in own groups" ON public.lesson_stage_progress
  WITH CHECK (is_my_teacher_group(( SELECT l.group_id
   FROM (lessons l
     JOIN lesson_stages ls ON ((ls.lesson_id = l.id)))
  WHERE (ls.id = lesson_stage_progress.stage_id)
 LIMIT 1)) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads stage progress in own groups" ON public.lesson_stage_progress
  USING (is_my_teacher_group(( SELECT l.group_id
   FROM (lessons l
     JOIN lesson_stages ls ON ((ls.lesson_id = l.id)))
  WHERE (ls.id = lesson_stage_progress.stage_id)
 LIMIT 1)) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "lesson_materials: delete" ON public.lesson_materials
  USING ((uploaded_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "lesson_materials: insert" ON public.lesson_materials
  WITH CHECK ((uploaded_by = current_teacher_id()) AND (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_materials.lesson_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "lesson_materials: read" ON public.lesson_materials
  USING (((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_materials.lesson_id) AND is_my_group(l.group_id)))) OR (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_materials.lesson_id) AND is_my_teacher_group(l.group_id))))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "lesson_materials: update" ON public.lesson_materials
  USING ((uploaded_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student reads own lesson grades" ON public.lesson_grades
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher deletes lesson grades" ON public.lesson_grades
  USING ((graded_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher inserts lesson grades" ON public.lesson_grades
  WITH CHECK ((graded_by = current_teacher_id()) AND (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_grades.lesson_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads lesson grades in own groups" ON public.lesson_grades
  USING ((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_grades.lesson_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher updates lesson grades" ON public.lesson_grades
  USING ((graded_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((graded_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student raises own hand" ON public.lesson_raised_hands
  WITH CHECK ((student_id = current_student_id()) AND (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_raised_hands.lesson_id) AND is_my_group(l.group_id) AND (l.status = 'in_progress'::text)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student reads own raised hands" ON public.lesson_raised_hands
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher lowers raised hand" ON public.lesson_raised_hands
  USING ((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_raised_hands.lesson_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_raised_hands.lesson_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads raised hands in own groups" ON public.lesson_raised_hands
  USING ((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_raised_hands.lesson_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student creates own excuse request" ON public.lesson_excuse_requests
  WITH CHECK ((student_id = current_student_id()) AND (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_excuse_requests.lesson_id) AND is_my_group(l.group_id) AND (l.status = 'scheduled'::text)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student deletes own excuse request" ON public.lesson_excuse_requests
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student reads own excuse requests" ON public.lesson_excuse_requests
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student updates own excuse request" ON public.lesson_excuse_requests
  USING ((student_id = current_student_id()) AND (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_excuse_requests.lesson_id) AND (l.status = 'scheduled'::text)))) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads excuse requests in own groups" ON public.lesson_excuse_requests
  USING ((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_excuse_requests.lesson_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));

-- ---- Batch 3: attendance / grades / homework ----

ALTER POLICY "student reads own attendance" ON public.attendance
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher inserts attendance" ON public.attendance
  WITH CHECK ((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = attendance.lesson_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads attendance in own groups" ON public.attendance
  USING ((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = attendance.lesson_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher updates attendance" ON public.attendance
  USING (((is_finalized = false) AND (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = attendance.lesson_id) AND is_my_teacher_group(l.group_id))))) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = attendance.lesson_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student reads own grades" ON public.grades
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads grades in own groups" ON public.grades
  USING ((EXISTS ( SELECT 1
   FROM (student_groups sg
     JOIN groups g ON ((g.id = sg.group_id)))
  WHERE ((sg.student_id = grades.student_id) AND (g.teacher_id = current_teacher_id())))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student reads own homework" ON public.homework
  USING (is_my_group(group_id) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher creates homework" ON public.homework
  WITH CHECK (is_my_teacher_group(group_id) AND (teacher_id = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher deletes own homework" ON public.homework
  USING ((teacher_id = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads homework in own groups" ON public.homework
  USING (is_my_teacher_group(group_id) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher updates own homework" ON public.homework
  USING ((teacher_id = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((teacher_id = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student creates own submission" ON public.homework_submissions
  WITH CHECK ((student_id = current_student_id()) AND (EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = homework_submissions.homework_id) AND is_my_group(h.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student reads own submissions" ON public.homework_submissions
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student updates own submission" ON public.homework_submissions
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher grades submissions" ON public.homework_submissions
  USING ((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = homework_submissions.homework_id) AND is_my_teacher_group(h.group_id)))) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = homework_submissions.homework_id) AND is_my_teacher_group(h.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads submissions in own groups" ON public.homework_submissions
  USING ((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = homework_submissions.homework_id) AND is_my_teacher_group(h.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));

-- ---- Batch 4: payments / announcements / communication ----

ALTER POLICY "student reads own payments" ON public.payments
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student reads own charges" ON public.charges
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student reads announcements" ON public.announcements
  USING ((((scope = 'group'::text) AND is_my_group(group_id)) OR ((scope = 'all_my_groups'::text) AND (EXISTS ( SELECT 1
   FROM groups g
  WHERE ((g.teacher_id = announcements.created_by) AND is_my_group(g.id))))) OR ((scope = 'student'::text) AND (target_student_id = current_student_id()))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher creates announcements" ON public.announcements
  WITH CHECK ((created_by = current_teacher_id()) AND ((scope <> 'group'::text) OR is_my_teacher_group(group_id)) AND ((scope <> 'student'::text) OR (EXISTS ( SELECT 1
   FROM (student_groups sg
     JOIN groups g ON ((g.id = sg.group_id)))
  WHERE ((sg.student_id = announcements.target_student_id) AND (g.teacher_id = current_teacher_id()))))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher deletes own announcements" ON public.announcements
  USING ((created_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads own announcements" ON public.announcements
  USING ((created_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher updates own announcements" ON public.announcements
  USING ((created_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((created_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student inserts own reads" ON public.announcement_reads
  WITH CHECK ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student reads own reads" ON public.announcement_reads
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads reads of own announcements" ON public.announcement_reads
  USING ((EXISTS ( SELECT 1
   FROM announcements a
  WHERE ((a.id = announcement_reads.announcement_id) AND (a.created_by = current_teacher_id())))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "user inserts own ticker reads" ON public.announcement_user_reads
  WITH CHECK ((user_id = auth.uid()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "user reads own ticker reads" ON public.announcement_user_reads
  USING ((user_id = auth.uid()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student inserts own notif settings" ON public.notification_settings
  WITH CHECK ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student reads own notif settings" ON public.notification_settings
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student updates own notif settings" ON public.notification_settings
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "user deletes own notifications" ON public.notifications
  USING ((recipient_user_id = auth.uid()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "user inserts own notifications" ON public.notifications
  WITH CHECK ((recipient_user_id = auth.uid()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "user reads own notifications" ON public.notifications
  USING ((recipient_user_id = auth.uid()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "user updates own notifications" ON public.notifications
  USING ((recipient_user_id = auth.uid()) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((recipient_user_id = auth.uid()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "authenticated can read daily facts" ON public.daily_facts
  USING (is_super_admin() OR school_id = current_school_id());

ALTER POLICY "student marks own message read" ON public.messages
  USING ((recipient_student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((recipient_student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student reads own messages" ON public.messages
  USING (((recipient_student_id = current_student_id()) OR ((group_id IS NOT NULL) AND is_my_group(group_id)) OR (sender_id = auth.uid())) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student sends message" ON public.messages
  WITH CHECK ((sender_id = auth.uid()) AND (is_super_admin() OR school_id = current_school_id()));

-- ---- Batch 5: projects / materials / AI / library ----

ALTER POLICY "student reads group projects" ON public.projects
  USING (is_my_group(group_id) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher creates projects" ON public.projects
  WITH CHECK (is_my_teacher_group(group_id) AND (created_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher deletes own projects" ON public.projects
  USING ((created_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads group projects" ON public.projects
  USING (is_my_teacher_group(group_id) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher updates own projects" ON public.projects
  USING ((created_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((created_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student reads project stages" ON public.project_stages
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_stages.project_id) AND is_my_group(p.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher manages project stages" ON public.project_stages
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_stages.project_id) AND is_my_teacher_group(p.group_id)))) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_stages.project_id) AND is_my_teacher_group(p.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student manages own stage progress" ON public.project_stage_progress
  USING ((EXISTS ( SELECT 1
   FROM project_submissions s
  WHERE ((s.id = project_stage_progress.submission_id) AND (s.student_id = current_student_id())))) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM project_submissions s
  WHERE ((s.id = project_stage_progress.submission_id) AND (s.student_id = current_student_id())))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads stage progress" ON public.project_stage_progress
  USING ((EXISTS ( SELECT 1
   FROM (project_submissions s
     JOIN projects p ON ((p.id = s.project_id)))
  WHERE ((s.id = project_stage_progress.submission_id) AND is_my_teacher_group(p.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student creates own project submission" ON public.project_submissions
  WITH CHECK ((student_id = current_student_id()) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_submissions.project_id) AND is_my_group(p.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student reads own project submission" ON public.project_submissions
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student updates own project submission" ON public.project_submissions
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher grades project submissions" ON public.project_submissions
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_submissions.project_id) AND is_my_teacher_group(p.group_id)))) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_submissions.project_id) AND is_my_teacher_group(p.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads group project submissions" ON public.project_submissions
  USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_submissions.project_id) AND is_my_teacher_group(p.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student manages own project attachments" ON public.project_attachments
  USING ((EXISTS ( SELECT 1
   FROM project_submissions s
  WHERE ((s.id = project_attachments.submission_id) AND (s.student_id = current_student_id())))) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM project_submissions s
  WHERE ((s.id = project_attachments.submission_id) AND (s.student_id = current_student_id())))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads project attachments" ON public.project_attachments
  USING ((EXISTS ( SELECT 1
   FROM (project_submissions s
     JOIN projects p ON ((p.id = s.project_id)))
  WHERE ((s.id = project_attachments.submission_id) AND is_my_teacher_group(p.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student reads own materials" ON public.course_materials
  USING (is_my_group(group_id) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher deletes own materials" ON public.course_materials
  USING ((uploaded_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher inserts materials" ON public.course_materials
  WITH CHECK (is_my_teacher_group(group_id) AND (uploaded_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads group materials" ON public.course_materials
  USING (is_my_teacher_group(group_id) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher updates own materials" ON public.course_materials
  USING ((uploaded_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student inserts own ai messages" ON public.ai_chat_messages
  WITH CHECK ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student reads own ai messages" ON public.ai_chat_messages
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads ai messages of own groups" ON public.ai_chat_messages
  USING ((EXISTS ( SELECT 1
   FROM ((students s
     JOIN student_groups sg ON ((sg.student_id = s.id)))
     JOIN groups g ON ((g.id = sg.group_id)))
  WHERE ((s.id = ai_chat_messages.student_id) AND (g.teacher_id = current_teacher_id())))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "authenticated reads books" ON public.books
  USING (is_super_admin() OR school_id = current_school_id());
ALTER POLICY "teacher deletes own books" ON public.books
  USING ((uploaded_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher inserts books" ON public.books
  WITH CHECK ((uploaded_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher updates own books" ON public.books
  USING ((uploaded_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student deletes own favorites" ON public.book_favorites
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student inserts own favorites" ON public.book_favorites
  WITH CHECK ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student reads own favorites" ON public.book_favorites
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));

-- ---- Batch 6: quizzes / tests / classwork / leave requests ----

ALTER POLICY "student reads quiz questions" ON public.quiz_questions
  USING (is_my_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = quiz_questions.stage_id))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher manages quiz questions" ON public.quiz_questions
  USING (is_my_teacher_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = quiz_questions.stage_id))) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK (is_my_teacher_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = quiz_questions.stage_id))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student inserts own quiz attempts" ON public.quiz_attempts
  WITH CHECK ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student reads own quiz attempts" ON public.quiz_attempts
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student updates own quiz attempts" ON public.quiz_attempts
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads group quiz attempts" ON public.quiz_attempts
  USING (is_my_teacher_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = quiz_attempts.stage_id))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher updates group quiz attempts" ON public.quiz_attempts
  USING (is_my_teacher_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = quiz_attempts.stage_id))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student inserts own quiz answers" ON public.quiz_answers
  WITH CHECK ((EXISTS ( SELECT 1
   FROM quiz_attempts a
  WHERE ((a.id = quiz_answers.attempt_id) AND (a.student_id = current_student_id())))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student reads own quiz answers" ON public.quiz_answers
  USING ((EXISTS ( SELECT 1
   FROM quiz_attempts a
  WHERE ((a.id = quiz_answers.attempt_id) AND (a.student_id = current_student_id())))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student updates own quiz answers" ON public.quiz_answers
  USING ((EXISTS ( SELECT 1
   FROM quiz_attempts a
  WHERE ((a.id = quiz_answers.attempt_id) AND (a.student_id = current_student_id())))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads group quiz answers" ON public.quiz_answers
  USING ((EXISTS ( SELECT 1
   FROM ((quiz_attempts a
     JOIN lesson_stages ls ON ((ls.id = a.stage_id)))
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE ((a.id = quiz_answers.attempt_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student reads kahoot sessions" ON public.kahoot_sessions
  USING (is_my_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = kahoot_sessions.stage_id))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher manages kahoot sessions" ON public.kahoot_sessions
  USING (is_my_teacher_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = kahoot_sessions.stage_id))) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK (is_my_teacher_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = kahoot_sessions.stage_id))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student reads test questions" ON public.test_questions
  USING ((EXISTS ( SELECT 1
   FROM test_submissions ts
  WHERE ((ts.homework_id = test_questions.homework_id) AND (ts.student_id = current_student_id()) AND (ts.started_at IS NOT NULL)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher manages test questions in own groups" ON public.test_questions
  USING ((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = test_questions.homework_id) AND is_my_teacher_group(h.group_id)))) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = test_questions.homework_id) AND is_my_teacher_group(h.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student reads test options" ON public.test_question_options
  USING ((EXISTS ( SELECT 1
   FROM (test_questions q
     JOIN test_submissions ts ON ((ts.homework_id = q.homework_id)))
  WHERE ((q.id = test_question_options.question_id) AND (ts.student_id = current_student_id()) AND (ts.started_at IS NOT NULL)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher manages test options in own groups" ON public.test_question_options
  USING ((EXISTS ( SELECT 1
   FROM (test_questions q
     JOIN homework h ON ((h.id = q.homework_id)))
  WHERE ((q.id = test_question_options.question_id) AND is_my_teacher_group(h.group_id)))) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (test_questions q
     JOIN homework h ON ((h.id = q.homework_id)))
  WHERE ((q.id = test_question_options.question_id) AND is_my_teacher_group(h.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student creates own test submission" ON public.test_submissions
  WITH CHECK ((student_id = current_student_id()) AND (EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = test_submissions.homework_id) AND is_my_group(h.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student reads own test submissions" ON public.test_submissions
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student updates own test submission" ON public.test_submissions
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads test submissions in own groups" ON public.test_submissions
  USING ((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = test_submissions.homework_id) AND is_my_teacher_group(h.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher updates test submissions" ON public.test_submissions
  USING ((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = test_submissions.homework_id) AND is_my_teacher_group(h.group_id)))) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = test_submissions.homework_id) AND is_my_teacher_group(h.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student creates own test answers" ON public.test_answers
  WITH CHECK ((EXISTS ( SELECT 1
   FROM test_submissions ts
  WHERE ((ts.id = test_answers.submission_id) AND (ts.student_id = current_student_id())))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student reads own test answers" ON public.test_answers
  USING ((EXISTS ( SELECT 1
   FROM test_submissions ts
  WHERE ((ts.id = test_answers.submission_id) AND (ts.student_id = current_student_id())))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads test answers in own groups" ON public.test_answers
  USING ((EXISTS ( SELECT 1
   FROM (test_submissions ts
     JOIN homework h ON ((h.id = ts.homework_id)))
  WHERE ((ts.id = test_answers.submission_id) AND is_my_teacher_group(h.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student reads classwork in own group" ON public.classwork
  USING ((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = classwork.lesson_id) AND is_my_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher deletes classwork" ON public.classwork
  USING ((created_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher inserts classwork" ON public.classwork
  WITH CHECK ((created_by = current_teacher_id()) AND (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = classwork.lesson_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads classwork in own group" ON public.classwork
  USING ((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = classwork.lesson_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher updates classwork" ON public.classwork
  USING ((created_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((created_by = current_teacher_id()) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student reads classwork questions after submit" ON public.classwork_questions
  USING (((EXISTS ( SELECT 1
   FROM ((classwork_submissions cs
     JOIN classwork c ON ((c.id = cs.classwork_id)))
     JOIN lessons l ON ((l.id = c.lesson_id)))
  WHERE ((cs.classwork_id = cs.classwork_id) AND (cs.student_id = current_student_id())))) OR (EXISTS ( SELECT 1
   FROM (classwork c
     JOIN lessons l ON ((l.id = c.lesson_id)))
  WHERE ((c.id = classwork_questions.classwork_id) AND is_my_group(l.group_id))))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher manages classwork questions" ON public.classwork_questions
  USING ((EXISTS ( SELECT 1
   FROM classwork c
  WHERE ((c.id = classwork_questions.classwork_id) AND (c.created_by = current_teacher_id())))) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM classwork c
  WHERE ((c.id = classwork_questions.classwork_id) AND (c.created_by = current_teacher_id())))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads classwork questions" ON public.classwork_questions
  USING ((EXISTS ( SELECT 1
   FROM (classwork c
     JOIN lessons l ON ((l.id = c.lesson_id)))
  WHERE ((c.id = classwork_questions.classwork_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student inserts own classwork submission" ON public.classwork_submissions
  WITH CHECK ((student_id = current_student_id()) AND (EXISTS ( SELECT 1
   FROM (classwork c
     JOIN lessons l ON ((l.id = c.lesson_id)))
  WHERE ((c.id = classwork_submissions.classwork_id) AND is_my_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student reads own classwork submissions" ON public.classwork_submissions
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student updates own ungraded submission" ON public.classwork_submissions
  USING (((student_id = current_student_id()) AND (grade IS NULL)) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher grades classwork submissions" ON public.classwork_submissions
  USING ((EXISTS ( SELECT 1
   FROM (classwork c
     JOIN lessons l ON ((l.id = c.lesson_id)))
  WHERE ((c.id = classwork_submissions.classwork_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (classwork c
     JOIN lessons l ON ((l.id = c.lesson_id)))
  WHERE ((c.id = classwork_submissions.classwork_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher reads classwork submissions" ON public.classwork_submissions
  USING ((EXISTS ( SELECT 1
   FROM (classwork c
     JOIN lessons l ON ((l.id = c.lesson_id)))
  WHERE ((c.id = classwork_submissions.classwork_id) AND is_my_teacher_group(l.group_id)))) AND (is_super_admin() OR school_id = current_school_id()));

ALTER POLICY "student inserts own leave_requests" ON public.leave_requests
  WITH CHECK ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "student selects own leave_requests" ON public.leave_requests
  USING ((student_id = current_student_id()) AND (is_super_admin() OR school_id = current_school_id()));
ALTER POLICY "teacher manages leave_requests" ON public.leave_requests
  USING ((EXISTS ( SELECT 1
   FROM (lessons l
     JOIN groups g ON ((g.id = l.group_id)))
  WHERE ((l.id = leave_requests.lesson_id) AND (g.teacher_id = current_teacher_id())))) AND (is_super_admin() OR school_id = current_school_id()));

-- =====================================================================
-- PART G — reset_demo_data() deprecation note (function body NOT
-- touched: it is already generic via raw_user_meta_data.is_demo=true and
-- would need explicit school_id awareness to be safe to invoke again;
-- its cron trigger has been disabled since Iteration 5 Prompt 11, so
-- this is a documentation-only change).
-- =====================================================================

COMMENT ON FUNCTION public.reset_demo_data() IS 'Deprecated as of migration 71: cron disabled since Iter5-P11. Not adapted to school_id — do not invoke without reviewing school scoping first.';
