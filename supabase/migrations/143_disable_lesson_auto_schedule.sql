-- Migration 143 — временно отключить автоматический старт/завершение
-- уроков по времени (решение 21.07). Управление уроком — только вручную,
-- кнопками "Начать урок"/"Закончить урок" (см. startLesson()/endLesson()
-- в packages/core, не тронуты этой миграцией).
--
-- НЕ удаляет функции fn_auto_start_lessons()/fn_auto_end_lessons()
-- физически — только снимает их с pg_cron-расписания. Чтобы вернуть
-- авто-режим позже, достаточно повторно выполнить единственный SELECT
-- cron.schedule(...) снизу (закомментирован — см. "ЧТОБЫ ВЕРНУТЬ").

DO $$ BEGIN
  PERFORM cron.unschedule('auto-start-lessons');
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('auto-end-lessons');
EXCEPTION WHEN others THEN NULL;
END $$;

-- ЧТОБЫ ВЕРНУТЬ авто-режим позже — раскомментировать и выполнить:
-- SELECT cron.schedule('auto-start-lessons', '* * * * *', $$SELECT public.fn_auto_start_lessons()$$);
-- SELECT cron.schedule('auto-end-lessons', '* * * * *', $$SELECT public.fn_auto_end_lessons()$$);
