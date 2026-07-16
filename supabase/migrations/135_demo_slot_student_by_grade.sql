-- =====================================================================
-- Migration 135 — claim_demo_slot() принимает p_grade_level для
-- role='student'.
--
-- Контекст: DemoRoleModal вернули к исходной структуре «до Пачки 2» —
-- 3 карточки классов (3-й/7-й/10-й) вместо одной общей карточки
-- «Ученик». Клик по карточке класса должен давать случайного ученика
-- ТОЛЬКО из этого класса, не из общего пула ~96.
--
-- students.grade — текстовая колонка формата 'N класс' ('3 класс',
-- '7 класс', '10 класс' — проверено live-запросом: 31+31+31=93 active
-- студента с непустым grade, ещё 3 (rustam_03/farrukh_10/malika_07)
-- имеют grade=NULL несмотря на говорящий username — legacy-данные вне
-- скоупа этой миграции; они просто не участвуют в grade-scoped claim
-- (как и раньше не участвовали бы, если бы кто-то фильтровал по classу).
-- split_part(grade, ' ', 1)::integer извлекает ведущее число.
--
-- p_grade_level:
--   - для role='student': если указан (3/7/10) — фильтр по классу;
--     если NULL — как раньше, случайный из ВСЕХ активных (обратная
--     совместимость, если кто-то зовёт claim_demo_slot('student', NULL)
--     без класса).
--   - для role='teacher'/'parent': игнорируется (принудительно NULL) —
--     класс не применим.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_demo_slot(
  p_role text,
  p_subject_slug text DEFAULT NULL,
  p_grade_level integer DEFAULT NULL
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

  -- subject_slug имеет смысл только для teacher; grade_level — только
  -- для student. Принудительно чистим неприменимые параметры.
  IF p_role = 'teacher' THEN
    IF p_subject_slug IS NULL THEN
      RAISE EXCEPTION 'subject_slug_required_for_teacher' USING ERRCODE = 'P0001';
    END IF;
    p_grade_level := NULL;
  ELSIF p_role = 'parent' THEN
    p_subject_slug := NULL;
    p_grade_level := NULL;
  ELSE -- student
    p_subject_slug := NULL;
    IF p_grade_level IS NOT NULL AND p_grade_level NOT IN (3, 7, 10) THEN
      RAISE EXCEPTION 'invalid_grade_level' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_role = 'student' THEN
    -- Активный студент; если p_grade_level указан — только этого класса.
    -- grade=NULL студенты (legacy-аккаунты без класса) участвуют ТОЛЬКО
    -- в бесклассовом режиме (p_grade_level IS NULL) — как и раньше.
    SELECT s.user_id, u.raw_user_meta_data->>'username', u.email, s.school_id
      INTO v_user_id, v_username, v_email, v_school_id
    FROM public.students s
    JOIN auth.users u ON u.id = s.user_id
    WHERE s.status = 'active'
      AND (
        p_grade_level IS NULL
        OR split_part(s.grade, ' ', 1) = p_grade_level::text
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.demo_leases dl
        WHERE dl.user_id = s.user_id
          AND dl.released_at IS NULL
      )
    ORDER BY random()
    LIMIT 1;

  ELSIF p_role = 'teacher' THEN
    -- Без изменений: точечно 1 учитель предмета по teachers.subject_slug.
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
    -- Без изменений: любой из 3 родителей.
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

REVOKE ALL ON FUNCTION public.claim_demo_slot(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_demo_slot(text, text, integer) TO anon, authenticated, service_role;

-- Старая 2-параметровая перегрузка (text, text) больше не нужна — все
-- callers (веб server action + /api/demo/claim) обновлены на 3-параметровую
-- сигнатуру в этом же деплое. DROP, а не оставлять как dead overload —
-- иначе PostgREST может резолвить неоднозначно между (text,text) и
-- (text,text,integer default NULL) при вызове с 2 аргументами.
DROP FUNCTION IF EXISTS public.claim_demo_slot(text, text);

-- ── Регистрация ───────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('135')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ── Smoke test — выполнить руками ПОСЛЕ применения ────────────────────
DO $$
DECLARE v_row record;
BEGIN
  SELECT * INTO v_row FROM public.claim_demo_slot('student', NULL, 10);
  RAISE NOTICE 'claim student 10: %', v_row.username;
  PERFORM public.release_demo_slot(v_row.session_token);

  SELECT * INTO v_row FROM public.claim_demo_slot('student', NULL, 7);
  RAISE NOTICE 'claim student 7: %', v_row.username;
  PERFORM public.release_demo_slot(v_row.session_token);

  SELECT * INTO v_row FROM public.claim_demo_slot('student', NULL, 3);
  RAISE NOTICE 'claim student 3: %', v_row.username;
  PERFORM public.release_demo_slot(v_row.session_token);

  -- Обратная совместимость: без grade_level — случайный из всех.
  SELECT * INTO v_row FROM public.claim_demo_slot('student', NULL, NULL);
  RAISE NOTICE 'claim student (no grade): %', v_row.username;
  PERFORM public.release_demo_slot(v_row.session_token);

  -- teacher/parent не сломаны 3-м параметром.
  SELECT * INTO v_row FROM public.claim_demo_slot('teacher', 'math', NULL);
  RAISE NOTICE 'claim teacher/math: %', v_row.username;
  PERFORM public.release_demo_slot(v_row.session_token);

  RAISE NOTICE 'claim_demo_slot 135: ВСЕ СЦЕНАРИИ OK';
END $$;
