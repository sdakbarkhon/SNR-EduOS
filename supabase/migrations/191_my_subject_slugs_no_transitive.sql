-- =====================================================================
-- Migration 191 — правка fn_my_subject_slugs из 190: слаг коллеги берём
-- только у ОДНОПРЕДМЕТНОГО коллеги.
--
-- ЧТО ПОШЛО НЕ ТАК. В 190 множество «моих» слагов собиралось так: слаг
-- моей карточки плюс слаги карточек всех коллег по тем же предметам
-- справочника. Замер сразу после применения показал перекос:
--
--   ТЕСТ Алия  (карточка math, ведёт Математику и Информатику) → math, informatics  ✔
--   ТЕСТ Бахтиёр (карточка informatics, ведёт только Информатику) → math, informatics  ✘
--
-- Бахтиёр получил math транзитивно: он делит Информатику с Алией, а на её
-- карточке стоит math (её первое назначение). То есть слаг «протёк» через
-- многопредметного коллегу — ровно та ошибка, которую эта задача и чинит,
-- только в другую сторону.
--
-- ПОЧЕМУ ТАК ВЫШЛО. Карточка учителя отвечает на вопрос «какой предмет он
-- ведёт», только если предмет у него один. У многопредметного она говорит
-- про первое назначение и про остальные не знает — поэтому её нельзя
-- использовать как метку предмета справочника.
--
-- ИСПРАВЛЕНИЕ. Слаг предмета справочника берём только у коллеги, у которого
-- этот предмет ЕДИНСТВЕННЫЙ: у такого карточка и предмет заведомо про одно
-- и то же. Свою карточку по-прежнему учитываем всегда — она про меня.
--
-- Результат замера после правки:
--   Алия   → math (своя карточка) + informatics (от однопредметного Бахтиёра)
--   Бахтиёр → informatics (своя карточка); math не подхватывается
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_my_subject_slugs()
RETURNS TABLE(subject_slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- 1. слаг собственной карточки
  SELECT t.subject_slug
    FROM public.teachers t
   WHERE t.id = public.current_teacher_id()
     AND t.subject_slug IS NOT NULL
  UNION
  -- 2. слаг предмета справочника — с карточки ОДНОПРЕДМЕТНОГО коллеги
  SELECT other.subject_slug
    FROM public.subjects mine
    JOIN public.subjects theirs
      ON theirs.catalog_id = mine.catalog_id
     AND theirs.school_id = mine.school_id
    JOIN public.teachers other
      ON other.id = theirs.teacher_id
     AND other.subject_slug IS NOT NULL
   WHERE mine.teacher_id = public.current_teacher_id()
     AND mine.catalog_id IS NOT NULL
     AND mine.is_active
     AND NOT mine.is_stub
     AND (
       SELECT count(DISTINCT s2.catalog_id)
         FROM public.subjects s2
        WHERE s2.teacher_id = other.id
          AND s2.is_active
          AND NOT s2.is_stub
          AND s2.catalog_id IS NOT NULL
     ) = 1;
$$;

COMMENT ON FUNCTION public.fn_my_subject_slugs() IS
  'Слаги всех предметов текущего учителя: слаг его карточки плюс слаги '
  'карточек ОДНОПРЕДМЕТНЫХ коллег по тем же предметам справочника. '
  'Единственное место, где считается «мой предмет» для библиотеки кафедры.';
