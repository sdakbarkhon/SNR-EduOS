-- =============================================================================
-- Migration 35: lesson_stages v2 — гибкая система этапов урока
-- Заменяет фиксированные 6 этапов (goal/theory/practice/classwork/review/summary)
-- на гибкие: Старт (auto) + N middle-этапов + Итог (auto)
-- =============================================================================

-- === ЧАСТЬ 0: ОЧИСТКА СТАРЫХ ДАННЫХ ===
-- Удаляем все тестовые уроки (каскадно: lesson_stages, attendance, classwork, raised_hands, excuses)
DELETE FROM public.lessons;

-- === ЧАСТЬ 1: НОВЫЙ СТОЛБЕЦ lessons.duration_minutes ===
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS duration_minutes int DEFAULT 45;

-- === ЧАСТЬ 2: ПЕРЕСОЗДАЁМ lesson_stages ===
DROP TABLE IF EXISTS public.lesson_stages CASCADE;

CREATE TABLE public.lesson_stages (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     uuid        NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  position      int         NOT NULL,
  stage_role    text        NOT NULL CHECK (stage_role IN ('start', 'middle', 'summary')),
  -- NULL для start/summary; 'theory' или 'task' для middle
  stage_type    text        CHECK (stage_type IN ('theory', 'task')),
  -- NULL для start/summary и чистой теории без контента
  content_type  text        CHECK (content_type IN (
    'presentation', 'code', 'scratch', 'tinkercad', 'app_inventor',
    'code_monkey', 'quiz_qia', 'quiz_kahoot'
  )),
  title         text        NOT NULL,
  description   text,
  -- JSON-конфигурация под тип: {items:[...]} для presentation, {language:'python'} для code, и т.д.
  config        jsonb       NOT NULL DEFAULT '{}',
  -- is_completed используется только для start/summary (глобально на урок)
  is_completed  boolean     NOT NULL DEFAULT false,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, position)
);

-- === ЧАСТЬ 3: ПРОГРЕСС УЧЕНИКА ПО ЭТАПУ ===
CREATE TABLE public.lesson_stage_progress (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id         uuid        NOT NULL REFERENCES public.lesson_stages(id) ON DELETE CASCADE,
  student_id       uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  is_completed     boolean     NOT NULL DEFAULT false,
  completed_at     timestamptz,
  -- для task: ответ ученика (код/текст/ответы квиза/файл_путь)
  submission_data  jsonb,
  -- оценка учителя
  grade            int         CHECK (grade BETWEEN 1 AND 5),
  teacher_comment  text,
  graded_at        timestamptz,
  graded_by        uuid        REFERENCES public.teachers(id),
  UNIQUE(stage_id, student_id)
);

-- === ЧАСТЬ 4: REPLICA IDENTITY + REALTIME ===
ALTER TABLE public.lesson_stages REPLICA IDENTITY FULL;
ALTER TABLE public.lesson_stage_progress REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'lesson_stages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_stages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'lesson_stage_progress'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_stage_progress;
  END IF;
END $$;

-- === ЧАСТЬ 5: RLS ===
ALTER TABLE public.lesson_stages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_stage_progress ENABLE ROW LEVEL SECURITY;

-- ── lesson_stages ──────────────────────────────────────────────────────────────

-- Ученик видит этапы уроков своих групп
CREATE POLICY "student reads own group lesson stages"
  ON public.lesson_stages FOR SELECT TO authenticated
  USING (public.is_my_group(
    (SELECT group_id FROM public.lessons WHERE id = lesson_id LIMIT 1)
  ));

-- Учитель полный CRUD только в своих уроках
CREATE POLICY "teacher manages own lesson stages"
  ON public.lesson_stages FOR ALL TO authenticated
  USING (public.is_my_teacher_group(
    (SELECT group_id FROM public.lessons WHERE id = lesson_id LIMIT 1)
  ))
  WITH CHECK (public.is_my_teacher_group(
    (SELECT group_id FROM public.lessons WHERE id = lesson_id LIMIT 1)
  ));

-- ── lesson_stage_progress ──────────────────────────────────────────────────────

-- Ученик: читает/вставляет/обновляет только свои записи
CREATE POLICY "student reads own stage progress"
  ON public.lesson_stage_progress FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());

CREATE POLICY "student inserts own stage progress"
  ON public.lesson_stage_progress FOR INSERT TO authenticated
  WITH CHECK (student_id = public.current_student_id());

CREATE POLICY "student updates own stage progress"
  ON public.lesson_stage_progress FOR UPDATE TO authenticated
  USING (student_id = public.current_student_id())
  WITH CHECK (student_id = public.current_student_id());

-- Учитель читает прогресс учеников своих групп
CREATE POLICY "teacher reads stage progress in own groups"
  ON public.lesson_stage_progress FOR SELECT TO authenticated
  USING (public.is_my_teacher_group(
    (SELECT group_id FROM public.lessons l
     JOIN public.lesson_stages ls ON ls.lesson_id = l.id
     WHERE ls.id = stage_id LIMIT 1)
  ));

-- Учитель обновляет только поля оценки (grade/comment)
CREATE POLICY "teacher grades stage progress"
  ON public.lesson_stage_progress FOR UPDATE TO authenticated
  USING (public.is_my_teacher_group(
    (SELECT group_id FROM public.lessons l
     JOIN public.lesson_stages ls ON ls.lesson_id = l.id
     WHERE ls.id = stage_id LIMIT 1)
  ));

-- === ЧАСТЬ 6: ГРАНТЫ ===
GRANT SELECT ON public.lesson_stages TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.lesson_stages TO authenticated;
GRANT SELECT ON public.lesson_stage_progress TO authenticated, anon;
GRANT INSERT, UPDATE ON public.lesson_stage_progress TO authenticated;

-- === ЧАСТЬ 7: ТРИГГЕР АВТО-СОЗДАНИЯ Старт + Итог ===
CREATE OR REPLACE FUNCTION public.fn_create_default_stages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Старт (position 0)
  INSERT INTO public.lesson_stages (lesson_id, position, stage_role, title)
  VALUES (NEW.id, 0, 'start', 'Старт');
  -- Итог (position 9999 — всегда последний)
  INSERT INTO public.lesson_stages (lesson_id, position, stage_role, title)
  VALUES (NEW.id, 9999, 'summary', 'Итог');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lesson_default_stages
  AFTER INSERT ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_create_default_stages();
