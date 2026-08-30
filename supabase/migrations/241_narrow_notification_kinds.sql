-- Миграция 241: список видов уведомлений сужается до живых.
--
-- ПОРЯДОК СОБЛЮДЁН: сначала строки, потом ограничение. Миграция 240 сняла
-- десять источников, уборка удалила 261 строку снятых видов, и только теперь
-- CHECK можно сузить — на живых данных он бы отказал. Мы это уже проходили.
--
-- ПРОВЕРЕНО НЕПОСРЕДСТВЕННО ПЕРЕД НАПИСАНИЕМ (30.08.2026):
--
--   announcement       92 строк
--   new_homework       63 строк
--   announcement_new   30 строк
--   ──────────────────────────────
--   ВСЕГО             185 строк, из них снятых видов 0
--
--   notification_prefs: 0 строк, из них снятых категорий 0
--
-- Обе проверки повторены в самой миграции ниже: между чтением и применением
-- может пройти время, и отказ по нашей формулировке понятнее, чем отказ
-- Postgres на добавлении ограничения.

BEGIN;

-- ── Предохранитель: не сужаем вслепую ───────────────────────────────────────
DO $$
DECLARE
  v_kinds integer;
  v_cats  integer;
BEGIN
  SELECT count(*) INTO v_kinds FROM public.notifications
   WHERE kind NOT IN ('announcement', 'announcement_new', 'new_homework', 'new_grade');
  IF v_kinds > 0 THEN
    RAISE EXCEPTION 'Сужать рано: в notifications % строк снятых видов. Сначала уборка (хвост миграции 240).', v_kinds;
  END IF;

  SELECT count(*) INTO v_cats FROM public.notification_prefs
   WHERE category NOT IN ('grades', 'homework', 'announcements');
  IF v_cats > 0 THEN
    RAISE EXCEPTION 'Сужать рано: в notification_prefs % строк снятых категорий.', v_cats;
  END IF;
END $$;

-- ── Виды уведомлений ────────────────────────────────────────────────────────
--
-- Остаются четыре значения на три вида в понимании заказчика:
--   announcement      — объявление ученику и родителям;
--   announcement_new  — оно же, копия куратору от админа;
--   new_homework      — задали домашнее задание;
--   new_grade         — проверили работу (домашнюю или тест).
--
-- `new_grade` СТРОК НЕ ИМЕЕТ, и это не повод его убирать: источник у него
-- живой — два триггера, `trg_homework_grade_notify` и `trg_test_grade_notify`.
-- Убрать значение, которое завтра запишут, значит уронить проверку работы.
--
-- Уходят десять значений, у которых не осталось ни источника, ни строк:
-- homework_graded, lesson_material, student_excused, student_submitted,
-- leave_request, leave_decision, lesson_starting_soon, lesson_created,
-- grade_received, chat_message.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_kind_check
  CHECK (kind = ANY (ARRAY[
    'announcement'::text,
    'announcement_new'::text,
    'new_homework'::text,
    'new_grade'::text
  ]));

-- ── Категории настроек ──────────────────────────────────────────────────────
--
-- Из четырёх остаются три: «сообщения» ушли вместе с источником (миграция
-- 240 сняла рассылку про чат). В коде это уже сделано — NOTIFICATION_CATEGORIES
-- в packages/core/src/queries/announcements.ts; здесь база догоняет код.
ALTER TABLE public.notification_prefs DROP CONSTRAINT IF EXISTS notification_prefs_category_check;
ALTER TABLE public.notification_prefs
  ADD CONSTRAINT notification_prefs_category_check
  CHECK (category = ANY (ARRAY[
    'grades'::text,
    'homework'::text,
    'announcements'::text
  ]));

COMMIT;

-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ:
--
--   SELECT rel.relname, pg_get_constraintdef(con.oid)
--     FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
--    WHERE rel.relname IN ('notifications', 'notification_prefs') AND con.contype = 'c';
--
-- В первом должно остаться четыре значения, во втором три.
--
-- ЗАМКИ. Оба ALTER берут ACCESS EXCLUSIVE на свою таблицу и сканируют её при
-- добавлении ограничения. Размеры на 30.08.2026: notifications 185 строк,
-- notification_prefs 0 строк — проверка мгновенна, замок держится доли
-- секунды. Таблицы читает лента родителя и колокольчик; применять лучше в
-- спокойную минуту, но закрывать вкладки не нужно.
