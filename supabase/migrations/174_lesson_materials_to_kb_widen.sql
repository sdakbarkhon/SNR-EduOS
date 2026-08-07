-- 174 — автопубликация материалов урока в материалы группы: сняты три
-- ограничения + починен бакет.
--
-- ЧТО БЫЛО. Механизм из миграции 124 (Промт 7.6, 13.07.2026) жив и работает:
-- триггер trg_lesson_completed_to_kb на переход lessons.status в 'completed'
-- зовёт fn_lesson_materials_to_kb(). Но его WHERE пропускал почти всё —
-- на живых данных автопубликацию проходили 3 материала из 270:
--   * file_storage_path IS NOT NULL — ССЫЛКИ не публиковались вообще
--     (все video_youtube/video_rutube мимо);
--   * from_knowledge_base = false — материалы, прилинкованные из Базы знаний,
--     пропускались (264 файла из 265);
--   * visibility = 'all' — скрытые от учеников пропускались.
-- По решению заказчика (07.08.2026) все три сняты: в материалы группы
-- попадает всё, что было использовано на уроке.
--
-- ПЛЮС РЕГРЕСС, который чиним здесь же. Бакет был захардкожен строкой
-- 'lesson-materials'. K.1 (миграция 167) завёл .mp4 в ОТДЕЛЬНЫЙ бакет
-- lesson-videos, а материалы из Базы знаний вообще живут в своём (kb_bucket:
-- 'materials'/'books', миграция 115). Опубликованная строка вела на файл в
-- несуществующем месте — скачивание отдавало 404. Теперь бакет считается по
-- той же формуле, что в приложении (apps/web/lib/material-url.ts::
-- materialBucket): video_mp4 -> lesson-videos, иначе kb_bucket, иначе
-- lesson-materials.
--
-- ПРО visibility. У course_materials собственной колонки видимости НЕТ
-- (id, group_id, lesson_id, title, type, file_url, link_url, created_at,
-- description, subject, file_type, storage_path, file_size_bytes,
-- uploaded_by, school_id, stage_id, bucket) — переносить значение некуда,
-- фильтр просто снят. Материалы группы скоупятся по group_id через RLS.
--
-- ДЕДУПЛИКАЦИЯ. Веток теперь две, потому что у ссылок нет storage_path:
--   * файл — по (group_id, storage_path);
--   * ссылка — по (group_id, link_url).
-- Снятие фильтра from_knowledge_base само по себе дублей не создаёт: файл,
-- пришедший из БЗ, уже лежит в course_materials этой группы с тем же
-- storage_path, и первая ветка его отсекает. Это и есть корректное поведение.
--
-- Триггер НЕ пересоздаётся — правится только вызываемая им функция.
-- Идемпотентна: CREATE OR REPLACE.

BEGIN;

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
  v_bucket text;
  v_type text;
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
      -- Фильтры from_knowledge_base / visibility / file_storage_path сняты,
      -- см. шапку. Осталось единственное требование: у записи должно быть
      -- ЧТО публиковать — либо файл в Storage, либо внешняя ссылка.
      AND (file_storage_path IS NOT NULL OR external_url IS NOT NULL)
  LOOP
    -- ── ССЫЛКА (нет файла в Storage) ──────────────────────────────────────
    IF v_material.file_storage_path IS NULL THEN
      -- type='video' для видео-ссылок: MaterialsView.resolveType() читает его
      -- раньше ветки link_url и рисует видео-иконку, а открытие всё равно
      -- уходит в inline-плеер (там проверка link_url && !storage_path).
      -- Прочие ссылки оставляем без type — отрисуются как «link».
      v_type := CASE
        WHEN v_material.content_type IN ('video_youtube', 'video_rutube') THEN 'video'
        ELSE NULL
      END;

      INSERT INTO public.course_materials (
        group_id, lesson_id, title, subject, type, link_url, uploaded_by, school_id
      )
      SELECT
        v_group_id, p_lesson_id, v_material.title, v_subject_name, v_type,
        v_material.external_url, v_material.uploaded_by, v_school_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.course_materials cm
        WHERE cm.group_id = v_group_id
          AND cm.link_url = v_material.external_url
      );

      CONTINUE;
    END IF;

    -- ── ФАЙЛ В STORAGE ────────────────────────────────────────────────────
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

    -- Та же формула, что materialBucket() в apps/web/lib/material-url.ts.
    v_bucket := CASE
      WHEN v_material.content_type = 'video_mp4' THEN 'lesson-videos'
      ELSE COALESCE(v_material.kb_bucket, 'lesson-materials')
    END;

    INSERT INTO public.course_materials (
      group_id, lesson_id, title, subject, file_type,
      storage_path, bucket, file_size_bytes, uploaded_by, school_id
    )
    SELECT
      v_group_id, p_lesson_id, v_material.title, v_subject_name, v_file_type,
      v_material.file_storage_path, v_bucket, v_material.file_size_bytes,
      v_material.uploaded_by, v_school_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.course_materials cm
      WHERE cm.group_id = v_group_id
        AND cm.storage_path = v_material.file_storage_path
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.fn_lesson_materials_to_kb(uuid) IS
  'Публикует материалы урока в материалы группы при завершении урока. '
  'Файлы и ссылки, включая прилинкованные из Базы знаний и скрытые от учеников '
  '(миграция 174 сняла эти фильтры). Бакет считается по content_type/kb_bucket. '
  'Дедупликация: по storage_path для файлов, по link_url для ссылок.';

COMMIT;
