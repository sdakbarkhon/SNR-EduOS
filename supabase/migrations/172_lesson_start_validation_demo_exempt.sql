-- 172 — fn_validate_lesson_start: исключение для демо-школы
--
-- ПРОБЛЕМА. Триггер trg_validate_lesson_start (BEFORE INSERT OR UPDATE OF
-- starts_at ON lessons, WHEN CURRENT_USER = 'authenticated') отбивает урок,
-- начинающийся раньше `now() - 1 минута`. Он смотрит на РЕАЛЬНЫЕ часы
-- Postgres, а демо-контур живёт на замороженной дате 29.07.2026 (см.
-- apps/web/lib/demo-date.ts). Реальное «сегодня» уже 07.08, поэтому любой
-- урок, который демо-учитель пытается создать на демо-дату, для триггера
-- лежит в прошлом — создание уроков в демо было заблокировано полностью.
-- Под тот же триггер попадала автогенерация уроков из учебного плана
-- (/api/curriculum-plans/[id]/generate-lessons работает под пользовательским
-- клиентом, не сервисным ключом). Клиентская половина этой же проверки
-- (packages/core createLesson/updateLesson) уже переведена на getDemoNowMs()
-- коммитом f3fac4f — это серверная половина.
--
-- РЕШЕНИЕ. Валидация пропускается, только если урок принадлежит школе с
-- schools.is_demo = true. Для всех остальных школ проверка работает ровно как
-- раньше, тем же сравнением с now().
--
-- ⚠️ ГРАНИЦА РЕШЕНИЯ. Это ПЕРВОЕ обращение к is_demo в логике БД: до этой
-- миграции ни одна функция в public не читала этот флаг (проверено запросом
-- по pg_proc.prosrc — ноль совпадений). Исключение точечное, сделано под
-- заморозку демо-контура, и НЕ является началом реставрации механизма
-- миграции 110. Не расширять его на другие триггеры и политики «по аналогии»
-- без отдельного решения: демо-школа отличается от реальной только тем, что
-- живёт в замороженном времени, а не набором прав.
--
-- РЕЗОЛВ ШКОЛЫ. Основной путь — NEW.school_id: колонка NOT NULL с DEFAULT
-- current_school_id(), а дефолты подставляются в кортеж ДО срабатывания
-- BEFORE-триггеров, так что к моменту вызова функции поле уже заполнено.
-- Запасной путь через groups.school_id — на случай INSERT с явным NULL
-- (явное значение перебивает DEFAULT, а NOT NULL проверяется уже ПОСЛЕ
-- BEFORE-триггеров, то есть внутри функции NEW.school_id теоретически может
-- быть NULL). Проверено, что пути не расходятся: строк с
-- lessons.school_id <> groups.school_id в базе ноль.
--
-- Функция остаётся SECURITY INVOKER, как была. Чтение schools под ролью
-- authenticated разрешено политикой «authenticated reads schools»
-- (SELECT USING (true)). Если школу по какой-то причине прочитать не удалось,
-- COALESCE(..., false) оставляет валидацию включённой — то есть отказ
-- происходит в безопасную сторону, а не «пропустить всё».
--
-- Идемпотентна: CREATE OR REPLACE, сам триггер не пересоздаётся.

CREATE OR REPLACE FUNCTION public.fn_validate_lesson_start()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_is_demo boolean;
BEGIN
  -- On UPDATE, skip if starts_at is unchanged
  IF TG_OP = 'UPDATE' AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at THEN
    RETURN NEW;
  END IF;

  -- 172, 07.08.2026 — демо-школа живёт на замороженной дате, её «сегодня» с
  -- точки зрения Postgres now() всегда в прошлом. См. шапку миграции.
  SELECT s.is_demo INTO v_is_demo
  FROM public.schools s
  WHERE s.id = COALESCE(
    NEW.school_id,
    (SELECT g.school_id FROM public.groups g WHERE g.id = NEW.group_id)
  );

  IF COALESCE(v_is_demo, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.starts_at < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'Нельзя создать урок в прошедшее время' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.fn_validate_lesson_start() IS
  'Запрещает создание/перенос урока в прошлое (сравнение с now()). '
  'Исключение: школы с schools.is_demo = true — демо-контур работает на '
  'замороженной дате, см. миграцию 172 и resheniya_2.md 07.08.2026.';
