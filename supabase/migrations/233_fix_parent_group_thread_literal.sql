-- Миграция 233 — вторая функция с тем же испорченным литералом.
--
-- ЧТО НАЙДЕНО. Миграция 206 починила литерал « — Родители» в tg_group_created,
-- но такой же литерал есть ВО ВТОРОЙ функции — tg_add_parent_to_group_thread,
-- и её никто не тронул. Тело снято с прода через pg_get_functiondef, а не
-- взято из файла миграции (тела и файлы в этом проекте уже расходились):
--
--     SELECT id INTO v_thread_id FROM public.chat_threads
--     WHERE kind = 'group'
--       AND group_id = r_group.id
--       AND title = r_group.name || ' <U+FFFD> <U+FFFD x8>';
--
-- То есть на месте тире и слова «Родители» стоят символы-замены U+FFFD.
-- Байты заголовка, который эта функция пишет:
--     20 efbfbd 20 efbfbd efbfbd efbfbd efbfbd efbfbd efbfbd efbfbd efbfbd
-- Байты правильного заголовка, который пишет починенная tg_group_created:
--     20 e28094 20 d0a0 d0be d0b4 d0b8 d182 d0b5 d0bb d0b8   (« — Родители»)
-- Символов-замен в теле функции ровно 18 = два вхождения литерала по девять.
--
-- ПОЧЕМУ ЭТО НЕ КОСМЕТИКА. Триггер висит на parent_students AFTER INSERT.
-- Ищет он родительскую комнату по битому имени, а tg_group_created заводит её
-- с правильным. Совпадения нет никогда — значит функция каждый раз создаёт
-- ВТОРУЮ родительскую комнату, с нечитаемым названием, и сажает родителя
-- туда. Правильная комната остаётся пустой.
--
-- Что это дало живьём (запрос 29.08.2026):
--     SNR School      «W-5 — Родители»          участников 0
--     SNR School      «W-5 <мусор>»             участников 1  ← родитель, один
--     SNR Demo School «10-А класс — Родители»   участников 1
--     SNR Demo School «10-А класс <мусор>»      участников 2  ← он же ещё раз
-- Единственный родитель боевой школы сидит один в комнате с нечитаемым
-- названием. Куратора туда не добавили: он вписывается только при создании
-- треда и только если у группы уже проставлен teacher_id, а поле куратора
-- у групп боевой школы открылось лишь 28.08.2026.
--
-- ЧТО ДЕЛАЕТ ЭТА МИГРАЦИЯ. Пересоздаёт функцию с правильным литералом.
-- CREATE OR REPLACE, а не DROP + CREATE: DROP снёс бы выданные права.
-- Тело в остальном не меняется НИ НА СТРОКУ — тот же цикл по группам, тот же
-- поиск, тот же ON CONFLICT, тот же куратор. Триггер не пересоздаётся: он
-- ссылается на функцию по имени и подхватит новое тело сам.
--
-- ЧЕГО ЭТА МИГРАЦИЯ НЕ ДЕЛАЕТ. Уже созданные битые треды здесь НЕ трогаются:
-- перенос участников и сообщений — отдельный шаг, по слову заказчика, после
-- того как он посмотрит числа холостого прогона. Правила доступа, экраны и
-- отправка сообщений не затрагиваются вовсе.

CREATE OR REPLACE FUNCTION public.tg_add_parent_to_group_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  r_group RECORD;
  v_thread_id uuid;
  v_curator_user_id uuid;
  v_parent_user_id uuid;
BEGIN
  SELECT user_id INTO v_parent_user_id FROM public.parents WHERE id = NEW.parent_id;
  IF v_parent_user_id IS NULL THEN RETURN NEW; END IF;

  FOR r_group IN
    SELECT g.id, g.name, g.school_id, g.teacher_id
    FROM public.student_groups sg
    JOIN public.groups g ON g.id = sg.group_id
    WHERE sg.student_id = NEW.student_id
  LOOP
    SELECT t.user_id INTO v_curator_user_id
    FROM public.teachers t WHERE t.id = r_group.teacher_id;

    SELECT id INTO v_thread_id FROM public.chat_threads
    WHERE kind = 'group'
      AND group_id = r_group.id
      AND title = r_group.name || ' — Родители';

    IF v_thread_id IS NULL THEN
      INSERT INTO public.chat_threads (kind, school_id, group_id, title, created_at, updated_at)
      VALUES ('group', r_group.school_id, r_group.id,
              r_group.name || ' — Родители', now(), now())
      RETURNING id INTO v_thread_id;

      IF v_curator_user_id IS NOT NULL THEN
        INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
        VALUES (v_thread_id, v_curator_user_id, 'curator')
        ON CONFLICT (thread_id, user_id) DO NOTHING;
      END IF;
    END IF;

    INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
    VALUES (v_thread_id, v_parent_user_id, 'parent')
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.tg_add_parent_to_group_thread() IS
  'Сажает родителя в родительский тред каждой группы его ребёнка. Литерал '
  '« — Родители» был испорчен при сохранении миграции 81 не в UTF-8; '
  'миграция 206 починила такой же литерал в tg_group_created, эта — здесь.';

-- ── ПРОВЕРКИ ПОСЛЕ ПРИМЕНЕНИЯ ────────────────────────────────────────
--
-- 1. Символов-замен в теле не осталось. Ждём 0.
--
-- SELECT length(prosrc) - length(replace(prosrc, chr(65533), '')) AS сколько_FFFD
--   FROM pg_proc WHERE proname = 'tg_add_parent_to_group_thread';
--
-- 2. Литерал в теле — тот же, что у починенной 206 функции. Ждём true.
--
-- SELECT (SELECT prosrc LIKE '%'' — Родители''%' FROM pg_proc
--          WHERE proname = 'tg_add_parent_to_group_thread') AS у_родителя_верный,
--        (SELECT prosrc LIKE '%'' — Родители''%' FROM pg_proc
--          WHERE proname = 'tg_group_created') AS у_группы_верный;
--
-- 3. Права на выполнение не изменились (CREATE OR REPLACE их сохраняет).
--    Сравнить с тем, что было снято ДО применения:
--
-- SELECT proacl FROM pg_proc WHERE proname = 'tg_add_parent_to_group_thread';
--
-- 4. Триггер на месте и указывает на ту же функцию. Ждём одну строку.
--
-- SELECT tgname, tgenabled FROM pg_trigger
--  WHERE tgrelid = 'public.parent_students'::regclass
--    AND tgname = 'trg_parent_add_to_group_thread' AND NOT tgisinternal;
--
-- 5. Новых битых тредов больше не появляется. После применения число
--    тредов с символом-заменой в заголовке должно остаться ДВА и не расти:
--
-- SELECT count(*) AS битых_тредов FROM public.chat_threads
--  WHERE title LIKE '%' || chr(65533) || '%';
--
--    Эти два — уже существующие. Их слияние с правильными комнатами —
--    отдельный шаг, он ждёт согласия заказчика.
