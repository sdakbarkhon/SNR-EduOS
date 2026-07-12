-- =====================================================================
-- Migration 119 — привязать course_materials к исходному lesson_stages.
--
-- Баг: addAiPresentationToGroupMaterials (packages/core/src/queries/index.ts)
-- вставляет строку course_materials для AI-сгенерированной презентации
-- (slides jsonb на lesson_stages), но НЕ пишет ни storage_path, ни
-- link_url — реальный контент никогда не был файлом в Storage. Открытие
-- такого материала в "Материалы группы" всегда падало на "У этого
-- материала нет файла", потому что не было ни файла, ни способа найти
-- исходный lesson_stages по одной только course_materials-строке (не было
-- FK — только хрупкое совпадение (group_id, title, type) для дедупа).
--
-- Добавляем stage_id — точная FK-ссылка на исходный этап; UI теперь может
-- дотянуться до lesson_stages.slides и открыть презентацию через тот же
-- SlideViewer, что и в уроке. ON DELETE CASCADE: если учитель удалит сам
-- этап (единственный источник контента этой карточки), карточка в
-- "Материалы группы" тоже должна исчезнуть — оставлять её значило бы
-- вернуть тот же "нет файла" баг для другого источника.
-- =====================================================================

BEGIN;

ALTER TABLE public.course_materials
  ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES public.lesson_stages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_course_materials_stage_id
  ON public.course_materials (stage_id) WHERE stage_id IS NOT NULL;

-- Best-effort backfill для уже созданных до этой миграции строк: та же
-- пара (group_id, title) + content_type='presentation', что использовал
-- дедуп в addAiPresentationToGroupMaterials. Трогает только строки без
-- storage_path/link_url (т.е. заведомо AI-сгенерированные, а не ручные
-- .pptx-загрузки) и без уже проставленного stage_id — безопасно повторять.
UPDATE public.course_materials cm
SET stage_id = ls.id,
    lesson_id = COALESCE(cm.lesson_id, l.id)
FROM public.lesson_stages ls
JOIN public.lessons l ON l.id = ls.lesson_id
WHERE cm.type = 'presentation'
  AND cm.stage_id IS NULL
  AND cm.storage_path IS NULL
  AND cm.link_url IS NULL
  AND ls.content_type = 'presentation'
  AND ls.title = cm.title
  AND l.group_id = cm.group_id;

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('119')
ON CONFLICT (version) DO NOTHING;

COMMIT;
