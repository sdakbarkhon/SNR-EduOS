-- 194 — логин администратора школы отдельным полем.
--
-- ЗАЧЕМ. Учётные записи школ создаются с адресом `логин@<роль>.snr.local`, а
-- если такой логин уже занят другой школой — с адресом `логин.<код-школы>@…`
-- (см. createSchoolScopedUser, Z.2.10). Вход по логину разбирается резолвером
-- в app/actions/auth.ts: он ищет кандидатов в students и teachers по колонке
-- username. У админов такой колонки не было, и в резолвере для них стоял
-- пустой список с пометкой «найдём через сам адрес» — ветки, которая бы это
-- делала, не существовало.
--
-- Следствие: администратор второй школы с тем же логином получал школьный
-- адрес и войти уже не мог — ни по логину (резолвер его не видит), ни по
-- простому адресу (тот занят чужой записью). Молча, без сообщения.
--
-- ЧТО ДЕЛАЕМ. Заводим admins.username, заполняем из адреса учётной записи и
-- ставим уникальность в пределах школы. Резолвер входа начинает искать
-- админов так же, как учеников и учителей.
--
-- БЕЗОПАСНОСТЬ. Колонка не меняет ни одной политики: admins по-прежнему
-- читается только своей же строкой («admin reads own record»), а резолвер
-- работает служебным ключом, для которого RLS не действует.

BEGIN;

ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS username text;

-- Заполняем из локальной части адреса. У записей со школьным адресом
-- (`логин.код@…`) хвост с кодом школы отрезаем: логин — это то, что человеку
-- выдали на руки, а суффикс приписала система при столкновении.
UPDATE public.admins a
   SET username = src.login
  FROM (
    SELECT
      a2.id,
      CASE
        WHEN s.code IS NOT NULL
         AND split_part(u.email, '@', 1) LIKE '%.' || lower(s.code)
        THEN left(
               split_part(u.email, '@', 1),
               length(split_part(u.email, '@', 1)) - length('.' || lower(s.code))
             )
        ELSE split_part(u.email, '@', 1)
      END AS login
    FROM public.admins a2
    JOIN auth.users u ON u.id = a2.user_id
    LEFT JOIN public.schools s ON s.id = a2.school_id
  ) src
 WHERE src.id = a.id
   AND a.username IS NULL;

-- Один логин на школу. Регистр не важен: вход приводит введённое к нижнему.
CREATE UNIQUE INDEX IF NOT EXISTS admins_school_username_uniq
  ON public.admins (school_id, lower(username))
  WHERE username IS NOT NULL;

-- Поиск кандидатов при входе идёт по логину без привязки к школе.
CREATE INDEX IF NOT EXISTS admins_username_idx
  ON public.admins (lower(username))
  WHERE username IS NOT NULL;

-- ── самопроверки ──────────────────────────────────────────────────────────
DO $$
DECLARE
  empty_cnt int;
  dup_cnt   int;
BEGIN
  SELECT count(*) INTO empty_cnt FROM public.admins WHERE username IS NULL OR btrim(username) = '';
  IF empty_cnt > 0 THEN
    RAISE EXCEPTION 'у % администраторов логин не заполнился', empty_cnt;
  END IF;

  SELECT count(*) INTO dup_cnt FROM (
    SELECT school_id, lower(username) FROM public.admins
     GROUP BY 1, 2 HAVING count(*) > 1
  ) d;
  IF dup_cnt > 0 THEN
    RAISE EXCEPTION 'логины администраторов повторяются в % школах', dup_cnt;
  END IF;

  RAISE NOTICE 'admins.username заполнен у всех, повторов нет';
END $$;

COMMIT;
