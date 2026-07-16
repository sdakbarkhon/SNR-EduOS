-- =====================================================================
-- Migration 136 — Пачка 3, Задача 2: глобальный дневной счётчик вызовов
-- Gemini API (X/250), показывается под чатом EduOS Assistant всем ролям.
--
-- Глобальный = один счётчик на всю школу за день (НЕ per-student/per-
-- teacher) — по одной строке в day. Инкрементируется на КАЖДЫЙ успешный
-- вызов Gemini через единую точку входа apps/web/lib/ai/gemini-client.ts
-- (withRetry() — общий для generateText/generateContent/generateJSON/
-- chat, см. апстрим-комментарий в этом файле), поэтому лимит отражает
-- реальный расход Gemini-квоты приложением целиком, а не только чат.
--
-- Не переиспользует существующую public.ai_chat_messages (миграция
-- 20260623000041_ai_chat_messages) — та жёстко привязана к lesson_id
-- NOT NULL (урок-чат "Робокот", свой отдельный DAILY_LIMIT=10 через
-- fn_ai_messages_today) и участвует в demo-reset скриптах по
-- student_id — смешивать с общим бесlesson-счётчиком было бы либо
-- сломать существующий лимит урок-чата, либо потребовать миграцию
-- схемы этой таблицы ради несвязанной фичи.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  day             date PRIMARY KEY,
  requests_count  integer NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
-- Ноль клиентских политик — счётчик глобальный (не per-user), запись —
-- только через SECURITY DEFINER RPC ниже; чтение — тоже через RPC
-- (get_ai_usage_today), чтобы не плодить прямой SELECT-доступ к таблице.

CREATE OR REPLACE FUNCTION public.increment_ai_usage()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.ai_usage_log (day, requests_count)
  VALUES (
    (now() AT TIME ZONE 'Asia/Tashkent')::date,
    1
  )
  ON CONFLICT (day) DO UPDATE
    SET requests_count = ai_usage_log.requests_count + 1,
        updated_at = now()
  RETURNING requests_count INTO v_count;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.get_ai_usage_today()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  SELECT requests_count INTO v_count
  FROM public.ai_usage_log
  WHERE day = (now() AT TIME ZONE 'Asia/Tashkent')::date;
  RETURN COALESCE(v_count, 0);
END $$;

-- increment_ai_usage вызывается из apps/web/lib/ai/gemini-client.ts через
-- service-role admin-клиент (единая точка withRetry — вне HTTP-запроса
-- пользователя, поэтому anon/authenticated GRANT не обязателен для неё,
-- но даём — на случай прямого клиентского вызова в будущем).
-- get_ai_usage_today читает GET /api/ai/usage — тоже через admin-клиент,
-- но GRANT authenticated даём для единообразия с остальными RPC проекта.
REVOKE ALL ON FUNCTION public.increment_ai_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_ai_usage_today() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_usage_today() TO anon, authenticated, service_role;

-- ── Регистрация ───────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('136')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ── Smoke test — выполнить руками ПОСЛЕ применения ────────────────────
DO $$
DECLARE v_before integer; v_after integer;
BEGIN
  v_before := public.get_ai_usage_today();
  PERFORM public.increment_ai_usage();
  v_after := public.get_ai_usage_today();
  RAISE NOTICE 'ai_usage_log: before=%, after=% (ожидание: after = before + 1)', v_before, v_after;
  IF v_after <> v_before + 1 THEN
    RAISE EXCEPTION 'increment_ai_usage() не сработал корректно';
  END IF;
  RAISE NOTICE 'ai_usage_log: OK';
END $$;
