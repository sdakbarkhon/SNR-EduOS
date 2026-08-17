-- Миграция 207: в групповой чат класса попадают ученики и учителя.
--
-- ЧТО НАЙДЕНО. В настоящей школе завели учителя, группу и учеников. Личный чат
-- ученика с учителем появился, а групповой — «не создался». На деле тред как
-- раз создан: tg_group_created заводит два треда на каждую группу. Но в нём
-- НОЛЬ участников — а тред без участников не видит никто, и для человека это
-- неотличимо от «чата нет».
--
-- Проверено запросом:
--   настоящая школа: «W-5» — 0 участников, «W-5 — Родители» — 0 участников
--   демо-школа:      «10-А класс» — 11, «7-А класс» — 11, «3-А класс» — 11
--
-- ПОЧЕМУ ТАК. tg_group_created добавляет ровно одного участника — куратора, и
-- только `IF NEW.teacher_id IS NOT NULL`. В настоящих школах поля куратора в
-- форме группы нет вовсе (решение Z.2.6), поэтому teacher_id пуст и добавлять
-- некого. Учеников не добавляет никто и никогда: вступление в группу
-- (student_groups) и назначение учителя (subjects) на чат не влияли. В демо
-- одиннадцать участников появились из сида, а не от триггера — механизма,
-- который бы их поддерживал, в базе не было.
--
-- ЧТО ДЕЛАЕТ ЭТА МИГРАЦИЯ. Заводит недостающую связь событий:
--   * ученик добавлен в группу  → он в чате класса;
--   * ученик убран из группы    → он из чата класса;
--   * учителю назначен предмет  → он в чате класса;
-- и один раз добирает участников для уже существующих групп.
--
-- КАКОЙ ИЗ ДВУХ ТРЕДОВ «КЛАССНЫЙ». У группы их два, и отличаются они только
-- названием: у классного оно равно имени группы, у родительского — имя плюс
-- « — Родители». Отдельного признака в chat_threads нет, заводить колонку ради
-- этого не стали: сравнение с именем группы даёт однозначный ответ и не
-- расходится с тем, как тред создаётся строкой выше.

-- ── 1. Какой тред у группы «классный» ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_class_thread_id(p_group_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.id
  FROM public.chat_threads t
  JOIN public.groups g ON g.id = t.group_id
  WHERE t.group_id = p_group_id
    AND t.kind = 'group'
    AND t.title = g.name
  ORDER BY t.created_at
  LIMIT 1
$$;

COMMENT ON FUNCTION public.fn_class_thread_id(uuid) IS
  'Тред класса (не родительский) у группы. Родительский отличается суффиксом '
  '« — Родители» в названии — своего признака у тредов нет.';

-- ── 2. Ученик вступил в группу / вышел из неё ───────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_student_group_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread uuid;
  v_user   uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_thread := public.fn_class_thread_id(NEW.group_id);
    SELECT user_id INTO v_user FROM public.students WHERE id = NEW.student_id;
    IF v_thread IS NOT NULL AND v_user IS NOT NULL THEN
      INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
      VALUES (v_thread, v_user, 'student')
      ON CONFLICT (thread_id, user_id) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  -- Вышел из группы — выходит и из чата класса. Сообщения остаются: их автор
  -- хранится в chat_messages.sender_id и от участия не зависит.
  v_thread := public.fn_class_thread_id(OLD.group_id);
  SELECT user_id INTO v_user FROM public.students WHERE id = OLD.student_id;
  IF v_thread IS NOT NULL AND v_user IS NOT NULL THEN
    DELETE FROM public.chat_participants
    WHERE thread_id = v_thread AND user_id = v_user;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_group_chat ON public.student_groups;
CREATE TRIGGER trg_student_group_chat
  AFTER INSERT OR DELETE ON public.student_groups
  FOR EACH ROW EXECUTE FUNCTION public.tg_student_group_chat();

-- ── 3. Учителю назначили предмет в группе ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_subject_teacher_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread uuid;
  v_user   uuid;
BEGIN
  IF NEW.teacher_id IS NULL OR NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;
  v_thread := public.fn_class_thread_id(NEW.group_id);
  SELECT user_id INTO v_user FROM public.teachers WHERE id = NEW.teacher_id;
  IF v_thread IS NOT NULL AND v_user IS NOT NULL THEN
    INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
    VALUES (v_thread, v_user, 'teacher')
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Снятие учителя с предмета участие НЕ отзывает: он мог уже писать в чат, и
-- выкидывать его молча из переписки, которую он вёл, неправильно. Убирает
-- администратор, если нужно.
DROP TRIGGER IF EXISTS trg_subject_teacher_chat ON public.subjects;
CREATE TRIGGER trg_subject_teacher_chat
  AFTER INSERT OR UPDATE OF teacher_id ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.tg_subject_teacher_chat();

-- ── 4. Добор участников для уже созданных групп ─────────────────────────────
-- Только настоящие школы: демо-школу не трогаем, там участники на месте.
INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
SELECT public.fn_class_thread_id(sg.group_id), st.user_id, 'student'
FROM public.student_groups sg
JOIN public.students st ON st.id = sg.student_id
JOIN public.schools s ON s.id = sg.school_id
WHERE st.user_id IS NOT NULL
  AND s.is_demo IS NOT TRUE
  AND public.fn_class_thread_id(sg.group_id) IS NOT NULL
ON CONFLICT (thread_id, user_id) DO NOTHING;

INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
SELECT public.fn_class_thread_id(sub.group_id), t.user_id, 'teacher'
FROM public.subjects sub
JOIN public.teachers t ON t.id = sub.teacher_id
JOIN public.schools s ON s.id = sub.school_id
WHERE t.user_id IS NOT NULL
  AND s.is_demo IS NOT TRUE
  AND public.fn_class_thread_id(sub.group_id) IS NOT NULL
ON CONFLICT (thread_id, user_id) DO NOTHING;
