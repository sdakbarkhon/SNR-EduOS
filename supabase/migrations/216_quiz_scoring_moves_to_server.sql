-- 216 — ПОДСЧЁТ БАЛЛА ЗА QIA-КВИЗ ПЕРЕЕЗЖАЕТ НА СЕРВЕР.
--
-- Продолжение миграции 215, которая то же самое сделала с домашним тестом.
-- Разбор дыры — заходом ранее; коротко, что было:
--
--   • getQuizQuestions делал select("*"), поэтому correct_option_index уезжал
--     в браузер при монтировании экрана, до первого клика;
--   • finalizeQuizAttempt считала балл В БРАУЗЕРЕ УЧЕНИКА и сама писала итоги
--     в quiz_attempts И ОЦЕНКУ в lesson_stage_progress;
--   • под своим ключом ученик видел правильные ответы 160 вопросов всех своих
--     групп, включая ещё не проведённые уроки — гейта «этап начат» у квиза не
--     было вовсе, в отличие от теста;
--   • он же мог записать себе любой балл, любой итог, любую оценку и снять
--     признак «сдано» — проверено живыми запросами под его правами.
--
-- ЧТО СТАЛО. Четыре функции с правами владельца: выдать бланк, открыть
-- попытку, сохранить один ответ, принять сдачу со сверкой на сервере. Прямая
-- запись у ученика снята. Чтение вопросов сужено до «после сдачи».
--
-- ═══ ГЛАВНАЯ ОСТОРОЖНОСТЬ ЭТОЙ МИГРАЦИИ ═══
-- Таблицы quiz_questions / quiz_attempts / quiz_answers ОБЩИЕ у QIA-квиза и
-- у Kahoot. Kahoot в этом заходе трогать нельзя, а он читает вопросы и пишет
-- ответы из браузера ученика прямо во время игры. Поэтому КАЖДАЯ политика
-- ниже сужена ТОЛЬКО для этапов content_type='quiz_qia', а для остальных
-- (в том числе 'quiz_kahoot') условие остаётся прежним, слово в слово.
-- Снимешь это разделение — погасишь живую игру.
--
-- ЧЕГО ЭТА МИГРАЦИЯ НЕ ТРОГАЕТ: Kahoot, тесты (215), замок правки оценок
-- (trg_lock_teacher_marks на той же таблице остаётся как есть), ограничение
-- времени у квиза (не задано ни у одного этапа — включать его не просили),
-- процент у учителя, прошлые оценки и баллы.
--
-- ПОРЯДОК ВЫКАТКИ. Код умеет работать и ДО применения этой миграции: не найдя
-- функции, клиент откатывается на прежний путь и пишет предупреждение в
-- консоль. Промежуток «код на проде, миграция не применена» безопасен — квиз
-- работает по-старому, включая старые дыры.

BEGIN;

-- ─── 0. ДУБЛИ ОТВЕТОВ ────────────────────────────────────────────────────────
-- Клиент писал ответы через upsert по (attempt_id, question_id), но существует
-- ли под этим уникальный индекс — проверяем и ставим, если нет. Без него
-- ON CONFLICT в функции ниже не к чему привязаться.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_answers_attempt_question_key
  ON public.quiz_answers (attempt_id, question_id);

-- ─── 1. БЛАНК КВИЗА ──────────────────────────────────────────────────────────
-- Отдаёт вопросы, варианты и УЖЕ СОХРАНЁННЫЕ ОТВЕТЫ ученика. Номер правильного
-- варианта кладётся в ответ ТОЛЬКО после сдачи — на нём держится разбор ошибок,
-- и он же был утечкой до неё.
--
-- Ответы отдаются здесь же, а не отдельным запросом, потому что экран квиза
-- умеет возвращаться к незаконченной попытке: вышел, вернулся — прежние клики
-- на месте. После сужения политики ученик не может собрать это сам.
CREATE OR REPLACE FUNCTION public.get_quiz_paper(p_stage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_attempt public.quiz_attempts;
  v_reveal  boolean;
  v_qs      jsonb;
  v_as      jsonb;
BEGIN
  v_student := public.current_student_id();
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'not_a_student';
  END IF;

  -- Этап должен быть в группе этого ученика. Проверка руками: функция идёт с
  -- правами владельца, и правила доступа её не ограничивают — значит всё, что
  -- проверяла политика, обязано быть проверено здесь.
  IF NOT EXISTS (
    SELECT 1
      FROM public.lesson_stages ls
      JOIN public.lessons l ON l.id = ls.lesson_id
      JOIN public.student_groups sg ON sg.group_id = l.group_id
     WHERE ls.id = p_stage_id
       AND sg.student_id = v_student
  ) THEN
    RAISE EXCEPTION 'stage_not_available';
  END IF;

  SELECT * INTO v_attempt
    FROM public.quiz_attempts
   WHERE stage_id = p_stage_id AND student_id = v_student;

  v_reveal := COALESCE(v_attempt.is_finalized, false);

  SELECT COALESCE(jsonb_agg(x.q ORDER BY x.ord), '[]'::jsonb) INTO v_qs
    FROM (
      SELECT qq.position AS ord,
             jsonb_build_object(
               'id',            qq.id,
               'stage_id',      qq.stage_id,
               'position',      qq.position,
               'question_text', qq.question_text,
               'options',       qq.options,
               'points',        qq.points,
               'time_per_question_seconds', qq.time_per_question_seconds
             )
             -- Номер правильного добавляется ТОЛЬКО после сдачи. Не «-1», не
             -- null — ключа нет вовсе: любое значение здесь было бы половиной
             -- подсказки.
             || CASE WHEN v_reveal
                     THEN jsonb_build_object('correct_option_index', qq.correct_option_index)
                     ELSE '{}'::jsonb END AS q
        FROM public.quiz_questions qq
       WHERE qq.stage_id = p_stage_id
    ) x;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'id', a.id,
             'attempt_id', a.attempt_id,
             'question_id', a.question_id,
             'selected_option_index', a.selected_option_index
           )
           || CASE WHEN v_reveal
                   THEN jsonb_build_object('is_correct', a.is_correct, 'score', a.score)
                   ELSE '{}'::jsonb END
         ), '[]'::jsonb) INTO v_as
    FROM public.quiz_answers a
   WHERE v_attempt.id IS NOT NULL AND a.attempt_id = v_attempt.id;

  RETURN jsonb_build_object('questions', v_qs, 'answers', v_as, 'finalized', v_reveal);
END;
$$;

-- ─── 2. ОТКРЫТЬ ПОПЫТКУ ──────────────────────────────────────────────────────
-- Прежнее поведение startQuizAttempt, но с сервера. Гонку двух вызовов (экран
-- зовёт её при монтировании и когда этап становится активным), которую клиент
-- ловил по коду ошибки 23505, здесь закрывает FOR UPDATE.
CREATE OR REPLACE FUNCTION public.start_quiz(p_stage_id uuid)
RETURNS public.quiz_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_school  uuid;
  v_total   integer;
  v_row     public.quiz_attempts;
BEGIN
  v_student := public.current_student_id();
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'not_a_student';
  END IF;

  SELECT ls.school_id INTO v_school
    FROM public.lesson_stages ls
    JOIN public.lessons l ON l.id = ls.lesson_id
    JOIN public.student_groups sg ON sg.group_id = l.group_id
   WHERE ls.id = p_stage_id AND sg.student_id = v_student;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'stage_not_available';
  END IF;

  SELECT count(*) INTO v_total FROM public.quiz_questions WHERE stage_id = p_stage_id;

  SELECT * INTO v_row
    FROM public.quiz_attempts
   WHERE stage_id = p_stage_id AND student_id = v_student
     FOR UPDATE;
  IF FOUND THEN
    RETURN v_row;
  END IF;

  INSERT INTO public.quiz_attempts (stage_id, student_id, total_questions, school_id)
  VALUES (p_stage_id, v_student, COALESCE(v_total, 0), v_school)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ─── 3. СОХРАНИТЬ ОДИН ОТВЕТ ─────────────────────────────────────────────────
-- Экран квиза сохраняет каждый клик сразу, чтобы не потерять при обрыве связи.
-- Эта функция пишет РОВНО номер выбранного варианта. Признак правильности и
-- балл она не принимает и не трогает: их ставит только сдача, и только сервер.
CREATE OR REPLACE FUNCTION public.save_quiz_answer(
  p_stage_id    uuid,
  p_question_id uuid,
  p_selected    integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_attempt public.quiz_attempts;
  v_school  uuid;
BEGIN
  v_student := public.current_student_id();
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'not_a_student';
  END IF;

  SELECT * INTO v_attempt
    FROM public.quiz_attempts
   WHERE stage_id = p_stage_id AND student_id = v_student;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quiz_not_started';
  END IF;

  -- Сдал — правки закрыты. Иначе после разбора ошибок можно было бы
  -- переписать ответы и пересдать.
  IF v_attempt.is_finalized THEN
    RAISE EXCEPTION 'quiz_already_submitted';
  END IF;

  -- Вопрос обязан принадлежать ЭТОМУ этапу: иначе чужой вопрос уехал бы в
  -- чужую попытку.
  SELECT school_id INTO v_school
    FROM public.quiz_questions
   WHERE id = p_question_id AND stage_id = p_stage_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'question_not_in_stage';
  END IF;

  INSERT INTO public.quiz_answers
    (attempt_id, question_id, selected_option_index, answered_at, school_id)
  VALUES (v_attempt.id, p_question_id, p_selected, now(), v_school)
  ON CONFLICT (attempt_id, question_id)
  DO UPDATE SET selected_option_index = EXCLUDED.selected_option_index,
                answered_at           = now();
END;
$$;

-- ─── 4. СДАЧА ────────────────────────────────────────────────────────────────
-- Ничего от ученика не принимает, кроме этапа: ответы уже лежат в базе, их
-- писала функция выше. Балл, признак правильности, итоги и оценку считает и
-- пишет сервер.
CREATE OR REPLACE FUNCTION public.submit_quiz(p_stage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_attempt public.quiz_attempts;
  v_school  uuid;
  v_correct integer;
  v_score   integer;
  v_total   integer;
  v_grade   integer;
  v_pct     numeric;
  v_now     timestamptz := now();
BEGIN
  v_student := public.current_student_id();
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'not_a_student';
  END IF;

  SELECT * INTO v_attempt
    FROM public.quiz_attempts
   WHERE stage_id = p_stage_id AND student_id = v_student
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quiz_not_started';
  END IF;

  -- ПОВТОРНАЯ СДАЧА ОТКЛОНЯЕТСЯ. Раньше защиты не было вовсе: признак «сдано»
  -- ученик мог снять сам обычным UPDATE.
  IF v_attempt.is_finalized THEN
    RAISE EXCEPTION 'quiz_already_submitted';
  END IF;

  SELECT ls.school_id INTO v_school FROM public.lesson_stages ls WHERE ls.id = p_stage_id;

  -- Сверка по эталону. Признак правильности и балл проставляются ЗДЕСЬ и
  -- только здесь: раньше их присылал браузер ученика.
  UPDATE public.quiz_answers a
     SET is_correct = (a.selected_option_index = q.correct_option_index),
         score      = CASE WHEN a.selected_option_index = q.correct_option_index
                           THEN q.points ELSE 0 END
    FROM public.quiz_questions q
   WHERE a.attempt_id = v_attempt.id
     AND q.id = a.question_id;

  SELECT count(*) FILTER (WHERE a.is_correct),
         COALESCE(sum(a.score), 0)
    INTO v_correct, v_score
    FROM public.quiz_answers a
   WHERE a.attempt_id = v_attempt.id;

  SELECT count(*) INTO v_total FROM public.quiz_questions WHERE stage_id = p_stage_id;

  v_correct := COALESCE(v_correct, 0);
  v_score   := COALESCE(v_score, 0);
  v_total   := COALESCE(v_total, 0);

  -- Та же шкала, что была в gradeFromPercent.
  v_pct := CASE WHEN v_total > 0 THEN (v_correct::numeric / v_total::numeric) * 100 ELSE 0 END;
  v_grade := CASE
               WHEN v_pct >= 90 THEN 5
               WHEN v_pct >= 75 THEN 4
               WHEN v_pct >= 60 THEN 3
               WHEN v_pct >= 40 THEN 2
               ELSE 1
             END;

  UPDATE public.quiz_attempts
     SET finished_at     = v_now,
         correct_count   = v_correct,
         total_score     = v_score,
         total_questions = v_total,
         is_finalized    = true
   WHERE id = v_attempt.id;

  -- Оценка в прогресс по этапу. Метка ниже пропускает нас через запрет
  -- самооценки (см. раздел 6): запрет смотрит на auth.uid(), а он у функции с
  -- правами владельца остаётся ученическим, и без метки сервер запретил бы
  -- сам себе.
  PERFORM set_config('app.quiz_server_scoring', '1', true);

  INSERT INTO public.lesson_stage_progress
    (stage_id, student_id, is_completed, completed_at, grade, graded_at, graded_by, submission_data, school_id)
  VALUES (p_stage_id, v_student, true, v_now, v_grade, v_now, NULL,
          jsonb_build_object('kind', 'quiz', 'correct', v_correct, 'total', v_total, 'total_score', v_score),
          v_school)
  ON CONFLICT (stage_id, student_id)
  DO UPDATE SET is_completed    = true,
                completed_at    = v_now,
                grade           = EXCLUDED.grade,
                graded_at       = v_now,
                submission_data = EXCLUDED.submission_data;

  PERFORM set_config('app.quiz_server_scoring', '', true);

  RETURN jsonb_build_object('correct', v_correct, 'total', v_total, 'grade', v_grade);
END;
$$;

REVOKE ALL ON FUNCTION public.get_quiz_paper(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_quiz(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_quiz_answer(uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_quiz(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_paper(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_quiz(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_quiz_answer(uuid, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_quiz(uuid) TO authenticated, service_role;

-- ─── 5. ПОЛИТИКИ: СУЖАЕМ ТОЛЬКО ДЛЯ QIA ──────────────────────────────────────
-- Всюду ниже одна и та же форма: «этап не QIA — как было раньше; этап QIA —
-- по-новому». Kahoot попадает в первую ветку и не замечает правки.

-- 5.1. Вопросы. Было: видно любому в группе, с первой секунды и на любом
-- этапе, включая ещё не проведённые уроки. Стало: на QIA-этапе — только
-- после сдачи (для разбора ошибок); во время прохождения бланк выдаёт функция.
ALTER POLICY "student reads quiz questions" ON public.quiz_questions
  USING (
    (
      public.is_my_group((SELECT l.group_id
                            FROM public.lesson_stages ls
                            JOIN public.lessons l ON l.id = ls.lesson_id
                           WHERE ls.id = quiz_questions.stage_id))
      AND school_id = public.current_school_id()
      AND (
        -- не QIA (Kahoot и прочее) — прежнее условие целиком
        NOT EXISTS (SELECT 1 FROM public.lesson_stages ls
                     WHERE ls.id = quiz_questions.stage_id AND ls.content_type = 'quiz_qia')
        OR
        -- QIA — только после своей сданной попытки
        EXISTS (SELECT 1 FROM public.quiz_attempts a
                 WHERE a.stage_id = quiz_questions.stage_id
                   AND a.student_id = public.current_student_id()
                   AND a.is_finalized)
      )
    )
    OR public.is_super_admin()
  );

-- 5.2. Попытки: на QIA-этапе ученик их больше не создаёт и не правит —
-- это делают start_quiz и submit_quiz.
ALTER POLICY "student inserts own quiz attempts" ON public.quiz_attempts
  WITH CHECK (
    (
      student_id = public.current_student_id()
      AND school_id = public.current_school_id()
      AND NOT EXISTS (SELECT 1 FROM public.lesson_stages ls
                       WHERE ls.id = quiz_attempts.stage_id AND ls.content_type = 'quiz_qia')
    )
    OR public.is_super_admin()
  );

ALTER POLICY "student updates own quiz attempts" ON public.quiz_attempts
  USING (
    (
      student_id = public.current_student_id()
      AND school_id = public.current_school_id()
      AND NOT EXISTS (SELECT 1 FROM public.lesson_stages ls
                       WHERE ls.id = quiz_attempts.stage_id AND ls.content_type = 'quiz_qia')
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      student_id = public.current_student_id()
      AND school_id = public.current_school_id()
      AND NOT EXISTS (SELECT 1 FROM public.lesson_stages ls
                       WHERE ls.id = quiz_attempts.stage_id AND ls.content_type = 'quiz_qia')
    )
    OR public.is_super_admin()
  );

-- 5.3. Ответы: то же самое. Этап определяется через попытку.
ALTER POLICY "student inserts own quiz answers" ON public.quiz_answers
  WITH CHECK (
    (
      EXISTS (SELECT 1 FROM public.quiz_attempts a
               JOIN public.lesson_stages ls ON ls.id = a.stage_id
              WHERE a.id = quiz_answers.attempt_id
                AND a.student_id = public.current_student_id()
                AND ls.content_type <> 'quiz_qia')
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

ALTER POLICY "student updates own quiz answers" ON public.quiz_answers
  USING (
    (
      EXISTS (SELECT 1 FROM public.quiz_attempts a
               JOIN public.lesson_stages ls ON ls.id = a.stage_id
              WHERE a.id = quiz_answers.attempt_id
                AND a.student_id = public.current_student_id()
                AND ls.content_type <> 'quiz_qia')
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- ─── 6. ЗАПРЕТ САМООЦЕНКИ НА ПРОГРЕССЕ ПО ЭТАПУ ──────────────────────────────
-- Миграция 205 прямо объяснила, почему не повесила его сюда: «запрет там
-- сломал бы сдачу теста и прохождение викторины», потому что оценку писал
-- браузер ученика. Тест переехал на сервер миграцией 215, квиз — этой; писать
-- оценку из браузера больше некому, и запрет наконец можно поставить.
--
-- ПОЧЕМУ ОТДЕЛЬНАЯ ФУНКЦИЯ, А НЕ fn_no_student_self_grading ИЗ 205. Та смотрит
-- на auth.uid(), а он у функции с правами владельца остаётся ученическим —
-- то есть запрет закрыл бы и наш собственный submit_quiz. Нужна форточка для
-- сервера, а трогать общую функцию, которая висит на двух других таблицах,
-- ради этого нельзя. Поэтому здесь свой триггер с той же логикой плюс метка,
-- которую ставит submit_quiz на время своей записи.
--
-- Метка живёт внутри транзакции (третий аргумент set_config = true) и наружу
-- не выходит. Выставить её со стороны клиента нечем: произвольный SQL через
-- PostgREST не выполняется, а функции, которая её ставила бы, кроме
-- submit_quiz, не существует.
--
-- Kahoot этим не задет: его оценку пишет finishKahootGame в браузере УЧИТЕЛЯ,
-- а у учителя current_student_id() пуст, и правило до него не доходит.
CREATE OR REPLACE FUNCTION public.fn_no_student_stage_self_grading()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  -- Служебный ключ (сиды, крон, серверные действия) — мимо правила.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Форточка для собственной серверной сдачи квиза.
  IF current_setting('app.quiz_server_scoring', true) = '1' THEN
    RETURN NEW;
  END IF;

  -- Правило только про самого ученика. Учитель и администратор оценивают как
  -- раньше: у них current_student_id() пуст.
  v_owner := public.current_student_id();
  IF v_owner IS NULL OR NEW.student_id IS DISTINCT FROM v_owner THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.grade IS NOT NULL OR NEW.teacher_comment IS NOT NULL
       OR NEW.graded_at IS NOT NULL OR NEW.graded_by IS NOT NULL THEN
      RAISE EXCEPTION 'self_grading_forbidden';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.grade           IS DISTINCT FROM OLD.grade
     OR NEW.teacher_comment IS DISTINCT FROM OLD.teacher_comment
     OR NEW.graded_at    IS DISTINCT FROM OLD.graded_at
     OR NEW.graded_by    IS DISTINCT FROM OLD.graded_by THEN
    RAISE EXCEPTION 'self_grading_forbidden';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_no_student_stage_self_grading() IS
  'Ученик не пишет grade/teacher_comment/graded_at/graded_by в свой прогресс по этапу. '
  'Учитель и администратор — пишут. Служебный ключ — пишет. submit_quiz — по метке.';

DROP TRIGGER IF EXISTS trg_no_student_stage_self_grading ON public.lesson_stage_progress;
CREATE TRIGGER trg_no_student_stage_self_grading
  BEFORE INSERT OR UPDATE ON public.lesson_stage_progress
  FOR EACH ROW EXECUTE FUNCTION public.fn_no_student_stage_self_grading();

COMMIT;
