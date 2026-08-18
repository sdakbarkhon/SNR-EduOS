-- Миграция 212: учебный план собирается из книги, и темы подтверждаются
-- учителем до того, как план становится настоящим.
--
-- ЗАЧЕМ. Учитель загружал файл готового плана, и ИИ разбирал его на темы. Но
-- плана у учителя часто нет вовсе — есть учебник. Теперь источником может быть
-- книга из библиотеки школы, а разбирает её тот же самый механизм: меняется
-- только место, откуда берутся байты.
--
-- ── 1. ОТКУДА ВЗЯЛСЯ ПЛАН ──────────────────────────────────────────────────
-- source_book_id — книга-источник. Отдельная колонка, а не запись пути в
-- source_file_url: файл книги лежит в ДРУГОМ бакете (books, не
-- curriculum-plans), и по одному пути нельзя понять, где его искать. Ссылка на
-- книгу к тому же переживает переименование файла и даёт экрану показать
-- название учебника.
--
-- ON DELETE SET NULL, а не CASCADE: книгу из библиотеки могут убрать, и уносить
-- вместе с ней готовый учебный план с уроками было бы дикостью.
--
-- ── 2. СОСТОЯНИЕ «ПРЕДПРОСМОТР» ────────────────────────────────────────────
-- К статусам добавляется 'preview': темы разобраны и показаны учителю, но план
-- ещё не принят. Пока он в этом состоянии — это черновик: уроки по нему не
-- создают, в списке планов он помечен.
--
-- ПОЧЕМУ НЕ ПОКАЗАТЬ ТЕМЫ В ОКНЕ, НЕ СОЗДАВАЯ СТРОКУ ВОВСЕ. Разбор учебника
-- идёт полминуты и дольше: скачать файл на десятки мегабайт, извлечь текст,
-- сходить к модели. Держать всё это в открытом окне — ровно та ошибка, из-за
-- которой раньше загрузка плана блокировала интерфейс на 10-30 секунд, и от
-- которой уходили «большим фиксом». Поэтому строка создаётся сразу, разбор
-- идёт в фоне с настоящим показом хода работы, а «до создания» обеспечивается
-- статусом: пока учитель не согласился, плана как рабочего объекта нет.
--
-- ── 3. НАСТОЯЩИЙ ХОД РАБОТЫ ────────────────────────────────────────────────
-- progress_stage — что именно происходит прямо сейчас: download / extract /
-- outline / model / save. Раньше был только процент, и он был выдуманный:
-- 10 → 30 → 60 → 90 расставлены по коду как приметы, а не измерены. Для
-- разбора книги этого мало: скачивание тридцатимегабайтного PDF само по себе
-- занимает заметное время, и учитель, глядя на застывшие 30%, решает, что всё
-- сломалось. Текстовая стадия говорит, чем занят сервер.

ALTER TABLE public.curriculum_plans
  ADD COLUMN IF NOT EXISTS source_book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS progress_stage text;

COMMENT ON COLUMN public.curriculum_plans.source_book_id IS
  'Книга-источник, если план собран из учебника. Файл лежит в бакете books, '
  'а не curriculum-plans — отсюда отдельная колонка вместо пути.';
COMMENT ON COLUMN public.curriculum_plans.progress_stage IS
  'Чем сервер занят прямо сейчас: download/extract/outline/model/save. '
  'Проценты сами по себе выдуманы, стадия — настоящая.';

-- Статус «предпросмотр»: темы предложены, учитель ещё не согласился.
ALTER TABLE public.curriculum_plans DROP CONSTRAINT IF EXISTS curriculum_plans_status_check;
ALTER TABLE public.curriculum_plans ADD CONSTRAINT curriculum_plans_status_check
  CHECK (status = ANY (ARRAY['processing'::text, 'preview'::text, 'ready'::text, 'error'::text]));

-- ── Самопроверка ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cols integer;
  v_plan uuid;
BEGIN
  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_name = 'curriculum_plans' AND column_name IN ('source_book_id', 'progress_stage');
  IF v_cols <> 2 THEN RAISE EXCEPTION 'колонок % вместо 2', v_cols; END IF;

  -- Новый статус принимается, старые не сломались.
  SELECT id INTO v_plan FROM public.curriculum_plans LIMIT 1;
  IF v_plan IS NOT NULL THEN
    UPDATE public.curriculum_plans SET status = 'preview' WHERE id = v_plan;
    UPDATE public.curriculum_plans SET status = 'ready' WHERE id = v_plan;
  END IF;

  BEGIN
    UPDATE public.curriculum_plans SET status = 'выдуманный' WHERE id = v_plan;
    RAISE EXCEPTION 'ограничение статуса не работает: приняло произвольное значение';
  EXCEPTION WHEN check_violation THEN
    NULL; -- так и должно быть
  END;

  RAISE NOTICE 'Миграция 212: источник-книга и предпросмотр заведены';
END $$;
