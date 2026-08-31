-- Миграция 244: предмет урока обязан принадлежать его группе.
--
-- ЗАЧЕМ. У `lessons` есть и `group_id`, и `subject_id`, а у `subjects` — свой
-- `group_id`. Ничто не связывало эти две ссылки: урок мог оказаться в группе
-- 7-А с предметом из 10-А, и база бы это приняла. Единственное ограничение —
-- обычный FK на `subjects(id)`, который про группу ничего не знает.
--
-- Пункт 78 закрыл путь через интерфейс: список предметов в форме сужен по
-- выбранной группе, и рассогласовать урок оттуда больше нечем. Но остаётся
-- прямая вставка — скриптами, а боевую школу мы будем наполнять именно ими.
--
-- ЧТО БЫЛО БЕЗ ЭТОГО. Проверено прогоном 30.08.2026: перенос урока в другую
-- группу без смены предмета проходил (1 строка) и оставлял урок с предметом
-- старой группы. Это ломает всё, что считает по предмету: расписание
-- предметника (он видит чужой урок или теряет свой), журнал, средний балл по
-- предмету, учебный план.
--
-- ВОРОТА ПЕРЕД НАПИСАНИЕМ (проверено на живой базе 30.08.2026):
--
--   SNR Demo School   уроков 126   согласованных 126   рассогласованных 0
--   SNR School        уроков   2   согласованных   2   рассогласованных 0
--   без предмета: 0 в обеих школах
--
-- Ни одного рассогласованного урока нет, поэтому триггер никого не запирает.
-- Проверка повторена в самой миграции ниже: между чтением и применением может
-- пройти время, а запереть существующие уроки без предупреждения нельзя.

BEGIN;

-- ── Предохранитель: не запираем уроки, которые уже рассогласованы ──────────
--
-- Триггер BEFORE UPDATE отбил бы ЛЮБУЮ последующую правку такого урока — в
-- том числе смену статуса при автостарте. Урок стал бы нередактируемым, и
-- понять почему было бы неоткуда. Лучше остановиться здесь.
DO $$
DECLARE v integer;
BEGIN
  SELECT count(*) INTO v
    FROM public.lessons l
    JOIN public.subjects s ON s.id = l.subject_id
   WHERE s.group_id <> l.group_id;
  IF v > 0 THEN
    RAISE EXCEPTION 'Заводить триггер рано: % уроков уже рассогласованы (предмет из чужой группы). Сначала починить их, иначе они станут нередактируемыми.', v;
  END IF;
END $$;

-- ── Сама проверка ───────────────────────────────────────────────────────────
--
-- Текст отказа человеческий и с названиями, а не «violates constraint»: его
-- увидит и учитель в форме, и тот, кто запускает скрипт наполнения.
CREATE OR REPLACE FUNCTION public.fn_lesson_subject_matches_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_subject_group uuid;
  v_subject_name  text;
  v_lesson_group  text;
  v_subject_group_name text;
BEGIN
  -- Предмет у урока обязателен с миграции 226, но проверка дешёвая и
  -- защищает от порядка применения миграций на чистой базе.
  IF NEW.subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- На UPDATE выходим сразу, если пара не менялась. Триггер объявлен как
  -- UPDATE OF subject_id, group_id, но Postgres зовёт его при УПОМИНАНИИ
  -- колонки в SET, даже когда значение то же — а форма урока передаёт обе
  -- всегда. Без этой ветки каждая правка урока стоила бы лишнего чтения
  -- subjects.
  IF TG_OP = 'UPDATE'
     AND NEW.subject_id IS NOT DISTINCT FROM OLD.subject_id
     AND NEW.group_id  IS NOT DISTINCT FROM OLD.group_id THEN
    RETURN NEW;
  END IF;

  SELECT s.group_id, s.name INTO v_subject_group, v_subject_name
    FROM public.subjects s WHERE s.id = NEW.subject_id;

  IF v_subject_group IS NULL THEN
    -- Предмета нет вовсе — это работа FK, не наша. Пропускаем, чтобы отказ
    -- пришёл от него и назывался своим именем.
    RETURN NEW;
  END IF;

  IF v_subject_group <> NEW.group_id THEN
    SELECT name INTO v_lesson_group FROM public.groups WHERE id = NEW.group_id;
    SELECT name INTO v_subject_group_name FROM public.groups WHERE id = v_subject_group;
    RAISE EXCEPTION
      'Предмет «%» относится к группе «%», а урок ставится в группу «%». Выберите предмет этой группы.',
      coalesce(v_subject_name, '?'),
      coalesce(v_subject_group_name, '?'),
      coalesce(v_lesson_group, '?');
  END IF;

  RETURN NEW;
END;
$function$;

-- ── Триггер ─────────────────────────────────────────────────────────────────
--
-- BEFORE, а не AFTER: отказ должен прийти до записи и до остальных
-- BEFORE-триггеров, которые считают время урока.
--
-- UPDATE **OF subject_id, group_id** — важно. Без списка колонок триггер
-- звался бы на каждое обновление урока, а их много: автостарт меняет статус,
-- этапы двигают active_stage_id, завершение проставляет ended_at. Ни одному
-- из них проверка не нужна.
DROP TRIGGER IF EXISTS trg_lesson_subject_matches_group ON public.lessons;
CREATE TRIGGER trg_lesson_subject_matches_group
  BEFORE INSERT OR UPDATE OF subject_id, group_id ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.fn_lesson_subject_matches_group();

COMMIT;

-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ:
--
--   SELECT t.tgname, p.proname
--     FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
--    WHERE t.tgrelid = 'public.lessons'::regclass AND NOT t.tgisinternal
--      AND t.tgname = 'trg_lesson_subject_matches_group';
--
--   -- рассогласованных быть не должно ни одного:
--   SELECT count(*) FROM lessons l JOIN subjects s ON s.id = l.subject_id
--    WHERE s.group_id <> l.group_id;
--
-- ЧТО ПРОВЕРЕНО ПРОГОНОМ С ОТКАТОМ (30.08.2026):
--   * вставка урока с предметом чужой группы          — ОТКАЗ нашим текстом
--   * правка со сменой группы без смены предмета      — ОТКАЗ нашим текстом
--   * правка со сменой обоих согласованно             — проходит, 1 строка
--   * смена только статуса у всех 128 уроков          — проходит, 128 строк
--
-- СКРИПТЫ НАПОЛНЕНИЯ. Уроки вставляют три:
--   create-schedule-week.mjs   — предмет берётся по ключу group_id|name
--   regenerate-jul27-aug2.mjs  — по ключу name|group_id
--   restore-demo-lessons.mjs   — из готового плана, пара уже проставлена
-- Первые два согласованы по построению: предмет ищется В ГРУППЕ урока.
-- Третий берёт пару из файла плана и сам её не сверяет — вот его триггер и
-- подстрахует, что и требовалось.
--
-- ЗАМКИ. CREATE TRIGGER берёт ACCESS EXCLUSIVE на lessons на время
-- объявления — существующие строки не сканируются, замок держится доли
-- секунды. Уроков на 30.08.2026: 128.
