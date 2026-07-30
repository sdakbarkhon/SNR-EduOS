-- =====================================================================
-- Migration 160 — фоновый парсинг учебных планов: статус/прогресс
-- (Большой фикс, Блок 6, Задача 1).
--
-- ИСПРАВЛЕНИЯ К ПРОМТУ:
--
--   1) НОМЕР — промт просил "158", уже занята
--      (158_teacher_announcements_feed_rls.sql, более ранний заход этой
--      же сессии). Следующий свободный — 160 (159 тоже занята,
--      159_code_completion_type.sql, тот же заход).
--
--   2) Разведка нашла, что одних только status/progress_percent/
--      error_message НЕДОСТАТОЧНО для заявленной цели ("модалка
--      всплывает в любом месте приложения" через realtime): SELECT-
--      политика на curriculum_plans (миграция 116) —
--      can_view_curriculum_plan(school_id, group_id) — ссылается на
--      НЕ-PK колонки. Supabase Realtime оценивает RLS против WAL-записи;
--      для UPDATE/DELETE не-PK колонки попадают в WAL только при
--      REPLICA IDENTITY FULL — без неё authorizer не может вычислить
--      политику и МОЛЧА дропает событие (тот же баг, что чинила
--      20260623000037_lessons_replica_identity.sql для lessons — тот же
--      паттерн, один в один, включая fallback CREATE PUBLICATION на
--      случай если supabase_realtime вообще не существует). Без этой
--      добавки реалтайм-подписка на статус плана просто никогда не
--      сработала бы — тихо, без ошибки.
-- =====================================================================

BEGIN;

ALTER TABLE public.curriculum_plans
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready'
    CHECK (status IN ('processing', 'ready', 'error'));
ALTER TABLE public.curriculum_plans
  ADD COLUMN IF NOT EXISTS progress_percent int NOT NULL DEFAULT 100
    CHECK (progress_percent BETWEEN 0 AND 100);
ALTER TABLE public.curriculum_plans
  ADD COLUMN IF NOT EXISTS error_message text;

ALTER TABLE public.curriculum_plans REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'curriculum_plans'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.curriculum_plans;
    END IF;
  ELSE
    CREATE PUBLICATION supabase_realtime FOR TABLE public.curriculum_plans;
  END IF;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('160')
ON CONFLICT DO NOTHING;

COMMIT;
