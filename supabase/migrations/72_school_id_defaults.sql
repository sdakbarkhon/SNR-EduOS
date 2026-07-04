-- =====================================================================
-- Migration 72 — fix: school_id columns from migration 71 had no
-- DEFAULT. Every existing app write path (createStudent, createTeacher,
-- createGroup, marking attendance, submitting homework, sending a
-- message, etc.) inserts rows WITHOUT an explicit school_id — after
-- migration 71 made the column NOT NULL, all of those inserts would
-- start failing with a not-null violation. Found during post-apply
-- verification, before any live-traffic exposure.
--
-- Fix: DEFAULT public.current_school_id() on every school_id column.
-- Deliberately NOT a hardcoded literal — current_school_id() resolves
-- per-inserting-user (via auth.uid() through students/teachers/admins),
-- so this stays correct once a second school exists; a hardcoded
-- default would silently misattribute a future school B admin's rows
-- to school A. RLS's WITH CHECK still enforces school_id =
-- current_school_id() (or is_super_admin()) regardless of where the
-- value came from, so this changes nothing about isolation guarantees
-- — it only fixes ergonomics for callers that don't set the column.
--
-- Idempotent: ALTER COLUMN ... SET DEFAULT always converges.
-- =====================================================================

ALTER TABLE public.students ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.teachers ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.admins ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.groups ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.student_groups ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.subjects ALTER COLUMN school_id SET DEFAULT public.current_school_id();

ALTER TABLE public.lessons ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.lesson_stages ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.lesson_stage_progress ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.lesson_materials ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.lesson_grades ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.lesson_raised_hands ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.lesson_excuse_requests ALTER COLUMN school_id SET DEFAULT public.current_school_id();

ALTER TABLE public.attendance ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.grades ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.homework ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.homework_submissions ALTER COLUMN school_id SET DEFAULT public.current_school_id();

ALTER TABLE public.payments ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.charges ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.announcements ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.announcement_reads ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.announcement_user_reads ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.notification_settings ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.notifications ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.daily_facts ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.messages ALTER COLUMN school_id SET DEFAULT public.current_school_id();

ALTER TABLE public.projects ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.project_stages ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.project_stage_progress ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.project_submissions ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.project_attachments ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.course_materials ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.ai_chat_messages ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.books ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.book_favorites ALTER COLUMN school_id SET DEFAULT public.current_school_id();

ALTER TABLE public.quiz_questions ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.quiz_attempts ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.quiz_answers ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.kahoot_sessions ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.test_questions ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.test_question_options ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.test_submissions ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.test_answers ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.classwork ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.classwork_questions ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.classwork_submissions ALTER COLUMN school_id SET DEFAULT public.current_school_id();
ALTER TABLE public.leave_requests ALTER COLUMN school_id SET DEFAULT public.current_school_id();
