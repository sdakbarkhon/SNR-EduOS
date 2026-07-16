-- =====================================================================
-- Migration 132 — P2: снос старой демо-инфры + конвертация 90 demo →
-- реальные.
--
-- Новая модель (см. resheniya_2.md, PROMT «пачка 2»): демо-режим — это
-- вход в РЕАЛЬНЫЙ аккаунт из общего пула + жёлтый баннер. Никаких
-- is_demo-колонок, никакого fn_stamp_is_demo блокирующего UPDATE,
-- никакого reset_expired_demo_sessions, никакого пула demo_sessions.
-- Идентификация «сейчас демо» переносится в отдельный http-only cookie
-- snr_demo_session_token; выдача и heartbeat — в новую таблицу
-- demo_leases (миграция 133).
--
-- Что уходит:
--   - pg_cron 'reset-expired-demo-sessions' (*/30 мин)
--   - trg_stamp_is_demo BEFORE INSERT/UPDATE/DELETE на 10 таблицах
--   - функции: fn_stamp_is_demo(), is_demo_session(),
--     claim_demo_account(), reset_demo_data_for_user(),
--     reset_expired_demo_sessions(), touch_demo_session()
--   - колонки is_demo с 10 доменных таблиц + user_sessions.is_demo +
--     user_sessions.demo_started_at
--   - индексы idx_*_is_demo, idx_user_sessions_demo
--   - таблица public.demo_sessions (пул из 99)
--
-- Что остаётся (single-session нужен и для реальных аккаунтов):
--   - public.user_sessions без is_demo/demo_started_at
--   - check_user_session(uuid) без изменений (не трогает is_demo)
--   - touch_user_session() переписан без UPDATE demo_sessions
--
-- RLS-политики, ссылающиеся на is_demo: 4 политики на lessons из
-- миграции 131 (teacher reads/insert/updates/deletes) плюс helper
-- teacher_can_write_lesson(). Ветки is_demo там — parity для старого
-- пула demo_teacher_XX (который снесён миграцией 110). В новой P2-модели
-- «demo-teacher = реальный teacher_prog/robot/math/english/russian»
-- их сессии автоматически удовлетворяют is_subject_owner, is_demo-ветка
-- становится мёртвой. Переписываем эти политики и helper без is_demo
-- ПЕРЕД дропом колонки (иначе ALTER TABLE ... DROP COLUMN упадёт с
-- ошибкой «policy depends on column»).
--
-- Конвертация: 90 demo_student_XX_XX (auth.users emails
-- demo_student_*@demo.snr.local) → тем же логином, но без is_demo в
-- user_metadata и с password123 (для единообразия с 6 реальными).
-- В students.status все 90 уже active — идемпотентный UPDATE защитно.
--
-- Rollback тяжёлый: удаляются колонки и dropped старые функции.
-- Перед применением заказчику рекомендовано снять pg_dump.
-- =====================================================================

BEGIN;

-- ── 1. Снять pg_cron задачу reset_expired_demo_sessions ──────────────
-- Крон-джоб из миграции 99, обновлялся в 110. Убираем ДО DROP функции.
DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'reset-expired-demo-sessions';
EXCEPTION
  WHEN undefined_table THEN
    -- pg_cron не установлен — безопасно пропускаем.
    NULL;
  WHEN undefined_function THEN
    NULL;
END $$;

-- ── 2. Снять триггеры trg_stamp_is_demo с 10 таблиц ──────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lessons', 'lesson_stages', 'lesson_materials', 'homework',
    'attendance', 'lesson_grades', 'homework_submissions',
    'test_submissions', 'classwork_submissions', 'course_materials'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_stamp_is_demo ON public.%I', t);
  END LOOP;
END $$;

-- ── 3. Дропнуть демо-функции ─────────────────────────────────────────
-- CASCADE защитно, если что-то ещё ссылается на них (не должно, но
-- страхуемся). Каскад НЕ снесёт check_user_session — он на них не
-- завязан.
DROP FUNCTION IF EXISTS public.fn_stamp_is_demo() CASCADE;
DROP FUNCTION IF EXISTS public.claim_demo_account(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.claim_demo_account(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.reset_demo_data_for_user(uuid, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS public.reset_expired_demo_sessions() CASCADE;
DROP FUNCTION IF EXISTS public.touch_demo_session() CASCADE;

-- ── 4. Переписать touch_user_session без демо-строчки ────────────────
-- В версии 110 внутри был лишний UPDATE demo_sessions — после DROP
-- таблицы (шаг 8) функция бы падала. Переопределяем сейчас.
CREATE OR REPLACE FUNCTION public.touch_user_session()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.user_sessions
     SET last_activity = now()
   WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.touch_user_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_user_session() TO authenticated, service_role;

-- ── 5. Переписать 131-политики + teacher_can_write_lesson без is_demo ─
-- Ветки is_demo были parity для старого пула demo_teacher_XX (снесён
-- в 110). Новая модель: demo = вход в реальный teacher_prog/... —
-- покрывается is_subject_owner естественно.

CREATE OR REPLACE FUNCTION public.teacher_can_write_lesson(p_lesson_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lessons l
    WHERE l.id = p_lesson_id
      AND public.is_subject_owner(l.subject_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.teacher_can_write_lesson(uuid) TO authenticated;

-- SELECT: предметник — свой предмет; куратор — все уроки своих групп
DROP POLICY IF EXISTS "teacher reads lessons in own groups" ON public.lessons;
CREATE POLICY "teacher reads lessons in own groups" ON public.lessons
  FOR SELECT USING (
    (
      (
        public.is_subject_owner(subject_id)
        OR (public.is_curator_teacher() AND public.is_my_teacher_group(group_id))
      )
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- INSERT: только предметник со своим предметом в своей группе
DROP POLICY IF EXISTS "teachers_insert_lessons" ON public.lessons;
CREATE POLICY "teachers_insert_lessons" ON public.lessons
  FOR INSERT WITH CHECK (
    (
      public.is_my_teacher_group(group_id)
      AND public.is_subject_owner(subject_id)
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- UPDATE: только владелец предмета урока
DROP POLICY IF EXISTS "teacher updates own group lessons" ON public.lessons;
CREATE POLICY "teacher updates own group lessons" ON public.lessons
  FOR UPDATE USING (
    (
      public.is_subject_owner(subject_id)
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      public.is_subject_owner(subject_id)
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- DELETE: симметрично UPDATE
DROP POLICY IF EXISTS "teachers_delete_lessons" ON public.lessons;
CREATE POLICY "teachers_delete_lessons" ON public.lessons
  FOR DELETE USING (
    (
      public.is_subject_owner(subject_id)
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- ── 6. Дропнуть is_demo_session (её больше никто не вызывает) ────────
DROP FUNCTION IF EXISTS public.is_demo_session() CASCADE;

-- ── 7. Дропнуть индексы is_demo ──────────────────────────────────────
DROP INDEX IF EXISTS public.idx_lessons_is_demo;
DROP INDEX IF EXISTS public.idx_lesson_stages_is_demo;
DROP INDEX IF EXISTS public.idx_lesson_materials_is_demo;
DROP INDEX IF EXISTS public.idx_homework_is_demo;
DROP INDEX IF EXISTS public.idx_attendance_is_demo;
DROP INDEX IF EXISTS public.idx_lesson_grades_is_demo;
DROP INDEX IF EXISTS public.idx_homework_submissions_is_demo;
DROP INDEX IF EXISTS public.idx_test_submissions_is_demo;
DROP INDEX IF EXISTS public.idx_classwork_submissions_is_demo;
DROP INDEX IF EXISTS public.idx_course_materials_is_demo;
DROP INDEX IF EXISTS public.idx_user_sessions_demo;

-- ── 8. Дропнуть колонки is_demo с 10 доменных таблиц + user_sessions ─
ALTER TABLE public.lessons               DROP COLUMN IF EXISTS is_demo;
ALTER TABLE public.lesson_stages         DROP COLUMN IF EXISTS is_demo;
ALTER TABLE public.lesson_materials      DROP COLUMN IF EXISTS is_demo;
ALTER TABLE public.homework              DROP COLUMN IF EXISTS is_demo;
ALTER TABLE public.attendance            DROP COLUMN IF EXISTS is_demo;
ALTER TABLE public.lesson_grades         DROP COLUMN IF EXISTS is_demo;
ALTER TABLE public.homework_submissions  DROP COLUMN IF EXISTS is_demo;
ALTER TABLE public.test_submissions      DROP COLUMN IF EXISTS is_demo;
ALTER TABLE public.classwork_submissions DROP COLUMN IF EXISTS is_demo;
ALTER TABLE public.course_materials      DROP COLUMN IF EXISTS is_demo;
ALTER TABLE public.user_sessions         DROP COLUMN IF EXISTS is_demo;
ALTER TABLE public.user_sessions         DROP COLUMN IF EXISTS demo_started_at;

-- ── 9. Снять таблицу demo_sessions ───────────────────────────────────
DROP TABLE IF EXISTS public.demo_sessions CASCADE;

-- ── 10. Конвертация 90 demo_student_XX → реальные ────────────────────
-- В auth.users: убрать is_demo из user_metadata и сбросить пароль на
-- password123 (единообразие). Идентификация — по email-шаблону, т.к.
-- в проекте demo-аккаунты сидированы с доменом @demo.snr.local (см.
-- сэмпл: demo_student_7_05@demo.snr.local, demo_student_10_01 и т.д.).
-- crypt(...,gen_salt('bf')) — тот же паттерн, что используется в
-- миграции 20260702000065_demo_reset.sql (Supabase хранит bcrypt в
-- auth.users.encrypted_password).
UPDATE auth.users u
SET
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) - 'is_demo',
  encrypted_password = crypt('password123', gen_salt('bf')),
  updated_at         = now()
WHERE (raw_user_meta_data->>'username') LIKE 'demo\_student\_%' ESCAPE '\'
   OR u.email LIKE 'demo\_student\_%@demo.snr.local' ESCAPE '\';

-- Убедиться что students.status='active' (защитно; в проде уже active).
UPDATE public.students
   SET status = 'active'
 WHERE username LIKE 'demo\_student\_%' ESCAPE '\'
   AND status IS DISTINCT FROM 'active';

-- ── 11. Регистрация ──────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('132')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ── После применения — руками проверить: ────────────────────────────
--   1) SELECT column_name FROM information_schema.columns
--      WHERE table_schema='public' AND column_name='is_demo';
--      Ожидаемо: 0 строк.
--   2) SELECT proname FROM pg_proc WHERE proname IN
--      ('fn_stamp_is_demo','is_demo_session','claim_demo_account',
--       'reset_demo_data_for_user','reset_expired_demo_sessions',
--       'touch_demo_session');
--      Ожидаемо: 0 строк.
--   3) SELECT tgname FROM pg_trigger WHERE tgname='trg_stamp_is_demo';
--      Ожидаемо: 0 строк.
--   4) SELECT jobname FROM cron.job WHERE jobname='reset-expired-demo-sessions';
--      Ожидаемо: 0 строк.
--   5) SELECT count(*) FROM auth.users
--      WHERE (raw_user_meta_data->>'username') LIKE 'demo\_student\_%' ESCAPE '\';
--      Ожидаемо: 90 (email/username остаются — они «реальные», просто
--      без is_demo и с password123).
