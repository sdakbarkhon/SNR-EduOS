-- =====================================================================
-- 232 — ЛИЧНЫЕ ДАННЫЕ УЧЕНИКА И МЕДИЦИНСКИЕ СВЕДЕНИЯ
--
-- ЗАЧЕМ. Профиль ребёнка в родительском приложении показывал номер личного
-- дела, аллергию и медицинские особенности из заготовки — заполнять их было
-- негде. 28.08.2026 эти строки убрали с экрана настоящего родителя именно
-- потому, что источника нет. Здесь источник заводится.
--
-- ЧТО ЗАВОДИТСЯ:
--   * students.file_no  — номер личного дела, вводит администратор руками;
--   * students.gender   — пол ученика;
--   * public.student_medical — ОТДЕЛЬНАЯ ТАБЛИЦА под аллергию и медицинские
--     особенности. Почему отдельная, а не две колонки в students — ниже,
--     это главное решение миграции.
--
-- ═══════════════════════════════════════════════════════════════════════
-- ПОЧЕМУ МЕДИЦИНСКИЕ СВЕДЕНИЯ — ОТДЕЛЬНОЙ ТАБЛИЦЕЙ
-- ═══════════════════════════════════════════════════════════════════════
--
-- Требование заказчика: аллергию и медицинские особенности видят админ своей
-- школы, родитель своего ребёнка и суперадмин. НЕ видят учитель, куратор, сам
-- ученик, родитель чужого ребёнка, админ чужой школы.
--
-- ЧЕМ ЭТО НЕЛЬЗЯ ЗАКРЫТЬ. Правила доступа (RLS) в Postgres работают
-- ПОСТРОЧНО. Строку ученика обязан читать учитель — иначе не будет ни
-- журнала, ни посещаемости, ни оценок (политика «teacher reads students in
-- own groups»). Значит, лежи эти поля в students, учитель читал бы их вместе
-- со всей строкой.
--
-- Поколоночные права в Postgres ЕСТЬ — GRANT SELECT (столбец) — но здесь они
-- бесполезны: право выдаётся РОЛИ БАЗЫ, а в Supabase все вошедшие люди
-- приходят под одной ролью authenticated. Учитель и админ для базы — одна и
-- та же роль, различаются они только содержимым токена, который читают
-- функции is_my_child() / fn_is_admin() внутри правил доступа. Разделить их
-- грантом нельзя физически.
--
-- Отсюда решение: своя таблица со своими правилами. Одна строка на ученика,
-- связь один-к-одному. Учитель не получает на неё ни одного права — не
-- «поле спрятано в выдаче», а строки для него не существует.
--
-- ПРОВЕРКА В КОДЕ здесь не годится вовсе: админский слой ходит служебным
-- ключом, который правила доступа обходит, а мобильное приложение — токеном
-- человека. Защита, которая живёт только в приложении, обходится любым
-- запросом мимо него.
--
-- ═══════════════════════════════════════════════════════════════════════
-- ПОЧЕМУ ПОЛ — ТЕКСТ С ПРОВЕРКОЙ, А НЕ ПЕРЕЧИСЛЕНИЕ
-- ═══════════════════════════════════════════════════════════════════════
--
-- В схеме уже есть перечисления (students.status — student_status), так что
-- прецедент против. Но добавить значение в перечисление нельзя внутри
-- транзакции с последующим использованием, а все миграции этого проекта
-- применяются одной транзакцией (apply-migration.mjs). Появится завтра
-- третье значение — придётся городить миграцию в два приёма. У текста с
-- CHECK такой беды нет: правило переписывается одной строкой.
--
-- Значения — КОДЫ, не слова: 'male' / 'female'. Русские слова в базе уже
-- один раз обошлись дорого (перевод демо-заготовок ключуется по русской
-- строке, и правка текста рвёт перевод). Подпись на экране — дело словаря.
--
-- Пустое значение — законное: пол необязателен, NULL значит «не указан».
-- Отдельного 'unspecified' не заводим, чтобы не было двух способов сказать
-- одно и то же.
--
-- ЧТО ДЕЛАТЬ С is_female В МОБИЛЬНОМ. Там поле ChildRow.is_female всегда
-- ложно (toChildRow ставит false константой) и читает его ровно одно место —
-- выдуманный текст помощника на ДЕМО-ветке экрана прогресса. Настоящего
-- родителя оно не касается. Здесь его не трогаем: мобильное приложение в
-- этот заход не входит. В заходе по профилю ребёнка его надо заменить на
-- students.gender, а не оставлять рядом второй источник.
--
-- ═══════════════════════════════════════════════════════════════════════
-- ЗАМОК. ALTER TABLE public.students БЕРЁТ ИСКЛЮЧИТЕЛЬНЫЙ ЗАМОК НА ТАБЛИЦУ
-- ═══════════════════════════════════════════════════════════════════════
--
-- ACCESS EXCLUSIVE — на время миграции ученики недоступны никому, включая
-- чтение. Добавление колонки без значения по умолчанию таблицу не
-- переписывает и длится миллисекунды, но замок ждёт завершения ВСЕХ текущих
-- запросов к students, а его самого ждут все новые.
--
-- На миграции 227 это уже стоило взаимной блокировки (40P01, процессы
-- 3109554 и 3109561). Перед применением закрыть лишние вкладки с открытыми
-- экранами учеников, журнала и посещаемости.
--
-- ЧЕГО МИГРАЦИЯ НЕ ДЕЛАЕТ:
--   * не трогает существующие 31 строку учеников — новые поля пустые у всех;
--   * не заводит куратора: он уже есть у группы (groups.teacher_id), новая
--     колонка не нужна — см. отчёт захода;
--   * не трогает students.curator_id — его перестанут читать отдельным
--     заходом, здесь только схема;
--   * не трогает формы админки и мобильное приложение;
--   * не задаёт уникальность номера личного дела: заказчик сказал схему не
--     выдумывать, а уникальность — это уже схема. Если два ученика получат
--     один номер, база не возразит. Решение отложено сознательно;
--   * не регистрирует себя в supabase_migrations.schema_migrations — это
--     делает apply-migration.mjs внутри той же транзакции.
-- =====================================================================

BEGIN;

-- ── 1. ЛИЧНЫЕ ДАННЫЕ УЧЕНИКА ─────────────────────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS file_no text,
  ADD COLUMN IF NOT EXISTS gender  text;

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_gender_known;
ALTER TABLE public.students
  ADD CONSTRAINT students_gender_known
  CHECK (gender IS NULL OR gender IN ('male', 'female'));

COMMENT ON COLUMN public.students.file_no IS
  'Номер личного дела. Вводит администратор школы руками, схемы нумерации в '
  'продукте нет. Уникальность не проверяется — миграция 232.';
COMMENT ON COLUMN public.students.gender IS
  'Пол ученика: male / female. NULL — не указан. Коды, а не слова: подпись '
  'на экране собирает словарь. Миграция 232.';

-- ── 2. МЕДИЦИНСКИЕ СВЕДЕНИЯ — ОТДЕЛЬНАЯ ТАБЛИЦА ──────────────────────
CREATE TABLE IF NOT EXISTS public.student_medical (
  student_id     uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  -- Школа хранится строкой, а не берётся join'ом: правила доступа не должны
  -- ходить в students, иначе они начнут зависеть от ЕЁ правил.
  school_id      uuid NOT NULL REFERENCES public.schools(id),
  allergies      text,
  medical_notes  text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_student_medical_school
  ON public.student_medical (school_id);

COMMENT ON TABLE public.student_medical IS
  'Аллергия и медицинские особенности ученика. ОТДЕЛЬНАЯ таблица, а не '
  'колонки в students: строку ученика обязан читать учитель, а эти сведения '
  'он видеть не должен, и поколоночно их не спрятать — в Supabase все '
  'вошедшие приходят под одной ролью authenticated. Миграция 232.';

ALTER TABLE public.student_medical ENABLE ROW LEVEL SECURITY;

-- ── 3. ПРАВИЛА ДОСТУПА ───────────────────────────────────────────────
--
-- ЧТЕНИЕ: админ своей школы, родитель своего ребёнка, суперадмин.
-- Учителя, куратора и самого ученика в списке нет — для них строк нет.
DROP POLICY IF EXISTS "medical read" ON public.student_medical;
CREATE POLICY "medical read" ON public.student_medical
  FOR SELECT TO authenticated
  USING (
    (public.fn_is_admin() AND school_id = public.current_school_id())
    OR public.is_my_child(student_id)
    OR public.is_super_admin()
  );

-- ЗАПИСЬ: только админ своей школы. Родитель читает, но не правит —
-- медицинские сведения вносит школа. Суперадмин не пишет: список таблиц,
-- куда ему разрешено, пуст с миграции 222.
DROP POLICY IF EXISTS "medical write" ON public.student_medical;
CREATE POLICY "medical write" ON public.student_medical
  FOR ALL TO authenticated
  USING (public.fn_is_admin() AND school_id = public.current_school_id())
  WITH CHECK (public.fn_is_admin() AND school_id = public.current_school_id());

-- Сужающее правило суперадмина — как у всех таблиц с миграции 222. Тот
-- обход шёл циклом по таблицам, существовавшим на тот момент; новая таблица
-- в него не попала, поэтому правило добавляется здесь явно, иначе
-- student_medical стала бы единственным местом, куда суперадмин мог бы
-- писать. Условие дословно то же.
DROP POLICY IF EXISTS "superadmin write guard insert" ON public.student_medical;
CREATE POLICY "superadmin write guard insert" ON public.student_medical
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (NOT public.is_super_admin() OR public.sa_write_allowed('student_medical'));

DROP POLICY IF EXISTS "superadmin write guard update" ON public.student_medical;
CREATE POLICY "superadmin write guard update" ON public.student_medical
  AS RESTRICTIVE FOR UPDATE TO public
  USING (NOT public.is_super_admin() OR public.sa_write_allowed('student_medical'))
  WITH CHECK (NOT public.is_super_admin() OR public.sa_write_allowed('student_medical'));

DROP POLICY IF EXISTS "superadmin write guard delete" ON public.student_medical;
CREATE POLICY "superadmin write guard delete" ON public.student_medical
  AS RESTRICTIVE FOR DELETE TO public
  USING (NOT public.is_super_admin() OR public.sa_write_allowed('student_medical'));

-- Права на саму таблицу. anon не получает ничего: медицинские сведения с
-- улицы не читаются даже при ошибке в правилах.
REVOKE ALL ON public.student_medical FROM PUBLIC;
REVOKE ALL ON public.student_medical FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_medical TO authenticated;
GRANT ALL ON public.student_medical TO service_role;

COMMIT;

-- ── ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ — ТОЛЬКО ЧТЕНИЕ ────────────────────────
--   1) колонки появились, данные целы:
--      SELECT count(*) AS всего, count(file_no) AS с_делом, count(gender) AS с_полом
--        FROM public.students;                  -- ожидаем 31 / 0 / 0
--   2) правило пола на месте:
--      SELECT conname FROM pg_constraint
--       WHERE conrelid='public.students'::regclass AND conname='students_gender_known';
--   3) у таблицы медицинских сведений включены правила доступа:
--      SELECT relrowsecurity FROM pg_class
--       WHERE oid='public.student_medical'::regclass;   -- ожидаем true
--   4) правил ровно пять — чтение, запись и три сужающих:
--      SELECT policyname, cmd, permissive FROM pg_policies
--       WHERE schemaname='public' AND tablename='student_medical' ORDER BY policyname;
--   5) у анонима прав нет:
--      SELECT has_table_privilege('anon', 'public.student_medical', 'SELECT');  -- false
