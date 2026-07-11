-- Migration 112 — Промт «скорость», Задача 2: недостающий индекс group_teachers
--
-- group_teachers имеет только implicit unique index на PK (group_id, teacher_id)
-- (97_full_reset_new_accounts.sql). RLS-политика "read own group_teachers rows"
-- фильтрует по teacher_id = current_teacher_id() без group_id-предиката —
-- ведущая колонка PK-индекса не совпадает, поэтому он не используется для
-- этого паттерна. is_my_teacher_group() (вызывается на каждой teacher-facing
-- RLS-политике: lessons, homework, attendance, lesson_grades, ...) делает
-- EXISTS-проверку по group_teachers(teacher_id, group_id) как один из трёх
-- OR-веток — без этого индекса это seq scan по мере роста group_teachers.
--
-- Аудит остальных 6 индексов из задачи (subjects.teacher_id, lessons(group_id,
-- starts_at), lessons.subject_id, homework.group_id, attendance.lesson_id,
-- lesson_grades.lesson_id) подтвердил, что они уже существуют — эта миграция
-- добавляет единственный реально отсутствующий индекс.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_group_teachers_teacher_group
  ON public.group_teachers (teacher_id, group_id);

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('112')
ON CONFLICT (version) DO NOTHING;

COMMIT;
