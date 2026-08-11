-- =====================================================================
-- Migration 186 — ученик снова может сдать текстовое домашнее задание.
--
-- СИМПТОМ. Сдача с текстом не проходила НИ В ОДНОЙ школе, включая демо.
-- Под сессией ученика: «permission denied for table ai_homework_review_queue».
-- Под служебным ключом та же вставка падала иначе: «violates foreign key
-- constraint ai_homework_review_queue_submission_id_fkey».
--
-- ПРИЧИНА — ДВЕ НЕЗАВИСИМЫЕ, обе в одном триггере (перепроверено 11.08
-- запросами к живой базе, не по прошлому отчёту):
--
--   trg_enqueue_homework_ai_review  BEFORE INSERT OR UPDATE OF status,
--   answer_text, code_text  →  fn_enqueue_homework_ai_review(),
--   prosecdef = false, владелец postgres.
--
--   1. ПРАВА. Функция не SECURITY DEFINER, то есть выполняется от имени
--      вызывающего — ученика. У роли authenticated на
--      ai_homework_review_queue нет НИ ОДНОГО права (в role_table_grants
--      только postgres и service_role), плюс на таблице включена защита
--      строк при нуле политик. Вставка в очередь отбивается сразу.
--
--   2. ПОРЯДОК. Триггер BEFORE INSERT вставляет строку очереди со ссылкой
--      на NEW.id, которого в homework_submissions ещё нет — родительская
--      строка появится только после отработки BEFORE-триггеров. Внешний
--      ключ не отложенный (condeferrable = false), поэтому ссылка на
--      несуществующую строку отвергается.
--
-- ПОЧЕМУ ОДНОГО ПЕРЕНОСА НА AFTER МАЛО. Он снимает причину 2 и не трогает
-- причину 1: в AFTER функция по-прежнему работает от имени ученика. Нужны
-- обе правки сразу — AFTER и SECURITY DEFINER. Альтернатива «выдать
-- authenticated права на очередь» отвергнута: это открыло бы служебную
-- таблицу всем вошедшим, ровно то, от чего уходили в миграции 185.
--
-- ПОЧЕМУ ТРИГГЕРОВ СТАНОВИТСЯ ДВА. Присваивание NEW.ai_review_status
-- работает только в BEFORE — в AFTER оно ничего не меняет. Поэтому одна
-- обязанность остаётся в BEFORE (проставить признак «ждёт ИИ»), вторая
-- уезжает в AFTER (положить строку в очередь). BEFORE-триггер после этого
-- не пишет никуда, кроме своей же строки, и никаких прав ему не нужно.
--
-- ОБРАЗЕЦ РЯДОМ. На этой же таблице уже висит fn_homework_submission_notify:
-- AFTER INSERT + SECURITY DEFINER. Приводим очередь к тому же виду.
--
-- ПОЧЕМУ ЭТОГО НЕ ЗАМЕЧАЛИ. Все 440 демо-сдач имеют ai_review_status = NULL,
-- то есть триггер не отработал на них ни разу — они старше миграции 140.
-- Условие срабатывания требует непустого answer_text или code_text, поэтому
-- файловая сдача (текста нет) проходила и проходит.
--
-- ДАННЫЕ НЕ ЗАТРАГИВАЮТСЯ: ни одной строки не создаётся, не меняется и не
-- удаляется. Демо-школа не участвует.
-- =====================================================================

-- ── 1. BEFORE: только признак на своей же строке ─────────────────────
CREATE OR REPLACE FUNCTION public.fn_set_homework_ai_review_pending()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Условие ДОСЛОВНО то же, что было в старой функции: сдана, признак ещё
  -- не проставлен, есть текст ответа или кода. Ничего не расширяем.
  IF NEW.status = 'submitted'
     AND NEW.ai_review_status IS NULL
     AND (COALESCE(NEW.answer_text, '') <> '' OR COALESCE(NEW.code_text, '') <> '')
  THEN
    NEW.ai_review_status := 'pending_ai';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. AFTER: постановка в очередь, от имени владельца ───────────────
CREATE OR REPLACE FUNCTION public.fn_enqueue_homework_ai_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ставим в очередь ровно в момент ПЕРЕХОДА в 'pending_ai' — как и раньше:
  -- старое условие срабатывало только при ai_review_status IS NULL, то есть
  -- один раз на сдачу. При INSERT переход есть всегда, при UPDATE сверяемся
  -- со старым значением, чтобы не плодить постановки на каждое сохранение.
  IF NEW.ai_review_status = 'pending_ai'
     AND (TG_OP = 'INSERT' OR OLD.ai_review_status IS DISTINCT FROM 'pending_ai')
  THEN
    INSERT INTO public.ai_homework_review_queue (submission_id, school_id)
    VALUES (NEW.id, NEW.school_id)
    ON CONFLICT (submission_id) DO NOTHING;
  END IF;
  RETURN NULL;  -- AFTER-триггер: возвращаемое значение игнорируется
END;
$$;

-- ── 3. Перевешиваем ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_enqueue_homework_ai_review ON public.homework_submissions;

CREATE TRIGGER trg_set_homework_ai_review_pending
  BEFORE INSERT OR UPDATE OF status, answer_text, code_text
  ON public.homework_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_homework_ai_review_pending();

CREATE TRIGGER trg_enqueue_homework_ai_review
  AFTER INSERT OR UPDATE OF status, answer_text, code_text
  ON public.homework_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enqueue_homework_ai_review();

-- ── 4. Самопроверка ─────────────────────────────────────────────────
DO $$
DECLARE
  v_before_ok  boolean;
  v_after_ok   boolean;
  v_secdef     boolean;
  v_grants     integer;
BEGIN
  SELECT (t.tgtype & 2) > 0 INTO v_before_ok
    FROM pg_trigger t
   WHERE t.tgrelid = 'public.homework_submissions'::regclass
     AND t.tgname = 'trg_set_homework_ai_review_pending';
  IF NOT COALESCE(v_before_ok, false) THEN
    RAISE EXCEPTION 'trg_set_homework_ai_review_pending отсутствует или не BEFORE';
  END IF;

  SELECT (t.tgtype & 2) = 0 INTO v_after_ok
    FROM pg_trigger t
   WHERE t.tgrelid = 'public.homework_submissions'::regclass
     AND t.tgname = 'trg_enqueue_homework_ai_review';
  IF NOT COALESCE(v_after_ok, false) THEN
    RAISE EXCEPTION 'trg_enqueue_homework_ai_review отсутствует или остался BEFORE';
  END IF;

  SELECT p.prosecdef INTO v_secdef
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'fn_enqueue_homework_ai_review';
  IF NOT COALESCE(v_secdef, false) THEN
    RAISE EXCEPTION 'fn_enqueue_homework_ai_review не SECURITY DEFINER — права так и не обойдёт';
  END IF;

  -- Обратная половина: прямых прав на очередь у вошедших появиться НЕ должно.
  SELECT count(*) INTO v_grants
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'ai_homework_review_queue'
     AND grantee IN ('anon', 'authenticated');
  IF v_grants > 0 THEN
    RAISE EXCEPTION 'у anon/authenticated появились прямые права на очередь — так не задумано';
  END IF;

  RAISE NOTICE 'Миграция 186: признак ставит BEFORE, в очередь кладёт AFTER от имени владельца';
END $$;
