-- Migration 108 — PROMT 3, Часть 1:
-- 1. Добавить subjects.is_stub — семантически отдельно от is_active (is_active
--    может быть выключен временно; is_stub значит "предмет-плейсхолдер, никогда
--    не показывать в расписании ученикам")
-- 2. Пометить 9 stub-предметов (не входят в 5 рабочих)
-- 3. Wipe всех уроков и связанных данных (attendance, lesson_grades, materials,
--    quiz_questions/attempts/answers, lesson_stages, raised_hands, excuses)
-- 4. homework сохраняется, но lesson_id обнуляется — задание работает и без
--    привязки (ре-привязка после генерации нового расписания в задаче 5.2)
-- Storage-файлы старых уроков не чистятся — осиротеют в bucket, не критично.

BEGIN;

-- ── 1. Column ────────────────────────────────────────────────────────────
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS is_stub boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_subjects_is_stub ON public.subjects (is_stub) WHERE is_stub = false;

-- ── 2. Пометка заглушек ──────────────────────────────────────────────────
-- 9 предметов, которые НЕ показываются в расписании:
UPDATE public.subjects SET is_stub = true
WHERE name IN (
  'Природоведение', 'ИЗО', 'Музыка', 'История',
  'Биология', 'Химия', 'Физика', 'География', 'Обществознание'
);

-- 5 рабочих предметов явно оставляем is_stub=false (на случай если ошибочно
-- проставилось):
UPDATE public.subjects SET is_stub = false
WHERE name IN (
  'Программирование', 'Робототехника', 'Математика',
  'Английский язык', 'Русский язык'
);

-- ── 3. Wipe уроков и связанных данных ────────────────────────────────────
-- Порядок важен: сначала child-таблицы с FK на lessons/lesson_stages, потом сами.

-- Дочерние quiz данных
DELETE FROM public.quiz_answers;
DELETE FROM public.quiz_attempts;
DELETE FROM public.quiz_questions;

-- Kahoot sessions
DELETE FROM public.kahoot_sessions;

-- Прогресс по этапам, поднятые руки, excuses
DELETE FROM public.lesson_stage_progress;
DELETE FROM public.lesson_raised_hands;
DELETE FROM public.lesson_excuse_requests;

-- Оценки за урок + посещаемость
DELETE FROM public.lesson_grades;
DELETE FROM public.attendance;

-- Материалы уроков
DELETE FROM public.lesson_materials;

-- ai_chat_messages / classwork / leave_requests имеют NOT NULL FK на lessons —
-- чистим их полностью (сейчас пусто, но защищаемся на будущее)
DELETE FROM public.ai_chat_messages;
DELETE FROM public.classwork;
DELETE FROM public.leave_requests;

-- charges / course_materials / grades имеют NULLable lesson_id — обнуляем
UPDATE public.charges SET lesson_id = NULL WHERE lesson_id IS NOT NULL;
UPDATE public.course_materials SET lesson_id = NULL WHERE lesson_id IS NOT NULL;
UPDATE public.grades SET lesson_id = NULL WHERE lesson_id IS NOT NULL;

-- Разрываем FK lessons.active_stage_id → lesson_stages, чтобы можно было
-- удалить stages, потом lessons.
UPDATE public.lessons SET active_stage_id = NULL, demo_material_id = NULL;

-- Этапы уроков
DELETE FROM public.lesson_stages;

-- Обнуляем FK homework.lesson_id (ре-привязка в задаче 5.2)
UPDATE public.homework SET lesson_id = NULL WHERE lesson_id IS NOT NULL;

-- Наконец сами уроки
DELETE FROM public.lessons;

-- ── 4. Регистрация миграции ──────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('108')
ON CONFLICT (version) DO NOTHING;

COMMIT;
