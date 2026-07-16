-- =====================================================================
-- Migration 134 — фикс claim_demo_slot(): gen_random_bytes() не найдена.
--
-- Симптом (продовая ошибка после применения 132/133):
--   ERROR: 42883: function gen_random_bytes(integer) does not exist
--   HINT: No function matches the given name and argument types.
--   QUERY: v_session_token := encode(gen_random_bytes(32), 'hex')
--   CONTEXT: PL/pgSQL function claim_demo_slot(text,text) line 79 at assignment
--
-- Причина: в Supabase pgcrypto (откуда gen_random_bytes) устанавливается в
-- схему extensions, а не public — SET search_path = public, auth в 133
-- её не видит без явной квалификации. Любой демо-логин на вебе падал на
-- этом шаге → "Не удалось войти в демо-режим, попробуйте ещё раз".
--
-- Фикс: генерируем session_token без pgcrypto — двумя gen_random_uuid()
-- (встроена в PostgreSQL 13+ ядро, без extensions — тот же факт уже
-- задокументирован в 20260614000001_enums.sql) склеенными без дефисов =
-- 64 hex-символа, той же энтропии что 32 случайных байта.
--
-- Только claim_demo_slot использует gen_random_bytes — проверено grep'ом
-- по всем supabase/migrations/*.sql, других вхождений нет. Остальные
-- функции 133 (heartbeat_demo_slot, release_demo_slot,
-- get_occupied_teacher_subjects, sweep_expired_demo_leases) не звали
-- gen_random_bytes и не нуждаются в правке.
-- =====================================================================

BEGIN;

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

  -- ФИКС (134): было encode(gen_random_bytes(32), 'hex') — функция не
  -- резолвится без extensions.-квалификации. Два gen_random_uuid() без
  -- дефисов = 64 hex-символа (та же энтропия, что 32 случайных байта),
  -- gen_random_uuid() встроена в ядро PostgreSQL 13+, extensions не нужны.
  v_session_token := replace(gen_random_uuid()::text, '-', '') ||
                      replace(gen_random_uuid()::text, '-', '');

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

REVOKE ALL ON FUNCTION public.claim_demo_slot(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_demo_slot(text, text) TO anon, authenticated, service_role;

-- ── Регистрация ───────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('134')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ── Smoke test — выполнить руками ПОСЛЕ применения ────────────────────
DO $$
DECLARE v_row record;
BEGIN
  SELECT * INTO v_row FROM public.claim_demo_slot('student', NULL);
  RAISE NOTICE 'claim_demo_slot student: username=%, session_token_len=%', v_row.username, length(v_row.session_token);
  PERFORM public.release_demo_slot(v_row.session_token);

  SELECT * INTO v_row FROM public.claim_demo_slot('teacher', 'math');
  RAISE NOTICE 'claim_demo_slot teacher/math: username=%', v_row.username;
  PERFORM public.release_demo_slot(v_row.session_token);

  SELECT * INTO v_row FROM public.claim_demo_slot('parent', NULL);
  RAISE NOTICE 'claim_demo_slot parent: username=%', v_row.username;
  PERFORM public.release_demo_slot(v_row.session_token);

  RAISE NOTICE 'claim_demo_slot: ВСЕ 3 РОЛИ OK';
END $$;
