-- Миграция 236 — настройки уведомлений и источник для «Сообщений».
--
-- ОСНОВАНИЕ. Разведка 29.08.2026: из девяти категорий экрана настроек
-- работали три (оценки, домашние задания, объявления), тумблеры не
-- сохранялись нигде, а экран не закрыт demoOr — то есть врал настоящему
-- родителю. Решения заказчика: фильтр при ЧТЕНИИ, а не в триггере; на экране
-- остаются четыре категории; реклама убирается; чат получает свой источник.
--
-- ПОЧЕМУ ФИЛЬТР ПРИ ЧТЕНИИ. Разница между «не писать» и «писать и не
-- показывать» не в скорости, а в обратимости. Выключил категорию на месяц,
-- включил обратно — при фильтре в триггере пропущенного НЕТ И НЕ БУДЕТ:
-- событие прошло, строка не написана, восстановить неоткуда. При фильтре на
-- чтении история цела. Плюс это две функции общего слоя против девяти
-- триггеров, каждый из которых SECURITY DEFINER на живой таблице.
--
-- ЧТО ЭТА МИГРАЦИЯ НЕ ТРОГАЕТ. Девять существующих триггеров уведомлений —
-- ни один. Старую public.notification_settings (ключ по student_id, четыре
-- колонки) — не трогает вовсе: её читает общий слой и экран профиля ученика
-- в вебе, переезд и снос идут отдельным заходом.

-- ── 1. НАСТРОЙКИ УВЕДОМЛЕНИЙ ─────────────────────────────────────────
--
-- КЛЮЧ ПО ПОЛЬЗОВАТЕЛЮ, А НЕ ПО РОЛИ. Настройки нужны не только родителю:
-- ученик, учитель и админ получают уведомления тоже. user_id — единственное,
-- что есть у всех четверых. Старая notification_settings ключом student_id
-- выразить их не может, а четыре таблицы — это четыре копии одной логики.
--
-- СТРОКА НА КАТЕГОРИЮ, А НЕ КОЛОНКА. Категории будут меняться: сегодня
-- убираем рекламу, завтра вернём мероприятия, когда под них появится схема.
-- Колонки — миграция на каждое изменение; строки — правка CHECK.
--
-- ОТСУТСТВИЕ СТРОКИ ОЗНАЧАЕТ «ВКЛЮЧЕНО». Поэтому заводить строки заранее
-- никому не нужно: пишется только то, что человек ВЫКЛЮЧИЛ. У сегодняшних
-- 39 получателей это единицы строк вместо 156.
CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id  uuid NOT NULL REFERENCES public.schools(id),
  category   text NOT NULL CHECK (category IN ('grades', 'homework', 'announcements', 'messages')),
  enabled    boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

CREATE INDEX IF NOT EXISTS notification_prefs_school_idx
  ON public.notification_prefs (school_id);

COMMENT ON TABLE public.notification_prefs IS
  'Выключенные категории уведомлений. Отсутствие строки означает «включено»: '
  'хранится только то, что человек выключил. Ключ по user_id, а не по роли — '
  'настройки нужны ученику, родителю, учителю и админу одинаково.';

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

-- ── 2. ПРАВИЛА ДОСТУПА ───────────────────────────────────────────────
--
-- Свои и только свои. Ни админа школы, ни суперадмина здесь нет намеренно:
-- настройка уведомлений — личное дело человека, читать её посторонним незачем,
-- а менять — тем более. Школа сверяется вдобавок к пользователю, как во всех
-- таблицах проекта.
DROP POLICY IF EXISTS "own prefs read" ON public.notification_prefs;
CREATE POLICY "own prefs read" ON public.notification_prefs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own prefs insert" ON public.notification_prefs;
CREATE POLICY "own prefs insert" ON public.notification_prefs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND school_id = public.current_school_id());

DROP POLICY IF EXISTS "own prefs update" ON public.notification_prefs;
CREATE POLICY "own prefs update" ON public.notification_prefs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND school_id = public.current_school_id());

DROP POLICY IF EXISTS "own prefs delete" ON public.notification_prefs;
CREATE POLICY "own prefs delete" ON public.notification_prefs
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Сужающее правило суперадмина — как у всех таблиц с миграции 222. Новая
-- таблица в тот обход не попала: он шёл циклом по существовавшим тогда.
DROP POLICY IF EXISTS "superadmin write guard insert" ON public.notification_prefs;
CREATE POLICY "superadmin write guard insert" ON public.notification_prefs
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT public.is_super_admin()) OR public.sa_write_allowed('notification_prefs'));

DROP POLICY IF EXISTS "superadmin write guard update" ON public.notification_prefs;
CREATE POLICY "superadmin write guard update" ON public.notification_prefs
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT public.is_super_admin()) OR public.sa_write_allowed('notification_prefs'))
  WITH CHECK ((NOT public.is_super_admin()) OR public.sa_write_allowed('notification_prefs'));

DROP POLICY IF EXISTS "superadmin write guard delete" ON public.notification_prefs;
CREATE POLICY "superadmin write guard delete" ON public.notification_prefs
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT public.is_super_admin()) OR public.sa_write_allowed('notification_prefs'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;

-- ── 3. ИСТОЧНИК ДЛЯ КАТЕГОРИИ «СООБЩЕНИЯ» ────────────────────────────
--
-- Новый вид уведомления. Только добавление значения; существующие тринадцать
-- остаются как были.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN (
    'announcement', 'new_homework', 'new_grade', 'homework_graded',
    'lesson_material', 'student_excused', 'student_submitted',
    'leave_request', 'leave_decision', 'lesson_starting_soon',
    'lesson_created', 'grade_received', 'announcement_new',
    'chat_message'
  ));

-- ГРУППОВЫЕ ЧАТЫ УВЕДОМЛЕНИЙ НЕ ДАЮТ. Это не осторожность впрок, а замер.
--
-- Посчитано на живых данных 29.08.2026: за весь период жизни переписки
-- (15–28 июля, 13 дней, 555 сообщений) триггер без ограничения написал бы
-- 1311 строк. Из них:
--
--   личные чаты   471 сообщение  →   471 строка   (ровно одна на сообщение)
--   групповые      84 сообщения  →   840 строк    (в среднем 10 на сообщение)
--
-- То есть 15% сообщений дают 64% строк. И это при нынешних комнатах: в
-- групповом треде сейчас до 11 участников. В настоящем классе на 30 учеников
-- плюс их родители участников будет за шестьдесят — одно сообщение куратора
-- дало бы шестьдесят строк, а таких сообщений в день десятки.
--
-- При этом у группового чата уже ЕСТЬ рабочий счётчик непрочитанного:
-- chat_read_state против chat_messages, он показан в списке переписок.
-- Уведомление дублировало бы сигнал, который и так работает.
--
-- Поэтому личные чаты и комнаты поддержки — уведомляем, групповые — нет.
-- Если заказчик решит иначе, снять ограничение можно одной строкой: убрать
-- условие на kind ниже.
CREATE OR REPLACE FUNCTION public.fn_chat_message_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_kind      text;
  v_school_id uuid;
  v_sender    text;
BEGIN
  SELECT t.kind, t.school_id INTO v_kind, v_school_id
    FROM public.chat_threads t WHERE t.id = NEW.thread_id;

  -- Групповые чаты пропускаем: у них свой счётчик непрочитанного, а строк
  -- они дают на порядок больше (см. замер выше).
  IF v_kind IS NULL OR v_kind = 'group' THEN
    RETURN NEW;
  END IF;

  -- Автору о собственном сообщении не пишем: sender_id исключается прямо в
  -- отборе получателей, а не проверяется после.
  -- ЗАГОЛОВОК — ИМЯ ОТПРАВИТЕЛЯ, А НЕ ИМЯ КОМНАТЫ. У ВСЕХ личных чатов
  -- chat_threads.title пуст (181 из 181, замер 29.08.2026), и заголовок
  -- уведомления вышел бы пустым в самом частом случае. Имя ищется по всем
  -- четырём таблицам людей напрямую: функция работает от владельца, правила
  -- доступа её не ограничивают, а представления chat_*_names здесь не годятся
  -- — они отбирают по auth.uid(), то есть по отправителю, а не получателю.
  SELECT COALESCE(tc.full_name, st.full_name, pa.full_name, ad.full_name, '')
    INTO v_sender
    FROM (SELECT 1) z
    LEFT JOIN public.teachers tc ON tc.user_id = NEW.sender_id
    LEFT JOIN public.students st ON st.user_id = NEW.sender_id
    LEFT JOIN public.parents  pa ON pa.user_id = NEW.sender_id
    LEFT JOIN public.admins   ad ON ad.user_id = NEW.sender_id;

  INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id, school_id)
  SELECT cp.user_id,
         'chat_message',
         COALESCE(NULLIF(v_sender, ''), t.title, ''),
         left(NEW.body, 140),
         '/chat/' || NEW.thread_id::text,
         NEW.id,
         COALESCE(NEW.school_id, v_school_id)
    FROM public.chat_participants cp
    JOIN public.chat_threads t ON t.id = cp.thread_id
   WHERE cp.thread_id = NEW.thread_id
     AND cp.user_id IS DISTINCT FROM NEW.sender_id;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.fn_chat_message_notify() IS
  'Уведомление о новом сообщении участникам ЛИЧНОГО чата и комнаты поддержки, '
  'кроме автора. Групповые чаты пропускаются: у них свой счётчик '
  'непрочитанного, а строк они дают на порядок больше.';

-- AFTER, а не BEFORE: на chat_messages уже висит trg_update_thread_updated_at
-- (AFTER INSERT OR UPDATE), и порядок между двумя BEFORE решался бы алфавитом
-- имён. AFTER INSERT срабатывает после того, как строка сообщения записана, —
-- значит NEW.id уже настоящий и годится в source_id.
DROP TRIGGER IF EXISTS trg_chat_message_notify ON public.chat_messages;
CREATE TRIGGER trg_chat_message_notify
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.fn_chat_message_notify();

-- ── ПРОВЕРКИ ПОСЛЕ ПРИМЕНЕНИЯ ────────────────────────────────────────
--
-- 1. Таблица и её ключ. Ждём (user_id, category).
--
-- SELECT a.attname FROM pg_index i
--   JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
--  WHERE i.indrelid = 'public.notification_prefs'::regclass AND i.indisprimary;
--
-- 2. CHECK по категориям — ровно четыре значения.
--
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.notification_prefs'::regclass AND contype = 'c';
--
-- 3. Правила доступа: четыре разрешающих и три сужающих суперадминских.
--
-- SELECT policyname, cmd, permissive FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'notification_prefs' ORDER BY cmd, policyname;
--
-- 4. Новый вид уведомления разрешён, старые тринадцать на месте.
--
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_kind_check';
--
-- 5. Триггер чата на месте и включён.
--
-- SELECT tgname, tgenabled FROM pg_trigger
--  WHERE tgrelid = 'public.chat_messages'::regclass AND NOT tgisinternal ORDER BY tgname;
--
-- 6. Девять прежних триггеров уведомлений не тронуты. Ждём те же девять.
--
-- SELECT c.relname, tg.tgname FROM pg_trigger tg
--   JOIN pg_proc p ON p.oid = tg.tgfoid JOIN pg_class c ON c.oid = tg.tgrelid
--  WHERE NOT tg.tgisinternal AND p.prosrc ILIKE '%notifications%' ORDER BY 1, 2;
--
-- 7. Старая notification_settings не тронута. Ждём одну строку и четыре колонки.
--
-- SELECT count(*) AS строк FROM public.notification_settings;

-- =====================================================================
-- УДАЛЕНИЕ МЁРТВЫХ УВЕДОМЛЕНИЙ — ВЫПОЛНЯТЬ ОТДЕЛЬНО, ПОСМОТРЕВ НА ЧИСЛА.
--
-- Этот блок закомментирован НАМЕРЕННО: применение файла выше ничего не
-- удаляет. Выполните его отдельной командой, когда решите.
--
-- ЧТО УДАЛЯЕТСЯ. Вид 'lesson_created' больше не порождается никем: триггер,
-- писавший его, убрала миграция 224. Строки остались лежать и ПОКАЗЫВАЮТСЯ:
-- getMyNotifications берёт select("*") без фильтра по виду.
--
-- Замер 29.08.2026:
--
--   школа              строк   непрочитанных   период
--   SNR Demo School      114        21         26.07 — 17.08
--   SNR School             7         7         16.08 — 17.08
--   ────────────────────────────────────────────────────────
--   ВСЕГО                121        28
--
-- В боевой школе это ВСЕ её уведомления, кроме одной оценки: 7 из 8, и все
-- семь непрочитанные. То есть колокольчик там горит исключительно мёртвым.
--
-- Значение 'lesson_created' из CHECK выше НЕ убрано намеренно: сначала
-- удаляются строки, и только потом, отдельной миграцией и по слову
-- заказчика, можно сузить список видов. Убрать значение раньше строк —
-- значит получить отказ ограничения на живых данных.
--
--   -- Сколько удалится, до удаления:
--   SELECT s.name AS школа, count(*) AS строк,
--          count(*) FILTER (WHERE NOT n.is_read) AS непрочитанных
--     FROM public.notifications n JOIN public.schools s ON s.id = n.school_id
--    WHERE n.kind = 'lesson_created'
--    GROUP BY s.name ORDER BY s.name;
--
--   -- Само удаление:
--   DELETE FROM public.notifications WHERE kind = 'lesson_created';
--
--   -- Проверка после: ждём 0 и никаких висячих ссылок.
--   SELECT count(*) AS осталось FROM public.notifications WHERE kind = 'lesson_created';
-- =====================================================================
