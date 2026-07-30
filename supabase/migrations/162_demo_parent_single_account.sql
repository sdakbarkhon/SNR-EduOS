-- Migration 162 — демо-режим для роли «родитель» выдаёт РОВНО ОДИН аккаунт.
--
-- ПРОБЛЕМА. В claim_demo_slot() (последняя редакция — 135) ветка родителя
-- выглядела так:
--
--     ELSE -- 'parent'
--       SELECT ... FROM public.parents p ...
--       ORDER BY random()
--       LIMIT 1;
--
-- то есть демо-вход отдавал СЛУЧАЙНОГО из трёх родителей: Ismailov Bakhtiyor,
-- Rakhimov Odil или Karimov Sardor. Заказчик видел «Karimov Sardor» с ребёнком
-- «Karimov Farrukh» вместо ожидаемого Исмаилова — это не откат правки в коде и
-- не проблема деплоя, а вот этот random() в базе.
--
-- Демо-скоуп проекта сузили до ОДНОЙ семьи: родитель parent_ismailov
-- (Ismailov Bakhtiyor) с единственным ребёнком Ismailov Sherzod, 10-А. Данные
-- (расписание, оценки, посещаемость, ДЗ, оплаты) наполнялись именно под неё;
-- у двух других родителей экраны частично пустые. Показывать их в демо нельзя.
--
-- РЕШЕНИЕ. Ветка 'parent' ограничивается username = 'parent_ismailov'.
-- Остальные ветки (student по классу, teacher по предмету) переносятся из 135
-- ДОСЛОВНО — правится ровно один SELECT.
--
-- Побочный эффект, осознанный: демо-родитель теперь ОДИН на всю систему, и
-- второй одновременный демо-родитель получит 'no_available_slot', пока первый
-- не отпустит аренду (или пока её не подберёт sweep_expired_demo_leases).
-- Раньше их могло быть три. Для показа заказчику это правильный размен:
-- лучше «занято», чем чужая семья с полупустыми экранами.
--
-- Вход по телефону (apps/web/app/parent/LoginPhoneScreen.tsx →
-- loginParentByPhone → PARENT_PHONE_ACCOUNTS['912345678']) эту функцию не
-- использует вовсе и уже вёл к parent_ismailov — его не трогаем.

CREATE OR REPLACE FUNCTION public.claim_demo_slot(
  p_role text,
  p_subject_slug text DEFAULT NULL,
  p_grade_level integer DEFAULT NULL
)
RETURNS TABLE(
  username text,
  email text,
  password text,
  session_token text,
  user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_username text;
  v_email text;
  v_school_id uuid;
  v_session_token text;
BEGIN
  PERFORM public.sweep_expired_demo_leases();

  IF p_role NOT IN ('student', 'teacher', 'parent') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = 'P0001';
  END IF;

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
    -- Дословно из 135.
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
    -- Дословно из 135.
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
    -- ЕДИНСТВЕННОЕ ИЗМЕНЕНИЕ ОТНОСИТЕЛЬНО 135: был ORDER BY random() по всем
    -- родителям, стало — жёстко parent_ismailov. Демо-данными наполнена
    -- только его семья.
    SELECT p.user_id, u.raw_user_meta_data->>'username', u.email, p.school_id
      INTO v_user_id, v_username, v_email, v_school_id
    FROM public.parents p
    JOIN auth.users u ON u.id = p.user_id
    WHERE u.raw_user_meta_data->>'username' = 'parent_ismailov'
      AND NOT EXISTS (
        SELECT 1 FROM public.demo_leases dl
        WHERE dl.user_id = p.user_id
          AND dl.released_at IS NULL
      )
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

  -- Хвост дословно из 135: пароль — общий проектный литерал, функции
  -- demo_account_password() в схеме нет.
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

-- Проверка: демо-родитель — только Исмаилов, остальные роли не сломаны.
--
-- 'no_available_slot' НЕ считается провалом: он означает лишь, что нужный
-- аккаунт прямо сейчас занят чьей-то демо-сессией (а у родителя аккаунт
-- теперь ровно один, так что это штатная ситуация во время показа). Ограничение
-- при этом в силе. Проваливаем миграцию только если функция ВЕРНУЛА строку и
-- в ней оказался не Исмаилов — это и есть проверяемое условие.
DO $$
DECLARE
  v_row record;
BEGIN
  BEGIN
    SELECT * INTO v_row FROM public.claim_demo_slot('parent', NULL, NULL);
    IF v_row.username IS DISTINCT FROM 'parent_ismailov' THEN
      RAISE EXCEPTION 'демо-родитель = %, ожидался parent_ismailov', v_row.username;
    END IF;
    PERFORM public.release_demo_slot(v_row.session_token);
    RAISE NOTICE 'claim_demo_slot 162: родитель = parent_ismailov, ОК';
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      IF SQLERRM <> 'no_available_slot' THEN
        RAISE;
      END IF;
      RAISE NOTICE 'claim_demo_slot 162: parent_ismailov занят активной арендой — ограничение применено, проверку пропускаем';
  END;

  BEGIN
    SELECT * INTO v_row FROM public.claim_demo_slot('student', NULL, 10);
    PERFORM public.release_demo_slot(v_row.session_token);
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      IF SQLERRM <> 'no_available_slot' THEN RAISE; END IF;
  END;

  BEGIN
    SELECT * INTO v_row FROM public.claim_demo_slot('teacher', 'math', NULL);
    PERFORM public.release_demo_slot(v_row.session_token);
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      IF SQLERRM <> 'no_available_slot' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'claim_demo_slot 162: student/teacher не сломаны';
END $$;
