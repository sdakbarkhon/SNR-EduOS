-- =====================================================================
-- Migration 225 — машинный прогул перестаёт быть «отметкой учителя».
--
-- БЕДА, КОТОРУЮ ЧИНИМ.
-- В боевой школе включён автостарт, и раз в минуту fn_auto_end_lessons()
-- закрывает уроки, у которых наступило время окончания. Закрывая, он
-- ставит «Пропуск без причины» КАЖДОМУ неотмеченному ученику и сразу
-- помечает всю посещаемость урока как is_finalized = true.
--
-- Дальше учитель не может исправить ничего:
--   1) правило «teacher updates attendance» требует is_finalized = false —
--      а задание выставило true секунду назад, поэтому UPDATE учителя не
--      находит ни одной строки. Без ошибки: RLS не бросает, он просто
--      не отдаёт строку;
--   2) даже если бы правило пустило, триггер замка (миграция 203) считает
--      15 минут от marked_at, а marked_at проставила та же машина. Через
--      четверть часа отметка запирается навсегда.
-- Удалить строку нельзя вовсе: правила на DELETE у посещаемости нет.
-- Остаётся только администратор школы, по одной ячейке.
--
-- Это ровно та же болезнь, что миграция 218 вылечила у оценок: часы замка
-- заводило НЕ действие учителя. Лечим тем же способом.
--
-- ЧЕМ ОТЛИЧАЕТСЯ МАШИННАЯ ОТМЕТКА ОТ УЧИТЕЛЬСКОЙ.
-- Колонкой marked_by. Живой учитель всегда приходит через
-- markStudentAttendance() (packages/core), а она пишет marked_by = teacherId
-- при каждом нажатии. Автозавершение вставляет строку без этой колонки, и
-- там остаётся NULL. Проверено по живой базе: в боевой школе строк без
-- автора нет ни одной, все существующие отметки поставлены человеком.
--
-- ЧТО МЕНЯЕМ
--   1. Правило правки: учитель правит строку, если она ещё не заперта ИЛИ
--      если её поставила машина (marked_by IS NULL).
--   2. Триггер замка: правка машинной отметки — это ПЕРВОЕ выставление
--      человеком, а не изменение чужой проверки. Замок на неё не ложится,
--      а marked_at не сохраняется от машины: часы пойдут от исправления
--      учителя, и дальше действует обычное правило пятнадцати минут.
--   3. Запас времени: урок закрывается не по звонку, а через пять минут
--      после него.
--
-- ЭКРАН ПРАВИТСЯ ВМЕСТЕ С БАЗОЙ, ИНАЧЕ ТОЛКУ НЕТ.
-- Третий замок стоял в самой перекличке: после автозавершения весь список
-- становился «только чтение» (AttendanceRollCall.readOnly), а клиент отказывал
-- ещё до запроса, потому что считал 15 минут от машинного marked_at. Одна
-- миграция без правки экрана не дала бы учителю даже нажать кнопку. Поэтому в
-- том же коммите: getTeacherLessonAttendance отдаёт marked_by, а перекличка
-- запирает СТРОКУ, а не список.
--
-- ЧЕГО НЕ МЕНЯЕМ
--   * Замок на отметках, которые поставил живой учитель, остаётся как был:
--     у них marked_by заполнен, и обе правки их не касаются.
--   * Автостарт и автозавершение не выключаются — правим вокруг них.
--   * Демо-школа не задета: у неё autostart_enabled = false, автозавершение
--     до её уроков не доходит вовсе.
--
-- ПОЧЕМУ ПЯТЬ МИНУТ, А НЕ ПЯТНАДЦАТЬ.
-- Перемена между уроками — десять минут (сетка 09:00–09:45, 09:55–10:40,
-- 10:50–11:35 …). Запас обязан быть СТРОГО меньше перемены: иначе к моменту
-- звонка на следующий урок предыдущий всё ещё in_progress, и его закроет
-- триггер «один активный урок на группу» (миграция 152) — а он закрывает
-- урок БЕЗ раздачи прогулов. Тогда посещаемость не проставится вовсе, и мы
-- поменяем одну беду на другую, потише и потому опаснее. Пять минут дают
-- учителю время после звонка и оставляют пять минут запаса до следующего.
-- =====================================================================

BEGIN;

-- ── 1. Правило правки: машинную отметку учитель правит и после запирания ──

DROP POLICY IF EXISTS "teacher updates attendance" ON public.attendance;

CREATE POLICY "teacher updates attendance"
  ON public.attendance
  FOR UPDATE
  USING (
    (
      -- Либо запись ещё открыта, либо её поставила машина: машинный прогул
      -- не является проверкой учителя и запирать его не за что.
      (is_finalized = false OR marked_by IS NULL)
      AND EXISTS (
        SELECT 1 FROM public.lessons l
        WHERE l.id = attendance.lesson_id AND public.is_my_teacher_group(l.group_id)
      )
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.lessons l
        WHERE l.id = attendance.lesson_id AND public.is_my_teacher_group(l.group_id)
      )
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- ── 2. Замок: правка машинной отметки — первое выставление человеком ──────

CREATE OR REPLACE FUNCTION public.fn_lock_teacher_marks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stamp   timestamptz;
  v_changed boolean := false;
  v_row     record;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  -- Без пользовательской сессии: крон автозавершения, миграции, служебный
  -- ключ. Их правило не касается — иначе прогул некому было бы проставить.
  IF auth.uid() IS NULL THEN
    RETURN v_row;
  END IF;

  -- 23.08.2026 (миграция 225). Машинный прогул: строку вставило
  -- автозавершение, автора у неё нет. Правка такой строки живым человеком —
  -- это ПЕРВОЕ выставление отметки, а не изменение чужой проверки. Замок на
  -- неё не ложится, и marked_at от машины не сохраняется: часы пойдут от
  -- исправления учителя, после чего действует обычное правило 15 минут.
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'attendance' AND OLD.marked_by IS NULL THEN
    RETURN NEW;
  END IF;

  -- Отметка времени — это часы замка, и заводить их заново нельзя никому,
  -- кроме первого выставления. Иначе окно открывается снова:
  --   * учитель правит ОДИН комментарий (значение не изменилось, запрет не
  --     сработал), а upsert попутно пишет graded_at := now() — и оценка,
  --     запертая полчаса назад, снова редактируется;
  --   * или учитель правит оценку каждые 14 минут и держит окно вечно.
  -- Поэтому на любом UPDATE возвращаем старое значение отметки. NULL не
  -- трогаем: пустая отметка означает «ещё не выставляли», и первое
  -- выставление обязано её проставить (домашние задания и тесты приходят
  -- от ученика с graded_at IS NULL).
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'attendance' THEN
      IF OLD.marked_at IS NOT NULL THEN NEW.marked_at := OLD.marked_at; END IF;
    ELSE
      IF OLD.graded_at IS NOT NULL THEN NEW.graded_at := OLD.graded_at; END IF;
    END IF;
    v_row := NEW;
  END IF;

  -- Администратор своей школы правит без ограничения по времени.
  IF public.is_school_admin_of(v_row.school_id) THEN
    RETURN v_row;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Удаление всегда «меняет значение» — сверяем только срок.
    v_changed := true;
    -- Через CASE здесь нельзя: plpgsql разбирает ОБЕ ветки и падает на
    -- OLD.marked_at там, где такой колонки нет. Ветвим оператором IF —
    -- невыбранная ветка не вычисляется вовсе.
    IF TG_TABLE_NAME = 'attendance' THEN
      v_stamp := OLD.marked_at;
    ELSE
      v_stamp := OLD.graded_at;
    END IF;
  ELSIF TG_TABLE_NAME = 'lesson_grades' THEN
    v_changed := NEW.grade IS DISTINCT FROM OLD.grade;
    v_stamp := OLD.graded_at;
  ELSIF TG_TABLE_NAME = 'attendance' THEN
    v_changed := NEW.status IS DISTINCT FROM OLD.status;
    v_stamp := OLD.marked_at;
  ELSIF TG_TABLE_NAME = 'homework_submissions' THEN
    v_changed := NEW.grade IS DISTINCT FROM OLD.grade
              OR NEW.status IS DISTINCT FROM OLD.status;
    v_stamp := OLD.graded_at;
  ELSIF TG_TABLE_NAME = 'test_submissions' THEN
    v_changed := NEW.score IS DISTINCT FROM OLD.score
              OR NEW.grade IS DISTINCT FROM OLD.grade;
    v_stamp := OLD.graded_at;
  ELSIF TG_TABLE_NAME = 'lesson_stage_progress' THEN
    v_changed := NEW.grade IS DISTINCT FROM OLD.grade;
    v_stamp := OLD.graded_at;
  END IF;

  IF NOT v_changed OR v_stamp IS NULL THEN
    RETURN v_row;
  END IF;

  IF v_stamp > now() - public.mark_edit_window() THEN
    RETURN v_row;
  END IF;

  RAISE EXCEPTION 'mark_locked'
    USING HINT = 'Прошло больше 15 минут с выставления. Изменить может администратор школы.';
END;
$function$;

-- ── 3. Запас времени: урок закрывается через пять минут после звонка ──────

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
      -- 23.08.2026 (миграция 225). Было ends_at <= now(): урок закрывался и
      -- раздавал прогулы в ту же минуту, когда прозвенел звонок, — у учителя
      -- не оставалось ни секунды дописать перекличку. Пять минут запаса; про
      -- выбор именно пяти — в шапке миграции.
      AND ends_at <= now() - interval '5 minutes'
      AND EXISTS (
        SELECT 1 FROM public.schools s
        WHERE s.id = lessons.school_id AND s.autostart_enabled
      )
  LOOP
    UPDATE public.lessons
    SET status = 'completed', ended_at = now()
    WHERE id = r.id;

    -- Auto-complete Summary stage
    UPDATE public.lesson_stages
    SET is_completed = true, completed_at = now()
    WHERE lesson_id = r.id
      AND stage_role = 'summary'
      AND NOT is_completed;

    -- Auto-finalize attendance: absent_unexcused for missing records.
    -- marked_by намеренно остаётся NULL — это признак «поставила машина»,
    -- по которому учителю разрешено исправить отметку (см. пункты 1 и 2).
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

COMMIT;
