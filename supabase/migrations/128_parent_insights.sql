-- Промт МОБ-7, ЧАСТЬ 2 — v8 "EduOS Assistant Insight". Хранит сгенерированный
-- Gemini AI-анализ успеваемости/посещаемости/ДЗ ребёнка по неделям: и как
-- недельный кэш (API проверяет БД первым, не дёргает Gemini повторно в
-- течение 7 дней), и как история версий для аудита (никогда не
-- перезаписывается — каждая генерация своя строка).
--
-- INSERT — только через service_role в apps/web/app/api/mobile/insight/
-- route.ts (createAdminClient(), см. gemini-client.ts). Ни одной INSERT-
-- политики для authenticated/anon НЕ создаётся — это тот же идиом, что уже
-- используют admins (миграция 20260623000042_admin_role.sql: "Only
-- service_role can insert/update/delete... (no INSERT/UPDATE/DELETE
-- policies → только service_role может писать)"), а не отдельная явная
-- политика "WITH CHECK (true) FOR service_role" — service_role и так
-- обходит RLS целиком, явная политика для него ничего не даёт, только
-- создаёт ложное впечатление, что запись разрешена кому-то ещё.
--
-- SELECT — через уже существующий SECURITY DEFINER-хелпер is_my_child()
-- (миграция 74/126), а не через ручной inline-subquery по parent_students/
-- parents/auth.uid() — так делают уже 4+ существующих политики в проекте
-- (см. миграцию 76_parent_grades_visibility_gap.sql), сохраняем идиом.

BEGIN;

CREATE TABLE IF NOT EXISTS public.parent_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  locale text NOT NULL DEFAULT 'ru',
  insight_json jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS parent_insights_child_locale_generated_idx
  ON public.parent_insights (child_id, locale, generated_at DESC);

ALTER TABLE public.parent_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parent_can_read_own_children_insights" ON public.parent_insights;
CREATE POLICY "parent_can_read_own_children_insights"
  ON public.parent_insights FOR SELECT
  USING (public.is_my_child(child_id));

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('128')
ON CONFLICT (version) DO NOTHING;

COMMIT;
