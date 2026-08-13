-- 196 — один дневной счётчик ИИ-запросов на оба помощника.
--
-- БЫЛО. У чата внутри урока свой лимит: 10 сообщений в сутки на ученика,
-- считается функцией fn_ai_messages_today() по строкам ai_chat_messages с
-- role='user'. У общего помощника (кнопка EduOS Assistant) персонального
-- лимита не было вовсе — под ним показывался ОБЩИЙ на всю установку счётчик
-- вызовов Gemini (get_ai_usage_today(), 250 в сутки, миграция 136). Это
-- разные вещи: один про ученика, другой про расходы всей школы.
--
-- СТАЛО. Персональный лимит один на двоих. Общий помощник пишет свои
-- сообщения в ту же таблицу, поэтому та же fn_ai_messages_today() считает
-- оба места сразу — новая функция не нужна, второй копии логики не заводим.
-- Мешало только одно: lesson_id был NOT NULL, а у общего помощника урока
-- нет по определению. Снимаем это ограничение.
--
-- Счётчик как считался, так и считается ВНУТРИ базы по её собственным часам
-- (now() AT TIME ZONE 'Asia/Tashkent'), заморозка времени школы на него не
-- влияет — здесь ничего не меняем.
--
-- Общий счётчик на 250 вызовов остаётся как есть: это защита от расходов на
-- всю установку, а не квота ученика.

BEGIN;

ALTER TABLE public.ai_chat_messages ALTER COLUMN lesson_id DROP NOT NULL;

COMMENT ON COLUMN public.ai_chat_messages.lesson_id IS
  'Урок, внутри которого шёл разговор. NULL — сообщение общего помощника (кнопка EduOS Assistant), у него урока нет. Дневной лимит ученика считается по всем строкам независимо от этого поля.';

-- ── самопроверки ──────────────────────────────────────────────────────────
DO $$
DECLARE
  still_required int;
  fn_ok          int;
BEGIN
  SELECT count(*) INTO still_required
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'ai_chat_messages'
     AND column_name = 'lesson_id' AND is_nullable = 'NO';
  IF still_required > 0 THEN
    RAISE EXCEPTION 'lesson_id всё ещё NOT NULL';
  END IF;

  -- Функция счётчика не должна фильтровать по уроку, иначе сообщения общего
  -- помощника в лимит не попадут.
  SELECT count(*) INTO fn_ok
    FROM pg_proc
   WHERE proname = 'fn_ai_messages_today'
     AND pg_get_functiondef(oid) NOT LIKE '%lesson_id%';
  IF fn_ok <> 1 THEN
    RAISE EXCEPTION 'fn_ai_messages_today считает не так, как ожидалось';
  END IF;

  RAISE NOTICE 'lesson_id теперь необязателен; счётчик считает оба помощника';
END $$;

COMMIT;
