-- Миграция 247: очередь на наполнение уроков этапами. Пункт 208, заход Q1.
--
-- ЗАЧЕМ. Маршрут /api/ai/generate-stages работает синхронно: до трёх попыток
-- к модели плюс до шести картинок, потолок функции 300 секунд. Двадцать
-- уроков — это до ста минут с открытой вкладкой. Учитель должен нажать,
-- закрыть вкладку и вернуться позже.
--
-- ЧТО ДЕЛАЕТ ЭТА МИГРАЦИЯ И ЧЕГО НЕ ДЕЛАЕТ. Заводит таблицу заказов и способ
-- их класть. Разбирать заказы НЕКОМУ И НЕЧЕМУ — разборщик в заходе Q2,
-- автоматический запуск в Q3. Это не недоделка, а порядок: после Q1 строки
-- копятся, ни одного обращения к модели не происходит, ни рубля не тратится.
--
-- ── ЧТО ХРАНИМ И ПОЧЕМУ ИМЕННО ЭТО ─────────────────────────────────────────
--
-- Форма списана с двух уже работающих очередей проекта —
-- lesson_stages_embedding_queue (миграция 139) и ai_homework_review_queue: у
-- обеих (<предмет>_id, school_id, enqueued_at, attempts, last_error), первичный
-- ключ на предмете очереди, индекс FIFO. Отличий три, и каждое по делу.
--
--   1. STATUS. У тех очередей «сделано» означает «строки больше нет». Здесь
--      так нельзя: учитель уходит и возвращается, и ему нужно увидеть, что
--      вышло. Строка остаётся, а status рассказывает. Отдельно поэтому же
--      живёт 'canceled': решение заказчика — след того, что человек заказал и
--      передумал, должен остаться, а не исчезнуть.
--
--   2. BATCH_ID. Одно нажатие «наполнить выбранные» — это N строк. Учителю
--      надо показать «в очереди 20, сделано 0», а не двадцать отдельных
--      судеб. Один заказ — один batch_id.
--
--   3. REQUESTED_BY, TOPIC, OPTIONS. Разборщику из Q2 нужно знать, от чьего
--      имени работать и что передать модели. Тема берётся ровно так же, как
--      её берёт существующее одиночное окно: coalesce(lessons.topic,
--      lessons.title) — см. TeacherLessonDetailView, проп lessonTopic.
--      options пока пуст: сложность и веб-поиск появятся вместе с разборщиком.
--
-- ПЕРВИЧНЫЙ КЛЮЧ ПО УРОКУ — это и есть запрет дублей: один урок, одна строка.
-- Повторный заказ того же урока не плодит вторую, а переводит существующую
-- обратно в 'queued' (см. функцию ниже).
--
-- ── ПОПЫТОК ДВЕ, А НЕ ТРИ ──────────────────────────────────────────────────
--
-- У соседних очередей QUEUE_MAX_ATTEMPTS = 3. Здесь заказчик решил две, и
-- решение верное: внутри самого маршрута уже стоит цикл до трёх попыток
-- (generate-stages/route.ts, `for (let attempt = 0; attempt < 3 ...)`), а в
-- клиенте модели — ещё MAX_RETRIES = 3 на сетевые отказы. Три попытки очереди
-- сверху дали бы до девяти обращений на один урок. Число живёт в коде
-- разборщика (Q2), в схеме его нет намеренно: проверка `attempts <= 2`
-- отбила бы сам инкремент разборщика на последней попытке.
--
-- ── ПОТОЛКА НА ШКОЛУ В СУТКИ НЕТ ───────────────────────────────────────────
--
-- Решение заказчика. Что это значит числом, чтобы было видно, когда появится
-- первый замер: одно нажатие «выбрать все» на плане из 200 тем поставит в
-- очередь 200 уроков. По устройству маршрута это до 200 × 3 = 600 обращений к
-- модели и до 200 × 6 = 1200 картинок. Замеров нет: записей generate_stages в
-- ai_usage_events НОЛЬ, ближайший аналог — book_to_plan, один вызов на 21 962
-- токена и 36,9 секунды. Останов на середине предусмотрен (Q4), но уже
-- начатый урок добежит: прервать вызов модели на полпути нельзя.
--
-- ── ПРАВА: СНАЧАЛА ОТОБРАТЬ, ПОТОМ ВЫДАТЬ ──────────────────────────────────
--
-- В Supabase на схему public выставлены ALTER DEFAULT PRIVILEGES, и новая
-- таблица, созданная ролью postgres, СРАЗУ получает anon и authenticated с
-- полным набором прав. На этом проект уже спотыкался дважды: миграция 235
-- (представление chat_admin_names, через которое вошедший мог бы завести себе
-- администратора) и 238 (функция подсказки: REVOKE ... FROM PUBLIC снимает
-- только неявное право, а anon и authenticated получают ЯВНЫЙ грант, и его
-- надо отзывать поимённо).
--
-- Поэтому ниже отзыв поимённо у PUBLIC, anon и authenticated — и только потом
-- выдача ровно того, что нужно: учителю SELECT на таблицу и EXECUTE на
-- функцию заказа. Писать в таблицу напрямую он не может вовсе.
--
-- ── ЗАКАЗ ИДЁТ ЧЕРЕЗ ФУНКЦИЮ, А НЕ ЧЕРЕЗ INSERT ────────────────────────────
--
-- Требование «в базу идёт настоящий учитель и настоящий урок» выполняется
-- построением: fn_enqueue_stage_generation берёт учителя из
-- current_teacher_id(), а не из тела запроса, и кладёт только те уроки, что
-- прошли is_my_teacher_group. Подделать requested_by неоткуда — клиент его не
-- передаёт. Права INSERT/UPDATE у authenticated на таблице отсутствуют.

BEGIN;

SET LOCAL lock_timeout = '3s';

-- ── Таблица ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lesson_stage_gen_queue (
  -- Первичный ключ по уроку = запрет дублей. CASCADE: удалили урок — заказ
  -- на него больше не имеет смысла.
  lesson_id    uuid PRIMARY KEY REFERENCES public.lessons(id)   ON DELETE CASCADE,
  school_id    uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  -- Кто заказал. CASCADE: уволили учителя — его заказы уходят с ним.
  requested_by uuid        NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  -- Одно нажатие — один batch_id. Не ключ: строк в пачке много.
  batch_id     uuid        NOT NULL,
  enqueued_at  timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  status       text        NOT NULL DEFAULT 'queued',
  attempts     integer     NOT NULL DEFAULT 0,
  last_error   text,
  -- Что передать модели. Берётся так же, как в одиночном окне.
  topic        text,
  -- Сложность, веб-поиск, материалы. Наполнится в Q2 вместе с разборщиком.
  options      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT lesson_stage_gen_queue_status_check
    CHECK (status IN ('queued', 'running', 'done', 'failed', 'canceled'))
);

-- Разборщику (Q2) — брать самые старые из ждущих. Частичный индекс: строки
-- done/failed/canceled копятся и в выборку не попадают вовсе.
CREATE INDEX IF NOT EXISTS lesson_stage_gen_queue_fifo_idx
  ON public.lesson_stage_gen_queue (enqueued_at)
  WHERE status = 'queued';

-- Экрану — сводка по пачке «в очереди 20, сделано 0».
CREATE INDEX IF NOT EXISTS lesson_stage_gen_queue_batch_idx
  ON public.lesson_stage_gen_queue (batch_id);

-- Отчётам и разбору по школе.
CREATE INDEX IF NOT EXISTS lesson_stage_gen_queue_school_idx
  ON public.lesson_stage_gen_queue (school_id);

COMMENT ON TABLE public.lesson_stage_gen_queue IS
  'Очередь на наполнение уроков этапами через модель. Один урок — одна строка '
  '(первичный ключ по lesson_id). Кладёт fn_enqueue_stage_generation, '
  'разбирает служебная роль (заход Q2). Строка НЕ удаляется по завершении: '
  'учитель уходит и возвращается, и должен увидеть, чем кончилось. '
  'Миграция 247.';

-- ── Правила доступа ────────────────────────────────────────────────────────
ALTER TABLE public.lesson_stage_gen_queue ENABLE ROW LEVEL SECURITY;

-- Учитель видит СВОИ заказы. Чужие — нет: очередь общая на базу, а «своё» —
-- это то, что он сам поставил.
DROP POLICY IF EXISTS "teacher reads own stage gen queue" ON public.lesson_stage_gen_queue;
CREATE POLICY "teacher reads own stage gen queue"
  ON public.lesson_stage_gen_queue
  FOR SELECT
  USING (
    (requested_by = public.current_teacher_id() AND school_id = public.current_school_id())
    OR public.is_super_admin()
  );

-- Правил на INSERT/UPDATE/DELETE нет НАМЕРЕННО. Кладёт функция ниже (она
-- SECURITY DEFINER), разбирает служебная роль — ей правила не писаны.

-- ── Права ──────────────────────────────────────────────────────────────────
REVOKE ALL ON public.lesson_stage_gen_queue FROM PUBLIC;
REVOKE ALL ON public.lesson_stage_gen_queue FROM anon;
REVOKE ALL ON public.lesson_stage_gen_queue FROM authenticated;
GRANT SELECT ON public.lesson_stage_gen_queue TO authenticated;

-- ── Заказ ──────────────────────────────────────────────────────────────────
--
-- Возвращает jsonb: batch_id, сколько поставлено, сколько пропущено. Молчать
-- о пропущенных нельзя — человек выбрал десять уроков, а поставилось восемь,
-- и он должен знать почему.
CREATE OR REPLACE FUNCTION public.fn_enqueue_stage_generation(p_lesson_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_teacher uuid;
  v_batch   uuid := gen_random_uuid();
  v_asked   integer;
  v_queued  integer;
BEGIN
  -- Учитель берётся ИЗ СЕССИИ, а не из довода: подделать его неоткуда.
  v_teacher := public.current_teacher_id();
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'Ставить уроки в очередь может только учитель';
  END IF;

  v_asked := coalesce(array_length(p_lesson_ids, 1), 0);
  IF v_asked = 0 THEN
    RAISE EXCEPTION 'Не выбрано ни одного урока';
  END IF;

  INSERT INTO public.lesson_stage_gen_queue AS q
    (lesson_id, school_id, requested_by, batch_id, status, topic)
  SELECT l.id, l.school_id, v_teacher, v_batch, 'queued',
         -- Ровно так же, как одиночное окно: тема урока, а если её нет —
         -- название. Придумывать своё правило здесь было бы вторым источником.
         coalesce(l.topic, l.title)
    FROM public.lessons l
   WHERE l.id = ANY (p_lesson_ids)
     -- Настоящий урок И свой: чужую группу в очередь не поставить.
     AND public.is_my_teacher_group(l.group_id)
  ON CONFLICT (lesson_id) DO UPDATE
    SET batch_id     = EXCLUDED.batch_id,
        requested_by = EXCLUDED.requested_by,
        status       = 'queued',
        attempts     = 0,
        last_error   = NULL,
        enqueued_at  = now(),
        started_at   = NULL,
        finished_at  = NULL,
        topic        = EXCLUDED.topic
    -- Бегущую строку не трогаем: разборщик уже платит за неё деньги, и
    -- сбрасывать её в 'queued' значило бы заплатить второй раз.
    WHERE q.status <> 'running';

  GET DIAGNOSTICS v_queued = ROW_COUNT;

  RETURN jsonb_build_object(
    'batch_id', v_batch,
    'queued',   v_queued,
    'skipped',  v_asked - v_queued
  );
END;
$function$;

COMMENT ON FUNCTION public.fn_enqueue_stage_generation(uuid[]) IS
  'Ставит уроки в очередь на наполнение этапами. Учитель берётся из сессии '
  '(current_teacher_id), уроки — только свои (is_my_teacher_group). Один урок '
  '— одна строка: повторный заказ возвращает существующую в queued, кроме той, '
  'что уже в работе. Отдаёт batch_id, сколько поставлено и сколько пропущено. '
  'Миграция 247.';

REVOKE ALL ON FUNCTION public.fn_enqueue_stage_generation(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_enqueue_stage_generation(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_enqueue_stage_generation(uuid[]) TO authenticated;

COMMIT;

-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ:
--
--   -- таблица и её ограничение статусов:
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='lesson_stage_gen_queue'
--    ORDER BY ordinal_position;
--
--   -- права: у authenticated РОВНО SELECT, у anon НИ ОДНОГО
--   SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type)
--     FROM information_schema.role_table_grants
--    WHERE table_schema='public' AND table_name='lesson_stage_gen_queue'
--    GROUP BY grantee ORDER BY grantee;
--
--   -- правило чтения одно, правил записи нет ни одного:
--   SELECT polname, polcmd FROM pg_policy
--    WHERE polrelid = 'public.lesson_stage_gen_queue'::regclass;
--
-- ЧТО ПРОВЕРЕНО ПРОГОНОМ С ОТКАТОМ (03.09.2026; числа — в журнале решений):
--   * учитель кладёт свои уроки — строки появляются, batch_id один на заказ
--   * учитель видит свои строки и НЕ видит чужие
--   * повторный заказ того же урока не плодит дубль (строк столько же)
--   * чужой урок в очередь не попадает — считается пропущенным
--   * прямой INSERT учителем отбивается: права на запись у него нет
--   * служебная роль видит все строки
--   * ни одного обращения к модели: разборщика в Q1 нет вовсе
