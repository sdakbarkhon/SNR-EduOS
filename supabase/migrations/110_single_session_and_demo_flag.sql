-- =====================================================================
-- Migration 110 — PROMT 3 (переработка демо-режима + single-session):
--
-- 1. Удалить 25 демо-учителей demo_teacher_{slug}_01..05 из миграции 109 —
--    пул демо-учителей больше не нужен: демо-клик логинит под РЕАЛЬНОГО
--    предметного учителя (teacher_prog/robot/math/english/russian) с
--    флагом is_demo в сессии.
-- 2. user_sessions — глобальный single-session реестр для ВСЕХ ролей:
--    одна активная сессия на аккаунт (UNIQUE user_id), логин делает
--    DELETE+INSERT, middleware сверяет session_id через check_user_session().
-- 3. is_demo boolean на 10 доменных таблицах + триггер fn_stamp_is_demo():
--    - INSERT из демо-сессии → is_demo=true (spoof-proof, клиентское
--      значение игнорируется для authenticated);
--    - UPDATE/DELETE реальной строки из демо-сессии → EXCEPTION
--      'editing_real_data_in_demo' (DB-уровневый 403 — записи идут
--      browser-клиентом под RLS, отдельного API-слоя нет);
--    - каскадные удаления (pg_trigger_depth() > 1) пропускаются: снос
--      демо-урока тянет за собой его реальные дочерние строки (например
--      attendance-заглушки от fn_auto_end_lessons).
-- 4. reset_demo_data_for_user() — точечная зачистка демо-данных одного
--    аккаунта; вызывается при перелогине (вытеснении демо-сессии) и из
--    крона.
-- 5. reset_expired_demo_sessions() v2 — по user_sessions.last_activity
--    (не по demo_sessions.claimed_at): logout НЕ удаляет строку сессии,
--    только штампует last_activity, поэтому «разлогинен >3ч назад» и
--    «неактивен 3ч» — одно условие. Плюс orphan-sweep и освобождение
--    пула демо-учеников (пул из 90 demo_student_* ОСТАЁТСЯ).
-- 6. claim_demo_account() — теперь student-only и server-only (вызов из
--    server action под service_role; у anon/authenticated EXECUTE отозван).
--
-- Примечание: в старой reset_expired_demo_sessions (миграции 99/106) были
-- латентные ошибки — фильтры по несуществующим колонкам
-- homework_submissions.created_at / quiz_attempts.created_at /
-- lesson_raised_hands.created_at (реальные: submitted_at / started_at /
-- raised_at). plpgsql валидирует ссылки при выполнении, а не при CREATE,
-- поэтому функция падала бы только при наличии протухших сессий. v2 ниже
-- использует фактические колонки.
-- =====================================================================

BEGIN;

-- ── 1. Удалить 25 демо-учителей ──────────────────────────────────────────
-- Старый фильтр 'demo_teacher_0%' (миграция 109) их не ловит — у новых
-- суффикс предмета: demo_teacher_prog_01 и т.д. После 109 никаких других
-- demo_teacher_% не существует, поэтому паттерн безопасно широкий.

-- Защитные удаления: данные, которые демо-учителя могли создать за время
-- жизни 109 на проде (FK marked_by/graded_by иначе заблокируют DELETE).
DELETE FROM public.attendance WHERE marked_by IN (
  SELECT id FROM public.teachers WHERE username LIKE 'demo\_teacher\_%' ESCAPE '\');
DELETE FROM public.lesson_grades WHERE graded_by IN (
  SELECT id FROM public.teachers WHERE username LIKE 'demo\_teacher\_%' ESCAPE '\');
DELETE FROM public.homework WHERE teacher_id IN (
  SELECT id FROM public.teachers WHERE username LIKE 'demo\_teacher\_%' ESCAPE '\');
DELETE FROM public.lesson_materials WHERE uploaded_by IN (
  SELECT id FROM public.teachers WHERE username LIKE 'demo\_teacher\_%' ESCAPE '\');
DELETE FROM public.course_materials WHERE uploaded_by IN (
  SELECT id FROM public.teachers WHERE username LIKE 'demo\_teacher\_%' ESCAPE '\');

DELETE FROM public.demo_sessions WHERE account_user_id IN (
  SELECT user_id FROM public.teachers WHERE username LIKE 'demo\_teacher\_%' ESCAPE '\');
-- В group_teachers демо-учителя не добавлялись (см. 109), но защитно:
DELETE FROM public.group_teachers WHERE teacher_id IN (
  SELECT id FROM public.teachers WHERE username LIKE 'demo\_teacher\_%' ESCAPE '\');
-- subjects.teacher_id после 109 указывает на реальных, но защитно:
UPDATE public.subjects
SET teacher_id = (SELECT id FROM public.teachers WHERE username = 'teacher_karim')
WHERE teacher_id IN (
  SELECT id FROM public.teachers WHERE username LIKE 'demo\_teacher\_%' ESCAPE '\');

DELETE FROM public.teachers WHERE username LIKE 'demo\_teacher\_%' ESCAPE '\';
-- auth.identities каскадится от auth.users.
DELETE FROM auth.users WHERE email LIKE 'demo\_teacher\_%@demo.snr.local' ESCAPE '\';

-- ── 2. user_sessions — single-session реестр ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id      uuid NOT NULL,
  device_info     text,
  is_demo         boolean NOT NULL DEFAULT false,
  demo_started_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_activity   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_sessions IS
  'Single-session: ровно одна активная сессия на аккаунт (все роли). session_id = session_id-claim из Supabase JWT (стабилен при refresh). Логин: DELETE+INSERT. Logout строку НЕ удаляет — только last_activity, чтобы крон отличал «брошенную» демо-сессию по одному условию.';

CREATE INDEX IF NOT EXISTS idx_user_sessions_demo
  ON public.user_sessions (last_activity) WHERE is_demo;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
-- Ноль политик: клиентского доступа нет вообще. Чтение — только через
-- SECURITY DEFINER RPC ниже; запись — только service_role (server actions).
REVOKE ALL ON public.user_sessions FROM anon, authenticated;

-- ── 3. is_demo на доменных таблицах ──────────────────────────────────────
-- 9 таблиц из ТЗ + course_materials (учителя пишут туда же; старый reset
-- её чистил — иначе демо-файлы жили бы вечно).
ALTER TABLE public.lessons               ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.lesson_stages         ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.lesson_materials      ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.homework              ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.attendance            ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.lesson_grades         ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.homework_submissions  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.test_submissions      ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.classwork_submissions ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.course_materials      ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_lessons_is_demo               ON public.lessons (is_demo)               WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_lesson_stages_is_demo         ON public.lesson_stages (is_demo)         WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_lesson_materials_is_demo      ON public.lesson_materials (is_demo)      WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_homework_is_demo              ON public.homework (is_demo)              WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_attendance_is_demo            ON public.attendance (is_demo)            WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_lesson_grades_is_demo         ON public.lesson_grades (is_demo)         WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_homework_submissions_is_demo  ON public.homework_submissions (is_demo)  WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_test_submissions_is_demo      ON public.test_submissions (is_demo)      WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_classwork_submissions_is_demo ON public.classwork_submissions (is_demo) WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_course_materials_is_demo      ON public.course_materials (is_demo)      WHERE is_demo;

-- ── 4. is_demo_session() + fn_stamp_is_demo() ────────────────────────────
CREATE OR REPLACE FUNCTION public.is_demo_session()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_sessions
    WHERE user_id = auth.uid() AND is_demo
  );
$$;

REVOKE ALL ON FUNCTION public.is_demo_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_demo_session() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_stamp_is_demo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- auth.uid() NULL (миграции, pg_cron, service_role) — значение не трогаем:
    -- сидовые/кроновые вставки остаются is_demo=false (или что передали).
    IF auth.uid() IS NOT NULL THEN
      NEW.is_demo := public.is_demo_session();
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE/DELETE: демо-сессия не может трогать реальные строки. Каскады
  -- (pg_trigger_depth() > 1, например снос демо-урока с его реальными
  -- attendance-заглушками) пропускаем — дочерние строки демо-объекта
  -- концептуально тоже демо.
  IF pg_trigger_depth() <= 1
     AND OLD.is_demo = false
     AND public.is_demo_session() THEN
    RAISE EXCEPTION 'editing_real_data_in_demo' USING ERRCODE = 'P0002';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Реальная сессия/крон, правящие демо-строку, не «отмывают» её.
    NEW.is_demo := OLD.is_demo;
    RETURN NEW;
  END IF;

  RETURN OLD; -- DELETE
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lessons', 'lesson_stages', 'lesson_materials', 'homework',
    'attendance', 'lesson_grades', 'homework_submissions',
    'test_submissions', 'classwork_submissions', 'course_materials'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_stamp_is_demo ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_stamp_is_demo
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE PROCEDURE public.fn_stamp_is_demo()', t);
  END LOOP;
END $$;

-- ── 5. check_user_session() + touch_user_session() ───────────────────────
-- Вызывается из middleware на каждый запрос. Возвращает:
--   'ok'       — сессия действительна (+ throttle-touch last_activity);
--   'missing'  — строки нет (деплой single-session / сессия снесена кроном)
--                → тихий редирект на /login;
--   'replaced' — session_id не совпал (вошли с другого устройства)
--                → /login?reason=session_replaced.
CREATE OR REPLACE FUNCTION public.check_user_session(p_session_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_session_id uuid;
  v_last_activity timestamptz;
BEGIN
  SELECT id, session_id, last_activity
    INTO v_id, v_session_id, v_last_activity
  FROM public.user_sessions
  WHERE user_id = auth.uid();

  IF v_id IS NULL THEN
    RETURN 'missing';
  END IF;

  IF v_session_id <> p_session_id THEN
    RETURN 'replaced';
  END IF;

  -- Throttle: пишем не чаще раза в 5 минут, чтобы не делать UPDATE на
  -- каждый HTTP-запрос.
  IF v_last_activity < now() - interval '5 minutes' THEN
    UPDATE public.user_sessions SET last_activity = now() WHERE id = v_id;
  END IF;

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.check_user_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_user_session(uuid) TO authenticated, service_role;

-- Heartbeat с клиента (DemoHeartbeat, раз в 5 минут). Обновляет и
-- user_sessions, и demo_sessions (пул демо-учеников) — активный пользователь
-- не должен быть выкинут кроном.
CREATE OR REPLACE FUNCTION public.touch_user_session()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.user_sessions SET last_activity = now() WHERE user_id = auth.uid();
  UPDATE public.demo_sessions SET last_activity = now() WHERE account_user_id = auth.uid() AND released = false;
$$;

REVOKE ALL ON FUNCTION public.touch_user_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_user_session() TO authenticated, service_role;

-- ── 6. reset_demo_data_for_user() ────────────────────────────────────────
-- Точечная зачистка демо-следов одного аккаунта. Вызывается:
--   - при логине, если вытесненная сессия была is_demo (мгновенно чистая
--     площадка для следующего, реальный владелец не видит демо-мусор);
--   - из reset_expired_demo_sessions() для протухших демо-сессий.
-- p_since — created_at демо-сессии: граница для таблиц без is_demo
-- (single-session гарантирует, что реальные записи владельца не могли
-- чередоваться с демо-записями в этом окне).
CREATE OR REPLACE FUNCTION public.reset_demo_data_for_user(
  p_user_id uuid,
  p_since timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
  v_student_id uuid;
  v_is_pool boolean := false;
BEGIN
  SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = p_user_id;
  SELECT id INTO v_student_id FROM public.students WHERE user_id = p_user_id;

  IF v_student_id IS NOT NULL THEN
    SELECT username LIKE 'demo\_%' ESCAPE '\' INTO v_is_pool
    FROM public.students WHERE id = v_student_id;
  END IF;

  IF v_teacher_id IS NOT NULL THEN
    -- Уведомления, порождённые демо-объектами (пока объекты ещё существуют).
    DELETE FROM public.notifications WHERE source_id IN (
      SELECT id FROM public.homework WHERE teacher_id = v_teacher_id AND is_demo);
    DELETE FROM public.notifications WHERE source_id IN (
      SELECT l.id FROM public.lessons l
      JOIN public.subjects s ON s.id = l.subject_id
      WHERE l.is_demo AND s.teacher_id = v_teacher_id);
    DELETE FROM public.notifications WHERE source_id IN (
      SELECT id FROM public.lesson_grades WHERE graded_by = v_teacher_id AND is_demo);

    -- Демо-уроки этого учителя (у lessons нет teacher_id — атрибуция через
    -- subjects.teacher_id; демо-сессия под teacher_X создаёт уроки только
    -- своего предмета). Каскад: lesson_stages, lesson_materials, attendance,
    -- lesson_grades, classwork, quiz_* и т.д.
    DELETE FROM public.lessons l
    WHERE l.is_demo
      AND l.subject_id IN (SELECT id FROM public.subjects WHERE teacher_id = v_teacher_id);

    -- Демо-строки, добавленные в РЕАЛЬНЫЕ уроки.
    DELETE FROM public.lesson_stages ls
    WHERE ls.is_demo AND EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.subjects s ON s.id = l.subject_id
      WHERE l.id = ls.lesson_id AND s.teacher_id = v_teacher_id);
    DELETE FROM public.homework          WHERE teacher_id  = v_teacher_id AND is_demo;
    DELETE FROM public.attendance        WHERE marked_by   = v_teacher_id AND is_demo;
    DELETE FROM public.lesson_grades     WHERE graded_by   = v_teacher_id AND is_demo;
    DELETE FROM public.lesson_materials  WHERE uploaded_by = v_teacher_id AND is_demo;
    DELETE FROM public.course_materials  WHERE uploaded_by = v_teacher_id AND is_demo;
  END IF;

  IF v_student_id IS NOT NULL THEN
    DELETE FROM public.homework_submissions  WHERE student_id = v_student_id AND is_demo;
    DELETE FROM public.test_submissions      WHERE student_id = v_student_id AND is_demo;
    DELETE FROM public.classwork_submissions WHERE student_id = v_student_id AND is_demo;
    DELETE FROM public.attendance            WHERE student_id = v_student_id AND is_demo;
    DELETE FROM public.lesson_grades         WHERE student_id = v_student_id AND is_demo;

    IF v_is_pool THEN
      -- Пул-аккаунт demo_student_* одноразовый — всё его добро в таблицах
      -- без is_demo сносим целиком (включая заглушки посещаемости от
      -- fn_auto_end_lessons, созданные кроном с is_demo=false).
      DELETE FROM public.lesson_stage_progress WHERE student_id = v_student_id;
      DELETE FROM public.quiz_attempts         WHERE student_id = v_student_id;
      DELETE FROM public.lesson_raised_hands   WHERE student_id = v_student_id;
      DELETE FROM public.ai_chat_messages      WHERE student_id = v_student_id;
      DELETE FROM public.attendance            WHERE student_id = v_student_id;
      DELETE FROM public.lesson_grades         WHERE student_id = v_student_id;
    ELSIF p_since IS NOT NULL THEN
      -- Реальный ученик, побывавший в демо (сейчас таких сценариев нет,
      -- но функция не должна зависеть от этого допущения).
      DELETE FROM public.lesson_stage_progress WHERE student_id = v_student_id AND completed_at > p_since;
      DELETE FROM public.quiz_attempts         WHERE student_id = v_student_id AND started_at  > p_since;
      DELETE FROM public.lesson_raised_hands   WHERE student_id = v_student_id AND raised_at   > p_since;
      DELETE FROM public.ai_chat_messages      WHERE student_id = v_student_id AND created_at  > p_since;
    END IF;
  END IF;

  -- Сообщения/уведомления самого аккаунта.
  IF v_is_pool THEN
    DELETE FROM public.chat_messages  WHERE sender_id = p_user_id;
    DELETE FROM public.notifications  WHERE recipient_user_id = p_user_id;
  ELSIF p_since IS NOT NULL THEN
    -- Для реального аккаунта: только отправленное за демо-окно. Полученные
    -- уведомления не трогаем — среди них могут быть настоящие.
    DELETE FROM public.chat_messages  WHERE sender_id = p_user_id AND created_at > p_since;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_demo_data_for_user(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_demo_data_for_user(uuid, timestamptz) TO service_role;

-- ── 7. claim_demo_account — student-only, server-only ────────────────────
DROP FUNCTION IF EXISTS public.claim_demo_account(text, text);
DROP FUNCTION IF EXISTS public.claim_demo_account(text, text, text);

CREATE OR REPLACE FUNCTION public.claim_demo_account(p_kind text, p_grade text DEFAULT NULL)
RETURNS TABLE(username text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_user_id uuid;
BEGIN
  IF p_kind IS DISTINCT FROM 'student' THEN
    -- Демо-учителя больше не пул: клик по карточке предмета — прямой логин
    -- под реального teacher_{slug} (server action demoLogin).
    RETURN;
  END IF;

  SELECT ds.id, ds.account_user_id INTO v_session_id, v_user_id
  FROM public.demo_sessions ds
  JOIN public.students s ON s.user_id = ds.account_user_id
  WHERE ds.released = true
    AND s.username LIKE 'demo\_student\_' || p_grade || '\_%' ESCAPE '\'
  ORDER BY random()
  FOR UPDATE OF ds SKIP LOCKED
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.demo_sessions
  SET released = false, claimed_at = now(), last_activity = now()
  WHERE id = v_session_id;

  RETURN QUERY
  SELECT s.username, u.email::text
  FROM auth.users u
  JOIN public.students s ON s.user_id = u.id
  WHERE u.id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_demo_account(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_demo_account(text, text) TO service_role;

-- ── 8. reset_expired_demo_sessions() v2 ──────────────────────────────────
-- Крон-джоб 'reset-expired-demo-sessions' (*/30, миграция 99) продолжает
-- вызывать это имя — тело заменяем целиком.
CREATE OR REPLACE FUNCTION public.reset_expired_demo_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  -- (a) Протухшие демо-сессии: неактивность 3ч+ (logout строку не удаляет,
  -- поэтому «вышел 3ч назад» попадает под то же условие).
  FOR r IN
    SELECT us.id, us.user_id, us.created_at
    FROM public.user_sessions us
    WHERE us.is_demo
      AND us.last_activity < now() - interval '3 hours'
  LOOP
    PERFORM public.reset_demo_data_for_user(r.user_id, r.created_at);
    DELETE FROM public.user_sessions WHERE id = r.id;
  END LOOP;

  -- (b) Orphan-sweep (страховка): is_demo-строки старше 3ч, чей
  -- аккаунт-владелец не имеет активной демо-сессии — например, если строка
  -- сессии была вытеснена реальным логином, а зачистка при логине не
  -- отработала. Атрибуция та же, что в reset_demo_data_for_user.
  DELETE FROM public.lessons l
  WHERE l.is_demo AND l.created_at < now() - interval '3 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_sessions us
      JOIN public.teachers t ON t.user_id = us.user_id
      JOIN public.subjects s ON s.teacher_id = t.id
      WHERE us.is_demo AND us.last_activity >= now() - interval '3 hours'
        AND s.id = l.subject_id);

  DELETE FROM public.lesson_stages ls
  WHERE ls.is_demo AND ls.created_at < now() - interval '3 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.subjects s ON s.id = l.subject_id
      JOIN public.teachers t ON t.id = s.teacher_id
      JOIN public.user_sessions us ON us.user_id = t.user_id
      WHERE l.id = ls.lesson_id
        AND us.is_demo AND us.last_activity >= now() - interval '3 hours');

  DELETE FROM public.homework h
  WHERE h.is_demo AND h.created_at < now() - interval '3 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_sessions us
      JOIN public.teachers t ON t.user_id = us.user_id
      WHERE us.is_demo AND us.last_activity >= now() - interval '3 hours'
        AND t.id = h.teacher_id);

  DELETE FROM public.attendance a
  WHERE a.is_demo AND a.marked_at < now() - interval '3 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_sessions us
      LEFT JOIN public.teachers t ON t.user_id = us.user_id
      LEFT JOIN public.students st ON st.user_id = us.user_id
      WHERE us.is_demo AND us.last_activity >= now() - interval '3 hours'
        AND (t.id = a.marked_by OR st.id = a.student_id));

  DELETE FROM public.lesson_grades g
  WHERE g.is_demo AND g.graded_at < now() - interval '3 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_sessions us
      LEFT JOIN public.teachers t ON t.user_id = us.user_id
      LEFT JOIN public.students st ON st.user_id = us.user_id
      WHERE us.is_demo AND us.last_activity >= now() - interval '3 hours'
        AND (t.id = g.graded_by OR st.id = g.student_id));

  DELETE FROM public.lesson_materials m
  WHERE m.is_demo AND m.created_at < now() - interval '3 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_sessions us
      JOIN public.teachers t ON t.user_id = us.user_id
      WHERE us.is_demo AND us.last_activity >= now() - interval '3 hours'
        AND t.id = m.uploaded_by);

  DELETE FROM public.course_materials m
  WHERE m.is_demo AND m.created_at < now() - interval '3 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_sessions us
      JOIN public.teachers t ON t.user_id = us.user_id
      WHERE us.is_demo AND us.last_activity >= now() - interval '3 hours'
        AND t.id = m.uploaded_by);

  DELETE FROM public.homework_submissions hs
  WHERE hs.is_demo AND hs.submitted_at < now() - interval '3 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_sessions us
      JOIN public.students st ON st.user_id = us.user_id
      WHERE us.is_demo AND us.last_activity >= now() - interval '3 hours'
        AND st.id = hs.student_id);

  DELETE FROM public.test_submissions ts
  WHERE ts.is_demo AND ts.submitted_at < now() - interval '3 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_sessions us
      JOIN public.students st ON st.user_id = us.user_id
      WHERE us.is_demo AND us.last_activity >= now() - interval '3 hours'
        AND st.id = ts.student_id);

  DELETE FROM public.classwork_submissions cs
  WHERE cs.is_demo AND cs.submitted_at < now() - interval '3 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_sessions us
      JOIN public.students st ON st.user_id = us.user_id
      WHERE us.is_demo AND us.last_activity >= now() - interval '3 hours'
        AND st.id = cs.student_id);

  -- (c) Освобождение пула демо-учеников: занят, но активной демо-сессии у
  -- аккаунта нет (клейм без логина, протухшая/вытесненная сессия). Перед
  -- release добираем возможные хвосты аккаунта.
  FOR r IN
    SELECT ds.id, ds.account_user_id
    FROM public.demo_sessions ds
    WHERE ds.released = false
      AND NOT EXISTS (
        SELECT 1 FROM public.user_sessions us
        WHERE us.user_id = ds.account_user_id
          AND us.is_demo
          AND us.last_activity >= now() - interval '3 hours')
      AND COALESCE(ds.last_activity, ds.claimed_at, now()) < now() - interval '3 hours'
  LOOP
    PERFORM public.reset_demo_data_for_user(r.account_user_id);
    DELETE FROM public.user_sessions WHERE user_id = r.account_user_id;
    UPDATE public.demo_sessions SET released = true WHERE id = r.id;
  END LOOP;
END;
$$;

-- ── 9. Регистрация ───────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('110')
ON CONFLICT (version) DO NOTHING;

COMMIT;
