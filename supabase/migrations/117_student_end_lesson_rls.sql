-- =====================================================================
-- Migration 117 — Промт 5А, Часть 3: RLS для ручного "Закончить урок"
-- со стороны УЧЕНИКА.
--
-- Баг: кнопка "Закончить урок" существует и вызывается на обеих сторонах
-- (packages/core/src/queries/index.ts::endLesson — общая функция;
-- apps/web/app/teacher/lessons/[id]/TeacherLessonDetailView.tsx и
-- apps/web/app/(app)/lessons/[id]/LessonWorkspaceView.tsx, последний с
-- комментарием "БОЛЬШОЕ ОБНОВЛЕНИЕ §7.6 — available to student too, not
-- just teacher"), но у УЧЕНИКА молча не срабатывала: endLesson() шлёт
-- прямой UPDATE через browser-supabase-клиент (authenticated-роль
-- ученика, не service_role/RPC). Единственная UPDATE-политика на
-- lessons — "teacher updates own group lessons" (20260618000025 /
-- изменена 71/73) — матчит только is_my_teacher_group(group_id), у
-- ученика current_teacher_id() всегда NULL → политика не совпадает.
-- PostgREST/RLS НЕ бросает ошибку когда 0 строк совпало по политике —
-- .update(...) в endLesson() просто трогает 0 строк без error, поэтому
-- клиент не замечает сбоя (кнопка "виснет", урок остаётся in_progress
-- до pg_cron fn_auto_end_lessons по ends_at). Тот же провал у
-- lesson_stages (summary-этап, второй .update() внутри endLesson()) —
-- там тоже единственная UPDATE-политика "teacher manages own lesson
-- stages" (is_my_teacher_group).
--
-- Фикс — 2 узкие student-only permissive UPDATE-политики (PERMISSIVE
-- по умолчанию — ИЛИтся с существующей teacher-политикой на той же
-- команде, ничего не отбирает у учителя):
--   1. lessons: ученик своей группы может перевести СВОЙ урок ровно
--      in_progress → completed (WITH CHECK фиксирует конечный статус,
--      USING — что трогать можно только уже идущий урок своей группы).
--   2. lesson_stages: ученик своей группы может пометить выполненным
--      ровно summary-этап урока своей группы.
-- Как и "teacher grades stage progress" (20260620000035) эта политика
-- не запрещает менять другие колонки строки на уровне RLS (Postgres RLS
-- не умеет ограничивать набор колонок per-role, когда общий GRANT UPDATE
-- уже открыт всем authenticated) — тот же уровень строгости, что уже
-- принят в этой схеме для аналогичных "ограниченных" ученических правок.
--
-- fn_stamp_is_demo (миграция 110) продолжает независимо блокировать
-- демо-сессию (ученика ИЛИ учителя), пытающуюся завершить РЕАЛЬНЫЙ
-- (is_demo=false) урок эксепшеном 'editing_real_data_in_demo' — это
-- ожидаемое поведение, эта миграция его не меняет и не обходит.
--
-- Ничего не бэкфиллится и не апдейтится в существующих строках lessons/
-- lesson_stages/lesson_materials — только новые CREATE POLICY
-- (идемпотентно через DROP POLICY IF EXISTS).
-- =====================================================================

BEGIN;

-- ── 1. lessons: ученик завершает урок своей группы ────────────────────────
DROP POLICY IF EXISTS "student ends own in-progress lesson" ON public.lessons;
CREATE POLICY "student ends own in-progress lesson"
  ON public.lessons FOR UPDATE TO authenticated
  USING (
    (
      public.is_my_group(group_id)
      AND status = 'in_progress'
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      public.is_my_group(group_id)
      AND status = 'completed'
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- ── 2. lesson_stages: ученик завершает summary-этап своего урока ──────────
DROP POLICY IF EXISTS "student completes own group lesson summary stage" ON public.lesson_stages;
CREATE POLICY "student completes own group lesson summary stage"
  ON public.lesson_stages FOR UPDATE TO authenticated
  USING (
    (
      stage_role = 'summary'
      AND school_id = public.current_school_id()
      AND public.is_my_group(
        (SELECT l.group_id FROM public.lessons l WHERE l.id = lesson_stages.lesson_id LIMIT 1)
      )
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      stage_role = 'summary'
      AND school_id = public.current_school_id()
      AND public.is_my_group(
        (SELECT l.group_id FROM public.lessons l WHERE l.id = lesson_stages.lesson_id LIMIT 1)
      )
    )
    OR public.is_super_admin()
  );

-- ── 3. Регистрация ──────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('117')
ON CONFLICT (version) DO NOTHING;

COMMIT;
