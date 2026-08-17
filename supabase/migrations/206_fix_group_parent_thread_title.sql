-- Миграция 206: у нового класса перестаёт появляться тред с битым названием.
--
-- ЧТО НАЙДЕНО. В теле триггера tg_group_created литерал « — Родители» записан
-- испорченными байтами. Прямо из pg_proc.prosrc:
--
--   INSERT INTO public.chat_threads (kind, school_id, group_id, title)
--   VALUES ('group', NEW.school_id, NEW.id, NEW.name || ' <FFFD> <FFFD>×8')
--
-- То есть на месте тире и слова «Родители» стоят символы-замены U+FFFD. Это не
-- разовая порча данных: функция срабатывает на КАЖДОЕ создание группы, и
-- каждый новый класс получает родительский тред с нечитаемым именем. Ровно так
-- появился тред «10-А класс <FFFD> …», который убрали как дубль, и ровно так
-- появился «W-5 <FFFD> …» при создании группы W-5 в настоящей школе.
--
-- Порча пришла из миграции 81 (rename_teacher_demo_and_parent_group_threads):
-- файл сохранили не в UTF-8, и Postgres принял испорченные байты как обычный
-- текст — синтаксически это законная строка, поэтому никто ничего не заметил.
--
-- ЧТО ДЕЛАЕТ ЭТА МИГРАЦИЯ. Пересоздаёт функцию с правильным литералом. Тело в
-- остальном не меняется ни на строку: те же два треда, тот же куратор, тот же
-- ON CONFLICT. Уже созданные битые треды здесь НЕ трогаются — данные правятся
-- отдельно и по слову заказчика.

CREATE OR REPLACE FUNCTION public.tg_group_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_curator_user_id uuid;
  v_student_thread_id uuid;
  v_parent_thread_id uuid;
BEGIN
  IF NEW.teacher_id IS NOT NULL THEN
    SELECT user_id INTO v_curator_user_id FROM public.teachers WHERE id = NEW.teacher_id;
  END IF;

  INSERT INTO public.chat_threads (kind, school_id, group_id, title)
  VALUES ('group', NEW.school_id, NEW.id, NEW.name)
  RETURNING id INTO v_student_thread_id;

  INSERT INTO public.chat_threads (kind, school_id, group_id, title)
  VALUES ('group', NEW.school_id, NEW.id, NEW.name || ' — Родители')
  RETURNING id INTO v_parent_thread_id;

  IF v_curator_user_id IS NOT NULL THEN
    INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
    VALUES (v_student_thread_id, v_curator_user_id, 'curator')
    ON CONFLICT (thread_id, user_id) DO NOTHING;
    INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
    VALUES (v_parent_thread_id, v_curator_user_id, 'curator')
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tg_group_created() IS
  'При создании группы заводит два треда: класса и родителей. Литерал '
  '« — Родители» был испорчен при сохранении миграции 81 не в UTF-8.';
