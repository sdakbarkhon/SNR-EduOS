-- Миграция 237: удаление администратора школы перестаёт упираться в след
-- «кто завёл родителя».
--
-- ЧТО БЫЛО СЛОМАНО. Суперадмин удаляет администратора школы и получает отказ.
-- Ошибку завели 24.08.2026 и подозревали миграцию 222 (закрытие записи
-- суперадмину). Подозрение не подтвердилось: у `admins` нет ни одного правила
-- ЗАПИСИ вовсе, а удаление идёт служебным ключом, который правила доступа
-- обходит целиком. Настоящая причина воспроизведена прогоном в транзакции:
--
--     23503  update or delete on table "users" violates foreign key
--            constraint "parents_created_by_fkey" on table "parents"
--
-- То есть внешний ключ БЕЗ каскада: `parents.created_by -> auth.users(id)` из
-- миграции 74, заведённый задолго до 222. Админ, который хоть раз завёл
-- родителя, становится неудаляемым навсегда.
--
-- ПОЧЕМУ ЭТО НЕ ЛОВИЛОСЬ ГЛАЗАМИ. Удаление идёт через Auth API, а он подменяет
-- текст базы своим «Database error deleting user». Настоящий код 23503 виден
-- только в логах Postgres.
--
-- ЧТО МЕНЯЕМ. Три ссылки на `auth.users`, у которых нет действия при удалении,
-- получают ON DELETE SET NULL:
--
--     parents.created_by             (миграция 74)
--     parent_invites.created_by      (миграция 74)
--     student_medical.updated_by     (миграция 232)
--
-- Все три колонки уже допускают NULL — проверено в information_schema, менять
-- их не нужно. Больше ссылок без каскада на `auth.users` нет ни одной:
-- остальные двадцать две либо CASCADE, либо SET NULL.
--
-- ЧТО ТЕРЯЕТСЯ. Только след «кто завёл»: у родителя, приглашения и записи о
-- здоровье поле становится пустым. Сами строки остаются целиком. Решение
-- заказчика: сам родитель важнее, чем запись о том, кто его создал. Кто и
-- когда удалил администратора, всё равно остаётся в журнале суперадмина
-- (миграция 220) — история действия не теряется, теряется только ссылка.
--
-- ЧЕГО ЭТА МИГРАЦИЯ НЕ ТРОГАЕТ:
--   * защиту последнего администратора школы (228) — она остаётся и остаётся
--     первой: сначала триггер не даст удалить последнего, и только у не
--     последнего дело дойдёт до этих ключей;
--   * ни одного правила доступа;
--   * журнал действий суперадмина.
--
-- ЗАМКИ. Каждый ALTER берёт ACCESS EXCLUSIVE на СВОЮ таблицу и
-- SHARE ROW EXCLUSIVE на `auth.users` (на время добавления ключа). Размеры на
-- 30.08.2026: parents 2 строки / 136 kB, parent_invites 0 строк / 72 kB,
-- student_medical 0 строк / 48 kB, auth.users 49 строк / 344 kB. На таких
-- объёмах проверка ключа мгновенна, замок держится доли секунды. Но замок на
-- `auth.users` на эти доли секунды придержит вход и продление сессий —
-- применять лучше в спокойную минуту.

BEGIN;

-- ── parents.created_by ──────────────────────────────────────────────────────
ALTER TABLE public.parents
  DROP CONSTRAINT IF EXISTS parents_created_by_fkey;
ALTER TABLE public.parents
  ADD CONSTRAINT parents_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── parent_invites.created_by ───────────────────────────────────────────────
ALTER TABLE public.parent_invites
  DROP CONSTRAINT IF EXISTS parent_invites_created_by_fkey;
ALTER TABLE public.parent_invites
  ADD CONSTRAINT parent_invites_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── student_medical.updated_by ──────────────────────────────────────────────
ALTER TABLE public.student_medical
  DROP CONSTRAINT IF EXISTS student_medical_updated_by_fkey;
ALTER TABLE public.student_medical
  ADD CONSTRAINT student_medical_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;

-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ. Должно вернуть три строки, у всех «SET NULL»:
--
--   SELECT rel.relname AS tbl, con.conname,
--          CASE con.confdeltype WHEN 'n' THEN 'SET NULL' WHEN 'a' THEN 'NO ACTION'
--               WHEN 'c' THEN 'CASCADE' END AS on_delete
--     FROM pg_constraint con
--     JOIN pg_class rel ON rel.oid = con.conrelid
--    WHERE con.conname IN ('parents_created_by_fkey',
--                          'parent_invites_created_by_fkey',
--                          'student_medical_updated_by_fkey');

-- ── ВТОРАЯ ЧАСТЬ: ЧТОБЫ СЛЕДУЮЩАЯ ТАКАЯ ССЫЛКА НЕ СТАЛА ЗАГАДКОЙ ────────────
--
-- Сегодня ссылок, мешающих удалить учётную запись, не осталось ни одной. Но
-- заведут завтра — новую таблицу с `created_by uuid REFERENCES auth.users(id)`
-- без действия при удалении, — и человек снова упрётся в «Database error
-- deleting user», потому что Auth API прячет настоящую причину.
--
-- Эта функция отвечает на вопрос «что мешает удалить этого пользователя»,
-- СПРАШИВАЯ У САМОЙ БАЗЫ, а не по списку в коде: список в коде забыли бы
-- пополнить ровно в тот день, когда он понадобится. Берутся все внешние ключи
-- на `auth.users` с действием NO ACTION или RESTRICT и считаются строки,
-- которые ссылаются на этого пользователя.
--
-- Имена таблиц и колонок приходят из системного каталога, а не от вызывающего,
-- и подставляются через %I — своей подстановки в запрос здесь нет.
--
-- Читающая, ничего не меняет. Права: только служебному ключу — её зовёт
-- серверный код перед удалением, и больше никто.
CREATE OR REPLACE FUNCTION public.fn_user_delete_blockers(p_user_id uuid)
RETURNS TABLE (table_name text, column_name text, row_count integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  r record;
  v_count integer;
BEGIN
  FOR r IN
    SELECT ns.nspname AS schema_name,
           rel.relname AS tbl,
           att.attname AS col
      FROM pg_constraint con
      JOIN pg_class rel   ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      JOIN pg_class frel  ON frel.oid = con.confrelid
      JOIN pg_namespace fns ON fns.oid = frel.relnamespace
      JOIN unnest(con.conkey) AS k(attnum) ON true
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = k.attnum
     WHERE con.contype = 'f'
       AND fns.nspname = 'auth'
       AND frel.relname = 'users'
       -- 'a' — NO ACTION, 'r' — RESTRICT. Только они мешают удалению;
       -- CASCADE и SET NULL разбираются сами.
       AND con.confdeltype IN ('a', 'r')
     ORDER BY rel.relname, att.attname
  LOOP
    EXECUTE format('SELECT count(*)::integer FROM %I.%I WHERE %I = $1',
                   r.schema_name, r.tbl, r.col)
       INTO v_count
      USING p_user_id;
    IF v_count > 0 THEN
      table_name := r.tbl;
      column_name := r.col;
      row_count := v_count;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$fn$;

COMMENT ON FUNCTION public.fn_user_delete_blockers(uuid) IS
  'Что мешает удалить учётную запись: внешние ключи на auth.users без каскада '
  'и число ссылающихся строк. Миграция 237.';

REVOKE ALL ON FUNCTION public.fn_user_delete_blockers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_user_delete_blockers(uuid) TO service_role;
