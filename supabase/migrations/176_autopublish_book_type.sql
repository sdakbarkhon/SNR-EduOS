-- 176 — автопубликация помечает книги из Библиотеки как книги.
--
-- ЧТО БЫЛО. Миграция 174 сняла ограничения автопубликации, и в материалы
-- группы приехали в том числе 30 книг из Библиотеки (kb_bucket='books').
-- Тип файла считается по расширению из file_original_name/file_storage_path,
-- а у книг в пути расширения нет — все 30 получили
-- file_type='application/octet-stream'. В списке материалов
-- MaterialsView.resolveType() не узнаёт такой тип и рисует их как обычные
-- файлы: серая иконка «файл» вместо книжной.
--
-- ЧТО ДЕЛАЕМ. `course_materials.type` уже поддерживает значение 'book' —
-- resolveType() проверяет `t === "book"` ТРЕТЬИМ условием, раньше ветки
-- link_url и раньше image, то есть достаточно проставить его. Никаких новых
-- колонок и ограничений не нужно.
--
-- Файловая ветка функции вообще не писала `type` (в отличие от ветки ссылок,
-- где 174 его проставляет для видео) — добавляем.

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
      -- Фильтры from_knowledge_base / visibility / file_storage_path сняты
      -- миграцией 174. Осталось единственное требование: у записи должно быть
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

    -- 176 — ЕДИНСТВЕННОЕ смысловое изменение относительно 174. Материал,
    -- пришедший из Библиотеки (kb_bucket='books'), помечаем как книгу: у
    -- таких путей нет расширения, v_file_type выше даёт
    -- 'application/octet-stream', и без этого они выглядят серыми файлами.
    -- Видео помечаем по бакету — так же, как это уже делает ветка ссылок.
    v_type := CASE
      WHEN v_material.kb_bucket = 'books' THEN 'book'
      WHEN v_bucket = 'lesson-videos' THEN 'video'
      ELSE NULL
    END;

    INSERT INTO public.course_materials (
      group_id, lesson_id, title, subject, type, file_type,
      storage_path, bucket, file_size_bytes, uploaded_by, school_id
    )
    SELECT
      v_group_id, p_lesson_id, v_material.title, v_subject_name, v_type, v_file_type,
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

-- ── Досыпка уже опубликованных записей ───────────────────────────────────
-- Идемпотентно: WHERE type IS DISTINCT FROM ... — повторный прогон не тронет
-- ничего. Трогаем ТОЛЬКО строки, приехавшие автопубликацией из Библиотеки
-- (bucket='books'); загруженные учителем вручную материалы в бакете
-- 'materials' и книги в самой Библиотеке не затрагиваются.
UPDATE public.course_materials
   SET type = 'book'
 WHERE bucket = 'books'
   AND type IS DISTINCT FROM 'book';

-- Заодно то же самое для видео, приехавших автопубликацией: у них
-- file_type='video/mp4' и resolveType() и так вернёт "video", так что это
-- лишь приводит данные к тому, что теперь пишет функция.
UPDATE public.course_materials
   SET type = 'video'
 WHERE bucket = 'lesson-videos'
   AND type IS DISTINCT FROM 'video';

COMMIT;
