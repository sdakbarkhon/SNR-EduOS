-- =====================================================================
-- Migration 183 — claim_demo_slot() выдаёт аккаунты ТОЛЬКО из демо-школы.
--
-- ЧТО ЧИНИМ. Живое тело функции (снято pg_get_functiondef 10.08.2026 — НЕ
-- взято из файлов 133/135, они разошлись со схемой) отбирает аккаунт без
-- какого-либо условия на школу:
--   * ученик   — любой students.status='active';
--   * учитель  — любой teachers.subject_slug = <предмет>;
--   * родитель — прибит к логину 'parent_ismailov' (след миграции 162).
-- school_id при этом ЧИТАЕТСЯ, но лишь затем, чтобы записать его в
-- demo_leases: школа здесь отчётность, а не условие отбора.
--
-- ПОЧЕМУ ЭТО ДЫРА. Кнопка «Демо» доступна анониму. Как только в
-- SNR International School (is_demo=false) появится первый активный ученик,
-- он попадёт в тот же барабан: ветка ученика выбирает ORDER BY random(),
-- то есть живой аккаунт настоящей школы может быть выдан анонимному
-- посетителю сразу, а не «когда демо закончится». Пароль функция при этом
-- возвращает литералом.
-- Проверено живыми счётчиками 10.08.2026: в реальной школе 0 учеников,
-- 0 предметников, 0 родителей — поэтому дыра ещё не выстрелила.
--
-- КАК ЧИНИМ. Демо-школа определяется флагом schools.is_demo (миграция 170,
-- заведён ровно затем, чтобы убрать расползающийся хардкод UUID). Хардкода
-- идентификатора здесь нет и не появляется.
--
-- ТРЕБОВАНИЕ «РОВНО ОДНА». Если демо-школ ноль или больше одной — функция
-- НЕ берёт первую попавшуюся, а отказывает 'demo_school_not_configured'.
-- Ноль значит, что флаг потеряли; больше одной — что кто-то пометил вторую
-- школу, и тогда неизвестно, из какой выдавать. В обоих случаях правильный
-- ответ — не выдавать ничего.
--
-- ЧТО НАМЕРЕННО НЕ МЕНЯЕТСЯ:
--   * сигнатура и тип возврата — 1 в 1, иначе пришлось бы трогать PostgREST
--     и оба вызывающих места;
--   * пароли-литералы внутри функции — отдельная задача заказчика;
--   * ORDER BY random() у ученика, LIMIT 1 у учителя и родителя;
--   * фильтр по классу, проверка роли, sweep протухших аренд;
--   * heartbeat_demo_slot / release_demo_slot / sweep_expired_demo_leases —
--     не трогаются вовсе: они работают по ключу аренды и доступ не выдают.
--
-- ХАРДКОД ЛОГИНА 'parent_ismailov' УБИРАЕТСЯ. Он случайно сужал выдачу до
-- одной строки и тем самым маскировал отсутствие фильтра по школе.
-- Заменяется честным условием на демо-школу: в демо сегодня ровно один
-- родитель, поэтому наблюдаемое поведение не меняется, но перестаёт
-- зависеть от конкретного логина.
--
-- ПРАВО anon ОТЗЫВАЕТСЯ. Оно было обязательным, пока существовал публичный
-- POST /api/demo/claim (он ходил без сессии). Этот адрес удаляется тем же
-- заходом, а единственный оставшийся вызывающий — серверное действие
-- demoLogin — ходит служебной ролью (createAdminClient читает
-- SUPABASE_SERVICE_ROLE_KEY; проверено по всем вызовам RPC в apps/web).
-- Отзыв делается ЯВНОЙ строкой: REVOKE ALL ... FROM PUBLIC ранее выданный
-- персональный грант роли anon не снимает.
--
-- РЕГИСТРАЦИЯ В РЕЕСТРЕ ЗДЕСЬ НЕ ДЕЛАЕТСЯ. apply-migration.mjs вставляет
-- строку реестра сам, внутри той же транзакции, и делает это БЕЗ
-- ON CONFLICT — собственный INSERT в файле (как в 133/135) дал бы
-- нарушение уникальности и откат всей миграции.
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
  v_user_id        uuid;
  v_username       text;
  v_email          text;
  v_school_id      uuid;
  v_session_token  text;
  v_demo_school_id uuid;
  v_demo_count     integer;
BEGIN
  PERFORM public.sweep_expired_demo_leases();

  IF p_role NOT IN ('student', 'teacher', 'parent') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = 'P0001';
  END IF;

  -- ── ДЕМО-ШКОЛА: РОВНО ОДНА, ИНАЧЕ ОТКАЗ ────────────────────────────
  -- Два отдельных запроса, а не min(id) одним: schools — таблица на две
  -- строки, стоимость нулевая, зато условие читается буквально.
  SELECT count(*) INTO v_demo_count FROM public.schools WHERE is_demo;

  IF v_demo_count <> 1 THEN
    RAISE EXCEPTION 'demo_school_not_configured' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_demo_school_id FROM public.schools WHERE is_demo;

  -- Параметры, неприменимые к роли, чистим (без изменений).
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
    SELECT s.user_id, u.raw_user_meta_data->>'username', u.email, s.school_id
      INTO v_user_id, v_username, v_email, v_school_id
    FROM public.students s
    JOIN auth.users u ON u.id = s.user_id
    WHERE s.school_id = v_demo_school_id        -- ← 183: только демо-школа
      AND s.status = 'active'
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
    SELECT t.user_id, u.raw_user_meta_data->>'username', u.email, t.school_id
      INTO v_user_id, v_username, v_email, v_school_id
    FROM public.teachers t
    JOIN auth.users u ON u.id = t.user_id
    WHERE t.school_id = v_demo_school_id        -- ← 183: только демо-школа
      AND t.subject_slug = p_subject_slug
      AND NOT EXISTS (
        SELECT 1 FROM public.demo_leases dl
        WHERE dl.user_id = t.user_id
          AND dl.released_at IS NULL
      )
    LIMIT 1;

  ELSE -- 'parent'
    -- 183: прежний хардкод логина заменён фильтром по школе. Литерал логина
    -- намеренно не повторяется даже в комментарии — иначе проверка «в теле
    -- функции не осталось хардкода» ищет подстроку и не отличает код от
    -- комментария (на этом споткнулся холостой прогон).
    SELECT p.user_id, u.raw_user_meta_data->>'username', u.email, p.school_id
      INTO v_user_id, v_username, v_email, v_school_id
    FROM public.parents p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.school_id = v_demo_school_id        -- ← 183: только демо-школа
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

  -- Пароли остаются как были — правка паролей в этот заход не входит.
  RETURN QUERY SELECT
    v_username,
    v_email::text,
    (CASE WHEN p_role = 'parent' THEN 'parent2026' ELSE 'password123' END)::text,
    v_session_token,
    v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_demo_slot(text, text, integer) FROM PUBLIC;
-- Персональный грант анониму снимается отдельной строкой — см. шапку.
REVOKE EXECUTE ON FUNCTION public.claim_demo_slot(text, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_demo_slot(text, text, integer)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.claim_demo_slot(text, text, integer) IS
  'Выдаёт напрокат аккаунт ТОЛЬКО из школы с schools.is_demo=true (миграция 183). '
  'Демо-школ должно быть ровно одна, иначе demo_school_not_configured. '
  'Хардкода идентификатора школы и логина родителя не содержит. '
  'Право EXECUTE у anon отозвано: единственный вызывающий — серверное '
  'действие demoLogin под служебной ролью.';

COMMIT;

-- ── ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ — только чтение, аренд не создаёт ───────
-- Намеренно НЕ вызываем claim_demo_slot в DO-блоке, как это делала 135:
-- каждый вызов создаёт строку в demo_leases, то есть пишет в демо-школу.
--   1) фильтр на месте во всех трёх ветках:
--      SELECT count(*) FROM regexp_matches(
--        pg_get_functiondef('public.claim_demo_slot(text,text,integer)'::regprocedure),
--        'school_id = v_demo_school_id', 'g');   -- ожидаем 3
--   2) хардкода логина не осталось:
--      SELECT pg_get_functiondef('public.claim_demo_slot(text,text,integer)'::regprocedure)
--             LIKE '%parent_ismailov%';          -- ожидаем false
--   3) демо-школа ровно одна:
--      SELECT count(*) FROM public.schools WHERE is_demo;  -- ожидаем 1
--   4) права: anon в списке отсутствует
--      SELECT proacl FROM pg_proc WHERE oid =
--        'public.claim_demo_slot(text,text,integer)'::regprocedure;
