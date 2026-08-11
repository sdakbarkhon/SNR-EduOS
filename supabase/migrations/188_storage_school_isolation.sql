-- =====================================================================
-- Migration 188 — изоляция ФАЙЛОВ между школами.
--
-- ДЫРА, КОТОРУЮ ЗАКРЫВАЕМ (замерено 11.08, не по документации):
-- политик на storage.objects — 50, слово «школа» не встречается ни в одной.
-- Семь бакетов открыты на чтение любому вошедшему одним условием вида
-- `bucket_id = 'materials'`. Проверено действием: ученик НАСТОЯЩЕЙ школы под
-- своим паролем скачал файл библиотеки ДЕМО-школы (2 233 155 байт), а
-- демо-ученику видны файлы настоящей школы. При этом чужих уроков и учеников
-- оба видят ноль: таблицы держат, файлы не держат вообще.
--
-- ПОЧЕМУ НЕ ЧИНИМ ПОЛИТИКИ ПО ОДНОЙ. Единого способа понять «чей файл» у
-- бакетов нет. Замер путей 11.08:
--   • у шести бакетов первый сегмент — идентификатор учителя или ученика;
--   • lesson-stage-images (141 объект, самый большой) — путь ПЛОСКИЙ,
--     `<uuid>.png`, папки нет вовсе;
--   • slide-images (22) и h5p-content (6) — папка есть, но её первый сегмент
--     не учитель, не ученик и не группа.
-- То есть 169 объектов из 234 про свою школу не говорят ничего.
--
-- РЕШЕНИЕ — СОГЛАШЕНИЕ О ПУТИ. Новые файлы кладутся в папку с
-- идентификатором школы: `<school_id>/<как было раньше>`. Правило чтения:
--   путь начинается с МОЕЙ школы
--   ИЛИ (префикса школы нет вообще И моя школа — демо).
-- Второе условие накрывает всё наследие: 229 объектов без префикса
-- принадлежат демо-школе. Существующие файлы НЕ двигаются.
--
-- ПОЧЕМУ ОГРАНИЧИТЕЛЬНАЯ ПОЛИТИКА, А НЕ ПЕРЕПИСЫВАНИЕ ПЯТИДЕСЯТИ.
-- Разрешительные политики складываются по ИЛИ — добавить к ним школу можно
-- только переписав каждую. Пятьдесят переписанных условий про «свою папку»,
-- «вложение домашнего задания», «подсказку», «сдачу» — это пятьдесят шансов
-- сломать видимость СВОИХ файлов, а сломанное чтение хуже нынешней дыры:
-- дыра пока никого не задевает, а учитель, не видящий свой материал, задевает
-- всех сразу. Ограничительная политика (AS RESTRICTIVE) складывается с ними
-- по И: старые правила остаются буквально нетронутыми, поверх них ложится
-- одно новое условие. Четыре политики вместо пятидесяти переписанных.
--
-- СЛУЖЕБНАЯ РОЛЬ НЕ ЗАДЕТА: у service_role стоит BYPASSRLS (проверено
-- pg_roles), поэтому серверные загрузки — картинки этапов, разбор учебных
-- планов — работают как работали.
--
-- ДАННЫЕ НЕ ТРОГАЮТСЯ: ни одного объекта не создаётся, не переносится и не
-- удаляется. Меняются только правила доступа.
-- =====================================================================

-- ── 1. Единственное место, где живёт правило ────────────────────────
CREATE OR REPLACE FUNCTION public.fn_storage_path_visible(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- новый вид: первый сегмент пути — идентификатор моей школы
    (split_part(p_name, '/', 1) = public.current_school_id()::text)
    OR
    -- наследие: префикса школы нет вовсе. Такие файлы принадлежат демо-школе,
    -- и видны они только тем, чья школа помечена is_demo.
    (
      NOT EXISTS (
        SELECT 1 FROM public.schools s WHERE s.id::text = split_part(p_name, '/', 1)
      )
      AND EXISTS (
        SELECT 1 FROM public.schools s
         WHERE s.id = public.current_school_id() AND s.is_demo
      )
    );
$$;

COMMENT ON FUNCTION public.fn_storage_path_visible(text) IS
  'Единственное правило принадлежности файла школе. Путь начинается с '
  'идентификатора школы; пути без такого префикса — наследие демо-школы. '
  'Используется четырьмя ограничительными политиками на storage.objects.';

-- ── 2. Четыре ограничительные политики ──────────────────────────────
-- TO public — значит и anon, и authenticated. service_role и postgres
-- обходят защиту строк и под эти политики не попадают.
DROP POLICY IF EXISTS "school isolation: read" ON storage.objects;
CREATE POLICY "school isolation: read" ON storage.objects
  AS RESTRICTIVE FOR SELECT TO public
  USING (public.fn_storage_path_visible(name));

DROP POLICY IF EXISTS "school isolation: write" ON storage.objects;
CREATE POLICY "school isolation: write" ON storage.objects
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (public.fn_storage_path_visible(name));

DROP POLICY IF EXISTS "school isolation: update" ON storage.objects;
CREATE POLICY "school isolation: update" ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO public
  USING (public.fn_storage_path_visible(name))
  WITH CHECK (public.fn_storage_path_visible(name));

DROP POLICY IF EXISTS "school isolation: delete" ON storage.objects;
CREATE POLICY "school isolation: delete" ON storage.objects
  AS RESTRICTIVE FOR DELETE TO public
  USING (public.fn_storage_path_visible(name));

-- ── 3. Самопроверка ─────────────────────────────────────────────────
DO $$
DECLARE
  v_demo_user   uuid;
  v_real_user   uuid;
  v_demo_school uuid;
  v_real_school uuid;
  v_answer      boolean;
  v_count       integer;
BEGIN
  SELECT id INTO v_demo_school FROM public.schools WHERE is_demo LIMIT 1;
  SELECT id INTO v_real_school FROM public.schools WHERE NOT is_demo LIMIT 1;
  SELECT user_id INTO v_demo_user FROM public.students
    WHERE school_id = v_demo_school AND user_id IS NOT NULL LIMIT 1;
  SELECT user_id INTO v_real_user FROM public.students
    WHERE school_id = v_real_school AND user_id IS NOT NULL LIMIT 1;

  IF v_demo_user IS NULL OR v_real_user IS NULL THEN
    RAISE NOTICE 'нет учеников для проверки в одной из школ — самопроверка пропущена';
    RETURN;
  END IF;

  -- Демо-ученик: наследие видит, чужой префикс — нет.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_demo_user, 'role', 'authenticated')::text, true);
  SELECT public.fn_storage_path_visible('030e2b6d-48ca-4af2-a194-03eda771720a.png') INTO v_answer;
  IF NOT v_answer THEN RAISE EXCEPTION 'демо-ученик потерял наследие: плоский путь стал невидим'; END IF;
  SELECT public.fn_storage_path_visible(v_real_school::text || '/x/y.pdf') INTO v_answer;
  IF v_answer THEN RAISE EXCEPTION 'демо-ученик видит файл чужой школы по новому префиксу'; END IF;

  -- Ученик настоящей школы: свой префикс видит, наследие — нет.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_real_user, 'role', 'authenticated')::text, true);
  SELECT public.fn_storage_path_visible(v_real_school::text || '/x/y.pdf') INTO v_answer;
  IF NOT v_answer THEN RAISE EXCEPTION 'ученик настоящей школы не видит файл СВОЕЙ школы'; END IF;
  SELECT public.fn_storage_path_visible('030e2b6d-48ca-4af2-a194-03eda771720a.png') INTO v_answer;
  IF v_answer THEN RAISE EXCEPTION 'ученик настоящей школы видит наследие демо-школы'; END IF;

  PERFORM set_config('request.jwt.claims', NULL, true);

  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects' AND permissive = 'RESTRICTIVE';
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'ограничительных политик % вместо 4', v_count;
  END IF;

  RAISE NOTICE 'Миграция 188: файлы изолированы по школам, наследие осталось у демо';
END $$;
