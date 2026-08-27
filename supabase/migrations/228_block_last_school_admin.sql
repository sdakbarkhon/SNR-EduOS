-- =====================================================================
-- 228. Последнего администратора школы удалить нельзя.
--
-- ЧТО БЫЛО. `deleteSchoolAdmin` сносил учётную запись без единой проверки:
-- `auth.admin.deleteUser(user_id)` → строка `public.admins` уходила каскадом
-- (`admins_user_id_fkey ... ON DELETE CASCADE`). Проверка
-- `assertAdminIsManageable` бережёт только демо-админа. То есть последнего
-- администратора школы можно было удалить, и школа оставалась без
-- управления: завести нового админа умеет только суперадмин, а школа об этом
-- узнала бы, когда некому стало заходить в кабинет.
--
-- ЭТО ВТОРОЙ РУБЕЖ, НЕ ЕДИНСТВЕННЫЙ. Первый стоит в коде
-- (`assertNotLastSchoolAdmin` в apps/web/lib/admin-api.ts) и существует ради
-- ТЕКСТА: отказ оттуда доезжает до человека внятной фразой через
-- guard()/unwrap() и humanizeAdminError. Здешний отказ до человека доедет
-- хуже: удаление идёт через Auth API, и он подменяет ошибку базы своим
-- «Database error deleting user». Поэтому база держит правило, а объясняет
-- код. Оба рубежа нужны: код закрывает обычный путь понятно, база закрывает
-- ЛЮБОЙ путь надёжно.
--
-- ПОЧЕМУ УСЛОВИЕ ИМЕННО «ШКОЛА ЕЩЁ СУЩЕСТВУЕТ». Строки `admins` уходят
-- каскадом в двух разных случаях, и различить их по глубине триггеров нельзя
-- — оба каскадные:
--
--   1. удаляют учётную запись администратора  → школа на месте, ЗАПРЕЩАЕМ,
--      если он последний;
--   2. удаляют школу целиком                  → школы уже нет, ПРОПУСКАЕМ.
--
-- Во втором случае `lib/school-lifecycle.ts` сначала удаляет строку школы
-- (`from("schools").delete()`), и только потом чистит учётные записи. Каскад
-- по `admins_school_id_fkey` срабатывает уже ПОСЛЕ удаления родительской
-- строки, поэтому `SELECT ... FROM schools` внутри триггера её не видит — и
-- заслон честно молчит. Проверено прогоном на живой базе в транзакции с
-- откатом: временная школа с единственным админом удаляется целиком без
-- отказа.
--
-- ПРИЗНАКА АКТИВНОСТИ У АДМИНОВ НЕТ. В `public.admins` нет ни `is_active`,
-- ни `archived_at` — считать «активных» не из чего, поэтому последний значит
-- последний вообще. Появится признак — правило станет `... AND is_active`,
-- и это будет отдельное решение, а не догадка сегодняшнего дня.
--
-- SECURITY DEFINER — чтобы правила доступа не соврали. Под ограниченной ролью
-- `SELECT` по `admins` мог бы не увидеть соседних администраторов, и заслон
-- отказал бы там, где отказывать не за что. Сегодня удаление идёт служебным
-- ключом (он правила обходит), но полагаться на это в правиле нельзя.
--
-- ДЕМО-АДМИН И ДЕМО-ШКОЛА НЕ ТРОНУТЫ: их бережёт своя проверка, она работает.
-- Здешнее правило просто оказывается для них ещё одним рубежом — у демо-школы
-- администратор ровно один.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_block_last_school_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- Школы уже нет — значит удаляют её целиком, и админы уходят вместе с ней.
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = OLD.school_id) THEN
    RETURN OLD;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.admins
    WHERE school_id = OLD.school_id AND id <> OLD.id
  ) THEN
    -- Машинный код, а не фраза: текст на языке человека подставляет
    -- humanizeAdminError на клиенте. Тот же приём, что у
    -- demo_school_cannot_be_deleted (миграция 202).
    RAISE EXCEPTION 'last_school_admin'
      USING ERRCODE = 'P0001',
            HINT = 'Assign another administrator to this school first.';
  END IF;

  RETURN OLD;
END;
$fn$;

COMMENT ON FUNCTION public.fn_block_last_school_admin() IS
  'Не даёт удалить последнего администратора школы. Пропускает удаление '
  'школы целиком: там строки schools уже нет. Миграция 228.';

DROP TRIGGER IF EXISTS trg_block_last_school_admin ON public.admins;

CREATE TRIGGER trg_block_last_school_admin
  BEFORE DELETE ON public.admins
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_block_last_school_admin();

-- ── Самопроверка: миграция не должна лечь наполовину ────────────────────────
DO $check$
DECLARE
  v_fn int;
  v_tg int;
BEGIN
  SELECT count(*) INTO v_fn FROM pg_proc
   WHERE proname = 'fn_block_last_school_admin'
     AND pronamespace = 'public'::regnamespace;
  IF v_fn <> 1 THEN
    RAISE EXCEPTION 'Миграция 228: функции fn_block_last_school_admin нет (найдено %)', v_fn;
  END IF;

  SELECT count(*) INTO v_tg FROM pg_trigger
   WHERE tgname = 'trg_block_last_school_admin'
     AND tgrelid = 'public.admins'::regclass
     AND NOT tgisinternal;
  IF v_tg <> 1 THEN
    RAISE EXCEPTION 'Миграция 228: триггера trg_block_last_school_admin нет (найдено %)', v_tg;
  END IF;

  -- Ни одна школа не должна остаться без администратора уже сейчас: если
  -- такая есть, правило её не починит, но знать об этом надо до применения.
  IF EXISTS (
    SELECT 1 FROM public.schools s
     WHERE NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.school_id = s.id)
  ) THEN
    RAISE WARNING 'Миграция 228: есть школы без администратора — правило их не касается, но проверьте список';
  END IF;
END;
$check$;

COMMIT;
