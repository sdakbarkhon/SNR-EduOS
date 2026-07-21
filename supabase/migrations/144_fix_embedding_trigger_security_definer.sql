-- =====================================================================
-- Migration 144 — fn_enqueue_*_embedding триггеры: добавить SECURITY
-- DEFINER (фикс HTTP 403 при сохранении этапов урока).
--
-- Баг: миграция 139 создала fn_enqueue_lesson_stage_embedding() и
-- fn_enqueue_quiz_stage_embedding() как обычные SECURITY INVOKER
-- (LANGUAGE plpgsql, без SECURITY DEFINER) триггеры на lesson_stages /
-- quiz_questions. Та же миграция явно делает
-- REVOKE ALL ON lesson_stages_embedding_queue FROM anon, authenticated
-- (по комментарию в 139: доступ к очереди должен идти только через
-- SECURITY DEFINER-путь / service-role).
--
-- Но триггер, который АВТОМАТИЧЕСКИ пишет в эту очередь при каждом
-- INSERT (и части UPDATE) 'middle'-этапа, выполняется с правами
-- ВЫЗЫВАЮЩЕЙ роли — то есть authenticated (учитель в браузере), а не
-- владельца функции. Поскольку authenticated не имеет прав на
-- lesson_stages_embedding_queue, INSERT внутри триггера падает с
-- Postgres 42501 (permission denied for table
-- lesson_stages_embedding_queue), откатывая ВЕСЬ INSERT/UPDATE в
-- lesson_stages целиком — PostgREST возвращает это как HTTP 403.
--
-- Это ломает ЛЮБУЮ вставку этапа с stage_role='middle' от имени
-- учителя — и AI-генерацию (AiGenerateStagesModal → addLessonStage),
-- и ручное "Добавить этап" (TeacherLessonDetailView → та же функция),
-- а также любой UPDATE slides/description/teacher_notes/stage_role/
-- content_type у уже существующих этапов — с момента применения 139.
--
-- Ручная проверка в конце 139 выполнялась прямым SQL UPDATE в SQL
-- Editor (то есть от имени владельца/postgres, который не упирается в
-- REVOKE), поэтому баг не был замечен на этапе ревью той миграции.
--
-- Фикс: SECURITY DEFINER + SET search_path на обеих функциях — тот же
-- паттерн, что уже применён в этой же 139 для
-- match_lesson_stage_embeddings(), и повсеместно в RLS-хелперах
-- проекта (is_subject_owner, teacher_can_write_lesson,
-- current_school_id и т.д.). REVOKE ALL на очереди остаётся как есть:
-- учитель по-прежнему не может читать/писать в неё напрямую — только
-- этот триггер (теперь с правами владельца функции) кладёт туда
-- записи.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_enqueue_lesson_stage_embedding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.stage_role = 'middle' THEN
    INSERT INTO public.lesson_stages_embedding_queue (lesson_stage_id, school_id)
    VALUES (NEW.id, NEW.school_id)
    ON CONFLICT (lesson_stage_id) DO UPDATE
      SET enqueued_at = now(), attempts = 0, last_error = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_enqueue_quiz_stage_embedding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_stage_role text;
BEGIN
  SELECT stage_role INTO v_stage_role FROM public.lesson_stages WHERE id = NEW.stage_id;
  IF v_stage_role = 'middle' THEN
    INSERT INTO public.lesson_stages_embedding_queue (lesson_stage_id, school_id)
    VALUES (NEW.stage_id, NEW.school_id)
    ON CONFLICT (lesson_stage_id) DO UPDATE
      SET enqueued_at = now(), attempts = 0, last_error = NULL;
  END IF;
  RETURN NEW;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('144')
ON CONFLICT (version) DO NOTHING;

COMMIT;
