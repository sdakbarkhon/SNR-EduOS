-- Миграция 202: школу можно убрать — архивом или насовсем.
--
-- ЧТО БЫЛО. Школу нельзя было убрать никак. На public.schools смотрят 58
-- внешних ключей, и 55 из них запрещали удаление (no action): ошибочно
-- заведённая школа оставалась в системе навсегда, а суперадмин видел её в
-- списке рядом с настоящими.
--
-- ДВА РАЗНЫХ ДЕЙСТВИЯ, А НЕ ОДНО.
--
--  1. АРХИВ — обратимый. Школа исчезает из списков и в неё нельзя войти, но
--     все данные лежат на месте. Сделан ровно так же, как «скрытие» предмета
--     школы (school_subjects.is_active, тот же тип и то же значение по
--     умолчанию) — второго способа прятать сущности в проекте заводить не
--     стали.
--
--  2. УДАЛЕНИЕ — необратимое. Уходит всё: люди, уроки, оценки, работы.
--
-- ПОЧЕМУ КАСКАД, А НЕ УДАЛЕНИЕ ПО ПОРЯДКУ В КОДЕ. 55 таблиц пришлось бы
-- удалять в правильном порядке руками, и любая будущая таблица со school_id
-- ломала бы этот порядок молча — до первой попытки удалить школу. Каскад
-- перекладывает порядок на Postgres: он и так знает граф связей. Ни на что,
-- кроме удаления самой школы, это не влияет — строка schools не удаляется
-- больше нигде во всём проекте.
--
-- ЧТО КАСКАД НЕ УБИРАЕТ И ДЕЛАЕТ КОД:
--   • файлы в хранилище — пути лежат в колонках вроде file_storage_path, и
--     Postgres о них не знает. Их собирает и удаляет серверное действие ДО
--     удаления строк, через API хранилища (иначе остались бы призраками);
--   • учётные записи в auth.users — связь идёт в обратную сторону
--     (students.user_id → auth.users), каскадом их не достать. Их удаляет то
--     же серверное действие после школы, иначе «удалённый» учитель продолжал
--     бы входить.
--
-- ДЕМО-ШКОЛУ НЕЛЬЗЯ НИ УДАЛИТЬ, НИ АРХИВИРОВАТЬ. Это запрещает триггер ниже,
-- то есть сама база, а не спрятанная кнопка: демо — витрина продукта, и её
-- потеря по ошибке дороже всего остального.

-- ── 1. Флаг архива ──────────────────────────────────────────────────────────
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.schools.is_active IS
  'false — школа в архиве: не показывается в списках, вход закрыт, данные целы. '
  'Тот же приём, что у school_subjects.is_active. Миграция 202.';

CREATE INDEX IF NOT EXISTS idx_schools_active ON public.schools (is_active) WHERE NOT is_active;

-- ── 2. Демо-школа неприкосновенна ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_protect_demo_school()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_demo THEN
      RAISE EXCEPTION 'demo_school_cannot_be_deleted'
        USING HINT = 'Демо-школа — витрина продукта, её удаление запрещено на уровне базы.';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: архивировать демо тоже нельзя.
  IF OLD.is_demo AND NEW.is_active = false THEN
    RAISE EXCEPTION 'demo_school_cannot_be_archived'
      USING HINT = 'Демо-школа должна оставаться доступной.';
  END IF;
  -- И снимать признак демо, чтобы обойти запрет, — тоже.
  IF OLD.is_demo AND NEW.is_demo = false THEN
    RAISE EXCEPTION 'demo_flag_is_permanent'
      USING HINT = 'Снятие признака демо открыло бы обход защиты от удаления.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_demo_school ON public.schools;
CREATE TRIGGER trg_protect_demo_school
  BEFORE UPDATE OR DELETE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_demo_school();

-- ── 3. 55 связей переводятся на каскад ──────────────────────────────────────
-- Перебираем ВСЕ внешние ключи на schools, у которых сейчас стоит запрет, и
-- пересоздаём их с ON DELETE CASCADE. Имя и колонки сохраняются — определение
-- берём из каталога, а не переписываем руками: так ничего не потеряется.
DO $$
DECLARE
  r RECORD;
  v_def text;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass::text AS child, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE c.confrelid = 'public.schools'::regclass
      AND c.contype = 'f'
      AND c.confdeltype IN ('a', 'r')   -- no action / restrict
  LOOP
    v_def := r.def || ' ON DELETE CASCADE';
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.child, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.child, r.conname, v_def);
  END LOOP;
END $$;

-- ── 4. Архивная школа не участвует в жизни системы ──────────────────────────
-- Выдача демо-слотов и любые выборки школ обязаны считаться только с живыми.
-- Функция одна, чтобы условие не расползлось по коду копиями.
CREATE OR REPLACE FUNCTION public.school_is_active(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((SELECT s.is_active FROM public.schools s WHERE s.id = p_school_id), false)
$$;

REVOKE ALL ON FUNCTION public.school_is_active(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.school_is_active(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.school_is_active(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.school_is_active(uuid) IS
  'Живая ли школа. Архивная (is_active = false) не должна попадать в списки, '
  'в выдачу демо-слотов и в подсчёты. Миграция 202.';

-- ── 5. «Моя школа жива?» — один вызов для экрана входа ──────────────────────
-- Отдельная функция без аргумента: вход спрашивает про СВОЮ школу, и
-- передавать её идентификатор снаружи незачем — он берётся из сессии.
CREATE OR REPLACE FUNCTION public.school_is_active_for_me()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- ВАЖНО: у суперадмина школы нет вовсе, current_school_id() отдаёт NULL.
  -- Без этой ветки вход суперадмину закрылся бы наглухо: NULL-школа
  -- считалась бы архивной. Нет школы — нечего и архивировать.
  SELECT CASE
    WHEN public.current_school_id() IS NULL THEN true
    ELSE public.school_is_active(public.current_school_id())
  END
$$;

REVOKE ALL ON FUNCTION public.school_is_active_for_me() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.school_is_active_for_me() FROM anon;
GRANT EXECUTE ON FUNCTION public.school_is_active_for_me() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
