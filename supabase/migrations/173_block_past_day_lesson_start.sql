-- 173 — запрет старта уроков за ПРОШЕДШИЕ дни относительно замороженной даты
--
-- ПРОБЛЕМА. Форма демо-школы «1-й урок прошёл / 2-й идёт / 3-й и дальше ждут»
-- расползается от живых демо-посетителей: RLS-политика
-- `student starts own scheduled lesson` ограничивает группу и статус, но НЕ
-- ДАТУ, поэтому ученик стартует урок любого дня недели. За два дня
-- потребовалось три ручных пересчёта, и в последнем 6 правок из 12 пришлись
-- на БУДУЩИЕ дни (30.07-02.08), где уроков вообще никто не должен был
-- запускать.
--
-- РЕШЕНИЕ. Старт запрещён только для дней СТРОГО РАНЬШЕ замороженной даты
-- школы. Замороженная дата 29.07.2026 и всё, что позже (30.07, 31.07, 01.08,
-- 02.08), стартовать МОЖНО — это осознанное решение заказчика: возможность
-- запускать уроки наперёд демонстрируется клиентам.
--
-- ПОЧЕМУ КОЛОНКА, А НЕ ХАРДКОД ДАТЫ В ФУНКЦИИ. `schools` уже несёт ровно
-- такие переключатели поведения — `autostart_enabled`, `nightly_close_enabled`,
-- `is_demo`. Дата в колонке: (1) не хардкодит 29.07 в логику БД, так что
-- сдвиг якоря правится одним UPDATE, а не миграцией; (2) даёт реальным школам
-- NULL, то есть отсутствие ограничения, без единого упоминания демо-школы в
-- предикате; (3) держит значение там же, где остальные школьные флаги.
--
-- ПОЧЕМУ ТРИГГЕР, А НЕ ПРАВКА ПОЛИТИКИ. Стартовать урок могут двое: ученик
-- (политика `student starts own scheduled lesson`) и учитель (политика
-- `teacher updates own group lessons`). Учительская политика обслуживает ВСЕ
-- учительские UPDATE по уроку — активный этап, показ материала, завершение —
-- и сужать её под одну операцию значит ломать остальные. Триггер накрывает
-- обе роли одним предикатом и не трогает ни одной политики.
--
-- Ограничен `CURRENT_USER = 'authenticated'` — тем же приёмом, что
-- `trg_validate_lesson_start` (миграция 172). Сервисная роль (кроны,
-- ops-скрипты, ночное восстановление формы) не блокируется: она чинит данные,
-- а не имитирует пользователя. Дрейф создают именно authenticated-сессии.

BEGIN;

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS frozen_date date;

COMMENT ON COLUMN public.schools.frozen_date IS
  'Замороженная дата школы (демо-контур). NULL = ограничений нет (реальные школы). '
  'Запрещает старт уроков за дни строго раньше неё — см. fn_block_past_day_lesson_start(). '
  'Должна совпадать с якорем в apps/web/lib/demo-date.ts.';

-- Демо-школа: 29.07.2026 — тот же день, что якорь заморозки (10:15 Ташкент).
UPDATE public.schools
SET frozen_date = DATE '2026-07-29'
WHERE is_demo = true;

CREATE OR REPLACE FUNCTION public.fn_block_past_day_lesson_start()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_frozen date;
  v_lesson_day date;
BEGIN
  SELECT s.frozen_date INTO v_frozen
  FROM public.schools s
  WHERE s.id = COALESCE(
    NEW.school_id,
    (SELECT g.school_id FROM public.groups g WHERE g.id = NEW.group_id)
  );

  -- Реальные школы (frozen_date IS NULL) не ограничиваются вовсе.
  IF v_frozen IS NULL THEN
    RETURN NEW;
  END IF;

  -- День урока по Ташкенту (UTC+5), а не по таймзоне сервера: расписание
  -- живёт в ташкентских сутках, и на сервере в UTC 09:00 Ташкента попало бы
  -- во «вчера».
  v_lesson_day := ((NEW.starts_at AT TIME ZONE 'Asia/Tashkent'))::date;

  IF v_lesson_day < v_frozen THEN
    RAISE EXCEPTION 'Нельзя начать урок за прошедший день'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.fn_block_past_day_lesson_start() IS
  'Запрещает переводить урок в in_progress, если его день строго раньше '
  'schools.frozen_date. Только для школ с заданной frozen_date; см. миграцию 173.';

DROP TRIGGER IF EXISTS trg_block_past_day_lesson_start ON public.lessons;

-- WHEN покрывает именно ПЕРЕХОД в in_progress: повторный UPDATE уже идущего
-- урока (например смена active_stage_id) триггер не будит.
CREATE TRIGGER trg_block_past_day_lesson_start
BEFORE UPDATE OF status ON public.lessons
FOR EACH ROW
WHEN (
  CURRENT_USER = 'authenticated'::name
  AND NEW.status = 'in_progress'
  AND OLD.status IS DISTINCT FROM 'in_progress'
)
EXECUTE FUNCTION public.fn_block_past_day_lesson_start();

COMMIT;
