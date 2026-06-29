-- =============================================================================
-- Migration 57: Clean all data for Iteration 4 demo seed
-- ВНИМАНИЕ: НЕОБРАТИМАЯ операция. Удаляет ВСЕ данные кроме админов и структуры/RLS.
-- Структура таблиц, RLS политики, триггеры — НЕ ТРОГАЮТСЯ.
-- После применения запустить: pnpm --filter web seed:demo-iter4
-- =============================================================================

-- ─── 1. Quiz / Kahoot / Stage children ───────────────────────────────────────
DELETE FROM public.quiz_answers;
DELETE FROM public.quiz_attempts;
DELETE FROM public.quiz_questions;
DELETE FROM public.kahoot_sessions;
DELETE FROM public.lesson_stage_progress;

-- ─── 2. Classwork chain ──────────────────────────────────────────────────────
DELETE FROM public.classwork_submissions;
DELETE FROM public.classwork_questions;
DELETE FROM public.classwork;

-- ─── 3. Other lesson children ────────────────────────────────────────────────
DELETE FROM public.ai_chat_messages;
DELETE FROM public.lesson_excuse_requests;
DELETE FROM public.lesson_raised_hands;
DELETE FROM public.leave_requests;
DELETE FROM public.attendance;
DELETE FROM public.lesson_grades;

-- ─── 4. Lesson core (stages → materials → lessons) ───────────────────────────
DELETE FROM public.lesson_stages;     -- cascades remaining quiz/stage_progress rows
DELETE FROM public.lesson_materials;
DELETE FROM public.lessons;           -- cascades remaining lesson children

-- ─── 5. Homework chain ───────────────────────────────────────────────────────
DELETE FROM public.test_answers;
DELETE FROM public.test_submissions;
DELETE FROM public.test_question_options;
DELETE FROM public.test_questions;
DELETE FROM public.homework_submissions;
DELETE FROM public.homework;

-- ─── 6. Announcements / Notifications ────────────────────────────────────────
DELETE FROM public.announcement_reads;
DELETE FROM public.notifications;
DELETE FROM public.announcements;

-- ─── 7. Projects chain ───────────────────────────────────────────────────────
DELETE FROM public.project_attachments;
DELETE FROM public.project_stage_progress;
DELETE FROM public.project_submissions;
DELETE FROM public.project_stages;
DELETE FROM public.projects;

-- ─── 8. Books ────────────────────────────────────────────────────────────────
DELETE FROM public.book_favorites;
DELETE FROM public.books;

-- ─── 9. Course materials ─────────────────────────────────────────────────────
DELETE FROM public.course_materials;

-- ─── 10. Daily facts ─────────────────────────────────────────────────────────
DELETE FROM public.daily_facts;

-- ─── 11. Conditional tables (могут не существовать в некоторых окружениях) ───
DO $$
BEGIN
  -- Старая таблица grades (migration 6 — может быть уже заменена lesson_grades)
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'grades') THEN
    DELETE FROM public.grades;
  END IF;

  -- notification_settings (migration 9)
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'notification_settings') THEN
    DELETE FROM public.notification_settings;
  END IF;

  -- messages (migration 8 — messages_announcements)
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'messages') THEN
    DELETE FROM public.messages;
  END IF;

  -- payments / charges (migration 10)
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'charges') THEN
    DELETE FROM public.charges;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'payments') THEN
    DELETE FROM public.payments;
  END IF;

  -- group_materials (упомянуто в промте, но миграции не найдено)
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'group_materials') THEN
    DELETE FROM public.group_materials;
  END IF;
END $$;

-- ─── 12. Subjects + Student-Group links ──────────────────────────────────────
DELETE FROM public.subjects;
DELETE FROM public.student_groups;

-- ─── 13. Корневые сущности ───────────────────────────────────────────────────
-- Порядок: students раньше teachers (student.curator_id → teachers SET NULL)
DELETE FROM public.students;
DELETE FROM public.teachers;
DELETE FROM public.groups;

-- ─── 14. Auth users (кроме админов) ─────────────────────────────────────────
-- admins.user_id ссылается на auth.users; удаляем всё КРОМЕ admin user_id.
DELETE FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM public.admins WHERE user_id IS NOT NULL
);

-- ─── 15. Проверки после очистки ──────────────────────────────────────────────
DO $$
DECLARE
  v_teachers_count int;
  v_students_count int;
  v_groups_count   int;
  v_admins_count   int;
BEGIN
  SELECT COUNT(*) INTO v_teachers_count FROM public.teachers;
  SELECT COUNT(*) INTO v_students_count FROM public.students;
  SELECT COUNT(*) INTO v_groups_count   FROM public.groups;
  SELECT COUNT(*) INTO v_admins_count   FROM public.admins;

  RAISE NOTICE 'After cleanup: teachers=%, students=%, groups=%, admins=%',
    v_teachers_count, v_students_count, v_groups_count, v_admins_count;

  IF v_admins_count = 0 THEN
    RAISE EXCEPTION 'CRITICAL: All admins deleted!';
  END IF;

  IF v_teachers_count > 0 OR v_students_count > 0 OR v_groups_count > 0 THEN
    RAISE EXCEPTION 'CRITICAL: Cleanup incomplete — teachers=%, students=%, groups=%',
      v_teachers_count, v_students_count, v_groups_count;
  END IF;
END $$;
