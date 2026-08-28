-- =====================================================================
-- 231 — ДЕМО-МЕСТО РОДИТЕЛЯ ПЕРЕСТАЁТ БЫТЬ ЭКСКЛЮЗИВНЫМ
--
-- ЧТО БЫЛО. Демонстрацию родителя мог смотреть ровно один гость за раз.
-- В демо-школе один родитель, а выдача места требовала, чтобы у аккаунта
-- не было незакрытой аренды, — второй гость получал «занято».
--
-- ПОЧЕМУ ЭТО НЕВЕРНО. Механизм аренды взят у учеников и учителей, где он
-- оправдан: там гость может менять данные, и двое на одном аккаунте
-- мешали бы друг другу. У родителя демонстрация только на просмотр,
-- эксклюзив там не нужен.
--
-- ЧТО МЕНЯЕТСЯ — ДВЕ ВЕЩИ, И ТОЛЬКО ВМЕСТЕ:
--   1) частичный уникальный индекс demo_leases_user_active_idx получает
--      исключение для роли parent;
--   2) из ветки 'parent' функции claim_demo_slot убирается условие
--      «у аккаунта нет незакрытой аренды».
--
-- ПОЧЕМУ ИМЕННО ВМЕСТЕ. Индекс — единственная настоящая защита: блокировки
-- строки в функции НЕТ (комментарий в 133 про FOR UPDATE SKIP LOCKED не
-- соответствует коду ни в одной из шести редакций тела — проверено
-- 28.08.2026). Если убрать только условие, два одновременных вызова оба
-- пройдут отбор, и проигравший упрётся в индекс с сырым 23505 вместо
-- вежливого no_available_slot. Стало бы хуже, чем было.
--
-- ЧЕГО МИГРАЦИЯ НЕ ДЕЛАЕТ — СПЕЦИАЛЬНО:
--   * НЕ сносит индекс целиком, а пересоздаёт частичным. У ученика и
--     учителя эксклюзив остаётся: у них аренда защищает от того, что двое
--     правят одни данные;
--   * НЕ трогает права. Тело обновляется через CREATE OR REPLACE, при нём
--     ACL сохраняется. DROP + CREATE сбросил бы права к умолчанию и снова
--     открыл функцию анониму — ровно та дыра, которую закрывала 185.
--     Строк GRANT здесь нет намеренно: живой список прав на 28.08.2026 —
--     postgres и service_role, и он должен остаться таким же;
--   * НЕ ослабляет границу по демо-школе. Условие school_id =
--     v_demo_school_id остаётся во всех трёх ветках;
--   * НЕ трогает heartbeat_demo_slot, release_demo_slot,
--     sweep_expired_demo_leases, get_occupied_teacher_subjects: они
--     работают по session_token, а он выдаётся на КАЖДУЮ аренду, не на
--     аккаунт. Два гостя получают два разных ключа и продлевают каждый
--     своё;
--   * НЕ трогает пароли-литералы, ORDER BY random() у ученика, потолок
--     10 взятий с адреса в час (он в apps/web/lib/rate-limit.ts) и
--     защиту одной сессии на аккаунт;
--   * НЕ регистрирует себя в supabase_migrations.schema_migrations —
--     это делает apply-migration.mjs внутри той же транзакции.
--
-- ТЕЛО ФУНКЦИИ СНЯТО С ПРОДА (pg_get_functiondef, 28.08.2026), а не взято
-- из файла 183: живое тело и файлы в этом проекте уже дважды расходились
-- (шапки 183 и 185). Отличие от снятого ровно одно — блок NOT EXISTS в
-- ветке 'parent'. Ветки ученика и учителя перенесены дословно.
--
-- ПОСЛЕДСТВИЕ, ПРИНЯТОЕ ЗАКАЗЧИКОМ 28.08.2026. Миграция 132 сняла запрет на
-- запись из демо-сессии, поэтому демо-гости пишут настоящие строки.
-- Несколько гостей под одним аккаунтом родителя будут видеть действия друг
-- друга — в первую очередь в чатах. Это не баг, это цена отказа от
-- эксклюзива; заводить вторых родителей в демо-школе заказчик не захотел.
-- =====================================================================

BEGIN;

-- ── 1. ИНДЕКС: ЭКСКЛЮЗИВ ОСТАЁТСЯ У УЧЕНИКА И УЧИТЕЛЯ ────────────────
--
-- role объявлена NOT NULL с CHECK (role IN ('student','teacher','parent')),
-- предикат неизменяем — частичный уникальный индекс по нему законен.
DROP INDEX IF EXISTS public.demo_leases_user_active_idx;

CREATE UNIQUE INDEX demo_leases_user_active_idx
  ON public.demo_leases (user_id)
  WHERE released_at IS NULL AND role <> 'parent';

COMMENT ON INDEX public.demo_leases_user_active_idx IS
  'Одна незакрытая аренда на аккаунт — для ученика и учителя. Роль parent '
  'исключена миграцией 231: демонстрацию родителя смотрят только глазами, '
  'и нескольким гостям она может показываться одновременно.';

-- ── 2. ТЕЛО ФУНКЦИИ: ИЗ ВЕТКИ 'parent' УБРАН NOT EXISTS ──────────────
CREATE OR REPLACE FUNCTION public.claim_demo_slot(
  p_role text,
  p_subject_slug text DEFAULT NULL::text,
  p_grade_level integer DEFAULT NULL::integer
)
RETURNS TABLE(username text, email text, password text, session_token text, user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
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
    --
    -- 231: ЗДЕСЬ БОЛЬШЕ НЕТ УСЛОВИЯ «у аккаунта нет незакрытой аренды».
    -- Демонстрацию родителя может смотреть сколько угодно гостей сразу:
    -- каждый получает СВОЙ ключ аренды, продлевает и освобождает своё.
    -- В ветках ученика и учителя условие остаётся — там оно по делу.
    SELECT p.user_id, u.raw_user_meta_data->>'username', u.email, p.school_id
      INTO v_user_id, v_username, v_email, v_school_id
    FROM public.parents p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.school_id = v_demo_school_id        -- ← 183: только демо-школа
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

COMMENT ON FUNCTION public.claim_demo_slot(text, text, integer) IS
  'Выдаёт напрокат аккаунт ТОЛЬКО из школы с schools.is_demo=true (миграция 183). '
  'Демо-школ должно быть ровно одна, иначе demo_school_not_configured. '
  'Хардкода идентификатора школы и логина родителя не содержит. '
  'Право EXECUTE у anon отозвано: единственные вызывающие — серверные '
  'действия под служебной ролью. '
  'Миграция 231: место родителя не эксклюзивно — условие «нет незакрытой '
  'аренды» осталось только у ученика и учителя.';

COMMIT;

-- ── ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ — ТОЛЬКО ЧТЕНИЕ, АРЕНД НЕ СОЗДАЁТ ───────
--   1) условие на школу по-прежнему во всех трёх ветках:
--      SELECT count(*) FROM regexp_matches(
--        pg_get_functiondef('public.claim_demo_slot(text,text,integer)'::regprocedure),
--        'school_id = v_demo_school_id', 'g');            -- ожидаем 3
--   2) условие «нет незакрытой аренды» осталось ровно в двух ветках:
--      SELECT count(*) FROM regexp_matches(
--        pg_get_functiondef('public.claim_demo_slot(text,text,integer)'::regprocedure),
--        'released_at IS NULL', 'g');                     -- ожидаем 2
--   3) индекс стал частичным с исключением роли:
--      SELECT indexdef FROM pg_indexes
--       WHERE schemaname='public' AND indexname='demo_leases_user_active_idx';
--      -- ожидаем ... WHERE ((released_at IS NULL) AND (role <> 'parent'::text))
--   4) права не изменились:
--      SELECT array_to_string(proacl, E'\n') FROM pg_proc
--       WHERE oid = 'public.claim_demo_slot(text,text,integer)'::regprocedure;
--      -- ожидаем ровно postgres=X/postgres и service_role=X/postgres
