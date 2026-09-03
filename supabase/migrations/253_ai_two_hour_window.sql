-- ═══════════════════════════════════════════════════════════════════════════
-- 253. ЛИМИТ ПОМОЩНИКА: ДВАДЦАТЬ ЗАПРОСОВ НА ДВА ЧАСА.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- БЫЛО: десять запросов в сутки, счёт от полуночи по Ташкенту
-- (fn_ai_messages_today). Стало: двадцать, а окно — два часа, и считается оно
-- НЕ от полуночи и не скользящим хвостом, а от МОМЕНТА ИСЧЕРПАНИЯ: потратил
-- двадцатый — ждёшь ровно два часа с этого мгновения, потом снова полные
-- двадцать.
--
-- ═══ ПОЧЕМУ БЕЗ НОВОЙ ТАБЛИЦЫ ══════════════════════════════════════════════
--
-- Окно выводится из самих сообщений, хранить его отдельно не нужно:
--
--   t20        — время ДВАДЦАТОГО С КОНЦА вопроса ученика;
--   отпустит   — t20 + два часа;
--   если сейчас < отпустит  → запас исчерпан, ждать до «отпустит»;
--   иначе                   → потрачено = вопросов позже «отпустит».
--
-- Проверка на примере. Двадцать вопросов подряд в 10:00 — t20 = 10:00,
-- отпустит 12:00, запас нулевой. В 12:05 ученик спрашивает пять раз: теперь
-- двадцатый с конца — это пятнадцатый из старой пачки, его «отпустит» давно
-- позади, а позже него лежат ровно пять новых. Потрачено 5, осталось 15.
-- Ровно то поведение, которое просили.
--
-- Меньше двадцати вопросов за всю жизнь — t20 нет, «отпустит» уходит в
-- минус-бесконечность, и потрачено = все вопросы. Тоже верно.
--
-- ═══ СЧЁТ ПО ЧЕЛОВЕКУ, А НЕ ПО АДРЕСУ ══════════════════════════════════════
--
-- Ключ — student_id. В школе один адрес на весь класс: считай по адресу, и
-- один ученик перекрыл бы кислород остальным.
--
-- ═══ ПРАВА ═════════════════════════════════════════════════════════════════
--
-- Функция НЕ security definer — как и прежняя: она видит ровно то, что видит
-- вызывающий по правилам доступа. Аноним получил бы ноль строк, поэтому право
-- у него отбираем сразу: считать чужой расход ему незачем.
--
-- Обойти лимит чтением этой функции нельзя: она только показывает. Отказ
-- ставит сервер в /api/ai/chat перед обращением к модели, а стереть свои
-- сообщения и обнулить счётчик ученик не может — политики DELETE на
-- ai_chat_messages нет вовсе.
--
-- ДАННЫЕ НЕ ТРОГАЮТСЯ: ни одной строки не пишется.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_ai_window_state(p_student_id uuid)
RETURNS TABLE(used integer, limit_n integer, blocked_until timestamptz)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH правило AS (
    SELECT 20 AS предел, interval '2 hours' AS окно
  ),
  двадцатый AS (
    SELECT m.created_at
      FROM public.ai_chat_messages m
     WHERE m.student_id = p_student_id
       AND m.role = 'user'
     ORDER BY m.created_at DESC
     OFFSET (SELECT предел FROM правило) - 1
     LIMIT 1
  ),
  край AS (
    SELECT COALESCE(
             (SELECT created_at FROM двадцатый) + (SELECT окно FROM правило),
             '-infinity'::timestamptz
           ) AS отпустит
  )
  SELECT
    CASE
      WHEN now() < (SELECT отпустит FROM край)
        THEN (SELECT предел FROM правило)
      ELSE (
        SELECT count(*)::int
          FROM public.ai_chat_messages m
         WHERE m.student_id = p_student_id
           AND m.role = 'user'
           AND m.created_at >= (SELECT отпустит FROM край)
      )
    END AS used,
    (SELECT предел FROM правило) AS limit_n,
    CASE
      WHEN now() < (SELECT отпустит FROM край) THEN (SELECT отпустит FROM край)
      ELSE NULL
    END AS blocked_until;
$function$;

REVOKE ALL ON FUNCTION public.fn_ai_window_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ai_window_state(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_ai_window_state(uuid) IS
  'Расход помощника у ученика: потрачено, предел и до какого времени запас исчерпан. '
  'Окно два часа от момента исчерпания, не от полуночи. Считается по человеку.';

-- Прежняя суточная функция НЕ УДАЛЯЕТСЯ: на неё могут смотреть отчёты и
-- демо-скрипты. Приложение её больше не зовёт.

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'fn_ai_window_state';
  IF n <> 1 THEN RAISE EXCEPTION '253: fn_ai_window_state не создана'; END IF;
END $$;

COMMIT;
