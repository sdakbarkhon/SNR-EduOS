-- =====================================================================
-- Migration 133 — P2: новая lease-инфраструктура.
--
-- Применяется ПОСЛЕ 132 (иначе полагается на dropped-структуры не
-- будет, но лучше держать порядок явно).
--
-- Модель:
--   * demo_leases фиксирует «сейчас <кто-то> занял <аккаунт> под <role>»
--   * Timeout неактивности — 15 минут (после чего слот освобождается
--     автоматически «ленивым sweep'ом» при следующем claim/status)
--   * Heartbeat раз в 5 минут (клиент /api/demo/heartbeat) продлевает
--     last_activity_at
--   * Explicit release (кнопка «выйти из демо» или signOut) сразу
--     ставит released_at
--
-- Пулы:
--   * student: любой из ~96 students со status='active'
--   * teacher: точечно по subject_slug — единственный учитель предмета
--     (teacher_prog/robot/math/english/russian; куратор teacher_karim
--     с subject_slug IS NULL исключён)
--   * parent: любой из 3 parents (parent_ismailov/rakhimov/karimov)
--
-- Всё через SECURITY DEFINER RPC. Клиентских RLS-политик у demo_leases
-- нет — доступ только через RPC + service_role. anon-роль имеет
-- EXECUTE на RPC (нужно для /login до входа).
-- =====================================================================

BEGIN;

-- ── 1. Таблица + индексы + RLS ───────────────────────────────────────
-- Если после 132 остались какие-то dangling варианты — сносим и создаём
-- с чистого листа (миграция 132 не трогает demo_leases).
DROP TABLE IF EXISTS public.demo_leases CASCADE;

CREATE TABLE public.demo_leases (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role              text NOT NULL CHECK (role IN ('student', 'teacher', 'parent')),
  -- subject_slug — только для role='teacher' (какой предмет заняли).
  -- Для student/parent обязательно NULL (валидация в claim_demo_slot).
  subject_slug      text,
  session_token     text NOT NULL UNIQUE,
  claimed_at        timestamptz NOT NULL DEFAULT now(),
  last_activity_at  timestamptz NOT NULL DEFAULT now(),
  released_at       timestamptz,
  school_id         uuid NOT NULL
);

CREATE INDEX demo_leases_active_by_role_idx
  ON public.demo_leases (role, released_at, last_activity_at);

CREATE UNIQUE INDEX demo_leases_session_token_active_idx
  ON public.demo_leases (session_token)
  WHERE released_at IS NULL;

CREATE UNIQUE INDEX demo_leases_user_active_idx
  ON public.demo_leases (user_id)
  WHERE released_at IS NULL;

ALTER TABLE public.demo_leases ENABLE ROW LEVEL SECURITY;
-- Ноль клиентских политик — доступ строго через SECURITY DEFINER RPC.
REVOKE ALL ON public.demo_leases FROM anon, authenticated;

COMMENT ON TABLE public.demo_leases IS
  'P2 демо-lease: кто занял какой реальный аккаунт под какую роль. '
  'Timeout неактивности 15 мин. Клиентского доступа нет — только через '
  'RPC claim_demo_slot/heartbeat_demo_slot/release_demo_slot/'
  'get_occupied_teacher_subjects.';

-- ── 2. Внутренний хелпер: ленивый sweep протухших leases ─────────────
-- Не exported. Вызывается из claim/get_occupied_teacher_subjects чтобы
-- освобождать «зависшие» слоты (клиент закрыл вкладку без release).
CREATE OR REPLACE FUNCTION public.sweep_expired_demo_leases()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.demo_leases
     SET released_at = now()
   WHERE released_at IS NULL
     AND last_activity_at < now() - interval '15 minutes';
$$;

-- ── 3. RPC: claim_demo_slot ──────────────────────────────────────────
-- Атомарная выдача свободного аккаунта из пула по (p_role, p_subject_slug).
-- В отличие от старого claim_demo_account, теперь СПЕЦИАЛЬНО НЕ разделяем
-- students на classes (класс демо-пользователь не выбирает).
--
-- Возврат: username (для UI-debug), password (фиксированный
-- 'password123' — единый в проекте), session_token (кладётся в
-- snr-demo-session cookie), user_id (не используется клиентом, но
-- полезен серверу для лога). email опущен потому что клиенту для
-- signInWithPassword проще резолвить email из username (см. server
-- action).
CREATE OR REPLACE FUNCTION public.claim_demo_slot(
  p_role text,
  p_subject_slug text DEFAULT NULL
)
RETURNS TABLE(
  username      text,
  email         text,
  password      text,
  session_token text,
  user_id       uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id       uuid;
  v_username      text;
  v_email         text;
  v_school_id     uuid;
  v_session_token text;
BEGIN
  -- Освобождаем протухшие leases (15 мин неактивности).
  PERFORM public.sweep_expired_demo_leases();

  -- Валидация роли.
  IF p_role NOT IN ('student', 'teacher', 'parent') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = 'P0001';
  END IF;

  -- subject_slug имеет смысл только для teacher.
  IF p_role = 'teacher' THEN
    IF p_subject_slug IS NULL THEN
      RAISE EXCEPTION 'subject_slug_required_for_teacher' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    -- Для student/parent — принудительно очищаем.
    p_subject_slug := NULL;
  END IF;

  IF p_role = 'student' THEN
    -- Любой активный студент (все 96 — единый пул после конверсии в 132).
    -- FOR UPDATE SKIP LOCKED на auth.users — стандартный anti-race.
    -- Читаем через LEFT JOIN, чтобы «не занятые» находились свободнее.
    SELECT s.user_id, u.raw_user_meta_data->>'username', u.email, s.school_id
      INTO v_user_id, v_username, v_email, v_school_id
    FROM public.students s
    JOIN auth.users u ON u.id = s.user_id
    WHERE s.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.demo_leases dl
        WHERE dl.user_id = s.user_id
          AND dl.released_at IS NULL
      )
    ORDER BY random()
    LIMIT 1;

  ELSIF p_role = 'teacher' THEN
    -- Точечно: 1 учитель предмета (teachers.subject_slug — канонический
    -- источник, subjects.slug колонки не существует).
    -- Куратор teacher_karim (subject_slug IS NULL) исключён естественно.
    SELECT t.user_id, u.raw_user_meta_data->>'username', u.email, t.school_id
      INTO v_user_id, v_username, v_email, v_school_id
    FROM public.teachers t
    JOIN auth.users u ON u.id = t.user_id
    WHERE t.subject_slug = p_subject_slug
      AND NOT EXISTS (
        SELECT 1 FROM public.demo_leases dl
        WHERE dl.user_id = t.user_id
          AND dl.released_at IS NULL
      )
    LIMIT 1;

  ELSE -- 'parent'
    -- Любой из 3 родителей.
    SELECT p.user_id, u.raw_user_meta_data->>'username', u.email, p.school_id
      INTO v_user_id, v_username, v_email, v_school_id
    FROM public.parents p
    JOIN auth.users u ON u.id = p.user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.demo_leases dl
      WHERE dl.user_id = p.user_id
        AND dl.released_at IS NULL
    )
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'no_available_slot' USING ERRCODE = 'P0001';
  END IF;

  v_session_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.demo_leases (
    user_id, role, subject_slug, session_token, school_id
  ) VALUES (
    v_user_id, p_role, p_subject_slug, v_session_token, v_school_id
  );

  RETURN QUERY SELECT
    v_username,
    v_email::text,
    'password123'::text,
    v_session_token,
    v_user_id;
END;
$$;

-- ── 4. RPC: heartbeat_demo_slot ──────────────────────────────────────
-- Продлевает last_activity_at, если lease жив и не протух.
-- Возврат: true если продлили; false если lease не найден / уже
-- released / протух (> 15 мин без активности).
CREATE OR REPLACE FUNCTION public.heartbeat_demo_slot(p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.demo_leases
     SET last_activity_at = now()
   WHERE session_token = p_session_token
     AND released_at IS NULL
     AND last_activity_at > now() - interval '15 minutes';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- ── 5. RPC: release_demo_slot ────────────────────────────────────────
-- Explicit release: кнопка «выйти из демо» или signOut в приложении.
-- Возврат: true если сняли; false если lease уже был released или не
-- найден.
CREATE OR REPLACE FUNCTION public.release_demo_slot(p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.demo_leases
     SET released_at = now()
   WHERE session_token = p_session_token
     AND released_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- ── 6. RPC: get_occupied_teacher_subjects ────────────────────────────
-- Для модалки «Демо учитель» — какие предметники сейчас заняты, чтобы
-- показать их «серыми/занято». Сначала sweep, потом список.
CREATE OR REPLACE FUNCTION public.get_occupied_teacher_subjects()
RETURNS TABLE(subject_slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sweep_expired_demo_leases();

  RETURN QUERY
  SELECT DISTINCT dl.subject_slug
  FROM public.demo_leases dl
  WHERE dl.role = 'teacher'
    AND dl.released_at IS NULL
    AND dl.subject_slug IS NOT NULL;
END;
$$;

-- ── 7. GRANTs ────────────────────────────────────────────────────────
-- claim / heartbeat / release / status — все нужны и anon (до входа
-- на /login), и authenticated (уже вошли, но heartbeat/release нужны).
-- sweep_expired_demo_leases — внутренний, не exposed.
REVOKE ALL ON FUNCTION public.claim_demo_slot(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_demo_slot(text, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.heartbeat_demo_slot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heartbeat_demo_slot(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.release_demo_slot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_demo_slot(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_occupied_teacher_subjects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_occupied_teacher_subjects() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.sweep_expired_demo_leases() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_expired_demo_leases() TO service_role;

-- ── 8. Регистрация ───────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('133')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ── После применения — руками проверить: ────────────────────────────
--   1) SELECT * FROM public.demo_leases; -- Ожидаемо: 0 строк.
--   2) SELECT * FROM public.claim_demo_slot('student', NULL);
--      -- Ожидаемо: одна строка (username, email, 'password123', hex,
--      -- user_id).
--   3) SELECT public.heartbeat_demo_slot('<session_token из 2>');
--      -- Ожидаемо: true.
--   4) SELECT * FROM public.claim_demo_slot('teacher', 'math');
--      -- Ожидаемо: teacher_math, email, password, token, user_id.
--   5) SELECT * FROM public.claim_demo_slot('teacher', 'math');
--      -- Ожидаемо: ERROR 'no_available_slot' (учитель математики один).
--   6) SELECT * FROM public.get_occupied_teacher_subjects();
--      -- Ожидаемо: {math}.
--   7) SELECT public.release_demo_slot('<token учителя>');
--      -- Ожидаемо: true.
--   8) SELECT * FROM public.claim_demo_slot('teacher', 'math');
--      -- Ожидаемо: снова успех (слот освобождён).
