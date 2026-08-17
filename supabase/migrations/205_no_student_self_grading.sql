-- Миграция 205: ученик не ставит оценку сам себе.
--
-- ЧТО НАЙДЕНО. У четырёх таблиц сдач есть политика «student updates own …» без
-- ограничения по колонкам, а ограничить колонки политика в принципе не умеет:
-- разрешена строка — разрешена любая её колонка. Проверено под настоящим
-- ключом ученика (Ismailov Sherzod), в транзакции с откатом:
--
--   update project_submissions  set grade=5 where student_id=current_student_id()
--     → UPDATE 3, было 0 оценок, стало 3
--   update homework_submissions set grade=5 where student_id=current_student_id()
--     → UPDATE 5
--
-- И это не косметика: на project_submissions висит trg_project_grade_notify,
-- поэтому вместе с поддельной оценкой уходят оповещения ученику И родителю, а
-- getStudentGrades фильтрует только `grade is not null` и автора не проверяет —
-- родитель видит выдуманную пятёрку как настоящую.
--
-- ПОЧЕМУ НЕ КОЛОНОЧНЫЕ ПРАВА. REVOKE UPDATE (grade) забрал бы право у роли
-- authenticated целиком, а учитель — та же роль. Он перестал бы оценивать.
-- Права на колонки не знают, кто перед ними; знает только триггер.
--
-- ПОЧЕМУ ТОЛЬКО ДВЕ ТАБЛИЦЫ ИЗ ЧЕТЫРЁХ. У test_submissions и
-- lesson_stage_progress та же дыра, но закрывать её этим приёмом НЕЛЬЗЯ:
-- автоматическая проверка теста и викторины считается на устройстве ученика и
-- пишется его же ключом —
--   packages/core/src/queries/index.ts:1968  submitTest → score, grade
--   packages/core/src/queries/index.ts:3686  викторина  → grade, graded_at
--   packages/core/src/queries/index.ts:3845  kahoot     → grade, graded_at
-- Запрет там сломал бы сдачу теста и прохождение викторины. Чтобы закрыть их
-- по-настоящему, подсчёт балла надо унести на сервер (SECURITY DEFINER RPC,
-- который считает по test_questions и пишет сам) — это переделка сдачи тестов,
-- отдельная работа. Здесь закрыто то, что закрывается без потерь.

CREATE OR REPLACE FUNCTION public.fn_no_student_self_grading()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_touches boolean := false;
  v_owner   uuid;
BEGIN
  -- Служебный ключ (сиды, крон, серверные действия) — мимо правила.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Правило только про самого ученика. Учитель, администратор и суперадмин
  -- оценивают как раньше: у них current_student_id() пуст.
  v_owner := public.current_student_id();
  IF v_owner IS NULL OR NEW.student_id IS DISTINCT FROM v_owner THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Сдача не может приходить уже оценённой.
    v_touches := NEW.grade IS NOT NULL
              OR NEW.teacher_comment IS NOT NULL
              OR NEW.graded_at IS NOT NULL
              OR NEW.graded_by IS NOT NULL;
  ELSE
    v_touches := NEW.grade IS DISTINCT FROM OLD.grade
              OR NEW.teacher_comment IS DISTINCT FROM OLD.teacher_comment
              OR NEW.graded_at IS DISTINCT FROM OLD.graded_at
              OR NEW.graded_by IS DISTINCT FROM OLD.graded_by;
  END IF;

  IF NOT v_touches THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'self_grading_forbidden'
    USING HINT = 'Оценку и комментарий к работе ставит учитель.';
END;
$$;

COMMENT ON FUNCTION public.fn_no_student_self_grading() IS
  'Ученик не пишет grade/teacher_comment/graded_at/graded_by в свою же сдачу. '
  'Учитель и администратор — пишут. Служебный ключ — пишет.';

DROP TRIGGER IF EXISTS trg_no_self_grading ON public.project_submissions;
CREATE TRIGGER trg_no_self_grading
  BEFORE INSERT OR UPDATE ON public.project_submissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_no_student_self_grading();

DROP TRIGGER IF EXISTS trg_no_self_grading ON public.homework_submissions;
CREATE TRIGGER trg_no_self_grading
  BEFORE INSERT OR UPDATE ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_no_student_self_grading();
