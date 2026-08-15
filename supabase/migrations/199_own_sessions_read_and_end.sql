-- Миграция 199: человек видит СВОИ входы в аккаунт и может закрыть чужой.
--
-- ЗАЧЕМ. Экран «Активные сессии» есть и в приложении родителя, и на вебе, но
-- показывать ему было нечего: единственная таблица, к которой он был привязан,
-- public.user_sessions — это не список устройств, а реестр правила «одна
-- активная сессия» (UNIQUE (user_id), одна строка на аккаунт, миграция 110).
-- Проверено счётом: 36 строк на 36 аккаунтов, у родителя Ismailov ровно одна.
-- Список устройств из неё не получится никогда — по устройству там не строка,
-- а перезапись.
--
-- ГДЕ УСТРОЙСТВА НА САМОМ ДЕЛЕ. В auth.sessions — родной таблице Supabase Auth:
-- строка на каждый вход, с датой входа, датой последнего обновления токена,
-- User-Agent и адресом. У того же родителя там 25 строк: настоящий iPhone
-- (Expo Go), веб и 23 входа из служебных скриптов.
--
-- ПОЧЕМУ ФУНКЦИИ, А НЕ ПОЛИТИКА. Схема auth наружу через API не отдаётся
-- вовсе, политику на неё не навесить, а служебный ключ в мобильном приложении
-- держать нельзя — он уезжает в сборку. Поэтому ровно две функции, обе
-- работают только от лица вошедшего:
--
--   • public.my_sessions()      — читает строки ТОЛЬКО с user_id = auth.uid();
--   • public.end_session(uuid)  — удаляет строку ТОЛЬКО с user_id = auth.uid()
--                                 и ТОЛЬКО не текущую.
--
-- Идентификатор пользователя берётся из токена внутри функции, аргументом его
-- передать нельзя — подставить чужой не выйдет.
--
-- ЧТО ЗНАЧИТ «ЗАКРЫТЬ СЕАНС». Удаление строки auth.sessions каскадом уносит
-- auth.refresh_tokens этой сессии (FK refresh_tokens_session_id_fkey ON DELETE
-- CASCADE, проверено каталогом) — устройство больше не сможет обновить токен.
-- Уже выданный access-токен доживает свой срок (у проекта — час), поэтому
-- выход на том устройстве происходит не мгновенно, а при первом обновлении
-- токена. Приложение об этом честно пишет.
--
-- ПРАВИЛО ОДНОЙ СЕССИИ НЕ ТРОНУТО. public.user_sessions, check_user_session(),
-- registerSession() работают ровно как работали. Единственное касание: если
-- закрываемая сессия — та самая, что записана в реестре, её строка убирается
-- вместе с сессией, иначе middleware продолжал бы сверяться с мертвецом.
-- Строка текущей сессии не трогается никогда: закрыть текущую нельзя.

-- ── 1. Свои сессии ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_sessions()
RETURNS TABLE (
  id           uuid,
  created_at   timestamptz,
  last_seen_at timestamptz,
  user_agent   text,
  ip           text,
  is_current   boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    s.id,
    s.created_at,
    -- Последняя активность = позднейшее из «обновлено» и «токен обновлён».
    -- refreshed_at хранится без часового пояса и всегда в UTC.
    GREATEST(
      s.updated_at,
      COALESCE(s.refreshed_at AT TIME ZONE 'UTC', s.updated_at)
    ) AS last_seen_at,
    s.user_agent,
    host(s.ip) AS ip,
    s.id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid AS is_current
  FROM auth.sessions s
  WHERE auth.uid() IS NOT NULL
    AND s.user_id = auth.uid()
  ORDER BY GREATEST(
             s.updated_at,
             COALESCE(s.refreshed_at AT TIME ZONE 'UTC', s.updated_at)
           ) DESC
$$;

COMMENT ON FUNCTION public.my_sessions() IS
  'Входы в СВОЙ аккаунт: устройство (User-Agent), адрес, когда вошли и когда '
  'последний раз обновляли токен, и какой из них текущий. Читает auth.sessions '
  'только по auth.uid() — чужие строки недостижимы. Миграция 199.';

REVOKE ALL ON FUNCTION public.my_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_sessions() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_sessions() TO authenticated;

-- ── 2. Закрыть свой чужой сеанс ─────────────────────────────────────────────
--
-- Возвращает:
--   'ok'        — сеанс закрыт;
--   'current'   — это текущее устройство, для выхода есть кнопка «Выйти»;
--   'not_found' — такой сессии у спрашивающего нет (в том числе чужая).
CREATE OR REPLACE FUNCTION public.end_session(p_session_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current uuid := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
BEGIN
  IF v_uid IS NULL OR p_session_id IS NULL THEN
    RETURN 'not_found';
  END IF;

  -- Текущую сессию не закрываем: это выход из приложения, а не управление
  -- чужими устройствами. Проверка стоит ПЕРВОЙ — иначе «выйти» пришло бы
  -- через этот вызов и обошло бы обычный выход со всей его уборкой.
  IF v_current IS NOT NULL AND p_session_id = v_current THEN
    RETURN 'current';
  END IF;

  DELETE FROM auth.sessions
  WHERE id = p_session_id
    AND user_id = v_uid;

  IF NOT FOUND THEN
    -- Либо уже закрыта, либо чужая — ответ один и тот же, чтобы по нему
    -- нельзя было проверять существование чужих сессий.
    RETURN 'not_found';
  END IF;

  -- Реестр «одной сессии» не должен указывать на закрытую сессию: иначе
  -- middleware вернул бы 'replaced' вместо тихого возврата на вход.
  DELETE FROM public.user_sessions
  WHERE user_id = v_uid
    AND session_id = p_session_id;

  RETURN 'ok';
END;
$$;

COMMENT ON FUNCTION public.end_session(uuid) IS
  'Закрывает ОДИН вход в свой аккаунт: удаляет строку auth.sessions (каскадом '
  'уходят refresh-токены — устройство больше не обновит сессию). Только свои '
  'строки, только не текущая. Миграция 199.';

REVOKE ALL ON FUNCTION public.end_session(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.end_session(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.end_session(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
