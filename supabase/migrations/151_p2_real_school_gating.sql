-- =====================================================================
-- Migration 151 — П.2 "Реальные роли": вторая (реальная) школа.
--
-- Решение: существующая школа (a0a0a0a0-...-0001) остаётся демо-школой —
-- её данные/поведение не меняются. Заводим ВТОРУЮ, пустую школу для
-- будущих реальных учеников/учителей/родителей. RLS (current_school_id(),
-- is_my_group/is_my_teacher_group) сама разделяет данные по school_id —
-- никаких is_demo-флагов, отдельных проектов Supabase или копий БД не
-- заводим (см. отчёт по разведке П.2).
--
-- Новый признак schools.autostart_enabled управляет ТОЛЬКО автоматикой:
-- — pg_cron auto-start/auto-end уроков (fn_auto_start_lessons/
--   fn_auto_end_lessons) обрабатывают только школы с этим флагом;
-- — RLS-политика "student ends own in-progress lesson" (миграция 117)
--   перестаёт пускать ручное завершение урока учеником для таких школ —
--   там управление полностью автоматическое.
-- Демо-школа получает autostart_enabled=false (значение по умолчанию) —
-- её поведение не меняется ни на бит: кнопки "Начать/Закончить урок"
-- работают как раньше, крон её не трогает.
--
-- Реальная школа создаётся ПУСТОЙ — ни учителей, ни учеников, ни уроков.
-- Онбординг реальных пользователей — через уже существующую /admin
-- (создание админа — через /superadmin/admins, см. отчёт по разведке
-- П.2, Шаг 5: минимальная admin-панель для этого уже готова, отдельный
-- UI строить не нужно).
-- =====================================================================

BEGIN;

-- ── 1. Демо-школа: явное имя, без изменения id/code ──────────────────────
UPDATE public.schools
SET name = 'SNR Demo School'
WHERE id = 'a0a0a0a0-0000-0000-0000-000000000001';

-- ── 2. Признак автоматического управления уроками по школе ───────────────
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS autostart_enabled boolean NOT NULL DEFAULT false;

-- ── 3. Вторая (реальная) школа — пустая, с автостартом ────────────────────
INSERT INTO public.schools (id, name, code, autostart_enabled)
VALUES (
  'b0b0b0b0-0000-0000-0000-000000000001',
  'SNR International School',
  'SNR-REAL',
  true
)
ON CONFLICT (id) DO NOTHING;

-- ── 4. fn_auto_start_lessons(): школьный фильтр в ОБОИХ UPDATE-ах ─────────
-- (не только в переводе статуса — иначе побочный эффект "авто-завершить
-- Start-этап" ловил бы и ручной старт в демо-школе, как только крон
-- снова заработает).
CREATE OR REPLACE FUNCTION public.fn_auto_start_lessons()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- scheduled → in_progress when starts_at is within last 5 minutes.
  UPDATE public.lessons
  SET status = 'in_progress', started_at = now()
  WHERE status = 'scheduled'
    AND starts_at <= now()
    AND starts_at > now() - interval '5 minutes'
    AND EXISTS (
      SELECT 1 FROM public.schools s
      WHERE s.id = lessons.school_id AND s.autostart_enabled
    );

  -- Auto-complete Start stage for newly started lessons — тот же
  -- school-фильтр, иначе ручной старт в демо-школе тоже ловился бы этим
  -- побочным эффектом крона.
  UPDATE public.lesson_stages ls
  SET is_completed = true, completed_at = now()
  FROM public.lessons l
  WHERE ls.lesson_id = l.id
    AND l.status = 'in_progress'
    AND l.started_at >= now() - interval '2 minutes'
    AND ls.stage_role = 'start'
    AND NOT ls.is_completed
    AND EXISTS (
      SELECT 1 FROM public.schools s
      WHERE s.id = l.school_id AND s.autostart_enabled
    );
END;
$$;

-- ── 5. fn_auto_end_lessons(): тот же фильтр — тело (миграция 85, с
--    school_id в attendance-insert) целиком сохранено, добавлен только
--    EXISTS(...) в источник цикла (единая точка — покрывает весь LOOP,
--    отдельно фильтровать статус/summary/attendance внутри не нужно).
CREATE OR REPLACE FUNCTION public.fn_auto_end_lessons()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, group_id, school_id FROM public.lessons
    WHERE status = 'in_progress'
      AND ends_at IS NOT NULL
      AND ends_at <= now()
      AND EXISTS (
        SELECT 1 FROM public.schools s
        WHERE s.id = lessons.school_id AND s.autostart_enabled
      )
  LOOP
    UPDATE public.lessons
    SET status = 'completed', ended_at = now()
    WHERE id = r.id;

    -- Auto-complete Summary stage
    UPDATE public.lesson_stages
    SET is_completed = true, completed_at = now()
    WHERE lesson_id = r.id
      AND stage_role = 'summary'
      AND NOT is_completed;

    -- Auto-finalize attendance: absent_unexcused for missing records
    INSERT INTO public.attendance (lesson_id, student_id, school_id, status, marked_at, is_finalized)
    SELECT r.id, sg.student_id, r.school_id, 'absent_unexcused', now(), true
    FROM public.student_groups sg
    WHERE sg.group_id = r.group_id
      AND NOT EXISTS (
        SELECT 1 FROM public.attendance a
        WHERE a.lesson_id = r.id AND a.student_id = sg.student_id
      );

    UPDATE public.attendance
    SET is_finalized = true
    WHERE lesson_id = r.id AND NOT is_finalized;
  END LOOP;
END;
$function$;

-- ── 6. Вернуть оба джоба в pg_cron (SQL сохранён в комментарии миграции
--    143, которая их сняла) — идемпотентно, unschedule-then-schedule.
DO $$ BEGIN
  PERFORM cron.unschedule('auto-start-lessons');
EXCEPTION WHEN others THEN NULL;
END $$;
SELECT cron.schedule('auto-start-lessons', '* * * * *', $$SELECT public.fn_auto_start_lessons()$$);

DO $$ BEGIN
  PERFORM cron.unschedule('auto-end-lessons');
EXCEPTION WHEN others THEN NULL;
END $$;
SELECT cron.schedule('auto-end-lessons', '* * * * *', $$SELECT public.fn_auto_end_lessons()$$);

-- ── 7. RLS: "student ends own in-progress lesson" (миграция 117) —
--    добавлено "школа не на автостарте" в USING/WITH CHECK. Единственная
--    UPDATE-политика на lessons, доступная ученику (проверено — вторая,
--    "teacher updates own group lessons", матчит только current_teacher_id()
--    и ученику не подходит) — патча этой одной политики достаточно, чтобы
--    полностью закрыть ручное завершение урока учеником в реальной школе.
DROP POLICY IF EXISTS "student ends own in-progress lesson" ON public.lessons;
CREATE POLICY "student ends own in-progress lesson"
  ON public.lessons FOR UPDATE TO authenticated
  USING (
    (
      public.is_my_group(group_id)
      AND status = 'in_progress'
      AND school_id = public.current_school_id()
      AND NOT EXISTS (
        SELECT 1 FROM public.schools s
        WHERE s.id = lessons.school_id AND s.autostart_enabled
      )
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      public.is_my_group(group_id)
      AND status = 'completed'
      AND school_id = public.current_school_id()
      AND NOT EXISTS (
        SELECT 1 FROM public.schools s
        WHERE s.id = lessons.school_id AND s.autostart_enabled
      )
    )
    OR public.is_super_admin()
  );

-- ── 8. Регистрация ─────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('151')
ON CONFLICT (version) DO NOTHING;

COMMIT;
