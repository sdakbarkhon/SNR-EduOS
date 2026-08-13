-- 197 — предыдущий идущий урок закрывается всегда, а время его завершения
-- берётся по времени школы, а не по настоящим часам.
--
-- ЧТО БЫЛО. Обработчик trg_close_other_in_progress_lessons (миграция 152)
-- закрывал соседние in_progress-уроки группы с условием
--     started_at IS DISTINCT FROM NEW.started_at
-- Условие поставлено не зря: fn_auto_start_lessons может за один проход
-- перевести в in_progress несколько уроков одной группы, а now() внутри
-- транзакции — константа, поэтому все строки одного массового UPDATE
-- получают ОДИНАКОВЫЙ started_at. Сравнение отсекало «братьев по тому же
-- проходу», чтобы урок не закрыли сразу после его же старта.
--
-- ПОЧЕМУ ЭТО СЛОМАЛОСЬ. В школе с замороженным временем ручной старт пишет
-- в started_at не настоящее время, а школьное — а оно у всех запусков одного
-- замороженного дня одно и то же. Проверено фактом: в 3-А у обоих идущих
-- уроков started_at = 2026-07-29 05:15Z (это 10:15 Ташкента, якорь заморозки)
-- при разном starts_at 05:50Z и 06:55Z. Условие принимало два ПОСЛЕДОВАТЕЛЬНЫХ
-- ручных запуска за «братьев по одному проходу» и не закрывало предыдущий.
-- Каждая следующая активация добавляла ещё один открытый урок.
--
-- ЧТО СТАЛО. Признак «тот же проход» теперь определяется не совпадением
-- времени, а самим фактом принадлежности к одному оператору: обработчик стал
-- пооператорным (FOR EACH STATEMENT) и получает транзитные таблицы. Внутри
-- одного UPDATE видно все стартовавшие уроки сразу, поэтому:
--   • для каждой затронутой группы выбирается ОДИН победитель — запущенный
--     последним (по started_at, при равенстве по starts_at, то есть более
--     поздний по расписанию);
--   • все остальные in_progress-уроки этой группы закрываются, включая
--     «братьев» из того же массового прохода.
-- Результат детерминирован и не зависит от порядка обработки строк — та самая
-- гонка, ради которой ставили прежнее условие, устранена по-настоящему, а не
-- обойдена. Инвариант «в группе не больше одного идущего урока» теперь
-- выполняется после любого оператора.
--
-- ВРЕМЯ ЗАВЕРШЕНИЯ. Было ended_at = now() — настоящие часы. В демо-школе это
-- давало урок, «завершённый» через две недели после своего дня: у урока
-- «Циклы в Scratch» дня 29 июля стояло ended_at 13 августа. Теперь берётся
-- started_at победителя — момент, когда начался следующий урок. Он и есть
-- школьное время: приложение пишет в started_at время школы (заморозку не
-- трогаем, только читаем то, что уже записано). В обычной школе started_at и
-- есть настоящее now(), поэтому там ничего не меняется.
-- Константа времени суток заморозки остаётся в одном месте — в коде
-- приложения; сюда она не копируется.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_close_other_in_progress_lessons()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Ранний выход обязателен. Пооператорный AFTER-триггер срабатывает даже
  -- когда оператор не задел ни одной строки, а закрывающий UPDATE ниже — это
  -- тоже оператор по той же таблице: без этой проверки обработчик вызывал бы
  -- сам себя до упора в глубину стека. Свой же UPDATE ставит 'completed',
  -- поэтому на вложенном вызове условие ложно и рекурсия обрывается сразу.
  IF NOT EXISTS (
    SELECT 1
      FROM new_rows n
      JOIN old_rows o ON o.id = n.id
     WHERE n.status = 'in_progress'
       AND o.status IS DISTINCT FROM 'in_progress'
  ) THEN
    RETURN NULL;
  END IF;

  WITH started AS (
    -- Уроки, которые ИМЕННО этим оператором перешли в in_progress.
    SELECT n.id, n.group_id, n.started_at, n.starts_at
      FROM new_rows n
      JOIN old_rows o ON o.id = n.id
     WHERE n.status = 'in_progress'
       AND o.status IS DISTINCT FROM 'in_progress'
  ),
  winner AS (
    -- По одному на группу: запущенный последним, при равенстве времени —
    -- более поздний по расписанию. Порядок строк ни на что не влияет.
    SELECT DISTINCT ON (group_id) group_id, id, started_at
      FROM started
     ORDER BY group_id, started_at DESC NULLS LAST, starts_at DESC, id
  )
  UPDATE public.lessons l
     SET status   = 'completed',
         ended_at = COALESCE(l.ended_at, w.started_at, now())
    FROM winner w
   WHERE l.group_id = w.group_id
     AND l.id <> w.id
     AND l.status = 'in_progress';

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_close_other_in_progress_lessons ON public.lessons;

CREATE TRIGGER trg_close_other_in_progress_lessons
AFTER UPDATE ON public.lessons
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.fn_close_other_in_progress_lessons();

-- ── самопроверки ──────────────────────────────────────────────────────────
DO $$
DECLARE
  trg_count int;
  is_stmt   boolean;
  has_now   boolean;
BEGIN
  SELECT count(*) INTO trg_count FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'lessons'
     AND t.tgname = 'trg_close_other_in_progress_lessons'
     AND NOT t.tgisinternal;
  IF trg_count <> 1 THEN
    RAISE EXCEPTION 'обработчик должен быть ровно один, а их %', trg_count;
  END IF;

  -- tgtype: бит 0 — FOR EACH ROW. Пооператорный триггер этот бит не ставит.
  SELECT (t.tgtype & 1) = 0 INTO is_stmt FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'lessons' AND t.tgname = 'trg_close_other_in_progress_lessons';
  IF NOT is_stmt THEN
    RAISE EXCEPTION 'обработчик остался построчным — транзитные таблицы работать не будут';
  END IF;

  -- Прежнее условие по времени старта не должно остаться в теле.
  SELECT pg_get_functiondef(oid) LIKE '%IS DISTINCT FROM NEW.started_at%' INTO has_now
    FROM pg_proc WHERE proname = 'fn_close_other_in_progress_lessons';
  IF has_now THEN
    RAISE EXCEPTION 'в теле осталось старое сравнение по started_at';
  END IF;

  RAISE NOTICE 'обработчик пооператорный, закрывает предыдущий урок при любом времени старта';
END $$;

COMMIT;
