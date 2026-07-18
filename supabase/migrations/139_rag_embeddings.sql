-- =====================================================================
-- Migration 139 — Пачка 5.1: RAG для EduOS Assistant (pgvector).
-- Применить вручную через Supabase Dashboard SQL Editor.
--
-- Область: lesson_stage_embeddings (векторный индекс) + очередь async-
-- обработки (lesson_stages_embedding_queue) + триггеры, которые ставят
-- этапы в очередь при изменении контента.
--
-- РАСХОЖДЕНИЕ С ИСХОДНЫМ ТЗ (важно, проверено live-запросом к БД):
--
-- 1) lesson_stages НЕ имеет колонки `content` — текст теории живёт в
--    JSONB-колонке `slides` (массив слайдов, у каждого свой content),
--    текст practice/прочих задач — в `description`/`teacher_notes`, а
--    текст quiz — вообще в ОТДЕЛЬНОЙ таблице `quiz_questions`
--    (question_text/options), не в lesson_stages вовсе.
--
-- 2) КРИТИЧНО: stage_role в реальных данных принимает только 3 значения —
--    'start' / 'middle' / 'summary' (структурная позиция этапа в уроке).
--    Значений 'theory'/'quiz_qia'/'practice' у stage_role НЕ БЫВАЕТ —
--    условие "stage_role IN ('theory','quiz_qia','practice')" из
--    первой версии этой миграции никогда не было истинным ни для одной
--    строки, т.е. очередь никогда бы не наполнялась. Реальный дискриминатор
--    типа контента — content_type: 'presentation' (теория, есть slides),
--    'quiz_qia'/'quiz_kahoot' (квиз, текст в quiz_questions), и ряд
--    прочих 'task'-типов (code/learningapps/geogebra/wokwi/blockly_games —
--    описание задания в description/teacher_notes, если оно есть).
--    "Не индексировать start/summary" из ТЗ реализовано как
--    stage_role = 'middle' — это и есть единственный настоящий фильтр
--    "не start и не summary" (никакая другая комбинация start/summary
--    не даёт content_type='presentation'/'quiz_qia'/etc. в природе).
--
-- Итог: триггер 1 стоит на UPDATE OF slides, description, teacher_notes,
-- stage_role, content_type (любая из этих колонок может задать/изменить
-- индексируемый текст) и фильтрует по stage_role = 'middle'. Триггер 2
-- на quiz_questions (INSERT/UPDATE) ставит в очередь РОДИТЕЛЬСКИЙ
-- stage_id — без него quiz-этапы никогда бы не переиндексировались
-- после первого раза (текст лежит в другой таблице, lesson_stages-
-- триггер его не видит).
--
-- Embedding-модель — Gemini gemini-embedding-001 с outputDimensionality:768
-- (text-embedding-004 изначально планировалась, но не существует на
-- v1beta — заменена после живого 404 при первом backfill; см.
-- apps/web/lib/ai/embeddings.ts). Cosine similarity — HNSW индекс.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

-- ── 1. lesson_stage_embeddings ───────────────────────────────────────
CREATE TABLE public.lesson_stage_embeddings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_stage_id  uuid NOT NULL REFERENCES public.lesson_stages(id) ON DELETE CASCADE,
  chunk_index      int NOT NULL DEFAULT 0,
  chunk_text       text NOT NULL,
  embedding        vector(768) NOT NULL,
  school_id        uuid NOT NULL REFERENCES public.schools(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_stage_id, chunk_index)
);

CREATE INDEX lesson_stage_embeddings_hnsw_idx
  ON public.lesson_stage_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX lesson_stage_embeddings_school_idx ON public.lesson_stage_embeddings (school_id);
CREATE INDEX lesson_stage_embeddings_stage_idx ON public.lesson_stage_embeddings (lesson_stage_id);

ALTER TABLE public.lesson_stage_embeddings ENABLE ROW LEVEL SECURITY;
-- Ноль клиентских политик — читается только через service-role (cron/
-- backfill) и SECURITY DEFINER-путь внутри Server Action (тот же
-- service-role admin-клиент, что уже использует apps/web/lib/ai/
-- gemini-client.ts's bumpAiUsage()). Студенты не обращаются к этой
-- таблице напрямую.
REVOKE ALL ON public.lesson_stage_embeddings FROM anon, authenticated;

-- ── 2. Очередь на (пере)обработку ────────────────────────────────────
CREATE TABLE public.lesson_stages_embedding_queue (
  lesson_stage_id uuid PRIMARY KEY REFERENCES public.lesson_stages(id) ON DELETE CASCADE,
  school_id       uuid NOT NULL,
  enqueued_at     timestamptz NOT NULL DEFAULT now(),
  attempts        int NOT NULL DEFAULT 0,
  last_error      text
);
CREATE INDEX lesson_stages_embedding_queue_fifo_idx
  ON public.lesson_stages_embedding_queue (enqueued_at);

ALTER TABLE public.lesson_stages_embedding_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_stages_embedding_queue FROM anon, authenticated;

-- ── 3. Триггер на lesson_stages (theory/practice/прочие task —
--      текст меняется прямо в этой таблице) ──────────────────────────
CREATE OR REPLACE FUNCTION public.fn_enqueue_lesson_stage_embedding()
RETURNS trigger
LANGUAGE plpgsql
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

CREATE TRIGGER trg_enqueue_lesson_stage_embedding
  AFTER INSERT OR UPDATE OF slides, description, teacher_notes, stage_role, content_type
  ON public.lesson_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enqueue_lesson_stage_embedding();

-- ── 4. Триггер на quiz_questions (quiz-текст живёт здесь, не в
--      lesson_stages) — ставит в очередь РОДИТЕЛЬСКИЙ этап ─────────
CREATE OR REPLACE FUNCTION public.fn_enqueue_quiz_stage_embedding()
RETURNS trigger
LANGUAGE plpgsql
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

CREATE TRIGGER trg_enqueue_quiz_stage_embedding
  AFTER INSERT OR UPDATE OF question_text, options
  ON public.quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enqueue_quiz_stage_embedding();

-- DELETE-триггер на lesson_stages не нужен — ON DELETE CASCADE у
-- lesson_stage_embeddings.lesson_stage_id уже удаляет эмбеддинги
-- вместе с этапом (как и было указано в ТЗ).

-- ── 5. Retrieval RPC (Задача E) ──────────────────────────────────────
-- supabase-js не умеет ORDER BY embedding <=> $1 через query-builder,
-- поэтому cosine-similarity retrieval нужен отдельной функцией.
--
-- Студент передаётся НЕ параметром, а берётся изнутри через
-- current_student_id() (тот же приём, что и is_my_group() выше) —
-- иначе, поскольку функция SECURITY DEFINER и EXECUTE выдан
-- authenticated, произвольный студент мог бы читать чужой RAG-контекст,
-- подставив чужой student_id. current_student_id() читает auth.uid()
-- текущей сессии, так что вызывать эту функцию нужно клиентом
-- пользователя (createClient() из lib/supabase/server.ts), НЕ
-- service-role admin-клиентом (там auth.uid() отсутствует — вернёт 0
-- строк, не чужие данные, т.е. безопасный отказ).
CREATE OR REPLACE FUNCTION public.match_lesson_stage_embeddings(
  p_query_embedding vector(768),
  p_match_count int DEFAULT 5
)
RETURNS TABLE (
  lesson_stage_id uuid,
  chunk_text      text,
  similarity      float,
  lesson_id       uuid,
  lesson_topic    text,
  starts_at       timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    e.lesson_stage_id,
    e.chunk_text,
    1 - (e.embedding <=> p_query_embedding) AS similarity,
    ls.lesson_id,
    l.topic AS lesson_topic,
    l.starts_at
  FROM public.lesson_stage_embeddings e
  JOIN public.lesson_stages ls ON ls.id = e.lesson_stage_id
  JOIN public.lessons l ON l.id = ls.lesson_id
  JOIN public.student_groups sg ON sg.group_id = l.group_id
  WHERE sg.student_id = public.current_student_id()
    AND l.starts_at::date <= (current_date + interval '1 day')
  ORDER BY e.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;

REVOKE ALL ON FUNCTION public.match_lesson_stage_embeddings(vector, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_lesson_stage_embeddings(vector, int) TO authenticated;

COMMIT;

-- ── После применения — проверить руками: ─────────────────────────────
--   1) SELECT count(*) FROM lesson_stages_embedding_queue;
--      -- существующие 'middle'-этапы (созданные до этой миграции) в
--      -- очередь НЕ попадают — триггер реагирует только на будущие
--      -- INSERT/UPDATE. Для них нужен POST /api/admin/rag/backfill.
--   2) UPDATE lesson_stages SET description = description WHERE
--      stage_role='middle' LIMIT 1; -- проверка триггера 1
--      SELECT * FROM lesson_stages_embedding_queue; -- ожидание: 1 строка
