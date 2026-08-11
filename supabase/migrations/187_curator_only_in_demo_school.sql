-- =====================================================================
-- Migration 187 — роль куратора остаётся только в демо-школе.
--
-- СИМПТОМ. Учитель, только что заведённый администратором НАСТОЯЩЕЙ школы,
-- молча получает режим наблюдателя: интерфейс без создания уроков и без
-- меню на карточках, чтение всех уроков своих групп и пустая библиотека
-- кафедры, куда он не может ничего загрузить. Ошибки на экране нет.
--
-- ПРИЧИНА (перепроверена 11.08 запросами к живой базе). Функция
-- is_curator_teacher() определяет куратора буквально как «в карточке пуст
-- предмет»:
--
--     SELECT EXISTS (SELECT 1 FROM teachers t
--                     WHERE t.user_id = auth.uid() AND t.subject_slug IS NULL)
--
-- А createTeacher (lib/admin-api.ts) предмет не ставит — его проставляет
-- ensureSubjectSlug при ПЕРВОМ назначении. Значит между заведением учителя
-- и его первым назначением карточка пуста, и человек считается куратором.
--
-- ЧТО ГОВОРИТ РЕШЕНИЕ 6.1. В шапке блока назначений lib/admin-api.ts
-- записано прямым текстом: «в демо-школе есть роль куратора группы (в
-- реальных школах её нет, решение 6.1)». То есть куратор — это свойство
-- ДЕМОНСТРАЦИИ, а не общая роль продукта. Функция об этом не знала.
--
-- ПРАВКА. Добавляем к условию школу. Демо-школа определяется флагом
-- schools.is_demo — идентификатор в текст не вписываем (в проекте уже есть
-- четыре места, где он захардкожен, пятого не заводим).
--
-- ЧТО ЭТО МЕНЯЕТ СЕГОДНЯ: НИЧЕГО. Учителей с пустым предметом в базе двое,
-- оба в демо-школе (teacher_karim и Mr.Sarvarbek) — для них ответ функции
-- не меняется. В настоящей школе таких нет вовсе. Правка работает на
-- будущее: она защищает учителя, которого заказчик заведёт завтра.
--
-- ЧТО НЕ ТРОГАЕМ:
--   • ни одной строки данных, ни одной карточки учителя;
--   • политику «teacher reads lessons in own groups» — она остаётся
--     дословно прежней, меняется лишь то, что функция ей отвечает;
--   • claim_demo_slot — он ищет учителя по subject_slug, колонку мы не
--     трогаем, демо-пул работает как работал;
--   • многопредметность — отдельная задача.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_curator_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.teachers t
      JOIN public.schools s ON s.id = t.school_id
     WHERE t.user_id = auth.uid()
       AND t.subject_slug IS NULL
       AND s.is_demo
  );
$$;

-- ── Самопроверка ────────────────────────────────────────────────────
-- Функция SECURITY DEFINER, поэтому роль переключать не нужно: ей важен
-- только auth.uid(), а он читается из request.jwt.claims. Подставляем
-- claims на время транзакции (is_local = true) и спрашиваем функцию.
DO $$
DECLARE
  v_demo_curator   uuid;
  v_real_curator   uuid;
  v_demo_subject   uuid;
  v_answer         boolean;
BEGIN
  SELECT t.user_id INTO v_demo_curator
    FROM public.teachers t JOIN public.schools s ON s.id = t.school_id
   WHERE t.subject_slug IS NULL AND s.is_demo AND t.user_id IS NOT NULL LIMIT 1;

  SELECT t.user_id INTO v_real_curator
    FROM public.teachers t JOIN public.schools s ON s.id = t.school_id
   WHERE t.subject_slug IS NULL AND NOT s.is_demo AND t.user_id IS NOT NULL LIMIT 1;

  SELECT t.user_id INTO v_demo_subject
    FROM public.teachers t JOIN public.schools s ON s.id = t.school_id
   WHERE t.subject_slug IS NOT NULL AND s.is_demo AND t.user_id IS NOT NULL LIMIT 1;

  IF v_demo_curator IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_demo_curator, 'role', 'authenticated')::text, true);
    SELECT public.is_curator_teacher() INTO v_answer;
    IF NOT v_answer THEN
      RAISE EXCEPTION 'куратор ДЕМО-школы перестал быть куратором — видимость уроков в демо поехала';
    END IF;
  ELSE
    RAISE NOTICE 'в демо-школе нет учителя с пустым предметом — проверку пропускаем';
  END IF;

  IF v_demo_subject IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_demo_subject, 'role', 'authenticated')::text, true);
    SELECT public.is_curator_teacher() INTO v_answer;
    IF v_answer THEN
      RAISE EXCEPTION 'предметник демо-школы вдруг стал куратором';
    END IF;
  END IF;

  IF v_real_curator IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_real_curator, 'role', 'authenticated')::text, true);
    SELECT public.is_curator_teacher() INTO v_answer;
    IF v_answer THEN
      RAISE EXCEPTION 'учитель НАСТОЯЩЕЙ школы с пустым предметом всё ещё наблюдатель — правка не сработала';
    END IF;
  ELSE
    RAISE NOTICE 'в настоящих школах нет учителя с пустым предметом — проверка на них будет при первом заведении';
  END IF;

  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE NOTICE 'Миграция 187: куратор остался только в демо-школе';
END $$;
