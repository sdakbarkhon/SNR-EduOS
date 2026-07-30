-- =====================================================================
-- Migration 157 — правило 3-го урока (демо-школа): с 3-го урока дня
-- группы ученик становится чистым зрителем (Большой фикс, Блок 3).
--
-- ИСПРАВЛЕНИЯ К ПРОМТУ (после разведки):
--
--   1) "is_my_group" — реальное имя функции, промт угадал верно
--      (supabase/migrations/20260614000002_identity.sql:54-64, студенческая
--      сторона; teacher-side аналог — is_my_teacher_group, другая функция).
--
--   2) "школа с autostart_enabled=false" из промта — НЕ используется как
--      признак "это демо-школа". autostart_enabled (миграция 151) означает
--      совсем другое — полностью автоматический ПОМИНУТНЫЙ жизненный цикл
--      урока; у демо-школы он false СЛУЧАЙНО совпадает с нужным
--      направлением, но семантически это разные вещи — ровно та же
--      причина, по которой миграция 156 (предыдущий заход этой же сессии)
--      отказалась переиспользовать эту колонку для другого переключателя.
--      Переиспользование здесь означало бы: будущая РЕАЛЬНАЯ школа, которая
--      просто предпочла ручной жизненный цикل (autostart_enabled=false по
--      своим причинам, не будучи демо), автоматически получила бы правило
--      3-го урока — не то, что просил промт ("Правило применяется только
--      к демо-школе"). Использую прямое сравнение school_id с id демо-школы
--      (тот же SCHOOL_ID, что и во всех apps/web/scripts/*.mjs этой сессии)
--      — точное соответствие формулировке промта, без побочных эффектов на
--      гипотетическую будущую школу. Существующий autostart_enabled-гейт в
--      политике "student ends own in-progress lesson" (миграция 151) не
--      трогаю — он про своё, ортогональное правило (ручной/авто жизненный
--      цикл), продолжает работать как раньше.
--
--   3) fn_lesson_day_index — LANGUAGE sql вместо plpgsql из черновика
--      промта (проще, без DECLARE/BEGIN ради одного SELECT; тот же стиль,
--      что у is_my_group/current_school_id в этой схеме).
--
-- !!! ЭТА МИГРАЦИЯ НЕ ПРИМЕНЕНА К ПРОД-БАЗЕ ЭТИМ ЗАХОДОМ — то же
-- ограничение среды, что у 153-156: нет прямого Postgres-подключения/
-- привязанного Supabase CLI, только PostgREST через SUPABASE_SERVICE_ROLE_KEY
-- (не DDL). Ручной шаг заказчика: применить через Supabase Dashboard →
-- SQL Editor. До применения RPC fn_lesson_day_index в
-- packages/core/src/queries/index.ts (getStudentLessonView) будет
-- возвращать ошибку "function does not exist" — она логируется, а
-- StudentLessonView.isThirdLessonViewer безопасно деградирует к false
-- (dayIndexTyped.data ?? 1) — UI-гварды просто не активируются, поведение
-- как раньше миграции, ничего не ломается.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_lesson_day_index(p_lesson_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT t.position::integer
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY group_id, (starts_at AT TIME ZONE 'Asia/Tashkent')::date
          ORDER BY starts_at
        ) AS position
      FROM public.lessons
      WHERE group_id = (SELECT l0.group_id FROM public.lessons l0 WHERE l0.id = p_lesson_id)
        AND (starts_at AT TIME ZONE 'Asia/Tashkent')::date =
            (SELECT (l0.starts_at AT TIME ZONE 'Asia/Tashkent')::date FROM public.lessons l0 WHERE l0.id = p_lesson_id)
    ) t
    WHERE t.id = p_lesson_id
  ), 1);
$$;

-- Точный текст политики — из живого текста миграции 150
-- (supabase/migrations/150_student_slide_navigation.sql:35-63), не гадание.
DROP POLICY IF EXISTS "student navigates active lesson slide" ON public.lesson_stages;
CREATE POLICY "student navigates active lesson slide"
  ON public.lesson_stages FOR UPDATE TO authenticated
  USING (
    (
      school_id = public.current_school_id()
      AND EXISTS (
        SELECT 1 FROM public.lessons l
        WHERE l.id = lesson_stages.lesson_id
          AND l.status = 'in_progress'
          AND l.active_stage_id = lesson_stages.id
          AND public.is_my_group(l.group_id)
          AND (
            l.school_id <> 'a0a0a0a0-0000-0000-0000-000000000001'
            OR public.fn_lesson_day_index(l.id) <= 2
          )
      )
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      school_id = public.current_school_id()
      AND EXISTS (
        SELECT 1 FROM public.lessons l
        WHERE l.id = lesson_stages.lesson_id
          AND l.status = 'in_progress'
          AND l.active_stage_id = lesson_stages.id
          AND public.is_my_group(l.group_id)
          AND (
            l.school_id <> 'a0a0a0a0-0000-0000-0000-000000000001'
            OR public.fn_lesson_day_index(l.id) <= 2
          )
      )
    )
    OR public.is_super_admin()
  );

-- Точный текст политики — из живого текста миграции 151
-- (supabase/migrations/151_p2_real_school_gating.sql:157-183), не гадание.
-- autostart_enabled-гейт (своё, ортогональное правило) сохранён без
-- изменений; добавлен ТОЛЬКО day-index-гейт, и только для демо-школы.
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
      AND (
        school_id <> 'a0a0a0a0-0000-0000-0000-000000000001'
        OR public.fn_lesson_day_index(lessons.id) <= 2
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
      AND (
        school_id <> 'a0a0a0a0-0000-0000-0000-000000000001'
        OR public.fn_lesson_day_index(lessons.id) <= 2
      )
    )
    OR public.is_super_admin()
  );

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('157')
ON CONFLICT DO NOTHING;

COMMIT;
