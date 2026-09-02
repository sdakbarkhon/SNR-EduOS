-- Миграция 250: роль менеджера — основание.
--
-- Заход 1 из трёх. Здесь только фундамент: таблица роли, признак, разбор роли
-- и колонка роли в журнале. Прав на чужие школы тут НЕТ — это заходы 2 и 3.
--
-- ═══ КТО ТАКОЙ МЕНЕДЖЕР ═══════════════════════════════════════════════════
--
-- «Админ школы, но во всех школах сразу». Следит за учителями и за деньгами.
-- Школы заводить не может, администраторов школ — тоже. Ни к какой школе не
-- привязан, поэтому колонки school_id у него НЕТ и быть не должно.
--
-- ═══ УРОК ШЕСТОЙ РОЛИ: КУРАТОРА ═══════════════════════════════════════════
--
-- Роль куратора уже заводили и уже сносили — тремя миграциями (187, 242, 243)
-- плюс отдельный заход по коду. Шапка 187 называет причину прямо: куратор
-- определялся «буквально как „в карточке пуст предмет“», и новый учитель без
-- предмета молча получал чужие права.
--
-- ОТСЮДА ГЛАВНОЕ ПРАВИЛО ЭТОЙ МИГРАЦИИ: роль — это ЯВНАЯ СТРОКА в своей
-- таблице, а не вывод из отсутствия чего-то. Ровно так устроены super_admins
-- и admins, и менеджер повторяет их буква в букву.
--
-- Второй урок 243: роль цеплялась за правило доступа, функцию-предикат, два
-- триггера чатов, значение в CHECK участника чата, поле в форме и подпись на
-- экране. Здесь менеджер НЕ заводится ни в чатах, ни в триггерах: заказчик
-- решил, что переписки, объявления и поддержка ему не нужны вовсе. Значит и
-- сносить в будущем будет нечего, кроме этой таблицы.
--
-- ═══ ПРАВА НА ТАБЛИЦУ: ОТЗЫВАЕМ ПОИМЁННО ══════════════════════════════════
--
-- На схему public в Supabase стоят ALTER DEFAULT PRIVILEGES, и новая таблица
-- сразу получает anon и authenticated полный набор. Проверено на живой базе
-- 03.09.2026: у super_admins сегодня И anon, И authenticated имеют
-- SELECT/INSERT/UPDATE/DELETE/TRUNCATE. Спасают только правила доступа, но
-- полагаться на один рубеж там, где можно поставить два, незачем.
--
-- Поэтому: сперва REVOKE поимённо, потом GRANT ровно SELECT для authenticated
-- — чтобы человек мог прочитать СВОЮ строку через правило ниже. Тот же приём,
-- что в миграциях 235, 238 и 247.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ── 1. Таблица роли ────────────────────────────────────────────────────────
--
-- Слепок с super_admins, минус ничего и плюс ничего:
--   id, user_id (уникален, каскад от auth.users), full_name, created_at,
--   google_email с той же нормализацией.
--
-- ПЛЮС КОЛОНКА username, КОТОРОЙ У СУПЕРАДМИНА НЕТ. Она нужна для входа по
-- логину: резолвер входа (resolveLoginCandidates) ищет человека по колонке
-- username, и у админов такая колонка появилась миграцией 194 ровно потому,
-- что без неё вход ломался. Не повторяем чужую беду.
CREATE TABLE IF NOT EXISTS public.managers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    text NOT NULL DEFAULT 'Менеджер',
  username     text,
  google_email text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT managers_google_email_norm_chk
    CHECK (google_email IS NULL OR google_email = lower(btrim(google_email)))
);

COMMENT ON TABLE public.managers IS
  'Менеджер — админ школы во всех школах сразу. Привязки к школе НЕТ '
  'намеренно: в этом вся роль. Права на чужие школы дают заходы 2 и 3, '
  'здесь только основание. Миграция 250.';

-- Логин уникален без учёта регистра — как у школьных админов, чтобы вход по
-- логину не находил двоих.
CREATE UNIQUE INDEX IF NOT EXISTS managers_username_uniq
  ON public.managers (lower(btrim(username))) WHERE username IS NOT NULL;

-- Почта Google уникальна тем же способом, что у суперадмина.
CREATE UNIQUE INDEX IF NOT EXISTS managers_google_email_uniq
  ON public.managers (lower(btrim(google_email))) WHERE google_email IS NOT NULL;

ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;

-- ── 2. Права ───────────────────────────────────────────────────────────────
REVOKE ALL ON public.managers FROM PUBLIC;
REVOKE ALL ON public.managers FROM anon;
REVOKE ALL ON public.managers FROM authenticated;
GRANT SELECT ON public.managers TO authenticated;

-- Читать может только сам менеджер свою строку — ровно как у super_admins
-- («super admin reads own record»). Всё остальное делает служебный ключ из
-- экрана суперадмина, а он правила обходит.
CREATE POLICY "manager reads own record"
  ON public.managers FOR SELECT
  USING (user_id = auth.uid());

-- ── 3. Признак роли ────────────────────────────────────────────────────────
--
-- Слово в слово как is_super_admin(): STABLE SECURITY DEFINER, пустой
-- search_path не ставим — ставим 'public', как у соседей.
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.managers WHERE user_id = auth.uid())
$function$;

COMMENT ON FUNCTION public.is_manager() IS
  'Есть ли строка в managers у вошедшего. Слепок с is_super_admin(). '
  'В правилах доступа ПОКА НЕ ИСПОЛЬЗУЕТСЯ: права на чужие школы — заходы '
  '2 и 3. Миграция 250.';

REVOKE ALL ON FUNCTION public.is_manager() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_manager() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated;

-- ── 4. Разбор роли ─────────────────────────────────────────────────────────
--
-- Менеджер встаёт ВТОРЫМ, между суперадмином и админом школы: он сильнее
-- школьного админа (ходит во все школы) и слабее суперадмина (школ не
-- заводит). Приоритеты прочих сдвигаются на единицу — числа здесь значат
-- только порядок, наружу они не отдаются.
--
-- Тело снято с прода через pg_get_functiondef 03.09.2026 и дополнено одной
-- веткой; остальные пять не тронуты ни символом.
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT role FROM (
    SELECT 'super_admin' AS role, 1 AS prio FROM public.super_admins WHERE user_id = auth.uid()
    UNION ALL
    SELECT 'manager', 2 FROM public.managers WHERE user_id = auth.uid()
    UNION ALL
    SELECT 'admin', 3 FROM public.admins WHERE user_id = auth.uid()
    UNION ALL
    SELECT 'parent', 4 FROM public.parents WHERE user_id = auth.uid()
    UNION ALL
    SELECT 'teacher', 5 FROM public.teachers WHERE user_id = auth.uid()
    UNION ALL
    SELECT 'student', 6 FROM public.students WHERE user_id = auth.uid()
  ) roles
  ORDER BY prio
  LIMIT 1
$function$;

-- ── 5. Журнал: кто именно действовал ───────────────────────────────────────
--
-- ВЫБРАНА КОЛОНКА, А НЕ ОТДЕЛЬНЫЕ НАЗВАНИЯ ДЕЙСТВИЙ. Развилка была такая:
-- либо `manager.school.update` рядом с `school.update`, либо одна колонка
-- роли.
--
-- Названия действий отвечают на вопрос «ЧТО сделано», и экран журнала по ним
-- фильтрует. Заведи вторую половину имени под роль — и фильтр «правка школы»
-- перестанет показывать правки школы, придётся выбирать дважды. А число
-- названий удвоится на ровном месте.
--
-- Колонка отвечает на вопрос «КТО», и это отдельный вопрос. Один фильтр
-- рядом с существующим, ни одно старое название не трогается.
--
-- Умолчание 'super_admin' — потому что все 27 записей, лежащих в журнале на
-- 03.09.2026, оставил именно он: другой роли, которая сюда пишет, до сегодня
-- не существовало.
ALTER TABLE public.superadmin_journal
  ADD COLUMN IF NOT EXISTS actor_role text NOT NULL DEFAULT 'super_admin';

COMMENT ON COLUMN public.superadmin_journal.actor_role IS
  'Кто действовал: super_admin или manager. Заведена миграцией 250 под роль '
  'менеджера. Отдельных названий действий под роль НЕ заводим намеренно: '
  'название отвечает на «что сделано», роль — на «кто сделал», и смешивать '
  'их значит сломать фильтр по действию.';

COMMIT;

-- ═══ ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ ════════════════════════════════════════════
--
--   -- таблица и её права:
--   SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type)
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND table_name = 'managers'
--    GROUP BY grantee ORDER BY grantee;
--   -- ждём: authenticated = SELECT, anon отсутствует вовсе
--
--   -- разбор роли знает менеджера:
--   SELECT pg_get_functiondef('public.get_current_user_role'::regproc);
--
--   -- колонка роли в журнале, все старые записи помечены суперадмином:
--   SELECT actor_role, count(*) FROM public.superadmin_journal GROUP BY 1;
--
--   -- существующие роли не задеты:
--   SELECT count(*) FROM public.super_admins;  -- было 1
--   SELECT count(*) FROM public.admins;        -- было 4
--
-- ЕСЛИ ПОНАДОБИТСЯ СНЯТЬ (роль ещё нигде не используется, снос дешёвый):
--
--   DROP FUNCTION public.is_manager();
--   DROP TABLE public.managers;
--   ALTER TABLE public.superadmin_journal DROP COLUMN actor_role;
--   -- и вернуть get_current_user_role к пяти веткам
