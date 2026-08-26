-- =====================================================================
-- Migration 226 — у урока обязан быть предмет.
--
-- БЕДА, КОТОРУЮ ЧИНИМ.
-- Колонка lessons.subject_id объявлена NULLABLE, значения по умолчанию нет,
-- и единственное, что её сторожит, — внешний ключ со SET NULL:
--
--   FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
--
-- То есть удаление предмета НЕ отклоняется, а молча обнуляет предмет у всех
-- его уроков. Урок при этом не исчезает и ошибки не даёт — он просто
-- перестаёт быть виден УЧИТЕЛЮ, и только ему: правила доступа сужают уроки
-- предметника через subject_id, а ученик, родитель, администратор и
-- суперадмин продолжают видеть тот же урок как ни в чём не бывало.
-- Проверено пробой с откатом на всех семи ролях.
--
-- ЦЕНА ОДНОГО УДАЛЕНИЯ. Сегодня на этом висит 126 уроков демо-школы и 2
-- урока боевой: удаление одного предмета убрало бы их из расписания учителя
-- разом и без единого сообщения.
--
-- ЗАПАСНОГО ПУТИ В БОЕВОЙ ШКОЛЕ НЕТ. Куратор видит уроки мимо предмета, но
-- is_curator_teacher() содержит AND s.is_demo — в боевой школе эта ветка не
-- срабатывает никогда. Здесь она намеренно НЕ трогается: мы закрываем
-- причину, а не расширяем обход.
--
-- ЧТО УЖЕ ЗАКРЫТО И ЧТО НЕТ. Из браузера дыру не пройти: форма учителя и
-- массовое создание требуют предмет, а удаление предмета в админке
-- останавливает гвард со счётом уроков. Открытыми оставались три пути —
-- createLesson в общем слое (subject_id: input.subjectId ?? null), прямая
-- вставка скриптом и само удаление предмета в обход админки.
--
-- ЧТО ДЕЛАЕТ ЭТА МИГРАЦИЯ.
--   1) отказывается работать, если в базе есть хоть один урок без предмета —
--      с понятным текстом и числом таких уроков. Ничего не проставляет за
--      человека: угадать предмет прошедшего урока нельзя, а поставить
--      «какой-нибудь» хуже, чем остановиться;
--   2) ставит NOT NULL на lessons.subject_id;
--   3) меняет ON DELETE SET NULL на ON DELETE RESTRICT.
--
-- ЦЕНА, ПРИНЯТАЯ ЗАКАЗЧИКОМ: предмет, у которого есть уроки, становится
-- неудаляемым. Это осознанный размен — молчаливая потеря расписания хуже,
-- чем отказ удалить предмет. Гвард в админке (admin-api.ts,
-- BLOCKED_SUBJECT_IN_USE) остаётся первым рубежом и объясняет отказ числами;
-- RESTRICT — второй рубеж на случай пути мимо админки.
--
-- ЧЕГО МИГРАЦИЯ НЕ ДЕЛАЕТ. Не трогает homework.subject_id (там та же
-- нулевая колонка, но задание без предмета никого не прячет), groups.subject
-- и projects.subject (заглушки, на них висит форма группы), правила доступа,
-- триггеры и куратора.
--
-- ПРИМЕНЕНИЕ РУЧНОЕ. Строку реестра в теле файла не пишем: её вставляет
-- apply-migration.mjs внутри своей транзакции, и собственный INSERT дал бы
-- нарушение уникальности и откат всей миграции.
-- =====================================================================

BEGIN;

-- ── 1. Отказ, если есть уроки без предмета ───────────────────────────────
DO $$
DECLARE
  v_orphans integer;
  v_sample  text;
BEGIN
  SELECT count(*) INTO v_orphans FROM public.lessons WHERE subject_id IS NULL;

  IF v_orphans > 0 THEN
    SELECT string_agg(x.id::text, ', ')
      INTO v_sample
      FROM (SELECT id FROM public.lessons WHERE subject_id IS NULL ORDER BY starts_at LIMIT 5) x;

    RAISE EXCEPTION
      'Миграция 226 остановлена: % уроков без предмета. Проставьте предмет вручную и повторите. Первые: %',
      v_orphans, COALESCE(v_sample, '—')
      USING ERRCODE = 'P0001';
  END IF;
END $$;

-- ── 2. Предмет обязателен ────────────────────────────────────────────────
ALTER TABLE public.lessons
  ALTER COLUMN subject_id SET NOT NULL;

-- ── 3. Удаление предмета с уроками отклоняется, а не обнуляет их ─────────
-- Имя ограничения сохраняем прежним (lessons_subject_id_fkey): по нему
-- узнаёт отказ разбор ошибок админки, и переименование пришлось бы держать
-- в голове в двух местах.
ALTER TABLE public.lessons
  DROP CONSTRAINT IF EXISTS lessons_subject_id_fkey;

ALTER TABLE public.lessons
  ADD CONSTRAINT lessons_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE RESTRICT;

-- ── 4. Проверка, что вышло именно то, что задумано ───────────────────────
DO $$
DECLARE
  v_nullable text;
  v_rule     text;
BEGIN
  SELECT is_nullable INTO v_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'subject_id';

  IF v_nullable <> 'NO' THEN
    RAISE EXCEPTION 'Миграция 226: NOT NULL не встал, is_nullable = %', v_nullable;
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_rule
    FROM pg_constraint
   WHERE conrelid = 'public.lessons'::regclass AND conname = 'lessons_subject_id_fkey';

  IF v_rule IS NULL OR v_rule NOT ILIKE '%ON DELETE RESTRICT%' THEN
    RAISE EXCEPTION 'Миграция 226: внешний ключ не стал RESTRICT, сейчас: %', COALESCE(v_rule, 'ключа нет');
  END IF;

  RAISE NOTICE 'Миграция 226: subject_id обязателен, удаление предмета с уроками отклоняется.';
END $$;

COMMIT;
