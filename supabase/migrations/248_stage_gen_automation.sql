-- Миграция 248: очередь наполнения разбирается сама. Плюс управление ею.
--
-- Заходы Q3 и Q4, слитые в одну миграцию по решению заказчика 03.09.2026:
-- Q4 без Q3 бесполезен (отменять нечего, пока никто не разбирает), Q3 без Q4
-- неудобен (пачка идёт, а остановить её нечем).
--
-- ═══ ЧТО ЗДЕСЬ ════════════════════════════════════════════════════════════
--
--   1. расширение pg_net — база впервые ходит по сети;
--   2. fn_kick_stage_gen_queue — будильник: дёргает наш маршрут разбора;
--   3. расписание, раз в пять минут;
--   4. fn_cancel_stage_gen_batch и fn_retry_stage_gen_lesson — отмена и повтор;
--   5. fn_prune_cron_history — уборка журнала заданий;
--   6. расписание уборки, раз в сутки.
--
-- ═══ ПОЧЕМУ РАЗ В ПЯТЬ МИНУТ ══════════════════════════════════════════════
--
-- Замер 03.09.2026 на живом уроке: 26 секунд у модели, 30–37 секунд на разбор
-- одной строки целиком. Один урок за вызов — это решено в Q2 и не меняется:
-- потолок функции 300 секунд, а 37 секунд был удачный случай (одна картинка,
-- одна попытка); шесть картинок и три попытки уложатся впритык.
--
-- Пять минут дают двадцать уроков за час сорок. Минута дала бы двадцать минут,
-- но это 1440 пробуждений в сутки — при пустой очереди они почти бесплатны
-- (проверка идёт без сети, см. ниже), и всё же это шум в журнале заданий,
-- который и без нас распух до 182 тысяч строк.
--
-- ═══ РАСШИРЕНИЕ pg_net: ЧТО ДАЁТ, ЧЕМ РИСКУЕМ, КАК СНЯТЬ ══════════════════
--
-- ДАЁТ. Асинхронные запросы наружу прямо из базы: net.http_post отдаёт номер
-- запроса сразу и не ждёт ответа. Без него база не может позвать наш маршрут,
-- а расписание Vercel на бесплатном тарифе ходит не чаще раза в сутки — при
-- ста минутах на двадцать уроков это растянулось бы на недели.
--
-- ЧЕМ РИСКУЕМ. Поднимается фоновый рабочий процесс и две таблицы в схеме net:
-- http_request_queue и _http_response. Владельцем расширения становится
-- supabase_admin — то же, что у pg_cron и vault. Проверено прогоном с откатом
-- 03.09.2026: CREATE EXTENSION под ролью postgres проходит, версия 0.20.3,
-- после отката следов не остаётся.
--
-- КАК СНЯТЬ, если не пойдёт:
--
--   SELECT cron.unschedule('stage-gen-drain');
--   DROP EXTENSION pg_net;
--
-- Снятие на живой базе НЕ ПРОБОВАЛ — проверено только создание с откатом.
--
-- ═══ АДРЕС И СЕКРЕТ — В ХРАНИЛИЩЕ, А НЕ ЗДЕСЬ ═════════════════════════════
--
-- В этой миграции их НЕТ и быть не может: секрет в git класть нельзя, а адрес
-- может смениться, миграция же вечна. Оба лежат в vault под именами
-- `stage_gen_cron_url` и `stage_gen_cron_secret`; заказчик кладёт их сам,
-- двумя строками (они в журнале решений и в шапке функции ниже).
--
-- Пока их нет, задание просыпается, ничего не находит и предупреждает в
-- журнал. Это намеренно: молчащее задание неотличимо от работающего.
--
-- ═══ ЧТО ПРОВЕРЕНО СУХИМ ПРОГОНОМ 03.09.2026 ══════════════════════════════
--
-- Вся миграция целиком прогонялась на живой базе в транзакции с откатом.
-- Прошла, и после отката не осталось ни расширения, ни заданий, ни функций.
-- Заодно проверено по одному действию:
--
--   * заданий стало семь: пять прежних не тронуты ни одним словом;
--   * все четыре функции — SECURITY DEFINER с search_path=public;
--   * права: anon не может звать НИ ОДНУ; authenticated — только отмену и
--     повтор; будильник и уборка не достаются никому, кроме расписания;
--   * пустая очередь — в сеть не пошёл (net.http_request_queue как был 0);
--   * очередь есть, секретов нет — предупредил и в сеть не пошёл;
--   * лежит только адрес, секрета нет — предупредил и в сеть не пошёл;
--   * отмена и повтор от имени не-учителя — отказ внятным текстом;
--   * уборка журнала убрала бы 95 597 строк из 182 102.
--
-- Запросов наружу за весь прогон — НОЛЬ. Вызовов модели — ноль.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ── 1. Расширение ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── 2. Будильник ───────────────────────────────────────────────────────────
--
-- Зовёт /api/cron/stage-gen-process. Сам ничего не разбирает: вся работа —
-- в маршруте, потому что там живут и модель, и вставка этапов.
CREATE OR REPLACE FUNCTION public.fn_kick_stage_gen_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url    text;
  v_secret text;
  v_req    bigint;
BEGIN
  -- ПУСТАЯ ОЧЕРЕДЬ — В СЕТЬ НЕ ХОДИМ ВОВСЕ. Решение заказчика. Проверка
  -- стоит первой и стоит один индексный поиск: у очереди есть частичный
  -- индекс по status='queued'.
  --
  -- Условие только по status, без attempts: строка со списанной второй
  -- попыткой становится 'failed', а не остаётся 'queued', — значит «queued»
  -- уже означает «попытки есть». Второй копии числа попыток здесь нет
  -- намеренно: она живёт в разборщике (STAGE_GEN_MAX_ATTEMPTS) и должна
  -- жить в одном месте.
  IF NOT EXISTS (
    SELECT 1 FROM public.lesson_stage_gen_queue WHERE status = 'queued'
  ) THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'stage_gen_cron_url';
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'stage_gen_cron_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    -- WARNING, а не NOTICE: у pg_cron log_min_messages = warning, и notice в
    -- журнал не попал бы. Молчащее задание неотличимо от работающего, а тут
    -- разница ровно в этом — очередь есть, разбирать её некому.
    RAISE WARNING 'Наполнение этапов: в хранилище нет % — задание ничего не делает',
      CASE WHEN v_url IS NULL THEN 'адреса (stage_gen_cron_url)'
           ELSE 'секрета (stage_gen_cron_secret)' END;
    RETURN;
  END IF;

  -- timeout_milliseconds = 300000 — тот же потолок, что у самого маршрута
  -- (maxDuration = 300). Умолчание pg_net — 5 секунд, и его хватило бы
  -- только на то, чтобы оборвать соединение посреди генерации: разбор одной
  -- строки идёт 30–37 секунд. Обрыв на середине вставки оставил бы урок с
  -- половиной этапов, а деньги за вызов модели были бы уже потрачены.
  --
  -- Значение принимается: миграция целиком прошла сухим прогоном с откатом
  -- 03.09.2026, функция создалась. А вот СОБЛЮДАЕТ ли pg_net такой предел на
  -- деле — НЕ ПРОВЕРЕНО: чтобы это увидеть, нужен настоящий запрос наружу, а
  -- в этом заходе их ноль. Если окажется, что он режет раньше, это будет
  -- видно по timed_out в net._http_response.
  SELECT net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/stage-gen-process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    timeout_milliseconds := 300000
  ) INTO v_req;
END;
$function$;

COMMENT ON FUNCTION public.fn_kick_stage_gen_queue() IS
  'Будильник очереди наполнения: раз в пять минут дёргает '
  '/api/cron/stage-gen-process, если в очереди есть ждущие строки. Адрес и '
  'секрет берёт из vault (stage_gen_cron_url, stage_gen_cron_secret) — в '
  'миграции их нет намеренно. Пустая очередь — в сеть не ходит. Миграция 248.';

-- ── 3. Отмена пачки ────────────────────────────────────────────────────────
--
-- СНИМАЕТСЯ ТОЛЬКО НЕЗАПУЩЕННОЕ. Строка в состоянии 'running' уже стоит денег:
-- разборщик её взял, модель считает, прервать вызов нельзя. Такая добежит и
-- станет 'done' или 'failed' — это решение заказчика, а не упрощение.
CREATE OR REPLACE FUNCTION public.fn_cancel_stage_gen_batch(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_teacher  uuid;
  v_canceled integer;
  v_running  integer;
BEGIN
  -- Учитель — из сессии, не из довода: подделать неоткуда.
  v_teacher := public.current_teacher_id();
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'Отменять очередь может только учитель';
  END IF;

  SELECT count(*) INTO v_running
    FROM public.lesson_stage_gen_queue
   WHERE batch_id = p_batch_id AND requested_by = v_teacher AND status = 'running';

  UPDATE public.lesson_stage_gen_queue
     SET status = 'canceled', finished_at = now()
   WHERE batch_id = p_batch_id
     AND requested_by = v_teacher
     AND status = 'queued';
  GET DIAGNOSTICS v_canceled = ROW_COUNT;

  -- Строка НЕ удаляется: след того, что человек заказал и передумал, должен
  -- остаться (решение заказчика 02.09.2026, миграция 247).
  RETURN jsonb_build_object('canceled', v_canceled, 'running', v_running);
END;
$function$;

COMMENT ON FUNCTION public.fn_cancel_stage_gen_batch(uuid) IS
  'Снимает с очереди незапущенные строки пачки. Начатое (running) не трогает: '
  'вызов модели уже идёт и деньги за него потрачены. Строки не удаляются, '
  'переходят в canceled. Только свои. Миграция 248.';

-- ── 4. Повтор после ошибки ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_retry_stage_gen_lesson(p_lesson_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_teacher uuid;
  v_reset   integer;
BEGIN
  v_teacher := public.current_teacher_id();
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'Повторять наполнение может только учитель';
  END IF;

  -- Сбрасываем счётчик у КОНКРЕТНОЙ строки, и только у той, что уже сдалась.
  -- Бегущую и сделанную не трогаем: первая ещё считается, вторая уже стоила
  -- денег, и «повторить» для неё означало бы заплатить второй раз молча.
  UPDATE public.lesson_stage_gen_queue
     SET status      = 'queued',
         attempts    = 0,
         last_error  = NULL,
         enqueued_at = now(),
         started_at  = NULL,
         finished_at = NULL
   WHERE lesson_id = p_lesson_id
     AND requested_by = v_teacher
     AND status IN ('failed', 'canceled');
  GET DIAGNOSTICS v_reset = ROW_COUNT;

  RETURN jsonb_build_object('queued', v_reset);
END;
$function$;

COMMENT ON FUNCTION public.fn_retry_stage_gen_lesson(uuid) IS
  'Возвращает в очередь одну сдавшуюся строку: attempts обнуляется, ошибка '
  'стирается. Берёт только failed и canceled — running ещё считается, done '
  'уже стоила денег. Только свои. Миграция 248.';

-- ── 5. Уборка журнала заданий ──────────────────────────────────────────────
--
-- НЕ НАША БЕДА, НО ЗАМЕТИЛИ ЕЁ МЫ. В cron.job_run_details на 03.09.2026 лежало
-- 182 072 строки, накопленных с 23.06 — их пишут два задания, ходящие каждую
-- минуту, и никто их не подчищает. Проверено прогоном с откатом: строк старше
-- тридцати дней — 95 569, и удалить их роль postgres может.
--
-- Тридцать дней выбраны так, чтобы месячная история оставалась: именно она
-- нужна, когда разбираешься, почему задание не сработало на прошлой неделе.
CREATE OR REPLACE FUNCTION public.fn_prune_cron_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM cron.job_run_details WHERE end_time < now() - interval '30 days';
END;
$function$;

COMMENT ON FUNCTION public.fn_prune_cron_history() IS
  'Убирает из cron.job_run_details записи старше тридцати дней. Таблица растёт '
  'на ~3 тысячи строк в сутки от заданий, ходящих каждую минуту, и до этой '
  'миграции не чистилась вовсе. Миграция 248.';

-- ── 6. Права ───────────────────────────────────────────────────────────────
--
-- СНАЧАЛА ОТОБРАТЬ, ПОТОМ ВЫДАТЬ — приём из миграций 235 и 238: на схему
-- public в Supabase стоят ALTER DEFAULT PRIVILEGES, и новая функция сразу
-- получает anon и authenticated. Будильнику и уборке это не нужно вовсе.
REVOKE ALL ON FUNCTION public.fn_kick_stage_gen_queue()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_prune_cron_history()    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.fn_cancel_stage_gen_batch(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_retry_stage_gen_lesson(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cancel_stage_gen_batch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_retry_stage_gen_lesson(uuid) TO authenticated;

-- ── 7. Расписание ──────────────────────────────────────────────────────────
--
-- cron.schedule по имени идемпотентна: повторное применение миграции не
-- заведёт второе задание, а перепишет существующее.
--
-- Существующие пять заданий не тронуты ни одним словом.
--
-- Время у pg_cron — GMT (cron.timezone = GMT). Для «раз в пять минут» это
-- безразлично; уборка поставлена на 21:50 GMT, то есть 02:50 по Ташкенту, —
-- в стороне от 0 2 * * *, где уже стоит чистка объявлений.
SELECT cron.schedule('stage-gen-drain',      '*/5 * * * *', 'SELECT public.fn_kick_stage_gen_queue()');
SELECT cron.schedule('prune-cron-history',   '50 21 * * *', 'SELECT public.fn_prune_cron_history()');

COMMIT;

-- ═══ ПОСЛЕ ПРИМЕНЕНИЯ — ДВЕ СТРОКИ ДЛЯ ХРАНИЛИЩА ══════════════════════════
--
-- Выполнить ОДИН раз, вручную. В миграцию они не входят намеренно: секрет не
-- должен попасть в git, а адрес может смениться.
--
--   SELECT vault.create_secret(
--     'https://eduos.snruz.uz', 'stage_gen_cron_url',
--     'Адрес прода для будильника очереди наполнения (миграция 248)');
--
--   SELECT vault.create_secret(
--     'ЗДЕСЬ_ЗНАЧЕНИЕ_CRON_SECRET', 'stage_gen_cron_secret',
--     'Секрет крон-маршрутов для будильника очереди (миграция 248)');
--
-- Значение секрета — то же, что в CRON_SECRET на Vercel. Поменяете там —
-- поменяйте и здесь: vault.update_secret(id, 'новое значение').
--
-- ═══ ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ ════════════════════════════════════════════
--
--   -- расширение стоит:
--   SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_net';
--
--   -- задания на месте, всего семь (пять прежних + два наших):
--   SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;
--
--   -- секреты положены:
--   SELECT name FROM vault.decrypted_secrets ORDER BY name;
--
--   -- КАК ПОНЯТЬ, ЧТО ЗАДАНИЕ ХОДИЛО. Две таблицы, и они отвечают на разные
--   -- вопросы:
--   --
--   -- 1) «просыпалось ли оно вообще» — cron.job_run_details. Строка появляется
--   --    на КАЖДОЕ пробуждение, даже когда очередь пуста и в сеть не ходили:
--   SELECT start_time, status, return_message
--     FROM cron.job_run_details
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'stage-gen-drain')
--    ORDER BY start_time DESC LIMIT 10;
--
--   -- 2) «ходило ли оно в сеть и что ответили» — net._http_response. Строка
--   --    появляется ТОЛЬКО когда очередь была непуста:
--   SELECT id, status_code, timed_out, error_msg, created
--     FROM net._http_response ORDER BY created DESC LIMIT 10;
--
--   -- ОТСЮДА И РАЗЛИЧИЕ, о котором спрашивал заказчик:
--   --   строка в job_run_details есть, в _http_response нет  → сходило, очередь была пуста
--   --   строки нет ни там, ни там                            → не сходило вовсе (задание не активно)
--   --   есть обе, status_code = 200                          → сходило и разобрало
--   --   есть обе, timed_out = true или error_msg заполнен    → маршрут не ответил
--
-- ИЗВЕСТНОЕ ОГРАНИЧЕНИЕ. net._http_response подчищает сам pg_net по своему
-- сроку жизни. Значит вчерашние ответы там не найти, и если маршрут лежал час
-- позавчера — следа не осталось. Точное значение срока на этой базе не
-- проверял: расширение до этой миграции не стояло. Заводить ради этого свою
-- таблицу не стали — очередь и так рассказывает главное: строка, которую не
-- разобрали, осталась в 'queued' и будет взята следующим пробуждением.
