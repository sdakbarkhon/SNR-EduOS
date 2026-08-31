-- Миграция 243: роль куратора убирается из правил и триггеров.
--
-- Третий и последний шаг. 242 убрала данные (применена), заход по коду убрал
-- роль из приложений (коммит 7581128b), здесь уходят правило доступа,
-- функция-предикат, два триггера и упоминание роли в CHECK.
--
-- СОСТОЯНИЕ ПЕРЕД НАПИСАНИЕМ (проверено запросом 30.08.2026):
--   учителей в демо-школе                      5
--   из них без предмета                        0   → is_curator_teacher() всегда false
--   групп с проставленным куратором            0
--   учеников с заполненным curator_id          0
--   участий в чатах с ролью 'curator'          0   → CHECK можно сузить
--
-- ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ:
--   * is_my_teacher_group() НЕ ТРОГАЕМ — на ней держится 61 правило доступа.
--     Кураторство было лишь одной из трёх её веток (groups.teacher_id,
--     subjects.teacher_id, group_teachers); две другие живы и нужны.
--   * students.curator_id НЕ УДАЛЯЕМ — колонку читает замороженное
--     ученическое приложение (apps/mobile). Она пуста, показывает прочерк.
--   * groups.teacher_id НЕ УДАЛЯЕМ — на неё смотрит is_my_teacher_group,
--     а сама колонка nullable и пуста. Удаление потребовало бы правки той
--     функции, то есть тех же 61 правила.

BEGIN;

-- ── Предохранитель: не снимаем правила при живых кураторах ──────────────────
DO $$
DECLARE v_groups integer; v_curators integer; v_part integer;
BEGIN
  SELECT count(*) INTO v_groups FROM public.groups WHERE teacher_id IS NOT NULL;
  IF v_groups > 0 THEN
    RAISE EXCEPTION 'Снимать рано: у % групп проставлен куратор. Сначала данные (миграция 242).', v_groups;
  END IF;

  SELECT count(*) INTO v_curators
    FROM public.teachers t JOIN public.schools s ON s.id = t.school_id
   WHERE t.subject_slug IS NULL AND s.is_demo;
  IF v_curators > 0 THEN
    RAISE EXCEPTION 'Снимать рано: в демо-школе % учителей без предмета — для них is_curator_teacher() ещё истинна.', v_curators;
  END IF;

  SELECT count(*) INTO v_part FROM public.chat_participants WHERE role_in_thread = 'curator';
  IF v_part > 0 THEN
    RAISE EXCEPTION 'Сужать CHECK рано: % участий с ролью curator.', v_part;
  END IF;
END $$;

-- ── ШАГ 1. Правило доступа на уроках ────────────────────────────────────────
--
-- Было:
--   (is_subject_owner(subject_id) OR (is_curator_teacher() AND is_my_teacher_group(group_id)))
--   AND school_id = current_school_id() OR is_super_admin()
--
-- Кураторская ветка уходит. Остаётся одно правило для всех учителей: видишь
-- уроки того предмета, которым владеешь. Оно же стоит на UPDATE и DELETE
-- («teacher updates own group lessons», «teachers_delete_lessons») — теперь
-- чтение и запись сходятся по формуле, а не расходятся.
--
-- Правило переписываем ДО удаления функции: DROP при живой ссылке откажет.
DROP POLICY IF EXISTS "teacher reads lessons in own groups" ON public.lessons;
CREATE POLICY "teacher reads lessons in own groups" ON public.lessons
  FOR SELECT
  USING (
    (is_subject_owner(subject_id) AND school_id = current_school_id())
    OR is_super_admin()
  );

-- ── ШАГ 2. Функция-предикат ─────────────────────────────────────────────────
--
-- Заведена миграцией 187: «учитель без предмета И только в демо-школе».
-- Ссылок на неё в схеме больше нет — единственную сняли шагом 1. В коде
-- приложений её тоже больше не зовут (lib/curator.ts, коммит 7581128b).
DROP FUNCTION IF EXISTS public.is_curator_teacher();

-- ── ШАГ 3. Триггер смены куратора ───────────────────────────────────────────
--
-- Переносил участие с ролью 'curator' между людьми при смене
-- groups.teacher_id. Колонка пуста и заполнить её неоткуда: поля в форме
-- группы больше нет.
DROP TRIGGER IF EXISTS trg_group_curator_changed ON public.groups;
DROP FUNCTION IF EXISTS public.tg_group_curator_changed();

-- ── ШАГ 4. Триггер личных чатов куратора ────────────────────────────────────
--
-- Заводил личный чат куратора с КАЖДЫМ учеником группы при назначении. Те
-- тридцать веток удалены миграцией 242; заводить новые не с кем.
DROP TRIGGER IF EXISTS trg_group_curator_direct_chats ON public.groups;
DROP FUNCTION IF EXISTS public.tg_group_curator_direct_chats();

-- ── ШАГ 5. Создание группы — БЕЗ куратора, но С ВЕТКАМИ ЧАТА ────────────────
--
-- ЭТОТ ТРИГГЕР НЕ СНИМАЕТСЯ, А ПЕРЕПИСЫВАЕТСЯ. Он делает две вещи: создаёт
-- две ветки чата (классную и родительскую) и вписывает в них куратора.
-- Вторая уходит, ПЕРВАЯ ОБЯЗАНА ОСТАТЬСЯ — без неё у новой группы не будет
-- чата вовсе, и это главное, что здесь можно сломать.
--
-- Переменные под id веток убраны вместе с участниками: RETURNING было нужно
-- только чтобы вписать куратора.
CREATE OR REPLACE FUNCTION public.tg_group_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Классная ветка: сюда попадают ученики.
  INSERT INTO public.chat_threads (kind, school_id, group_id, title)
  VALUES ('group', NEW.school_id, NEW.id, NEW.name);

  -- Родительская ветка. Родителей в неё добавляет отдельный триггер на
  -- parent_students — при привязке ребёнка (tg_add_parent_to_group_thread).
  INSERT INTO public.chat_threads (kind, school_id, group_id, title)
  VALUES ('group', NEW.school_id, NEW.id, NEW.name || ' — Родители');

  -- 30.08.2026 — блока «вписать куратора участником» здесь больше нет.
  -- Роль убрана из продукта; взрослого в классную ветку заводит админ
  -- школы вручную, как это сделано для трёх существующих классов.
  RETURN NEW;
END;
$function$;

-- ── ШАГ 6. Родитель в родительскую ветку — без куратора ─────────────────────
--
-- Функция добавляет родителя в ветку «{Класс} — Родители» при привязке к
-- ученику, а если ветки нет — создаёт её и вписывает туда куратора. Второе
-- уходит; создание ветки и добавление родителя остаются.
CREATE OR REPLACE FUNCTION public.tg_add_parent_to_group_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r_group RECORD;
  v_thread_id uuid;
  v_parent_user_id uuid;
BEGIN
  SELECT user_id INTO v_parent_user_id FROM public.parents WHERE id = NEW.parent_id;
  IF v_parent_user_id IS NULL THEN RETURN NEW; END IF;

  FOR r_group IN
    SELECT g.id, g.name, g.school_id
    FROM public.student_groups sg
    JOIN public.groups g ON g.id = sg.group_id
    WHERE sg.student_id = NEW.student_id
  LOOP
    SELECT id INTO v_thread_id FROM public.chat_threads
    WHERE kind = 'group'
      AND group_id = r_group.id
      AND title = r_group.name || ' — Родители';

    -- Ветки может не быть у групп, заведённых до появления родительских
    -- веток. Создаём — иначе родителю некуда попасть.
    IF v_thread_id IS NULL THEN
      INSERT INTO public.chat_threads (kind, school_id, group_id, title, created_at, updated_at)
      VALUES ('group', r_group.school_id, r_group.id,
              r_group.name || ' — Родители', now(), now())
      RETURNING id INTO v_thread_id;
      -- 30.08.2026 — вписывания куратора во вновь созданную ветку здесь
      -- больше нет; вместе с ним ушла и выборка g.teacher_id выше.
    END IF;

    INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
    VALUES (v_thread_id, v_parent_user_id, 'parent')
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ── ШАГ 7. Роли участников чата ─────────────────────────────────────────────
--
-- Из шести значений остаются пять. Строк с 'curator' ноль — проверено выше
-- предохранителем, иначе ALTER отказал бы на существующих данных.
ALTER TABLE public.chat_participants DROP CONSTRAINT IF EXISTS chat_participants_role_in_thread_check;
ALTER TABLE public.chat_participants
  ADD CONSTRAINT chat_participants_role_in_thread_check
  CHECK (role_in_thread = ANY (ARRAY[
    'student'::text,
    'teacher'::text,
    'parent'::text,
    'admin'::text,
    'bot'::text
  ]));

COMMIT;

-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ:
--
--   -- функции нет, триггеров четыре из шести:
--   SELECT proname FROM pg_proc
--    WHERE pronamespace = 'public'::regnamespace AND proname = 'is_curator_teacher';   -- 0 строк
--
--   SELECT t.tgname FROM pg_trigger t WHERE t.tgrelid = 'public.groups'::regclass
--     AND NOT t.tgisinternal;                          -- trg_group_created + прочие, БЕЗ двух кураторских
--
--   -- правило на уроках без кураторской ветки:
--   SELECT pg_get_expr(polqual, polrelid) FROM pg_policy pol
--     JOIN pg_class cl ON cl.oid = pol.polrelid
--    WHERE cl.relname = 'lessons' AND polname = 'teacher reads lessons in own groups';
--
--   -- пять ролей вместо шести:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'chat_participants_role_in_thread_check';
--
-- ЗАМКИ. Шаг 7 берёт ACCESS EXCLUSIVE на chat_participants и сканирует её
-- при добавлении ограничения: на 30.08.2026 там 341 строка — мгновенно.
-- Остальные шаги трогают каталог (правило, функции, триггеры) и данных не
-- читают. Замок держится доли секунды.
--
-- ЧТО ОСТАЛОСЬ ОТ РОЛИ ПОСЛЕ ЭТОЙ МИГРАЦИИ:
--   * колонки groups.teacher_id и students.curator_id — пустые, не удаляем
--     (см. шапку);
--   * тип ChatParticipantRole в packages/core ещё перечисляет 'curator':
--     его сужение — правка кода, не схемы, и делается отдельно.
