-- 175 — единый набор типов материалов во всех вкладках Базы знаний.
--
-- ЗАЧЕМ. Решение заказчика (07.08.2026): «в Базе знаний должно быть всё
-- одинаково в плане материалов, только разница будет в доступе». Сейчас
-- вкладки умеют разное:
--
--   вкладка               файл          видео-ссылка   .mp4 файлом
--   ─────────────────────────────────────────────────────────────
--   Материалы группы      да            НЕТ ФОРМЫ      да
--   Библиотека (books)    ТОЛЬКО PDF    НЕЛЬЗЯ         НЕЛЬЗЯ
--   Материалы кафедры     да            да, но не .mp4 да
--
-- ЧТО МЕНЯЕТСЯ В БД, а что нет. Из трёх таблиц DDL нужен только двум:
--
--   * course_materials — НИЧЕГО. CHECK-ограничений на ней нет вовсе,
--     link_url есть с самой первой миграции, storage_path и так nullable
--     (у 469 из 501 записей он NULL — это AI-презентации). Вкладке не
--     хватало только формы, это чистый UI.
--   * books — блокирует NOT NULL на file_storage_path, и колонки под ссылку
--     нет ни одной. Плюс бакет пускает только pdf/jpeg/png/webp.
--   * teacher_library_materials — блокирует одна ветка CHECK: у video_mp4
--     обязателен storage_path, поэтому прямая .mp4-ССЫЛКА не сохраняется.
--
-- ДОСТУП НЕ ТРОГАЕТСЯ. Ни одной политики RLS, ни одного GRANT, ни политик
-- чтения Storage здесь нет — это единственная разница между вкладками, и она
-- остаётся ровно такой, какой была: книги видит вся школа, материалы группы —
-- своя группа, материалы кафедры — учителя своего предмета.

BEGIN;

-- ─── A. books: ссылка вместо файла ───────────────────────────────────────────

-- Физический блокер: без этого строка-ссылка невозможна в принципе.
ALTER TABLE public.books ALTER COLUMN file_storage_path DROP NOT NULL;

ALTER TABLE public.books ADD COLUMN IF NOT EXISTS external_url text;

COMMENT ON COLUMN public.books.external_url IS
  'Видео-ссылка вместо файла: YouTube/RuTube (уже нормализованный embed-URL) '
  'или прямой .mp4. NULL у книг-файлов. Тип определяется на рендере общим '
  'классификатором (lib/material-kind.ts), отдельной колонки content_type '
  'здесь НЕТ намеренно — см. заголовок миграции.';

-- Строка — либо файл, либо ссылка, третьего не дано. Именно «либо-либо», а не
-- «хотя бы одно»: обе заполненные означали бы, что рендер и удаление должны
-- гадать, что главнее. Все 10 существующих записей имеют file_storage_path и
-- пустой external_url — новая проверка им подходит без единой правки данных.
ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_content_shape_chk;
ALTER TABLE public.books ADD CONSTRAINT books_content_shape_chk CHECK (
  (file_storage_path IS NOT NULL AND external_url IS NULL)
  OR (external_url IS NOT NULL AND file_storage_path IS NULL)
);

-- Бакет: было только pdf/jpeg/png/webp. Добавляем документы, ещё один формат
-- картинок и видео — но НЕ «всё подряд»: список остаётся белым, произвольные
-- исполняемые файлы туда по-прежнему не загрузить. Файлы книг остаются в
-- бакете books (в том числе .mp4) — отдельная колонка bucket этой таблице не
-- заводится, иначе getBookSignedUrl и удаление книги пришлось бы учить
-- выбирать хранилище.
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
         'application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'image/jpeg', 'image/png', 'image/webp',
         'video/mp4'
       ]
 WHERE id = 'books';

-- ─── B. teacher_library_materials: прямая .mp4-ссылка ────────────────────────

-- Ветка video_mp4 требовала storage_path, то есть загруженный файл. Прямая
-- .mp4-ссылка не сохранялась совсем — до 4fe7585 она вообще молча ложилась
-- как video_rutube (порча данных), после — честно отклонялась.
--
-- ПОЧЕМУ ОСЛАБЛЯЕМ ПРОВЕРКУ, А НЕ ЗАВОДИМ НОВЫЙ content_type. Новое значение
-- ('video_url') стоило бы тех же двух перезаписей CHECK ПЛЮС правки TS-юнионов
-- в четырёх местах ПЛЮС всех switch по content_type (их шесть) ПЛЮС такого же
-- расширения lesson_materials и homework — иначе прикрепление такого материала
-- к уроку молча ломается. Каждый пропущенный switch — тихая ошибка рендера.
-- Ослабление же меняет ровно одно утверждение: «video_mp4 больше не значит,
-- что файл в Storage». Его потребителей можно перечислить, и они правятся в
-- этом же коммите.
--
-- Существующие 12 записей (10 file + 2 video_youtube) под новую проверку
-- подходят без изменений; ветка file и ветка youtube/rutube не тронуты.
ALTER TABLE public.teacher_library_materials
  DROP CONSTRAINT IF EXISTS teacher_library_materials_content_shape_chk;
ALTER TABLE public.teacher_library_materials
  ADD CONSTRAINT teacher_library_materials_content_shape_chk CHECK (
    (content_type = 'file' AND storage_path IS NOT NULL)
    OR (content_type IN ('video_youtube', 'video_rutube')
        AND external_url IS NOT NULL AND source_url IS NOT NULL)
    OR (content_type = 'video_mp4'
        AND (storage_path IS NOT NULL
             OR (external_url IS NOT NULL AND source_url IS NOT NULL)))
  );

COMMENT ON COLUMN public.teacher_library_materials.content_type IS
  'file — файл в Storage; video_youtube/video_rutube — embed-ссылка; '
  'video_mp4 — mp4 ЛИБО загруженный (storage_path в бакете lesson-videos), '
  'ЛИБО прямая ссылка (external_url). Миграция 175.';

COMMIT;
