-- Migration 163 — два независимых, но найденных в одном заходе дефекта.
--
-- ЧАСТЬ A. claim_demo_slot('parent', ...) всегда падал сигнатурой в signIn.
--
-- Функция (миграции 135/162) возвращает ОДИН общий литерал пароля
-- 'password123'::text для ВСЕХ трёх ролей. Для student/teacher это верно —
-- проверено живьём. Для parent — НЕТ: все три реальных родителя
-- (parent_ismailov/parent_rakhimov/parent_karimov) созданы под паролем
-- 'parent2026' (тот же PARENT_PHONE_PASSWORD, что использует обычный вход
-- по номеру телефона, packages/core/src/auth/phone.ts). Проверено живьём:
--   signInWithPassword(parent_ismailov@parents.snr.local, 'password123') → ОШИБКА
--   signInWithPassword(parent_ismailov@parents.snr.local, 'parent2026')  → OK
-- То же для rakhimov/karimov. Из-за этого apps/web/app/api/demo/claim/route.ts
-- получал signInError на КАЖДОЙ попытке демо-входа роли 'parent' (эндпоинт
-- используется мобильным приложением apps/mobile-parent, LoginScreen «Демо
-- родитель» — само мобильное приложение не трогаем, чиним только общую
-- backend-функцию, которую оно вызывает) и откатывал lease с 500 signin_failed.
-- Веб-кнопка на /parent (LoginPhoneScreen.handleDemoLogin) эту функцию не
-- вызывает вовсе — она использует прямой телефон-вход, независимо проверенный
-- и корректный; эта часть миграции её не касается.
--
-- Хвост функции переносится ИЗ 162 без изменений, кроме одной строки: пароль
-- для ветки 'parent' — CASE по роли вместо universal-литерала.
--
-- ЧАСТЬ B. Восстановление битого title в chat_threads.
--
-- У треда 06ba53fe-51c6-4067-b7b9-1afa3298bea4 (группа «10-А класс»,
-- единственный тред parent_ismailov) title в БД буквально содержит
-- REPLACEMENT CHARACTER (U+FFFD) — не отображение, а испорченные байты,
-- записанные ещё на сидировании:
--   codepoints: 31 30 2d 410 20 43a 43b 430 441 441 20 fffd 20 fffd×8
--   т.е. "10-А класс" + мусор вместо остатка строки.
-- Это САМО ПО СЕБЕ видимый баг (в /parent/messages группа «10-А» показывала бы
-- те же крякозябры) и ОДИН ИЗ источников «Помощь и поддержка ведёт в чат
-- класса с битым заголовком» — второй источник (сам факт, что «Поддержка»
-- вообще open-ит групповой чат) чинится в коде: pickSupportThread() в
-- apps/web/app/parent/(app)/_ui/threads.ts перестаёт использовать групповой
-- тред как fallback. Здесь чиним только данные: title = чистое имя группы.
--
-- Не точечный UPDATE по id (сработает только на ЭТОЙ БД) — ищем ЛЮБОЙ title
-- с replacement character, чтобы починка была устойчивой к порядку прогона
-- миграций/сред. group_id есть у group-тредов — берём имя оттуда.

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
    -- Дословно из 135/162.
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
    -- Дословно из 135/162.
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

  ELSE -- 'parent', ограничение на parent_ismailov из 162 сохранено.
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

  -- ЕДИНСТВЕННОЕ смысловое изменение относительно 162: пароль по роли, а не
  -- один и тот же литерал для всех трёх.
  RETURN QUERY SELECT
    v_username,
    v_email::text,
    (CASE WHEN p_role = 'parent' THEN 'parent2026' ELSE 'password123' END)::text,
    v_session_token,
    v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_demo_slot(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_demo_slot(text, text, integer) TO anon, authenticated, service_role;

-- ── Часть B: ремонт битого title ──────────────────────────────────────────
UPDATE public.chat_threads t
SET title = g.name
FROM public.groups g
WHERE t.kind = 'group'
  AND t.group_id = g.id
  AND t.title LIKE '%' || chr(65533) || '%'; -- U+FFFD REPLACEMENT CHARACTER

-- ── Самопроверка ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_row record;
  v_broken_titles integer;
BEGIN
  -- A: пароль для parent действительно 'parent2026' теперь, и claim реально
  -- сигналит успешным signIn возможен (саму сеть/auth здесь не дёрнуть —
  -- проверяем только то, что функция возвращает нужный пароль).
  BEGIN
    SELECT * INTO v_row FROM public.claim_demo_slot('parent', NULL, NULL);
    IF v_row.password IS DISTINCT FROM 'parent2026' THEN
      RAISE EXCEPTION 'claim_demo_slot(parent) вернул пароль %, ожидался parent2026', v_row.password;
    END IF;
    IF v_row.username IS DISTINCT FROM 'parent_ismailov' THEN
      RAISE EXCEPTION 'демо-родитель = %, ожидался parent_ismailov', v_row.username;
    END IF;
    PERFORM public.release_demo_slot(v_row.session_token);
    RAISE NOTICE 'claim_demo_slot 163: parent_ismailov / parent2026, ОК';
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      IF SQLERRM <> 'no_available_slot' THEN RAISE; END IF;
      RAISE NOTICE 'claim_demo_slot 163: parent_ismailov занят активной арендой — пропускаем';
  END;

  BEGIN
    SELECT * INTO v_row FROM public.claim_demo_slot('student', NULL, 10);
    IF v_row.password IS DISTINCT FROM 'password123' THEN
      RAISE EXCEPTION 'claim_demo_slot(student) вернул пароль %, ожидался password123', v_row.password;
    END IF;
    PERFORM public.release_demo_slot(v_row.session_token);
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      IF SQLERRM <> 'no_available_slot' THEN RAISE; END IF;
  END;

  -- B: ни одного title с replacement character не осталось.
  SELECT count(*) INTO v_broken_titles
  FROM public.chat_threads
  WHERE title LIKE '%' || chr(65533) || '%';
  IF v_broken_titles > 0 THEN
    RAISE EXCEPTION 'chat_threads: % title(ов) всё ещё содержат U+FFFD после ремонта', v_broken_titles;
  END IF;

  RAISE NOTICE 'claim_demo_slot 163: student password123 не сломан; битых title в chat_threads не осталось';
END $$;
