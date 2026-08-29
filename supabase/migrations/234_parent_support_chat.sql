-- Миграция 234 — комната поддержки родитель↔школа.
--
-- ЗАЧЕМ. Раздел «Поддержка» в приложении родителя сегодня — витрина «Скоро».
-- Заказчик решил: родитель пишет в поддержку и попадает к админам СВОЕЙ школы.
-- Комната одна на родителя, отвечает любой свободный админ — не пара с
-- конкретным человеком: у боевой школы админов трое, и выбирать, к кому идти,
-- родитель не должен, а уход одного не должен осиротить переписку.
--
-- ЧТО УЖЕ РАБОТАЕТ И НЕ ТРОГАЕТСЯ. Проверено чтением живых правил доступа
-- (pg_policies, 29.08.2026) — НИ ОДНО из них не смотрит на kind:
--
--   chat_threads   SELECT: is_my_thread(id) OR is_super_admin()
--                          OR (school_id = current_school_id() AND fn_is_admin())
--   chat_messages  SELECT: is_my_thread(thread_id) OR is_super_admin()
--                          OR (fn_is_admin() AND school_id = current_school_id())
--   chat_messages  INSERT: is_my_thread(thread_id) AND sender_id = auth.uid()
--
-- Значит новый вид чата виден и пишется существующими правилами как есть:
--   * родитель и админ — участники, поэтому читают и пишут;
--   * админ школы вдобавок читает всё по своей школе (миграция 142);
--   * УЧИТЕЛЬ не читает ничего: он не участник, fn_is_admin() у него ложно,
--     is_super_admin() ложно — комната поддержки вернёт ему ноль строк.
-- Ни одной политики эта миграция не меняет. Это было главным условием.
--
-- ПОЧЕМУ ФУНКЦИЯ, А НЕ ЗАПРОС ИЗ ПРИЛОЖЕНИЯ. Родитель не может завести
-- комнату сам: в правиле INSERT на chat_threads родительской ветки нет вовсе
-- (есть суперадмин, админ школы и учитель), и в правиле INSERT на
-- chat_participants её тоже нет. Поэтому комнату собирает SECURITY DEFINER —
-- ровно так же, как личные чаты ученик↔учитель собирает fn_ensure_direct_chat.
--
-- ЧЕМ ЭТА ФУНКЦИЯ БЕЗОПАСНЕЕ fn_ensure_direct_chat. Та принимала два
-- произвольных идентификатора и не проверяла, кто зовёт, — миграция 223
-- закрыла её от anon и authenticated именно за это. Здешняя НЕ ПРИНИМАЕТ
-- АРГУМЕНТОВ вовсе: и родителя, и школу она берёт из auth.uid(). Позвавший
-- получает свою собственную комнату и ничью больше; кто не родитель —
-- получает NULL и не создаёт ничего. Поэтому право выполнения выдаётся
-- authenticated, а PUBLIC и anon отзываются — режим 223 сохранён.
--
-- ЗАГОЛОВОК КОМНАТЫ — ИМЯ РОДИТЕЛЯ, И ТОЛЬКО ОНО. Русских литералов в теле
-- функции нет НИ ОДНОГО намеренно: миграции 81/206/233 в этом проекте — это
-- три захода на один и тот же испорченный при сохранении русский текст внутри
-- функции. Имя приезжает из parents.full_name, то есть из данных, а не из
-- исходника. Опорная связь всё равно не заголовок, а parent_id: по нему
-- приложение и находит комнату, и берёт актуальное имя.

-- ── 1. НОВЫЙ ВИД ЧАТА ────────────────────────────────────────────────
-- Только добавление значения. Существующие group/direct/admin_ai остаются
-- как были, ни одна строка не переписывается.
ALTER TABLE public.chat_threads DROP CONSTRAINT IF EXISTS chat_threads_kind_check;
ALTER TABLE public.chat_threads
  ADD CONSTRAINT chat_threads_kind_check
  CHECK (kind IN ('group', 'direct', 'admin_ai', 'support'));

-- ── 2. ЧЬЯ КОМНАТА ───────────────────────────────────────────────────
-- Той же формы, что уже существующие student_id / teacher_id / group_id:
-- необязательная ссылка на участника-хозяина. Уникальность частичная —
-- у одного родителя ровно одна комната поддержки, на остальные виды чата
-- ограничение не распространяется.
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.parents(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS chat_threads_support_parent_unique_idx
  ON public.chat_threads (parent_id) WHERE kind = 'support';

-- ── 3. СБОРКА КОМНАТЫ ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_ensure_support_thread()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_parent_id  uuid;
  v_school_id  uuid;
  v_user_id    uuid;
  v_title      text;
  v_thread_id  uuid;
BEGIN
  -- Ни одного аргумента: кто зовёт, тот и получает свою комнату.
  SELECT p.id, p.school_id, p.user_id, p.full_name
    INTO v_parent_id, v_school_id, v_user_id, v_title
    FROM public.parents p
   WHERE p.user_id = auth.uid();

  -- Позвал не родитель — молча ничего. Не ошибка: функция открыта роли
  -- authenticated, и «не тот позвал» не повод падать.
  IF v_parent_id IS NULL OR v_school_id IS NULL OR v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_thread_id
    FROM public.chat_threads
   WHERE kind = 'support' AND parent_id = v_parent_id;

  IF v_thread_id IS NULL THEN
    INSERT INTO public.chat_threads (kind, school_id, parent_id, title)
    VALUES ('support', v_school_id, v_parent_id, v_title)
    RETURNING id INTO v_thread_id;
  END IF;

  INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
  VALUES (v_thread_id, v_user_id, 'parent')
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  -- Все админы школы разом. Повторный вызов ничего не портит и добирает
  -- тех, кого завели после создания комнаты.
  INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
  SELECT v_thread_id, a.user_id, 'admin'
    FROM public.admins a
   WHERE a.school_id = v_school_id
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  RETURN v_thread_id;
END;
$fn$;

COMMENT ON FUNCTION public.fn_ensure_support_thread() IS
  'Комната поддержки текущего родителя: создаёт при первом вызове, '
  'вписывает родителя и всех админов его школы. Аргументов нет — '
  'родитель и школа берутся из auth.uid(), чужую комнату получить нельзя.';

-- Режим миграции 223: наружу открыто только то, что обязано быть открыто.
-- authenticated нужен: функцию зовёт приложение родителя. anon и PUBLIC не
-- нужны — без auth.uid() она всё равно вернёт NULL, но право не выдаём.
REVOKE EXECUTE ON FUNCTION public.fn_ensure_support_thread() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_ensure_support_thread() FROM anon;
GRANT  EXECUTE ON FUNCTION public.fn_ensure_support_thread() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_ensure_support_thread() TO service_role;

-- ── 4. СОСТАВ АДМИНОВ В КОМНАТАХ ─────────────────────────────────────
-- Завели админа — он входит во все комнаты поддержки своей школы и видит
-- накопившееся. Удалили — выходит из них.
CREATE OR REPLACE FUNCTION public.tg_admin_support_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
    SELECT t.id, NEW.user_id, 'admin'
      FROM public.chat_threads t
     WHERE t.kind = 'support' AND t.school_id = NEW.school_id
    ON CONFLICT (thread_id, user_id) DO NOTHING;
    RETURN NEW;
  END IF;

  DELETE FROM public.chat_participants cp
   USING public.chat_threads t
   WHERE cp.thread_id = t.id
     AND cp.user_id = OLD.user_id
     AND t.kind = 'support'
     AND t.school_id = OLD.school_id;
  RETURN OLD;
END;
$fn$;

COMMENT ON FUNCTION public.tg_admin_support_membership() IS
  'Держит состав админов в комнатах поддержки школы в синхроне с public.admins.';

-- AFTER, а не BEFORE — это важно. На той же таблице стоит заслон миграции
-- 228 (trg_block_last_school_admin, BEFORE DELETE): последнего админа школы
-- удалить нельзя. BEFORE отрабатывает первым и, если удаление запрещено,
-- бросает исключение — весь оператор откатывается, и AFTER не срабатывает
-- вовсе. Поставь мы BEFORE — порядок между двумя BEFORE-триггерами решался
-- бы алфавитом имён, и заслон можно было бы обойти по случайности.
DROP TRIGGER IF EXISTS trg_admin_support_membership_ins ON public.admins;
CREATE TRIGGER trg_admin_support_membership_ins
  AFTER INSERT ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.tg_admin_support_membership();

DROP TRIGGER IF EXISTS trg_admin_support_membership_del ON public.admins;
CREATE TRIGGER trg_admin_support_membership_del
  AFTER DELETE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.tg_admin_support_membership();

-- ── ПРОВЕРКИ ПОСЛЕ ПРИМЕНЕНИЯ ────────────────────────────────────────
--
-- 1. Новый вид разрешён, старые на месте. Ждём четыре значения.
--
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.chat_threads'::regclass AND conname = 'chat_threads_kind_check';
--
-- 2. Колонка и частичная уникальность заведены. Ждём по одной строке.
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='chat_threads' AND column_name='parent_id';
-- SELECT indexdef FROM pg_indexes
--  WHERE schemaname='public' AND indexname='chat_threads_support_parent_unique_idx';
--
-- 3. Право выполнения: authenticated есть, anon нет.
--
-- SELECT has_function_privilege('authenticated', 'public.fn_ensure_support_thread()', 'EXECUTE') AS authenticated_может,
--        has_function_privilege('anon',          'public.fn_ensure_support_thread()', 'EXECUTE') AS anon_может;
--
-- 4. Заслон последнего админа из миграции 228 на месте и стоит ПЕРЕД нашим.
--    Ждём три триггера: BEFORE DELETE у 228 и два AFTER у 234.
--
-- SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
--  WHERE tgrelid = 'public.admins'::regclass AND NOT tgisinternal ORDER BY tgname;
--
-- 5. Комнат поддержки пока ноль — их создаёт первый вызов функции родителем.
--
-- SELECT count(*) AS комнат_поддержки FROM public.chat_threads WHERE kind = 'support';
--
-- 6. Существующие виды чата не задеты. Ждём те же числа, что были до
--    применения: комнат 195, участников 404, сообщений 555.
--
-- SELECT (SELECT count(*) FROM public.chat_threads)      AS комнат,
--        (SELECT count(*) FROM public.chat_participants) AS участников,
--        (SELECT count(*) FROM public.chat_messages)     AS сообщений;
