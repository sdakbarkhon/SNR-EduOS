-- Миграция 213: логин уникален во всей системе; вход через Google — не только
-- у родителей.
--
-- ── 1. ПОЧЕМУ ЛОГИН БЫЛ УНИКАЛЕН ТОЛЬКО ВНУТРИ ШКОЛЫ ───────────────────────
-- Стояли индексы UNIQUE(school_id, username) у students и teachers и
-- UNIQUE(school_id, lower(username)) у admins. То есть в двух школах мог жить
-- свой «ivanov», и вход по логину приходилось разруливать вторым вопросом
-- «в какую школу входите» (Z.2.10). Теперь логин занят — значит занят везде.
--
-- ПРОВЕРЕНО ПЕРЕД ПРАВКОЙ: совпадений нет ни одного. 43 логина (2 админа,
-- 31 ученик, 10 учителей), все различны даже без учёта регистра и между
-- ролями. Поэтому ограничение накладывается на живые данные без разбора
-- конфликтов.
--
-- ЛОГИН ЕСТЬ НЕ У ВСЕХ. Колонка username существует только у admins, students
-- и teachers. Родитель входит по телефону, у суперадминистратора логина нет
-- вовсе — притворяться, что покрыты пять ролей, не станем: покрыты три, и
-- ровно те, у которых есть что делать уникальным.
--
-- ПОЧЕМУ ИНДЕКС + ТРИГГЕР, А НЕ ОДИН ИНДЕКС. Уникальный индекс работает внутри
-- одной таблицы. «Ivanov не должен повториться ни у ученика, ни у учителя, ни у
-- админа» — это уже три таблицы, и обычным индексом такое не выражается.
-- Поэтому: индекс держит уникальность внутри таблицы, триггер — между ними.
-- Форму при этом не спрашиваем вовсе: её обходят прямым обращением к базе.
--
-- ── 2. ПОЧТА ДЛЯ ВХОДА ЧЕРЕЗ GOOGLE ────────────────────────────────────────
-- У родителей google_email появилась ещё в миграции 201 и работает. Ученикам,
-- учителям и админам колонки не было — добавляется здесь по тому же образцу:
-- нормализованное хранение (CHECK), уникальность и та же сверка в коде.
--
-- ОДНА ПОЧТА — ОДИН ЧЕЛОВЕК, и это держит база. Иначе двое с одним адресом
-- сделали бы вход через Google неоднозначным, а неоднозначность здесь означает
-- «кого-то пустили в чужой кабинет».

-- ── Колонки почты ───────────────────────────────────────────────────────────
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS google_email text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS google_email text;
ALTER TABLE public.admins   ADD COLUMN IF NOT EXISTS google_email text;

COMMENT ON COLUMN public.students.google_email IS
  'Почта Google для входа. Вписывает администратор школы. Хранится в нижнем '
  'регистре без пробелов — та же нормализация, что у parents (миграция 201).';
COMMENT ON COLUMN public.teachers.google_email IS 'См. students.google_email.';
COMMENT ON COLUMN public.admins.google_email   IS
  'Почта Google для входа. Вписывает суперадминистратор.';

-- Хранение только нормализованным: сравнение почт не то место, где стоит
-- надеяться, что «оно и так совпадёт».
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['students','teachers','admins'] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      t, t || '_google_email_norm_chk');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK ('
      || 'google_email IS NULL OR google_email = lower(btrim(google_email)))',
      t, t || '_google_email_norm_chk');
  END LOOP;
END $$;

-- ── Уникальность внутри таблицы ─────────────────────────────────────────────
-- Логин: прежние индексы «школа + логин» уступают место глобальным.
-- Индексы students_school_username_key / teachers_school_username_key созданы
-- ограничением UNIQUE, а не CREATE INDEX, — их нельзя удалить индексом,
-- только вместе с ограничением. Имя ограничения совпадает с именем индекса
-- (так их назвал Postgres при создании таблицы), поэтому снимаем по нему.
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_school_username_key;
ALTER TABLE public.teachers DROP CONSTRAINT IF EXISTS teachers_school_username_key;
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_school_id_username_key;
ALTER TABLE public.teachers DROP CONSTRAINT IF EXISTS teachers_school_id_username_key;
-- А этот заводился обычным CREATE UNIQUE INDEX (миграция 194).
DROP INDEX IF EXISTS public.admins_school_username_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS students_username_global_uniq
  ON public.students (lower(btrim(username))) WHERE username IS NOT NULL AND btrim(username) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS teachers_username_global_uniq
  ON public.teachers (lower(btrim(username))) WHERE username IS NOT NULL AND btrim(username) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS admins_username_global_uniq
  ON public.admins   (lower(btrim(username))) WHERE username IS NOT NULL AND btrim(username) <> '';

-- Почта: уникальна внутри каждой таблицы (у parents индекс уже есть с 201).
CREATE UNIQUE INDEX IF NOT EXISTS students_google_email_uniq
  ON public.students (lower(btrim(google_email))) WHERE google_email IS NOT NULL AND btrim(google_email) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS teachers_google_email_uniq
  ON public.teachers (lower(btrim(google_email))) WHERE google_email IS NOT NULL AND btrim(google_email) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS admins_google_email_uniq
  ON public.admins   (lower(btrim(google_email))) WHERE google_email IS NOT NULL AND btrim(google_email) <> '';

-- ── Уникальность МЕЖДУ таблицами ────────────────────────────────────────────
-- SECURITY DEFINER: проверка обязана видеть все три таблицы целиком, а под
-- правами вызывающего он видит только свою школу — и «свободен» означало бы
-- «свободен в моей школе», то есть ровно то, от чего уходим.
CREATE OR REPLACE FUNCTION public.fn_login_is_taken(
  p_login text, p_table text, p_id uuid
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_login text := lower(btrim(coalesce(p_login, '')));
  v_found boolean;
BEGIN
  IF v_login = '' THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.students s
     WHERE lower(btrim(s.username)) = v_login
       AND NOT (p_table = 'students' AND s.id = p_id)
    UNION ALL
    SELECT 1 FROM public.teachers t
     WHERE lower(btrim(t.username)) = v_login
       AND NOT (p_table = 'teachers' AND t.id = p_id)
    UNION ALL
    SELECT 1 FROM public.admins a
     WHERE lower(btrim(a.username)) = v_login
       AND NOT (p_table = 'admins' AND a.id = p_id)
  ) INTO v_found;

  RETURN v_found;
END $$;

COMMENT ON FUNCTION public.fn_login_is_taken(text, text, uuid) IS
  'Занят ли логин в ЛЮБОЙ из трёх ролей. Индекс держит уникальность внутри '
  'таблицы, эта функция — между таблицами.';

CREATE OR REPLACE FUNCTION public.fn_email_is_taken(
  p_email text, p_table text, p_id uuid
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_found boolean;
BEGIN
  IF v_email = '' THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.students s
     WHERE lower(btrim(s.google_email)) = v_email AND NOT (p_table = 'students' AND s.id = p_id)
    UNION ALL
    SELECT 1 FROM public.teachers t
     WHERE lower(btrim(t.google_email)) = v_email AND NOT (p_table = 'teachers' AND t.id = p_id)
    UNION ALL
    SELECT 1 FROM public.admins a
     WHERE lower(btrim(a.google_email)) = v_email AND NOT (p_table = 'admins' AND a.id = p_id)
    UNION ALL
    SELECT 1 FROM public.parents p
     WHERE lower(btrim(p.google_email)) = v_email AND NOT (p_table = 'parents' AND p.id = p_id)
  ) INTO v_found;

  RETURN v_found;
END $$;

COMMENT ON FUNCTION public.fn_email_is_taken(text, text, uuid) IS
  'Привязана ли почта к кому-то ещё — по всем четырём ролям, включая '
  'родителей. Одна почта на двоих сделала бы вход через Google неоднозначным.';

-- Один триггер на все таблицы: TG_TABLE_NAME отличает вызывающего.
-- Сообщения нарочно человеческие: их показывает форма, и «duplicate key value
-- violates unique constraint» администратору читать незачем.
CREATE OR REPLACE FUNCTION public.tg_check_login_and_email_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.username IS NOT NULL AND btrim(NEW.username) <> ''
     AND (TG_OP = 'INSERT' OR NEW.username IS DISTINCT FROM OLD.username)
     AND public.fn_login_is_taken(NEW.username, TG_TABLE_NAME, NEW.id)
  THEN
    RAISE EXCEPTION 'LOGIN_TAKEN' USING ERRCODE = 'unique_violation';
  END IF;

  IF NEW.google_email IS NOT NULL AND btrim(NEW.google_email) <> ''
     AND (TG_OP = 'INSERT' OR NEW.google_email IS DISTINCT FROM OLD.google_email)
     AND public.fn_email_is_taken(NEW.google_email, TG_TABLE_NAME, NEW.id)
  THEN
    RAISE EXCEPTION 'EMAIL_TAKEN' USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_unique_login_email ON public.students;
CREATE TRIGGER trg_unique_login_email BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.tg_check_login_and_email_unique();

DROP TRIGGER IF EXISTS trg_unique_login_email ON public.teachers;
CREATE TRIGGER trg_unique_login_email BEFORE INSERT OR UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.tg_check_login_and_email_unique();

DROP TRIGGER IF EXISTS trg_unique_login_email ON public.admins;
CREATE TRIGGER trg_unique_login_email BEFORE INSERT OR UPDATE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.tg_check_login_and_email_unique();

-- У родителей логина нет — проверяется только почта. Отдельный триггер, чтобы
-- общая функция не спотыкалась об отсутствующую колонку username.
CREATE OR REPLACE FUNCTION public.tg_check_parent_email_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.google_email IS NOT NULL AND btrim(NEW.google_email) <> ''
     AND (TG_OP = 'INSERT' OR NEW.google_email IS DISTINCT FROM OLD.google_email)
     AND public.fn_email_is_taken(NEW.google_email, 'parents', NEW.id)
  THEN
    RAISE EXCEPTION 'EMAIL_TAKEN' USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_unique_parent_email ON public.parents;
CREATE TRIGGER trg_unique_parent_email BEFORE INSERT OR UPDATE ON public.parents
  FOR EACH ROW EXECUTE FUNCTION public.tg_check_parent_email_unique();

-- ── Самопроверка ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_school uuid;
  v_login  text;
  v_ok     boolean;
BEGIN
  SELECT id INTO v_school FROM public.schools WHERE NOT is_demo LIMIT 1;
  SELECT lower(btrim(username)) INTO v_login FROM public.students WHERE username IS NOT NULL LIMIT 1;
  IF v_login IS NULL THEN
    RAISE NOTICE 'нет логинов для проверки — самопроверка пропущена';
    RETURN;
  END IF;

  -- Логин ученика занят и для учителя, и в другой школе.
  IF NOT public.fn_login_is_taken(v_login, 'teachers', gen_random_uuid()) THEN
    RAISE EXCEPTION 'логин ученика не считается занятым для учителя';
  END IF;
  IF NOT public.fn_login_is_taken(upper(v_login), 'admins', gen_random_uuid()) THEN
    RAISE EXCEPTION 'регистр обходит проверку занятости';
  END IF;

  -- Свой собственный логин занятым для себя НЕ считается — иначе любое
  -- обновление строки падало бы.
  SELECT NOT public.fn_login_is_taken(v_login, 'students', id) INTO v_ok
    FROM public.students WHERE lower(btrim(username)) = v_login LIMIT 1;
  IF NOT v_ok THEN RAISE EXCEPTION 'ученик конфликтует сам с собой'; END IF;

  -- Свободный логин свободен.
  IF public.fn_login_is_taken('свободный-логин-' || gen_random_uuid()::text, 'students', gen_random_uuid()) THEN
    RAISE EXCEPTION 'свободный логин считается занятым';
  END IF;

  RAISE NOTICE 'Миграция 213: логины уникальны во всей системе, почта заведена трём ролям';
END $$;
