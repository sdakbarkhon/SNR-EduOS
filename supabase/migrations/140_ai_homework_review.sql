-- =====================================================================
-- Migration 140 — Пачка 5.3: AI-проверка домашних заданий (текстовые
-- ответы, включая код) с подтверждением учителем перед показом ученику.
-- Применить вручную через Supabase Dashboard SQL Editor.
--
-- РАСХОЖДЕНИЯ С ИСХОДНЫМ ТЗ (проверено live-запросом к БД, не догадкой):
--
-- 1) Имя файла: план предлагал `20260619000140_...`, оставлен плоский
--    номер `140_...` — та же логика, что и в Пачке 5.1 (139): проект
--    сейчас продолжает плоскую нумерацию (136-139 этой же сессии), а не
--    формат с датой-префиксом (последний такой файл — 20260707000070).
--
-- 2) teacher_approved_by REFERENCES teachers(id), НЕ users(id) —
--    таблицы public.users в этой схеме не существует вообще. graded_by
--    (аналогичное существующее поле на этой же таблице) уже ссылается
--    на teachers(id) — тот же паттерн, для консистентности.
--
-- 3) RLS НЕ трогается на homework_submissions — уже существующие policy
--    "teacher reads submissions in own groups" (SELECT) и "teacher
--    grades submissions" (UPDATE), обе из 20260617000018_teacher_auth.sql,
--    работают на уровне СТРОКИ через is_my_teacher_group(h.group_id) и
--    не зависят от того, какие колонки читаются/пишутся — новые
--    ai_grade/ai_feedback/ai_review_status/teacher_approved_*
--    автоматически покрыты ими же, без единой новой policy.
--
-- 4) Гейт "текст vs внешний сервис" — НЕ через homework.content_type
--    (тот принимает много значений: programming/bundle/wokwi/geogebra/
--    test/desmos и 12 внешних сервисов — не бинарный), а буквально по
--    наличию текста в самой submission (answer_text/code_text), как и
--    предусматривал п.3 ТЗ как запасной вариант. Bundle-сдачи текст
--    хранят в ОТДЕЛЬНОЙ таблице homework_subtask_submissions, а не в
--    answer_text/code_text родительской строки — под этот гейт
--    естественно НЕ попадают (сознательная граница скоупа, не баг).
-- =====================================================================

BEGIN;

-- ── 1. Новые колонки на homework_submissions ─────────────────────────
ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS ai_grade smallint
    CHECK (ai_grade IS NULL OR ai_grade IN (2, 3, 4, 5)),
  ADD COLUMN IF NOT EXISTS ai_feedback jsonb,
  ADD COLUMN IF NOT EXISTS ai_review_status text
    CHECK (ai_review_status IS NULL OR ai_review_status IN (
      'pending_ai', 'ai_reviewed_pending_teacher',
      'teacher_approved', 'teacher_declined_manual_grade'
    )),
  ADD COLUMN IF NOT EXISTS ai_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS teacher_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS teacher_approved_by uuid REFERENCES public.teachers(id);

CREATE INDEX IF NOT EXISTS homework_submissions_ai_pending_idx
  ON public.homework_submissions (ai_review_status)
  WHERE ai_review_status = 'ai_reviewed_pending_teacher';

-- ── 2. Очередь на AI-обработку ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_homework_review_queue (
  submission_id uuid PRIMARY KEY REFERENCES public.homework_submissions(id) ON DELETE CASCADE,
  school_id     uuid NOT NULL,
  enqueued_at   timestamptz NOT NULL DEFAULT now(),
  attempts      int NOT NULL DEFAULT 0,
  last_error    text
);
CREATE INDEX IF NOT EXISTS ai_homework_review_queue_fifo_idx
  ON public.ai_homework_review_queue (enqueued_at);

ALTER TABLE public.ai_homework_review_queue ENABLE ROW LEVEL SECURITY;
-- Ноль клиентских policy — читается/пишется только service-role
-- (cron/admin batch), тот же паттерн, что lesson_stages_embedding_queue
-- (миграция 139).
REVOKE ALL ON public.ai_homework_review_queue FROM anon, authenticated;

-- ── 3. Триггер: авто-enqueue при сдаче с текстовым ответом ───────────
-- Три РАЗНЫХ TS-функции сейчас переводят submission в status='submitted'
-- (submitHomeworkWithFile, submitProgrammingHomework, submitHomeworkBundle
-- в packages/core/src/queries/index.ts) — вместо правки всех трёх
-- (и любых будущих) точек входа, триггер на самой таблице реагирует на
-- ЛЮБОЙ путь, которым submission стала submitted с текстом. Тот же приём,
-- что уже применён в миграции 139 для lesson_stages.
--
-- BEFORE (не AFTER) — чтобы напрямую выставить NEW.ai_review_status без
-- отдельного UPDATE поверх той же строки. NEW.school_id уже гарантированно
-- заполнен на этом этапе (DEFAULT public.current_school_id() применяется
-- до срабатывания BEFORE-триггеров).
--
-- Guard "ai_review_status IS NULL" — не трогает submission, если у неё
-- уже ЕСТЬ какой-то ai_review_status (уже проверена/подтверждена/отклонена
-- ранее). Следствие: пересдача ПОСЛЕ teacher_approved/
-- teacher_declined_manual_grade НЕ переставит её обратно в очередь
-- автоматически — если это понадобится, сброс ai_review_status на NULL
-- нужно будет явно добавить в код пересдачи (вне скоупа этой миграции).
CREATE OR REPLACE FUNCTION public.fn_enqueue_homework_ai_review()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'submitted'
     AND NEW.ai_review_status IS NULL
     AND (COALESCE(NEW.answer_text, '') <> '' OR COALESCE(NEW.code_text, '') <> '')
  THEN
    NEW.ai_review_status := 'pending_ai';
    INSERT INTO public.ai_homework_review_queue (submission_id, school_id)
    VALUES (NEW.id, NEW.school_id)
    ON CONFLICT (submission_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enqueue_homework_ai_review
  BEFORE INSERT OR UPDATE OF status, answer_text, code_text
  ON public.homework_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enqueue_homework_ai_review();

COMMIT;

-- ── После применения — проверить руками: ─────────────────────────────
--   1) UPDATE homework_submissions SET answer_text = answer_text
--      WHERE status = 'submitted' AND answer_text IS NOT NULL LIMIT 1;
--      SELECT ai_review_status FROM homework_submissions WHERE id = '<та же id>';
--      -- ожидание: 'pending_ai'
--      SELECT * FROM ai_homework_review_queue WHERE submission_id = '<та же id>';
--      -- ожидание: 1 строка
--   2) SELECT count(*) FROM ai_homework_review_queue;
--      -- существующие submitted-сдачи (созданные до этой миграции) в
--      -- очередь НЕ попадают — триггер реагирует только на будущие
--      -- INSERT/UPDATE, как и в миграции 139.
