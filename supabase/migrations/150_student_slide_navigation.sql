-- =====================================================================
-- Migration 150 — синхронная навигация по слайдам: ученик тоже может
-- листать активную презентацию своего ИДУЩЕГО урока (не только учитель).
--
-- Точечная PERMISSIVE UPDATE-политика на lesson_stages — тот же паттерн,
-- что уже принят в миграции 117 ("student completes own group lesson
-- summary stage"): PERMISSIVE политики ИЛИтся с существующими
-- "teacher updates own subject lesson stages" (миграция 131) — ничего не
-- отбирает у учителя, только добавляет узкое право ученику.
--
-- RLS не умеет ограничить конкретную КОЛОНКУ (current_slide_index) — та же
-- принятая в этом проекте степень строгости, что и в миграции 117 (см. её
-- комментарий). Единственный клиентский путь, который реально шлёт UPDATE
-- от имени ученика на lesson_stages — setCurrentSlide() в packages/core
-- (queries/index.ts), и он всегда шлёт только { current_slide_index }.
--
-- Условие l.active_stage_id = lesson_stages.id — не избыточная
-- перестраховка: apps/web/app/(app)/lessons/[id]/LessonWorkspaceView.tsx
-- рендерит SlideViewer/StudentPresentationViewer ТОЛЬКО для activeMiddleStage
-- (centerStages), пока лежит статус 'in_progress' — ученический клиент
-- физически не может смонтировать вьюер для чужой (неактивной) стадии,
-- эта политика подтверждает то же самое на сервере.
--
-- fn_stamp_is_demo (миграция 110, точечно исключена в 127 именно для
-- current_slide_index на lesson_stages) продолжает работать без изменений —
-- демо-сессия ученика получает то же освобождение, что уже есть у демо-
-- учителя, никакой новой логики здесь не требуется.
--
-- Применить вручную через Supabase Dashboard SQL Editor. Идемпотентно
-- (DROP POLICY IF EXISTS перед CREATE), безопасно перезапускать.
-- =====================================================================

BEGIN;

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
      )
    )
    OR public.is_super_admin()
  );

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('150')
ON CONFLICT (version) DO NOTHING;

COMMIT;
