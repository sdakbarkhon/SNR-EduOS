-- Промт 7.6 — автопубликация материалов урока в Базу знаний (Материалы группы)
-- при переходе урока в статус 'completed'.
--
-- Аудит (Часть 1) показал расхождения с исходным планом промта:
--   * course_materials УЖЕ имеет lesson_id (FK -> lessons ON DELETE SET NULL,
--     миграция 119) — отдельная колонка source_lesson_id не нужна, переиспользуем.
--   * course_materials.subject — свободный text (не subject_id FK); заполняем
--     из subjects.name урока, как это уже делают insertMaterial/AI-презентации.
--   * lesson_materials НЕ имеет file_type — MIME выводим по расширению файла.
--   * lesson_materials.visibility ('all' | 'teacher_only') — teacher_only не
--     публикуем в общую БЗ (не в исходном плане, но следует из модели видимости).
--   * КРИТИЧНО: lesson_materials хранит файлы в Storage-бакете "lesson-materials",
--     а весь существующий код course_materials жёстко резолвит бакет "materials"
--     (getMaterialDownloadUrl). Прямая вставка storage_path без учёта бакета
--     сломала бы скачивание (404: файл ищется не там). Добавляем bucket-колонку.
--   * fn_auto_end_lessons — SECURITY DEFINER, обычный UPDATE без подавления
--     триггеров (нет session_replication_role/pg_trigger_depth-обхода) — наш
--     AFTER UPDATE OF status триггер сработает от него так же, как от ручного
--     клика "Закончить урок" (RLS ученика, миграция 117).
--
-- Ретроспективно НЕ применяется: триггер реагирует только на будущие
-- UPDATE lessons SET status='completed', существующие завершённые уроки не трогаем.

BEGIN;

ALTER TABLE public.course_materials
  ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'materials';

COMMENT ON COLUMN public.course_materials.bucket IS
  'Storage-бакет для storage_path. По умолчанию materials (весь существующий контент). '
  'lesson-materials — для строк, автопубликованных из lesson_materials при завершении урока '
  '(fn_lesson_materials_to_kb); файл физически принадлежит lesson_materials, поэтому при '
  'удалении такой course_materials-строки объект Storage НЕ удаляется (см. deleteMaterial).';

CREATE OR REPLACE FUNCTION public.fn_lesson_materials_to_kb(p_lesson_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject_id uuid;
  v_group_id uuid;
  v_school_id uuid;
  v_subject_name text;
  v_material RECORD;
  v_file_type text;
BEGIN
  SELECT subject_id, group_id, school_id
    INTO v_subject_id, v_group_id, v_school_id
    FROM public.lessons
    WHERE id = p_lesson_id;

  IF v_group_id IS NULL THEN
    RETURN;
  END IF;

  IF v_subject_id IS NOT NULL THEN
    SELECT name INTO v_subject_name FROM public.subjects WHERE id = v_subject_id;
  END IF;

  FOR v_material IN
    SELECT *
    FROM public.lesson_materials
    WHERE lesson_id = p_lesson_id
      AND from_knowledge_base = false   -- уже есть в БЗ (линк), не дублировать
      AND visibility = 'all'            -- teacher_only не публикуем в общую БЗ
      AND file_storage_path IS NOT NULL
  LOOP
    v_file_type := CASE lower(regexp_replace(
        coalesce(v_material.file_original_name, v_material.file_storage_path), '^.*\.', ''))
      WHEN 'pdf'  THEN 'application/pdf'
      WHEN 'doc'  THEN 'application/msword'
      WHEN 'docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      WHEN 'ppt'  THEN 'application/vnd.ms-powerpoint'
      WHEN 'pptx' THEN 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      WHEN 'xls'  THEN 'application/vnd.ms-excel'
      WHEN 'xlsx' THEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      WHEN 'jpg'  THEN 'image/jpeg'
      WHEN 'jpeg' THEN 'image/jpeg'
      WHEN 'png'  THEN 'image/png'
      WHEN 'gif'  THEN 'image/gif'
      WHEN 'webp' THEN 'image/webp'
      WHEN 'svg'  THEN 'image/svg+xml'
      WHEN 'mp4'  THEN 'video/mp4'
      WHEN 'webm' THEN 'video/webm'
      ELSE 'application/octet-stream'
    END;

    INSERT INTO public.course_materials (
      group_id, lesson_id, title, subject, file_type,
      storage_path, bucket, file_size_bytes, uploaded_by, school_id
    )
    SELECT
      v_group_id, p_lesson_id, v_material.title, v_subject_name, v_file_type,
      v_material.file_storage_path, 'lesson-materials', v_material.file_size_bytes,
      v_material.uploaded_by, v_school_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.course_materials cm
      WHERE cm.group_id = v_group_id
        AND cm.storage_path = v_material.file_storage_path
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_lesson_status_to_kb()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    PERFORM public.fn_lesson_materials_to_kb(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lesson_completed_to_kb ON public.lessons;
CREATE TRIGGER trg_lesson_completed_to_kb
  AFTER UPDATE OF status ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_lesson_status_to_kb();

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('124')
ON CONFLICT DO NOTHING;

COMMIT;
