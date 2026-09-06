-- ============================================================================
-- Миграция 273: право исполнения отозвано у анонима. НЕ ПРИМЕНЕНА.
-- ============================================================================
--
-- ═══ ЧТО СЛОМАНО ═══════════════════════════════════════════════════════════
--
-- Роль `anon` — это НЕВОШЕДШИЙ человек с публичным ключом, который лежит
-- открытым текстом в браузере у каждого посетителя. Ей открыты 94 наши
-- функции: 49 триггерных и 45 вызываемых, из них 9 пишут в таблицы.
--
-- Никто их анониму не открывал. Явный `GRANT ... TO anon` в миграциях есть
-- только у ЧЕТЫРЁХ функций из шестидесяти девяти SECURITY DEFINER. Остальные
-- 65 открылись САМИ из `ALTER DEFAULT PRIVILEGES` на схему public.
--
-- ═══ ЧЕМ ДОКАЗАНО ══════════════════════════════════════════════════════════
--
-- Замер 06.09.2026, публичным ключом, без всякой сессии:
--
--   POST /rest/v1/rpc/zzz_no_such_function   -> 404 PGRST202
--        (маршрутизатор дошёл; это не 401 и не 403 — преграды нет)
--   POST /rest/v1/rpc/get_current_user_role  -> 200  null
--        (функция ИСПОЛНИЛАСЬ; null потому, что сессии нет)
--   POST /rest/v1/rpc/fn_storage_rel {…}     -> 200  "teachers/x.png"
--        (функция с аргументом исполнилась и вернула настоящий ответ)
--
-- Разбор всех путей до входа: анониму НЕ НУЖНА НИ ОДНА функция базы. Экран
-- входа, вход родителя по телефону, вход через Google, демо-вход, публичные
-- маршруты — каждый вызов идёт либо служебным ключом, либо уже после выдачи
-- сессии. Анонимному ключу остаются только эндпоинты GoTrue, а это не функции
-- базы.
--
-- ═══ ПОЧЕМУ REVOKE ИДЁТ И ОТ PUBLIC ═══════════════════════════════════════
--
-- У ОДИННАДЦАТИ функций ниже право выдано ещё и роли PUBLIC. Отзыв только
-- у `anon` их бы не закрыл: право вернулось бы другим путём, и проба показала
-- бы «закрыто», а дыра осталась. Поэтому каждая строка отзывает у PUBLIC
-- тоже. Где гранта PUBLIC нет, это холостое действие, а не ошибка.
--
-- `service_role` НЕ ЗАДЕТ: у всех девятнадцати он держит EXECUTE ЯВНЫМ
-- грантом, а не через PUBLIC — проверено поимённо. Серверный код, который
-- зовёт шестнадцать функций служебным ключом, продолжает работать.
--
-- Задания pg_cron идут под ролью `postgres` — владельцем функций (проверено
-- по cron.job.username, все семь). Отзыв у браузерных ролей их не касается,
-- и ежемесячное выставление счетов продолжит работать по расписанию.
--
-- ═══ ЧЕГО ЭТА МИГРАЦИЯ НЕ ДЕЛАЕТ ═══════════════════════════════════════════
--
-- ⚠️ ПРИЧИНА НЕ ВЫЛЕЧЕНА. `ALTER DEFAULT PRIVILEGES` на схему public остаются
-- как есть — их правка обсуждается отдельно. Значит:
--
--     КАЖДАЯ БУДУЩАЯ МИГРАЦИЯ, ЗАВОДЯЩАЯ ФУНКЦИЮ, ОБЯЗАНА ОТЗЫВАТЬ ПРАВО
--     ПОИМЁННО — REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated;
--     и только потом выдавать нужное. Забыли строку — функция открылась
--     анониму молча.
--
-- Это уже записано в шапке миграции 238 словами «ЭТО ТРЕТИЙ РАЗ, КОГДА ОНО
-- КУСАЕТСЯ». Теперь четвёртый.
--
-- Сигнатуры функций НЕ МЕНЯЮТСЯ. У денежных `p_school_id uuid DEFAULT NULL`
-- остаётся: умолчание нужно крону, он зовёт их без аргументов по всем школам.
-- Ни одного DROP, ни одного CREATE OR REPLACE — только REVOKE.
--
-- Права на таблицы (TRUNCATE, REFERENCES, TRIGGER) здесь не трогаются вовсе —
-- отдельный заход.
--
-- ═══ КОГО НЕ ТРОГАЕМ И ПОЧЕМУ ══════════════════════════════════════════════
--
-- Из 45 вызываемых в этот файл попали 19. Остальные 26 оставлены намеренно:
--
--   16 зовутся ВНУТРИ ПРАВИЛ ДОСТУПА на таблицах, доступных этим ролям
--      (is_my_group, is_my_teacher_group, fn_is_admin, current_student_id
--      и другие). Правило исполняется правами вызывающего: отними право —
--      и запрос вернёт не пустой список, а отказ.
--   2  зовутся в правилах на storage.objects: fn_storage_rel и
--      fn_storage_path_visible. Отзыв закрыл бы доступ к файлам.
--   8  в списке «трогать нельзя» из разведки: is_super_admin и
--      sa_write_allowed (RESTRICTIVE-правило миграции 222 на каждой пишущей
--      таблице), current_school_id (умолчание на 60 колонках),
--      fn_new_payment_public_no (умолчание колонки), admin_name (вычисляемое
--      поле PostgREST), check_user_session, fn_lesson_materials_to_kb,
--      fn_drop_direct_chat_participation, fn_direct_chat_still_linked
--      (триггерные цепочки в контексте INVOKER — права спрашиваются
--      у вошедшего). Девятая из этого списка, admin_name, анониму УЖЕ
--      закрыта миграцией 198 и потому в число 45 не входит.
--
-- Арифметика сходится: 19 в файле + 16 в правилах + 2 на storage + 8
-- неприкасаемых = 45 вызываемых, открытых анониму.
--
-- Триггерные функции (49) не трогаются: PostgREST их наружу не пускает,
-- а Postgres проверяет EXECUTE в момент CREATE TRIGGER, а не при срабатывании.
--
-- ═══ НЕ ПРИМЕНЕНА ══════════════════════════════════════════════════════════
--
-- Файл коммитится, применяет человек через Dashboard. Что проверить после
-- применения — в resheniya_3.md, запись от 06.09.2026.
-- ============================================================================

BEGIN;

-- ── 1. ДЕНЬГИ. Отзыв у обеих браузерных ролей ───────────────────────────────
--
-- Обе SECURITY DEFINER, обе БЕЗ ЕДИНОЙ ПРОВЕРКИ ЛИЧНОСТИ в теле: ни
-- auth.uid(), ни current_school_id(), ни сверки роли. И аргумент по умолчанию
-- NULL означает ВСЕ ШКОЛЫ — цикл идёт по schools WHERE is_active.
--
-- Зовутся только из apps/web/lib/admin-payments.ts служебным ключом и кроном
-- под postgres. Ни ученику, ни родителю, ни учителю они не нужны.

-- Выставляет счета за месяц: пишет в tuition_invoices.
REVOKE EXECUTE ON FUNCTION public.fn_issue_monthly_invoices(uuid) FROM PUBLIC, anon, authenticated;

-- Гасит счета с баланса: пишет в balance_entries и переводит счета в paid.
REVOKE EXECUTE ON FUNCTION public.fn_settle_open_invoices(uuid) FROM PUBLIC, anon, authenticated;

-- ── 2. ПРОЧИЕ ПИШУЩИЕ. Отзыв у обеих браузерных ролей ───────────────────────

-- Счётчик расхода на модель. Зовётся из lib/ai/gemini-client.ts служебным ключом.
REVOKE EXECUTE ON FUNCTION public.increment_ai_usage() FROM PUBLIC, anon, authenticated;

-- Освобождение демо-места. Зовётся из app/actions/auth.ts и api/demo/* служебным ключом.
REVOKE EXECUTE ON FUNCTION public.release_demo_slot(text) FROM PUBLIC, anon, authenticated;

-- Продление демо-аренды. Зовётся из api/demo/heartbeat служебным ключом.
REVOKE EXECUTE ON FUNCTION public.heartbeat_demo_slot(text) FROM PUBLIC, anon, authenticated;

-- Отметка живости сессии. В коде вызывающих НЕТ ни одного — мёртвый грант.
REVOKE EXECUTE ON FUNCTION public.touch_user_session() FROM PUBLIC, anon, authenticated;

-- ── 3. ПИШУЩАЯ, отзыв только у анонима ──────────────────────────────────────

-- Разлёт уведомления об оценке. Зовётся из fn_homework_grade_notify и
-- fn_test_grade_notify — обе SECURITY DEFINER, права вошедшего не спрашивают.
-- У authenticated оставлено намеренно: запас на случай прямого вызова.
REVOKE EXECUTE ON FUNCTION public.fn_notify_student_grade(uuid, integer, text, uuid) FROM PUBLIC, anon;

-- ── 4. ЧИТАЮЩИЕ. Отзыв у обеих браузерных ролей ─────────────────────────────

-- Предпросмотр выставления счетов. Зовётся из lib/admin-payments.ts служебным ключом.
REVOKE EXECUTE ON FUNCTION public.fn_issue_preview(uuid) FROM PUBLIC, anon, authenticated;

-- Расход на модель за сегодня. Зовётся из api/ai/usage и экрана суперадмина, служебным ключом.
REVOKE EXECUTE ON FUNCTION public.get_ai_usage_today() FROM PUBLIC, anon, authenticated;

-- Занятость предметов в демо. В коде вызывающих НЕТ ни одного — мёртвый грант.
REVOKE EXECUTE ON FUNCTION public.get_occupied_teacher_subjects() FROM PUBLIC, anon, authenticated;

-- Признак роли менеджера. В правилах доступа не используется ни разу,
-- вызывающих в коде нет. Анониму и так закрыта — отзыв только у вошедшего.
REVOKE EXECUTE ON FUNCTION public.is_manager() FROM PUBLIC, authenticated;

-- ── 5. ЧИТАЮЩИЕ. Отзыв только у анонима ─────────────────────────────────────
--
-- У authenticated оставлены: часть зовётся из-под сессии, часть — из тел
-- других функций. Анониму не нужна ни одна.

-- Сколько вопросов помощнику задал ученик сегодня.
REVOKE EXECUTE ON FUNCTION public.fn_ai_messages_today(uuid) FROM PUBLIC, anon;

-- Ветка чата класса по группе. Зовётся из триггеров чатов, они SECURITY DEFINER.
REVOKE EXECUTE ON FUNCTION public.fn_class_thread_id(uuid) FROM PUBLIC, anon;

-- Занята ли почта. Зовётся из триггеров проверки уникальности, они SECURITY DEFINER.
REVOKE EXECUTE ON FUNCTION public.fn_email_is_taken(text, text, uuid) FROM PUBLIC, anon;

-- Занят ли логин. Тот же триггер уникальности.
REVOKE EXECUTE ON FUNCTION public.fn_login_is_taken(text, text, uuid) FROM PUBLIC, anon;

-- Роль вошедшего. Зовётся посредником ключом ВОШЕДШЕГО — у authenticated остаётся.
-- Анониму отвечает null, то есть не нужна ему вовсе.
REVOKE EXECUTE ON FUNCTION public.get_current_user_role() FROM PUBLIC, anon;

-- Окно правки отметок. Зовётся внутри fn_lock_teacher_marks, та SECURITY DEFINER.
REVOKE EXECUTE ON FUNCTION public.mark_edit_window() FROM PUBLIC, anon;

-- Текущий месяц школы. Зовётся внутри денежных функций, они SECURITY DEFINER.
REVOKE EXECUTE ON FUNCTION public.school_current_month(uuid) FROM PUBLIC, anon;

-- Школьное «сейчас». Зовётся внутри school_current_month, та SECURITY DEFINER.
REVOKE EXECUTE ON FUNCTION public.school_now(uuid) FROM PUBLIC, anon;

-- Поиск по векторам этапов. У ВОШЕДШЕГО ОСТАЁТСЯ ОБЯЗАТЕЛЬНО.
-- Зовётся КЛЮЧОМ ВОШЕДШЕГО, а не служебным: apps/web/app/api/ai/chat/route.ts:61
-- берёт клиент сессии (createClient из lib/supabase/server), и он же уходит в
-- buildRagContext -> rag-context.ts:120. Миграция 139 выдала право именно
-- authenticated (139:187), а тело отбирает строки по current_student_id() от
-- auth.uid() — под служебным ключом вернуло бы ноль строк. Отзыв у вошедшего
-- убил бы поиск по материалам МОЛЧА: rag-context.ts:126 глотает отказ и
-- возвращает пустой контекст.
REVOKE EXECUTE ON FUNCTION public.match_lesson_stage_embeddings(vector, integer) FROM PUBLIC, anon;

-- ── 6. Самопроверка ─────────────────────────────────────────────────────────
--
-- Отказ в правах не бросается сам: REVOKE несуществующего права проходит
-- молча. Поэтому проверяем результат, а не факт выполнения.
DO $$
DECLARE
  v_у_анонима      integer;
  v_у_вошедшего    integer;
  v_у_служебного   integer;
  v_нельзя_закрыты integer;
  v_оставлен_снят  integer;
  v_имя            text;

  -- Девятнадцать, у которых право отзывается у анонима.
  анон text[] := ARRAY[
    'fn_issue_monthly_invoices', 'fn_settle_open_invoices', 'increment_ai_usage',
    'release_demo_slot', 'heartbeat_demo_slot', 'touch_user_session',
    'fn_notify_student_grade', 'fn_issue_preview', 'get_ai_usage_today',
    'match_lesson_stage_embeddings', 'get_occupied_teacher_subjects',
    'fn_ai_messages_today', 'fn_class_thread_id', 'fn_email_is_taken',
    'fn_login_is_taken', 'get_current_user_role', 'mark_edit_window',
    'school_current_month', 'school_now'
  ];

  -- Одиннадцать, у которых право отзывается и у вошедшего.
  вошед text[] := ARRAY[
    'fn_issue_monthly_invoices', 'fn_settle_open_invoices', 'increment_ai_usage',
    'release_demo_slot', 'heartbeat_demo_slot', 'touch_user_session',
    'fn_issue_preview', 'get_ai_usage_today',
    'get_occupied_teacher_subjects', 'is_manager'
  ];

  -- Десять, у которых право отзывается ТОЛЬКО у анонима: вошедший обязан
  -- сохранить право. Каждая строка REVOKE отзывает и у PUBLIC, а PUBLIC —
  -- это способ раздачи, а не роль: если бы право вошедшего держалось только
  -- через него, отзыв снял бы его заодно и молча.
  оставлен text[] := ARRAY[
    'fn_notify_student_grade', 'fn_ai_messages_today', 'fn_class_thread_id',
    'fn_email_is_taken', 'fn_login_is_taken', 'get_current_user_role',
    'mark_edit_window', 'school_current_month', 'school_now',
    'match_lesson_stage_embeddings'
  ];

  -- Девять, которые обязаны остаться открытыми: на них держатся правила
  -- доступа, умолчания колонок и триггерные цепочки.
  нельзя text[] := ARRAY[
    'is_super_admin', 'sa_write_allowed', 'current_school_id',
    'fn_new_payment_public_no', 'admin_name', 'check_user_session',
    'fn_lesson_materials_to_kb', 'fn_drop_direct_chat_participation',
    'fn_direct_chat_still_linked'
  ];
BEGIN
  -- 1. У анонима не должно остаться ни одного права из списка.
  SELECT count(*) INTO v_у_анонима
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = ANY(анон)
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_у_анонима <> 0 THEN
    SELECT string_agg(p.proname, ', ') INTO v_имя
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY(анон)
       AND has_function_privilege('anon', p.oid, 'EXECUTE');
    RAISE EXCEPTION '273: у анонима осталось право на % функций: %. Скорее всего право выдано роли PUBLIC и REVOKE его не снял', v_у_анонима, v_имя;
  END IF;

  -- 2. У вошедшего не должно остаться ни одного права из своего списка.
  SELECT count(*) INTO v_у_вошедшего
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = ANY(вошед)
     AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
  IF v_у_вошедшего <> 0 THEN
    SELECT string_agg(p.proname, ', ') INTO v_имя
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY(вошед)
       AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
    RAISE EXCEPTION '273: у вошедшего осталось право на % функций: %', v_у_вошедшего, v_имя;
  END IF;

  -- 3. Служебный ключ ОБЯЗАН сохранить право на все девятнадцать: на нём
  --    держится весь серверный код и оба денежных вызова из админки.
  SELECT count(*) INTO v_у_служебного
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = ANY(анон)
     AND has_function_privilege('service_role', p.oid, 'EXECUTE');
  IF v_у_служебного <> array_length(анон, 1) THEN
    RAISE EXCEPTION '273: служебный ключ потерял право — осталось % из %. Серверный код сломан', v_у_служебного, array_length(анон, 1);
  END IF;

  -- 4. Девять «трогать нельзя» обязаны остаться открытыми вошедшему.
  SELECT count(*) INTO v_нельзя_закрыты
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = ANY(нельзя)
     AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE');
  IF v_нельзя_закрыты <> 0 THEN
    RAISE EXCEPTION '273: закрыто % функций из списка «трогать нельзя» — сломаются правила доступа или умолчания колонок', v_нельзя_закрыты;
  END IF;

  -- 5. У десяти, где вошедший оставлен намеренно, право обязано уцелеть.
  --    Без этой проверки отзыв у PUBLIC мог бы снять его молча, а миграция
  --    отрапортовала бы успех. Самый чувствительный тут —
  --    match_lesson_stage_embeddings: его отказ поиск по материалам глотает.
  SELECT count(*) INTO v_оставлен_снят
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = ANY(оставлен)
     AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE');
  IF v_оставлен_снят <> 0 THEN
    SELECT string_agg(p.proname, ', ') INTO v_имя
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY(оставлен)
       AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE');
    RAISE EXCEPTION '273: у вошедшего ПРОПАЛО право на % функций, которые обещано оставить: %. Скорее всего оно держалось через PUBLIC', v_оставлен_снят, v_имя;
  END IF;

  RAISE NOTICE '273: у анонима отозвано 19, у вошедшего 10; служебный ключ цел, девять неприкасаемых и десять оставленных вошедшему открыты';
END $$;

COMMIT;
