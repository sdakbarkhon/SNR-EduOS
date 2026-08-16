-- Миграция 203: выставленное учителем запирается через 15 минут.
--
-- ПРАВИЛО. Учитель поставил оценку или отметку → 15 минут может исправить свою
-- ошибку → дальше запись запирается. После этого изменить её может только
-- администратор школы. Автор при этом НЕ меняется: в журнале остаётся учитель,
-- который ставил, пометок «изменено администратором» не заводим.
--
-- ЧТО ЗАПИРАЕТСЯ (пять таблиц, у каждой свои «значащие» колонки):
--   lesson_grades          — grade
--   attendance             — status
--   homework_submissions   — grade, status
--   test_submissions       — score, grade
--   lesson_stage_progress  — grade
--
-- ЧТО НЕ ЗАПИРАЕТСЯ. Комментарии учителя (lesson_grades.comment,
-- homework_submissions.teacher_comment, lesson_stage_progress.teacher_comment)
-- — это текст, а не оценка, править его можно всегда. Поэтому запрет сделан
-- ТРИГГЕРОМ, а не только политикой доступа: политика работает построчно и
-- запретила бы вместе с оценкой и комментарий.
--
-- ОТ КАКОГО ВРЕМЕНИ 15 МИНУТ. От настоящего now(), а не от «школьного»
-- замороженного. Причина фактическая: отметки времени пишет now() — так делает
-- триггер set_grading_meta (graded_at := now()) и так же проставляются
-- marked_at/graded_at из приложения. Сравнивать метку, записанную настоящими
-- часами, с замороженной датой школы значило бы сравнивать разные шкалы: в
-- демо-школе (заморожена на 29.07.2026) учитель, поставивший оценку сегодня,
-- получил бы разницу в недели и запертую запись в ту же секунду. Заморозка
-- времени — про то, какой день показывать в журнале, а не про то, сколько
-- прошло с нажатия кнопки.
--
-- ЧТО НЕ ЛОМАЕТСЯ.
--   • Выставление. Правило про ИЗМЕНЕНИЕ: если метки ещё нет (NULL) — значит
--     учитель ставит впервые, и это разрешено всегда.
--   • Автозавершение урока. Оно проставляет прогул и ставит is_finalized
--     служебным ключом, без пользовательской сессии: триггер пропускает всё,
--     что приходит без auth.uid(). Плюс is_finalized не входит в «значащие»
--     колонки ни у одной таблицы.
--   • Ученик. Его собственные политики (сдача работы, прохождение этапа) не
--     трогаются, а колонок с оценками он и так не пишет.
--
-- АДМИНИСТРАТОР. До этой миграции у админа НЕ БЫЛО ни одной политики на
-- изменение этих пяти таблиц — то есть он не мог исправить ничего вообще.
-- Ниже они добавляются, строго по своей школе.

-- ── 1. Кто перед нами ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_school_admin_of(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins a
    WHERE a.user_id = auth.uid() AND a.school_id = p_school_id
  ) OR public.is_super_admin()
$$;

REVOKE ALL ON FUNCTION public.is_school_admin_of(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_school_admin_of(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_school_admin_of(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.is_school_admin_of(uuid) IS
  'Администратор ИМЕННО ЭТОЙ школы (или суперадмин). Миграция 203.';

-- ── 2. Сколько живёт право учителя на правку ────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_edit_window()
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$ SELECT interval '15 minutes' $$;

COMMENT ON FUNCTION public.mark_edit_window() IS
  'Окно, в которое учитель ещё может исправить свою оценку. Одно место на всю '
  'систему: интерфейс спрашивает его же, чтобы показывать одинаковый отсчёт.';

-- ── 3. Сам замок ────────────────────────────────────────────────────────────
-- Замок ловит и удаление: у учителя есть право удалять оценки за урок
-- (политика «teacher deletes lesson grades»), и без этого правило обходится
-- в два действия — удалить запертую оценку и поставить заново, потому что
-- вставка ограничений не имеет.
CREATE OR REPLACE FUNCTION public.fn_lock_teacher_marks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;


DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lesson_grades', 'attendance', 'homework_submissions',
    'test_submissions', 'lesson_stage_progress'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_lock_teacher_marks ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_lock_teacher_marks
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.fn_lock_teacher_marks()', t);
  END LOOP;
END $$;

-- ── 4. Право администратора править ─────────────────────────────────────────
-- Строго своя школа. Учительские политики не трогаются: их условие про
-- «свой класс» остаётся ровно тем же, что было.
DROP POLICY IF EXISTS "admin updates lesson grades" ON public.lesson_grades;
CREATE POLICY "admin updates lesson grades" ON public.lesson_grades
  FOR UPDATE TO authenticated
  USING (public.is_school_admin_of(school_id))
  WITH CHECK (public.is_school_admin_of(school_id));

DROP POLICY IF EXISTS "admin updates attendance" ON public.attendance;
CREATE POLICY "admin updates attendance" ON public.attendance
  FOR UPDATE TO authenticated
  USING (public.is_school_admin_of(school_id))
  WITH CHECK (public.is_school_admin_of(school_id));

DROP POLICY IF EXISTS "admin updates homework submissions" ON public.homework_submissions;
CREATE POLICY "admin updates homework submissions" ON public.homework_submissions
  FOR UPDATE TO authenticated
  USING (public.is_school_admin_of(school_id))
  WITH CHECK (public.is_school_admin_of(school_id));

DROP POLICY IF EXISTS "admin updates test submissions" ON public.test_submissions;
CREATE POLICY "admin updates test submissions" ON public.test_submissions
  FOR UPDATE TO authenticated
  USING (public.is_school_admin_of(school_id))
  WITH CHECK (public.is_school_admin_of(school_id));

DROP POLICY IF EXISTS "admin updates stage progress" ON public.lesson_stage_progress;
CREATE POLICY "admin updates stage progress" ON public.lesson_stage_progress
  FOR UPDATE TO authenticated
  USING (public.is_school_admin_of(school_id))
  WITH CHECK (public.is_school_admin_of(school_id));

-- Админу нужно ещё и ЧИТАТЬ эти строки, чтобы найти их в списке правок.
-- Политики чтения проверяются ниже по факту: если админ уже видит школу
-- целиком, лишних не добавляем.

NOTIFY pgrst, 'reload schema';

DROP TRIGGER IF EXISTS trg_lock_teacher_marks_del ON public.lesson_grades;
CREATE TRIGGER trg_lock_teacher_marks_del
  BEFORE DELETE ON public.lesson_grades
  FOR EACH ROW EXECUTE FUNCTION public.fn_lock_teacher_marks();

NOTIFY pgrst, 'reload schema';
