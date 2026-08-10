-- 182, 10.08.2026 — работы Scratch хранятся у нас.
--
-- ЗАЧЕМ. Кнопки «Сохранить», «Мои работы» и «Поделиться» в нашей копии
-- Scratch рассчитаны на серверы scratch.mit.edu, к которым копия не
-- подключена, и писали «скоро». Теперь редактор отдаёт файл проекта наружу
-- событием, а платформа кладёт его в своё приватное хранилище.
--
-- ПОЧЕМУ РАСШИРЯЕМ sandbox_projects, А НЕ ЗАВОДИМ НОВУЮ ТАБЛИЦУ. Таблица уже
-- существует (миграция 118) ровно под это: ученик, школа, имя работы,
-- идентификатор сервиса, автосейв, времена. До сих пор её использовал только
-- CodeSandbox, потому что текст кода можно было прочитать, а из чужой рамки
-- состояние взять было нечем. Scratch — второй сервис с настоящим
-- состоянием, и это тот же самый список работ ученика, а не отдельная
-- сущность. Заводить вторую таблицу значило бы держать два «моих проекта».
--
-- ЧТО ДОБАВЛЯЕТСЯ:
--   file_path         — путь в бакете scratch-projects. У CodeSandbox работа
--                       лежит в колонке code (текст), у Scratch это двоичный
--                       .sb3, ему место в хранилище, а не в строке.
--   origin            — откуда работа: песочница, урок или домашнее задание.
--                       От него зависит, увидит ли её учитель.
--   lesson_stage_id   — привязка к этапу урока, если работа оттуда.
--   homework_id       — привязка к заданию.
--   shared_with_class — ученик показал работу классу («Поделиться»).
--
-- ПРАВА. Ученик как видел только свои работы, так и видит — политики
-- миграции 118 не трогаются. Добавляется ОДНА политика для учителя, и она
-- намеренно узкая:
--   • только origin 'lesson' или 'homework' — работы из ПЕСОЧНИЦЫ учителю не
--     видны никогда, это личное пространство ученика (решение заказчика);
--   • только ученики групп, которые ведёт сам учитель — через
--     is_my_teacher_group(), тот же предикат, что гейтит остальной контент.
-- Одноклассники чужих работ не видят вовсе: политики «поделиться» здесь нет,
-- она появится вместе с экраном, сейчас колонка только хранит признак.

ALTER TABLE public.sandbox_projects
  ADD COLUMN IF NOT EXISTS file_path         text,
  ADD COLUMN IF NOT EXISTS origin            text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS lesson_stage_id   uuid REFERENCES public.lesson_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS homework_id       uuid REFERENCES public.homework(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shared_with_class boolean NOT NULL DEFAULT false;

ALTER TABLE public.sandbox_projects
  DROP CONSTRAINT IF EXISTS sandbox_projects_origin_check;
ALTER TABLE public.sandbox_projects
  ADD CONSTRAINT sandbox_projects_origin_check
  CHECK (origin = ANY (ARRAY['sandbox', 'lesson', 'homework']::text[]));

-- Учитель ищет работы по конкретному заданию или этапу — индексируем оба.
CREATE INDEX IF NOT EXISTS idx_sandbox_projects_homework
  ON public.sandbox_projects (homework_id) WHERE homework_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sandbox_projects_stage
  ON public.sandbox_projects (lesson_stage_id) WHERE lesson_stage_id IS NOT NULL;

DROP POLICY IF EXISTS "teacher reads class work by assignment" ON public.sandbox_projects;
CREATE POLICY "teacher reads class work by assignment" ON public.sandbox_projects FOR SELECT
  USING (
    origin IN ('lesson', 'homework')
    AND EXISTS (
      SELECT 1 FROM public.student_groups sg
       WHERE sg.student_id = sandbox_projects.student_id
         AND public.is_my_teacher_group(sg.group_id)
    )
  );

-- ── Хранилище ───────────────────────────────────────────────────────────────
-- Приватный бакет, как остальные тринадцать: наружу файлы не отдаются, чтение
-- идёт подписанной ссылкой с сервера после проверки прав. Собственных политик
-- storage.objects не заводим намеренно — доступ гейтится в серверном
-- маршруте, где уже известно, чья это работа и кто её просит.
INSERT INTO storage.buckets (id, name, public)
VALUES ('scratch-projects', 'scratch-projects', false)
ON CONFLICT (id) DO NOTHING;

COMMENT ON COLUMN public.sandbox_projects.origin IS
  'sandbox | lesson | homework. Работы из песочницы учителю не видны — см. политику teacher reads class work by assignment.';
