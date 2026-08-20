-- 217 — KAHOOT ПЕРЕЕЗЖАЕТ НА СЕРВЕР. Последняя из трёх (215 тест, 216 квиз).
--
-- ЧТО БЫЛО, по разведке:
--   • правильные ответы на ВСЕ вопросы игры лежали в браузере ученика ещё в
--     лобби, пока на экране «Ждём учителя»;
--   • ученик присылал признак правильности и скорость ГОТОВЫМИ, сервер их не
--     проверял, а сразу писал в quiz_answers вместе с баллом;
--   • скорость мерили часы вкладки ученика;
--   • запрет «ты уже отвечал» жил только в памяти вкладки: перезагрузил
--     страницу после показа правильного ответа, ответил заново с нулевым
--     временем — тысяча очков;
--   • учительское «Завершить» суммировало присланное учениками и выводило из
--     этого официальную оценку.
--
-- ЧТО СТАЛО. Семь функций с правами владельца. Ученик получает ОДНО состояние
-- игры (kahoot_state) и отправляет ОДИН номер варианта; всё остальное —
-- правильность, время, балл, итог, оценка — считает сервер. Учитель ведёт игру
-- теми же кнопками, но через функции, чтобы срок ответа знал сервер.
--
-- ═══ ОСТОРОЖНОСТЬ ПРО СОСЕДЕЙ ═══
-- Таблицы quiz_questions / quiz_attempts / quiz_answers ОБЩИЕ с QIA-квизом,
-- который переехал миграцией 216. Каждое правило ниже расширяет сужение 216 на
-- 'quiz_kahoot', НЕ ТРОГАЯ ветку 'quiz_qia'. Проверка в начале файла не даст
-- применить 217 на базе, где 216 ещё нет: иначе ALTER POLICY переписал бы
-- условие целиком и молча вернул бы квизу старые дыры.
--
-- ЧЕГО НЕ ТРОГАЕМ: тесты, квиз, замок правки оценок, процент у учителя
-- (делится на лучший результат в группе — отдельная задача), прошлые данные
-- (живых прогонов игры ноль, чистить нечего).

BEGIN;

-- ─── 0. ПРОВЕРКА СОСЕДА ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'submit_quiz'
  ) THEN
    RAISE EXCEPTION 'сначала примените миграцию 216 (перенос QIA-квиза на сервер): без неё эта миграция вернёт квизу прежние дыры';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS quiz_answers_attempt_question_key
  ON public.quiz_answers (attempt_id, question_id);

-- ─── 1. СОСТОЯНИЕ ИГРЫ ДЛЯ УЧЕНИКА ───────────────────────────────────────────
-- Один вызов вместо трёх: сессия, текущий вопрос, свои ответы, а в конце —
-- таблица лидеров. Он же закрывает перезагрузку страницы: всё, что было в
-- памяти вкладки, теперь приходит с сервера.
--
-- ЧТО НЕ ОТДАЁТСЯ. В лобби — ни текста вопросов, ни вариантов, ни правильных
-- ответов: только сколько всего вопросов. С началом вопроса — текст и варианты
-- ТОЛЬКО текущего, без правильного. Правильный появляется, когда учитель нажал
-- «Показать ответ».
--
-- p_prefetch — упреждающая загрузка следующего вопроса на экране показа
-- ответа: тоже без правильного. Она убирает сетевой круг в самый чувствительный
-- момент — на смене вопроса, когда идёт счёт скорости.
CREATE OR REPLACE FUNCTION public.kahoot_state(p_stage_id uuid, p_prefetch boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student  uuid;
  v_school   uuid;
  v_sess     public.kahoot_sessions;
  v_attempt  public.quiz_attempts;
  v_total    integer;
  v_cur      public.quiz_questions;
  v_next     public.quiz_questions;
  v_question jsonb := 'null'::jsonb;
  v_nextq    jsonb := 'null'::jsonb;
  v_mine     jsonb;
  v_board    jsonb := 'null'::jsonb;
  v_revealed boolean;
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
  SELECT * INTO v_sess FROM public.kahoot_sessions WHERE stage_id = p_stage_id;

  -- Попытка заводится при первом открытии экрана — на ней держится список
  -- участников в лобби у учителя. Раньше её создавал браузер ученика.
  SELECT * INTO v_attempt
    FROM public.quiz_attempts
   WHERE stage_id = p_stage_id AND student_id = v_student
     FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.quiz_attempts (stage_id, student_id, total_questions, school_id)
    VALUES (p_stage_id, v_student, COALESCE(v_total, 0), v_school)
    ON CONFLICT (stage_id, student_id) DO UPDATE SET total_questions = COALESCE(v_total, 0)
    RETURNING * INTO v_attempt;
  END IF;

  IF v_sess.id IS NOT NULL AND v_sess.current_question_index >= 0 THEN
    SELECT * INTO v_cur
      FROM public.quiz_questions
     WHERE stage_id = p_stage_id
     ORDER BY position
     OFFSET v_sess.current_question_index LIMIT 1;

    v_revealed := v_sess.status IN ('question_revealed', 'finished');

    IF v_cur.id IS NOT NULL THEN
      v_question := jsonb_build_object(
        'id', v_cur.id,
        'position', v_cur.position,
        'question_text', v_cur.question_text,
        'options', v_cur.options,
        'time_per_question_seconds', v_cur.time_per_question_seconds
      )
      -- Номер правильного — только после показа. Ключа нет вовсе, пока рано.
      || CASE WHEN v_revealed
              THEN jsonb_build_object('correct_option_index', v_cur.correct_option_index)
              ELSE '{}'::jsonb END;
    END IF;

    -- Следующий вопрос — только на экране показа ответа и только по просьбе.
    IF p_prefetch AND v_sess.status = 'question_revealed' THEN
      SELECT * INTO v_next
        FROM public.quiz_questions
       WHERE stage_id = p_stage_id
       ORDER BY position
       OFFSET v_sess.current_question_index + 1 LIMIT 1;
      IF v_next.id IS NOT NULL THEN
        v_nextq := jsonb_build_object(
          'id', v_next.id, 'position', v_next.position,
          'question_text', v_next.question_text, 'options', v_next.options,
          'time_per_question_seconds', v_next.time_per_question_seconds);
      END IF;
    END IF;
  END IF;

  -- Свои ответы. Признак правильности и балл — только по уже показанным
  -- вопросам: иначе ответивший первым узнавал бы верный вариант раньше всех.
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object('question_id', a.question_id, 'selected_option_index', a.selected_option_index)
           || CASE WHEN v_sess.status = 'finished'
                     OR (v_sess.status = 'question_revealed' AND q.position <= v_sess.current_question_index)
                     OR q.position < v_sess.current_question_index
                   THEN jsonb_build_object('is_correct', a.is_correct, 'score', a.score)
                   ELSE '{}'::jsonb END
         ORDER BY q.position), '[]'::jsonb) INTO v_mine
    FROM public.quiz_answers a
    JOIN public.quiz_questions q ON q.id = a.question_id
   WHERE a.attempt_id = v_attempt.id;

  -- Таблица лидеров — ЦЕЛИКОМ и только в конце. Раньше ученик видел в ней
  -- одного себя: чужие попытки ему читать не положено, и список приходил
  -- пустым. Это чинится здесь заодно.
  IF v_sess.status = 'finished' THEN
    SELECT COALESCE(jsonb_agg(x ORDER BY x.total_score DESC, x.full_name), '[]'::jsonb) INTO v_board
      FROM (
        SELECT at.student_id, st.full_name,
               COALESCE(at.total_score, 0) AS total_score,
               COALESCE(at.correct_count, 0) AS correct_count
          FROM public.quiz_attempts at
          JOIN public.students st ON st.id = at.student_id
         WHERE at.stage_id = p_stage_id
      ) x;
  END IF;

  RETURN jsonb_build_object(
    'session', CASE WHEN v_sess.id IS NULL THEN 'null'::jsonb ELSE jsonb_build_object(
      'id', v_sess.id, 'status', v_sess.status,
      'current_question_index', v_sess.current_question_index,
      'question_started_at', v_sess.question_started_at,
      'started_at', v_sess.started_at, 'finished_at', v_sess.finished_at) END,
    'total_questions', COALESCE(v_total, 0),
    'question', v_question,
    'next_question', v_nextq,
    'my_answers', v_mine,
    'leaderboard', v_board
  );
END;
$$;

-- ─── 2. ПРИЁМ ОТВЕТА ─────────────────────────────────────────────────────────
-- Принимает ТОЛЬКО номер варианта. Правильность сверяет сам, время меряет по
-- своим часам, балл считает сам. Наружу не возвращает ничего о правильности:
-- экран после ответа показывает «ответ записан», и знать больше ему не нужно —
-- иначе ответивший первым узнавал бы верный вариант до показа.
CREATE OR REPLACE FUNCTION public.submit_kahoot_answer(
  p_stage_id    uuid,
  p_question_id uuid,
  p_selected    integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_school  uuid;
  v_sess    public.kahoot_sessions;
  v_attempt public.quiz_attempts;
  v_q       public.quiz_questions;
  v_ms      integer;
  v_limit   integer;
  v_correct boolean;
  v_score   integer;
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

  SELECT * INTO v_sess FROM public.kahoot_sessions WHERE stage_id = p_stage_id;
  IF NOT FOUND OR v_sess.status <> 'question_active' THEN
    RAISE EXCEPTION 'question_not_active';
  END IF;

  -- Вопрос должен быть ИМЕННО текущим: иначе можно было бы отвечать на
  -- будущие вопросы заранее.
  SELECT * INTO v_q
    FROM public.quiz_questions
   WHERE stage_id = p_stage_id
   ORDER BY position
   OFFSET v_sess.current_question_index LIMIT 1;
  IF NOT FOUND OR v_q.id <> p_question_id THEN
    RAISE EXCEPTION 'not_current_question';
  END IF;

  -- СРОК СЧИТАЕТ СЕРВЕР. Вкладка учителя закрывает вопрос кнопкой, но опоздание
  -- определяется здесь: замершая игра больше не приносит очков.
  v_limit := GREATEST(COALESCE(v_q.time_per_question_seconds, 20), 1);
  v_ms := GREATEST(0, (EXTRACT(EPOCH FROM (now() - v_sess.question_started_at)) * 1000)::integer);
  IF v_ms > v_limit * 1000 THEN
    RAISE EXCEPTION 'too_late';
  END IF;

  SELECT * INTO v_attempt
    FROM public.quiz_attempts
   WHERE stage_id = p_stage_id AND student_id = v_student
     FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.quiz_attempts (stage_id, student_id, total_questions, school_id)
    VALUES (p_stage_id, v_student,
            (SELECT count(*) FROM public.quiz_questions WHERE stage_id = p_stage_id), v_school)
    RETURNING * INTO v_attempt;
  END IF;

  -- ПОВТОРНЫЙ ОТВЕТ НЕВОЗМОЖЕН, в том числе после перезагрузки страницы:
  -- раньше запрет жил в памяти вкладки, а запись шла upsert'ом и переписывала
  -- прежний ответ.
  IF EXISTS (SELECT 1 FROM public.quiz_answers
              WHERE attempt_id = v_attempt.id AND question_id = p_question_id) THEN
    RAISE EXCEPTION 'already_answered';
  END IF;

  v_correct := (p_selected = v_q.correct_option_index);
  -- Та же формула, что была в kahootScore: верно мгновенно — 1000, на последней
  -- секунде — около 500, неверно — 0.
  v_score := CASE WHEN v_correct
                  THEN round(1000 * (1 - (LEAST(1::numeric, v_ms::numeric / (v_limit * 1000)::numeric) / 2)))::integer
                  ELSE 0 END;

  INSERT INTO public.quiz_answers
    (attempt_id, question_id, selected_option_index, is_correct, response_time_ms, score, answered_at, school_id)
  VALUES (v_attempt.id, p_question_id, p_selected, v_correct, v_ms, v_score, now(), v_school);

  RETURN jsonb_build_object('accepted', true);
END;
$$;

-- ─── 3. ВЕДЕНИЕ ИГРЫ УЧИТЕЛЕМ ────────────────────────────────────────────────
-- Те же четыре шага и те же кнопки. Через функции — чтобы срок ответа знал
-- сервер, а не только вкладка.
CREATE OR REPLACE FUNCTION public.fn_kahoot_assert_teacher(p_stage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin() THEN RETURN; END IF;
  IF NOT public.is_my_teacher_group((
        SELECT l.group_id FROM public.lesson_stages ls
          JOIN public.lessons l ON l.id = ls.lesson_id
         WHERE ls.id = p_stage_id)) THEN
    RAISE EXCEPTION 'not_your_stage';
  END IF;
END;
$$;

-- ОТКРЫТИЕ ОКНА БОЛЬШЕ НЕ УБИВАЕТ ИГРУ.
-- Было: createKahootSession делал DELETE и заводил новую сессию при КАЖДОМ
-- открытии учительского окна. Учитель, случайно закрывший вкладку посреди
-- урока, терял игру вместе с очками всего класса. Стало: идущая игра
-- подхватывается, новая заводится только если игры нет, она уже завершена,
-- или учитель явно попросил начать заново.
CREATE OR REPLACE FUNCTION public.kahoot_open_session(p_stage_id uuid, p_restart boolean DEFAULT false)
RETURNS public.kahoot_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sess   public.kahoot_sessions;
  v_school uuid;
BEGIN
  PERFORM public.fn_kahoot_assert_teacher(p_stage_id);
  SELECT school_id INTO v_school FROM public.lesson_stages WHERE id = p_stage_id;

  SELECT * INTO v_sess FROM public.kahoot_sessions WHERE stage_id = p_stage_id FOR UPDATE;

  IF FOUND AND NOT p_restart AND v_sess.status <> 'finished' THEN
    RETURN v_sess;   -- игра идёт — подхватываем
  END IF;

  IF FOUND THEN
    -- «Начать заново» либо игра была завершена: чистим прошлые ответы, иначе
    -- очки прошлой партии попали бы в подсчёт новой.
    DELETE FROM public.quiz_answers
     WHERE attempt_id IN (SELECT id FROM public.quiz_attempts WHERE stage_id = p_stage_id);
    UPDATE public.quiz_attempts
       SET correct_count = 0, total_score = 0, is_finalized = false, finished_at = NULL
     WHERE stage_id = p_stage_id;
    DELETE FROM public.kahoot_sessions WHERE stage_id = p_stage_id;
  END IF;

  INSERT INTO public.kahoot_sessions (stage_id, status, current_question_index, school_id)
  VALUES (p_stage_id, 'lobby', -1, v_school)
  RETURNING * INTO v_sess;
  RETURN v_sess;
END;
$$;

CREATE OR REPLACE FUNCTION public.kahoot_start(p_stage_id uuid)
RETURNS public.kahoot_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sess public.kahoot_sessions;
BEGIN
  PERFORM public.fn_kahoot_assert_teacher(p_stage_id);
  UPDATE public.kahoot_sessions
     SET status = 'question_active', current_question_index = 0,
         started_at = now(), question_started_at = now()
   WHERE stage_id = p_stage_id
   RETURNING * INTO v_sess;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_session'; END IF;
  RETURN v_sess;
END;
$$;

CREATE OR REPLACE FUNCTION public.kahoot_next(p_stage_id uuid)
RETURNS public.kahoot_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sess public.kahoot_sessions; v_total integer;
BEGIN
  PERFORM public.fn_kahoot_assert_teacher(p_stage_id);
  SELECT count(*) INTO v_total FROM public.quiz_questions WHERE stage_id = p_stage_id;
  SELECT * INTO v_sess FROM public.kahoot_sessions WHERE stage_id = p_stage_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_session'; END IF;
  IF v_sess.current_question_index + 1 >= v_total THEN RAISE EXCEPTION 'no_more_questions'; END IF;

  UPDATE public.kahoot_sessions
     SET status = 'question_active',
         current_question_index = v_sess.current_question_index + 1,
         question_started_at = now()
   WHERE stage_id = p_stage_id
   RETURNING * INTO v_sess;
  RETURN v_sess;
END;
$$;

CREATE OR REPLACE FUNCTION public.kahoot_reveal(p_stage_id uuid)
RETURNS public.kahoot_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sess public.kahoot_sessions;
BEGIN
  PERFORM public.fn_kahoot_assert_teacher(p_stage_id);
  UPDATE public.kahoot_sessions SET status = 'question_revealed'
   WHERE stage_id = p_stage_id RETURNING * INTO v_sess;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_session'; END IF;
  RETURN v_sess;
END;
$$;

-- ЗАВЕРШЕНИЕ. Итог считается ПО ЗАПИСЯМ, которые сделал сервер, а не по сумме
-- присланного учениками. Оценка выводится из этого итога.
CREATE OR REPLACE FUNCTION public.kahoot_finish(p_stage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_now   timestamptz := now();
  v_school uuid;
  r RECORD;
  v_players integer := 0;
BEGIN
  PERFORM public.fn_kahoot_assert_teacher(p_stage_id);
  SELECT count(*) INTO v_total FROM public.quiz_questions WHERE stage_id = p_stage_id;
  SELECT school_id INTO v_school FROM public.lesson_stages WHERE id = p_stage_id;

  FOR r IN
    SELECT at.id, at.student_id,
           count(*) FILTER (WHERE a.is_correct) AS correct,
           COALESCE(sum(a.score), 0) AS score
      FROM public.quiz_attempts at
      LEFT JOIN public.quiz_answers a ON a.attempt_id = at.id
     WHERE at.stage_id = p_stage_id
     GROUP BY at.id, at.student_id
  LOOP
    v_players := v_players + 1;

    UPDATE public.quiz_attempts
       SET correct_count = r.correct, total_score = r.score,
           total_questions = COALESCE(v_total, 0),
           is_finalized = true, finished_at = v_now
     WHERE id = r.id;

    INSERT INTO public.lesson_stage_progress
      (stage_id, student_id, is_completed, completed_at, grade, graded_at, graded_by, submission_data, school_id)
    VALUES (p_stage_id, r.student_id, true, v_now,
            CASE
              WHEN v_total = 0 THEN 1
              WHEN (r.correct::numeric / v_total::numeric) * 100 >= 90 THEN 5
              WHEN (r.correct::numeric / v_total::numeric) * 100 >= 75 THEN 4
              WHEN (r.correct::numeric / v_total::numeric) * 100 >= 60 THEN 3
              WHEN (r.correct::numeric / v_total::numeric) * 100 >= 40 THEN 2
              ELSE 1 END,
            v_now, NULL,
            jsonb_build_object('kind', 'kahoot', 'correct', r.correct,
                               'total', COALESCE(v_total, 0), 'total_score', r.score),
            v_school)
    ON CONFLICT (stage_id, student_id)
    DO UPDATE SET is_completed = true, completed_at = v_now,
                  grade = EXCLUDED.grade, graded_at = v_now,
                  submission_data = EXCLUDED.submission_data;
  END LOOP;

  UPDATE public.kahoot_sessions SET status = 'finished', finished_at = v_now
   WHERE stage_id = p_stage_id;

  RETURN jsonb_build_object('players', v_players, 'total_questions', COALESCE(v_total, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.kahoot_state(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_kahoot_answer(uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kahoot_open_session(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kahoot_start(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kahoot_next(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kahoot_reveal(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kahoot_finish(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_kahoot_assert_teacher(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kahoot_state(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_kahoot_answer(uuid, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kahoot_open_session(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kahoot_start(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kahoot_next(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kahoot_reveal(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kahoot_finish(uuid) TO authenticated, service_role;

-- ─── 4. ПОЛИТИКИ: сужение 216 распространяется на Kahoot ─────────────────────
-- Форма прежняя: ветка 'quiz_qia' оставлена слово в слово, добавлена ветка
-- 'quiz_kahoot'. Всё, что не квиз и не Kahoot, ведёт себя как раньше.

-- 4.1. Вопросы. Для Kahoot ученику видна строка только когда вопрос УЖЕ ЗАКРЫТ:
-- он позади текущего, либо текущий и учитель нажал «Показать ответ», либо игра
-- завершена. Во время вопроса текст и варианты приходят функцией — без
-- правильного.
ALTER POLICY "student reads quiz questions" ON public.quiz_questions
  USING (
    (
      public.is_my_group((SELECT l.group_id
                            FROM public.lesson_stages ls
                            JOIN public.lessons l ON l.id = ls.lesson_id
                           WHERE ls.id = quiz_questions.stage_id))
      AND school_id = public.current_school_id()
      AND (
        -- не квиз и не Kahoot — прежнее условие
        NOT EXISTS (SELECT 1 FROM public.lesson_stages ls
                     WHERE ls.id = quiz_questions.stage_id
                       AND ls.content_type IN ('quiz_qia', 'quiz_kahoot'))
        OR
        -- QIA — как поставила миграция 216: после своей сданной попытки
        EXISTS (SELECT 1 FROM public.lesson_stages ls
                 WHERE ls.id = quiz_questions.stage_id AND ls.content_type = 'quiz_qia')
          AND EXISTS (SELECT 1 FROM public.quiz_attempts a
                       WHERE a.stage_id = quiz_questions.stage_id
                         AND a.student_id = public.current_student_id()
                         AND a.is_finalized)
        OR
        -- Kahoot — только закрытые вопросы
        EXISTS (SELECT 1 FROM public.lesson_stages ls
                 WHERE ls.id = quiz_questions.stage_id AND ls.content_type = 'quiz_kahoot')
          AND EXISTS (SELECT 1 FROM public.kahoot_sessions s
                       WHERE s.stage_id = quiz_questions.stage_id
                         AND (s.status = 'finished'
                              OR quiz_questions.position < s.current_question_index
                              OR (quiz_questions.position = s.current_question_index
                                  AND s.status = 'question_revealed')))
      )
    )
    OR public.is_super_admin()
  );

-- 4.2. Попытки и ответы: прямой записи у ученика нет ни в квизе, ни в Kahoot.
ALTER POLICY "student inserts own quiz attempts" ON public.quiz_attempts
  WITH CHECK (
    (
      student_id = public.current_student_id()
      AND school_id = public.current_school_id()
      AND NOT EXISTS (SELECT 1 FROM public.lesson_stages ls
                       WHERE ls.id = quiz_attempts.stage_id
                         AND ls.content_type IN ('quiz_qia', 'quiz_kahoot'))
    )
    OR public.is_super_admin()
  );

ALTER POLICY "student updates own quiz attempts" ON public.quiz_attempts
  USING (
    (
      student_id = public.current_student_id()
      AND school_id = public.current_school_id()
      AND NOT EXISTS (SELECT 1 FROM public.lesson_stages ls
                       WHERE ls.id = quiz_attempts.stage_id
                         AND ls.content_type IN ('quiz_qia', 'quiz_kahoot'))
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      student_id = public.current_student_id()
      AND school_id = public.current_school_id()
      AND NOT EXISTS (SELECT 1 FROM public.lesson_stages ls
                       WHERE ls.id = quiz_attempts.stage_id
                         AND ls.content_type IN ('quiz_qia', 'quiz_kahoot'))
    )
    OR public.is_super_admin()
  );

ALTER POLICY "student inserts own quiz answers" ON public.quiz_answers
  WITH CHECK (
    (
      EXISTS (SELECT 1 FROM public.quiz_attempts a
               JOIN public.lesson_stages ls ON ls.id = a.stage_id
              WHERE a.id = quiz_answers.attempt_id
                AND a.student_id = public.current_student_id()
                AND ls.content_type NOT IN ('quiz_qia', 'quiz_kahoot'))
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
                AND ls.content_type NOT IN ('quiz_qia', 'quiz_kahoot'))
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

COMMIT;
