-- ============================================================================
-- Миграция 269: урок закрывается по звонку, а не через пять минут.
-- ============================================================================
--
-- ═══ ЧТО ОТМЕНЯЕТСЯ ════════════════════════════════════════════════════════
--
-- Запас в пять минут, заведённый МИГРАЦИЕЙ 225 (23.08.2026). Там он был
-- обоснован так: «урок закрывался и раздавал прогулы в ту же минуту, когда
-- прозвенел звонок, — у учителя не оставалось ни секунды дописать перекличку».
--
-- Решение заказчика 06.09.2026: запас убрать. Не успел дописать — правит
-- администратор школы, у него ограничения по времени нет вовсе.
--
-- ═══ ЧТО ЭТО МЕНЯЕТ, А ЧТО НЕТ ═════════════════════════════════════════════
--
-- Меняется ОДНО условие отбора: `ends_at <= now() - interval '5 minutes'`
-- становится `ends_at <= now()`. Всё остальное тело функции — закрытие урока,
-- закрытие этапа «Итог», раздача машинных прогулов с пустым `marked_by` —
-- остаётся слово в слово.
--
-- ЗАМОК ОЦЕНОК НЕ ЛОЖИТСЯ СРАЗУ, вопреки опасению. Он считает пятнадцать
-- минут ОТ САМОЙ ОТМЕТКИ (`graded_at` / `marked_at`), а не от конца урока:
-- отметка, поставленная на звонке, правится ещё пятнадцать минут после него.
-- Статус урока — это отдельная поблажка из миграции 245: пока урок идёт,
-- правится даже отметка старше пятнадцати минут. Вот она и укорачивается на
-- те самые пять минут — и только она.
--
-- ДЕМО-ШКОЛА НЕ ЗАДЕТА. Условие `schools.autostart_enabled` остаётся: в демо
-- автостарт выключен, и автозавершение туда не ходит вовсе.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_auto_end_lessons()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, group_id, school_id FROM public.lessons
    WHERE status = 'in_progress'
      AND ends_at IS NOT NULL
      -- 06.09.2026 (миграция 269). Было `ends_at <= now() - interval '5
      -- minutes'` — запас из миграции 225. Заказчик его отменил: урок
      -- закрывается по звонку, а не пять минут спустя.
      AND ends_at <= now()
      AND EXISTS (
        SELECT 1 FROM public.schools s
        WHERE s.id = lessons.school_id AND s.autostart_enabled
      )
  LOOP
    UPDATE public.lessons
    SET status = 'completed', ended_at = now()
    WHERE id = r.id;

    UPDATE public.lesson_stages
    SET is_completed = true, completed_at = now()
    WHERE lesson_id = r.id
      AND stage_role = 'summary'
      AND NOT is_completed;

    -- marked_by намеренно остаётся NULL — признак «поставила машина», по
    -- которому учителю разрешено исправить отметку без замка.
    INSERT INTO public.attendance (lesson_id, student_id, school_id, status, marked_at, is_finalized)
    SELECT r.id, sg.student_id, r.school_id, 'absent_unexcused', now(), true
    FROM public.student_groups sg
    WHERE sg.group_id = r.group_id
      AND NOT EXISTS (
        SELECT 1 FROM public.attendance a
        WHERE a.lesson_id = r.id AND a.student_id = sg.student_id
      );

    UPDATE public.attendance
    SET is_finalized = true
    WHERE lesson_id = r.id AND NOT is_finalized;
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.fn_auto_end_lessons() IS
  'Закрывает идущие уроки, у которых прозвенел звонок (ends_at <= now()), и финализирует перекличку машинными прогулами. Пятиминутный запас из миграции 225 отменён заказчиком 06.09.2026. Ходит только в школы с autostart_enabled — демо-школа не задета.';

-- ── Самопроверка ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_тело text;
BEGIN
  SELECT prosrc INTO v_тело FROM pg_proc
   WHERE proname = 'fn_auto_end_lessons' AND pronamespace = 'public'::regnamespace;

  IF v_тело LIKE '%interval ''5 minutes''%' THEN
    RAISE EXCEPTION '269: пятиминутный запас никуда не делся';
  END IF;
  IF v_тело NOT LIKE '%autostart_enabled%' THEN
    RAISE EXCEPTION '269: пропал школьный фильтр — автозавершение пойдёт в демо-школу';
  END IF;

  RAISE NOTICE '269: урок закрывается по звонку';
END $$;

COMMIT;
