-- =====================================================================
-- Migration 99 — БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 4: демо-инфраструктура (пул,
-- выдача, автосброс).
--
-- Контекст: миграция 97 удалила все старые demo_teacher/demo_student_3/7/10
-- аккаунты (единственные, что DemoRoleModal.tsx умел логинить) и создала 95
-- новых demo_* аккаунтов (demo_student_{10,7,3}_01..30, demo_teacher_01..05).
-- Кнопка "Демо" в проде сейчас 100% сломана (4 из 4 старых аккаунтов больше
-- не существуют) — это устраняется тем же коммитом, что и эта миграция.
--
-- Решение по механизму пула (см. resheniya.md, "Этап 4"): у каждого demo_*
-- аккаунта заранее заводится ровно одна строка в demo_sessions
-- (released=true). "Свободен" = released=true. Выдача — атомарный
-- UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1) через
-- SECURITY DEFINER RPC claim_demo_account(), вызываемый АНОНИМНО с /login
-- (до входа в систему) — поэтому GRANT EXECUTE отдельно anon-роли.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.demo_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at timestamptz,
  last_activity timestamptz,
  released boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS demo_sessions_account_user_id_key ON public.demo_sessions(account_user_id);

ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;

-- Никакого прямого клиентского доступа — всё через SECURITY DEFINER RPC
-- ниже. Админам разрешено читать для отладки/мониторинга занятости пула.
DROP POLICY IF EXISTS "admin reads demo_sessions" ON public.demo_sessions;
CREATE POLICY "admin reads demo_sessions" ON public.demo_sessions FOR SELECT
  USING (fn_is_admin() OR is_super_admin());

-- Одна строка на каждый существующий demo_* аккаунт, изначально свободна.
INSERT INTO public.demo_sessions (account_user_id, released)
SELECT id, true FROM auth.users WHERE raw_user_meta_data->>'is_demo' = 'true'
ON CONFLICT (account_user_id) DO NOTHING;

-- ── claim_demo_account(p_kind, p_grade) — атомарная выдача свободного
-- аккаунта из пула. p_kind: 'student' | 'teacher'. p_grade (только для
-- student): '10' | '7' | '3'. Пусто в результате = все заняты. ───────────
CREATE OR REPLACE FUNCTION public.claim_demo_account(p_kind text, p_grade text DEFAULT NULL)
RETURNS TABLE(username text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session_id uuid;
  v_user_id uuid;
BEGIN
  SELECT ds.id, ds.account_user_id INTO v_session_id, v_user_id
  FROM public.demo_sessions ds
  JOIN auth.users u ON u.id = ds.account_user_id
  LEFT JOIN public.students s ON s.user_id = u.id
  LEFT JOIN public.teachers t ON t.user_id = u.id
  WHERE ds.released = true
    AND (
      (p_kind = 'student' AND s.username LIKE 'demo\_student\_' || p_grade || '\_%' ESCAPE '\')
      OR (p_kind = 'teacher' AND t.username LIKE 'demo\_teacher\_%' ESCAPE '\')
    )
  ORDER BY random()
  FOR UPDATE OF ds SKIP LOCKED
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.demo_sessions
  SET released = false, claimed_at = now(), last_activity = now()
  WHERE id = v_session_id;

  RETURN QUERY
  SELECT COALESCE(s.username, t.username), u.email::text
  FROM auth.users u
  LEFT JOIN public.students s ON s.user_id = u.id
  LEFT JOIN public.teachers t ON t.user_id = u.id
  WHERE u.id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_demo_account(text, text) TO anon, authenticated;

-- ── touch_demo_session() — heartbeat (Этап 4.3), вызывается залогиненным
-- демо-аккаунтом за себя (auth.uid()) раз в 5 минут с клиента. ───────────
CREATE OR REPLACE FUNCTION public.touch_demo_session()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.demo_sessions
  SET last_activity = now()
  WHERE account_user_id = auth.uid() AND released = false;
$$;

GRANT EXECUTE ON FUNCTION public.touch_demo_session() TO authenticated;

-- ── reset_expired_demo_sessions() — Этап 4.4. Каждые 30 минут находит
-- сессии без активности 3+ часа, откатывает изменения ЭТОГО аккаунта ЗА
-- СЕССИЮ (created_at > claimed_at — не полный снос всех демо-данных, как в
-- старой reset_demo_data() из миграции 65, а точечный откат одной сессии),
-- помечает released=true. ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_expired_demo_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_student_id uuid;
  v_teacher_id uuid;
BEGIN
  FOR r IN
    SELECT ds.id, ds.account_user_id, ds.claimed_at
    FROM public.demo_sessions ds
    WHERE ds.released = false
      AND ds.last_activity < now() - interval '3 hours'
  LOOP
    SELECT id INTO v_student_id FROM public.students WHERE user_id = r.account_user_id;
    SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = r.account_user_id;

    IF v_student_id IS NOT NULL THEN
      DELETE FROM public.homework_submissions WHERE student_id = v_student_id AND created_at > r.claimed_at;
      DELETE FROM public.lesson_stage_progress WHERE student_id = v_student_id AND completed_at > r.claimed_at;
      DELETE FROM public.quiz_attempts WHERE student_id = v_student_id AND created_at > r.claimed_at;
      DELETE FROM public.lesson_raised_hands WHERE student_id = v_student_id AND created_at > r.claimed_at;
      DELETE FROM public.ai_chat_messages WHERE student_id = v_student_id AND created_at > r.claimed_at;
    END IF;

    IF v_teacher_id IS NOT NULL THEN
      -- lessons/homework/materials created by this demo teacher during the
      -- session — cascades to lesson_stages/lesson_materials/homework_submissions/etc.
      DELETE FROM public.lessons
        WHERE group_id IN (SELECT group_id FROM public.group_teachers WHERE teacher_id = v_teacher_id)
          AND created_at > r.claimed_at;
      DELETE FROM public.homework WHERE teacher_id = v_teacher_id AND created_at > r.claimed_at;
      DELETE FROM public.course_materials WHERE uploaded_by = v_teacher_id AND created_at > r.claimed_at;
      DELETE FROM public.lesson_materials WHERE uploaded_by = v_teacher_id AND created_at > r.claimed_at;
    END IF;

    DELETE FROM public.chat_messages WHERE sender_id = r.account_user_id AND created_at > r.claimed_at;
    DELETE FROM public.notifications WHERE recipient_user_id = r.account_user_id AND created_at > r.claimed_at;

    UPDATE public.demo_sessions SET released = true WHERE id = r.id;
  END LOOP;
END;
$$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'reset-expired-demo-sessions';
SELECT cron.schedule(
  'reset-expired-demo-sessions',
  '*/30 * * * *',
  $$SELECT public.reset_expired_demo_sessions();$$
);
