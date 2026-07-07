-- Migration 88
-- УЧ.6 follow-up: homework_submissions needs a state meaning "the student
-- has started a bundle homework but hasn't clicked the final 'Отправить
-- всё' yet" — distinct from 'submitted', which every existing teacher-facing
-- query/UI already treats as "awaiting grading" (TeacherHomeworkDetailView,
-- TeacherDashboardView, TeacherHomeworkView all filter/count on
-- status === 'submitted'). Bundle homework needs a homework_submissions row
-- to exist early (homework_subtask_submissions.submission_id is NOT NULL,
-- so subtask progress has to attach to something as the student works
-- through subtasks) — without this value that eager row would show up as
-- "pending review" the moment the student opens the homework.

ALTER TYPE public.submission_status ADD VALUE IF NOT EXISTS 'in_progress' BEFORE 'submitted';
