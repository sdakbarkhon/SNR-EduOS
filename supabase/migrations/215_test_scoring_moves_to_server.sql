-- 215 — ПОДСЧЁТ БАЛЛА ЗА ТЕСТ ПЕРЕЕЗЖАЕТ НА СЕРВЕР.
--
-- ЧТО БЫЛО. Экран теста целиком жил в браузере: серверной прослойки не
-- существовало ни в одном виде — ни маршрута, ни серверного действия. Отсюда
-- две дыры одного рода.
--
--   1. ПРАВИЛЬНЫЕ ОТВЕТЫ УЕЗЖАЛИ УЧЕНИКУ. getTestQuestions делал
--      select("*, options:test_question_options(*)") — то есть вместе с
--      текстом вариантов в браузер приезжала колонка is_correct, в ту же
--      секунду, когда ученик нажал «Начать». Сузить select было бы
--      косметикой: запрос делает браузер под ключом ученика, и тот же запрос
--      можно послать руками из консоли. Политика "student reads test options"
--      пускала строку целиком, а RLS в Postgres построчный — ограничения по
--      колонкам в нём нет и быть не может. Колоночных грантов тоже не было:
--      у test_question_options ноль колонок со своим ACL из шести.
--
--   2. БАЛЛ СЧИТАЛ БРАУЗЕР И САМ ЖЕ ЕГО ПИСАЛ. submitTest выполнялась на
--      машине ученика, сравнивала ответы с is_correct и прямым UPDATE клала
--      в test_submissions поля score, max_score и grade. Политика
--      "student updates own test submission" проверяла только «моя ли это
--      строка» — ни score, ни grade не были связаны ни с чем. Ученик мог
--      выставить себе пятёрку, не ответив ни на один вопрос.
--
-- Ровно этот путь назван в миграции 205: «чтобы закрыть по-настоящему,
-- подсчёт балла надо унести на сервер (SECURITY DEFINER RPC, который считает
-- по test_questions и пишет сам) — это переделка сдачи тестов, отдельная
-- работа». Вот она.
--
-- ЧТО СТАЛО. Три функции с правами владельца делают всю работу: выдают бланк
-- без правильных ответов, открывают попытку и принимают сдачу со сверкой на
-- сервере. Прямая запись у ученика снята — писать может только функция.
-- Чтение вариантов ученику сужено до «после сдачи»: разбор ошибок остаётся,
-- подсматривание до сдачи — нет.
--
-- ЧЕГО ЭТА МИГРАЦИЯ НЕ ТРОГАЕТ, намеренно:
--   • учителя и родителя — их политики на всех четырёх таблицах остались как
--     были, включая чтение is_correct и ручную правку балла;
--   • квизы и Kahoot (quiz_questions, quiz_attempts, quiz_answers) — там та
--     же дыра и шире, но это отдельный заход;
--   • замок правки оценок (mark_edit_window, fn_lock_teacher_marks);
--   • уже выставленные баллы — ничего не пересчитывается.
--
-- ПОРЯДОК ВЫКАТКИ. Код в apps/web умеет работать и до применения этой
-- миграции: если функции ещё нет, клиент честно откатывается на прежний путь
-- и пишет об этом в консоль. Поэтому промежуток «код на проде, миграция не
-- применена» безопасен — тест работает по-старому, включая старые дыры.
-- После применения клиент сам начнёт ходить через функции.

BEGIN;

-- ─── 0. ДУБЛИ ОТВЕТОВ ────────────────────────────────────────────────────────
-- Уникального индекса по (сдача, вопрос) не было, а submitTest вопреки своему
-- комментарию прежние ответы НЕ удаляла — вторая отправка добавляла второй
-- комплект строк, и авто-балл в окне проверки у учителя удваивался. В данных
-- на 19.08.2026 дублей ноль, так что индекс встаёт без чистки.
CREATE UNIQUE INDEX IF NOT EXISTS test_answers_submission_question_key
  ON public.test_answers (submission_id, question_id);

-- ─── 0б. БАЛЛ НЕ БОЛЬШЕ МАКСИМУМА ────────────────────────────────────────────
-- Такого ограничения не было вовсе. NULL допускается: у начатой, но не сданной
-- попытки обе колонки пусты.
ALTER TABLE public.test_submissions
  DROP CONSTRAINT IF EXISTS test_submissions_score_within_max;
ALTER TABLE public.test_submissions
  ADD CONSTRAINT test_submissions_score_within_max
  CHECK (score IS NULL OR max_score IS NULL OR score <= max_score);

-- ─── 1. БЛАНК ТЕСТА ──────────────────────────────────────────────────────────
-- Отдаёт вопросы и варианты. Признак правильности кладётся в ответ ТОЛЬКО
-- после сдачи — на нём держится разбор ошибок, и он же был утечкой до неё.
CREATE OR REPLACE FUNCTION public.get_test_paper(p_homework_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_sub     public.test_submissions;
  v_reveal  boolean;
  v_result  jsonb;
BEGIN
  v_student := public.current_student_id();
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'not_a_student';
  END IF;

  -- Задание должно относиться к группе этого ученика. Проверка здесь, а не в
  -- политике: функция идёт с правами владельца и правила доступа её не
  -- ограничивают — значит всё, что раньше проверяла политика, обязано быть
  -- проверено руками.
  IF NOT EXISTS (
    SELECT 1
      FROM public.homework h
      JOIN public.student_groups sg ON sg.group_id = h.group_id
     WHERE h.id = p_homework_id
       AND sg.student_id = v_student
  ) THEN
    RAISE EXCEPTION 'homework_not_available';
  END IF;

  SELECT * INTO v_sub
    FROM public.test_submissions
   WHERE homework_id = p_homework_id
     AND student_id  = v_student;

  -- Пока попытка не начата, бланка нет. Это то же условие, что стояло в
  -- прежней политике ("started_at IS NOT NULL"), просто теперь оно решает,
  -- отдавать ли вопросы вообще, а не отдавать ли их вместе с ответами.
  IF v_sub.id IS NULL OR v_sub.started_at IS NULL THEN
    RAISE EXCEPTION 'test_not_started';
  END IF;

  -- ПРИЗНАК СДАЧИ — score, А НЕ submitted_at. Ловушка, пойманная холостым
  -- прогоном: submitted_at объявлен NOT NULL DEFAULT now(), то есть он
  -- проставляется в момент СОЗДАНИЯ строки, на кнопке «Начать», и никогда не
  -- бывает пустым. Условие «submitted_at IS NOT NULL» было бы истинным всегда,
  -- и правильные ответы уезжали бы с первой секунды — ровно та дыра, которую
  -- чиним. Клиент отличает сданную попытку так же (TestPlayer: score != null).
  v_reveal := v_sub.score IS NOT NULL;

  SELECT COALESCE(jsonb_agg(x.q ORDER BY x.ord), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        tq.order_index AS ord,
        jsonb_build_object(
          'id',            tq.id,
          'homework_id',   tq.homework_id,
          'question_text', tq.question_text,
          'question_type', tq.question_type,
          'order_index',   tq.order_index,
          'options', COALESCE((
            SELECT jsonb_agg(
                     CASE WHEN v_reveal THEN
                       jsonb_build_object(
                         'id', o.id, 'question_id', o.question_id,
                         'option_text', o.option_text, 'order_index', o.order_index,
                         'is_correct', o.is_correct)
                     ELSE
                       -- Ключа is_correct в ответе НЕТ вовсе. Не false, не
                       -- null — его нет: любое значение здесь было бы половиной
                       -- подсказки при одном правильном варианте из четырёх.
                       jsonb_build_object(
                         'id', o.id, 'question_id', o.question_id,
                         'option_text', o.option_text, 'order_index', o.order_index)
                     END
                     ORDER BY o.order_index)
              FROM public.test_question_options o
             WHERE o.question_id = tq.id
          ), '[]'::jsonb)
        ) AS q
        FROM public.test_questions tq
       WHERE tq.homework_id = p_homework_id
    ) x;

  RETURN v_result;
END;
$$;

-- ─── 2. НАЧАЛО ПОПЫТКИ ───────────────────────────────────────────────────────
-- Повторение прежнего поведения startHomeworkTest, но с сервера: дважды начать
-- нельзя, у существующей попытки started_at не переписывается.
CREATE OR REPLACE FUNCTION public.start_test(p_homework_id uuid)
RETURNS public.test_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_school  uuid;
  v_row     public.test_submissions;
BEGIN
  v_student := public.current_student_id();
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'not_a_student';
  END IF;

  SELECT h.school_id INTO v_school
    FROM public.homework h
    JOIN public.student_groups sg ON sg.group_id = h.group_id
   WHERE h.id = p_homework_id
     AND sg.student_id = v_student;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'homework_not_available';
  END IF;

  SELECT * INTO v_row
    FROM public.test_submissions
   WHERE homework_id = p_homework_id
     AND student_id  = v_student
     FOR UPDATE;

  IF FOUND THEN
    IF v_row.started_at IS NULL THEN
      UPDATE public.test_submissions
         SET started_at = now()
       WHERE id = v_row.id
       RETURNING * INTO v_row;
    END IF;
    RETURN v_row;
  END IF;

  INSERT INTO public.test_submissions (homework_id, student_id, started_at, school_id)
  VALUES (p_homework_id, v_student, now(), v_school)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ─── 3. СДАЧА ────────────────────────────────────────────────────────────────
-- Принимает ТОЛЬКО ответы. Всё остальное — балл, максимум, признак
-- правильности, оценка — считает сервер. Присланному баллу не верим ни в
-- каком виде: в p_answers его просто негде передать, а лишние ключи в json
-- игнорируются, потому что читаются поимённо ровно три.
--
-- p_answers: [{"questionId": uuid, "selectedOptionId": uuid, "openText": text}]
CREATE OR REPLACE FUNCTION public.submit_test(p_homework_id uuid, p_answers jsonb)
RETURNS public.test_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student   uuid;
  v_school    uuid;
  v_sub       public.test_submissions;
  v_max       integer;
  v_score     integer;
  v_has_open  boolean;
  v_auto      boolean;
  v_grade     integer;
  v_ratio     numeric;
BEGIN
  v_student := public.current_student_id();
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'not_a_student';
  END IF;

  SELECT * INTO v_sub
    FROM public.test_submissions
   WHERE homework_id = p_homework_id
     AND student_id  = v_student
     FOR UPDATE;

  IF NOT FOUND OR v_sub.started_at IS NULL THEN
    RAISE EXCEPTION 'test_not_started';
  END IF;

  -- ПОВТОРНАЯ СДАЧА НЕ ПЕРЕЗАПИСЫВАЕТ БАЛЛ. Раньше защиты не было вовсе:
  -- submitTest сама искала строку и делала UPDATE, а замок правки оценок
  -- пропускал первую запись и всё, что уложилось в пятнадцать минут.
  IF v_sub.score IS NOT NULL THEN
    RAISE EXCEPTION 'test_already_submitted';
  END IF;

  SELECT h.school_id, COALESCE(h.test_auto_grade, true)
    INTO v_school, v_auto
    FROM public.homework h
   WHERE h.id = p_homework_id;

  -- МАКСИМУМ — ЧИСЛО ВОПРОСОВ С ВАРИАНТАМИ, А НЕ ВСЕХ ВОПРОСОВ.
  -- На этом держится признак «проверено» на экране учителя: он сравнивает
  -- max_score с общим числом вопросов, и пока они не равны, тест с открытым
  -- вопросом висит в очереди на проверку. Запиши сюда число всех вопросов —
  -- и очередь молча опустеет. Это самая тихая из возможных поломок, поэтому
  -- условие вынесено в отдельную строку с этим комментарием.
  SELECT count(*) FILTER (WHERE question_type = 'single_choice'),
         bool_or(question_type = 'open')
    INTO v_max, v_has_open
    FROM public.test_questions
   WHERE homework_id = p_homework_id;

  v_max      := COALESCE(v_max, 0);
  v_has_open := COALESCE(v_has_open, false);

  -- Ответы. Читаются ровно три ключа; всё, что ученик дописал в json сверх
  -- них — балл, признак правильности, что угодно — сюда не попадает.
  --
  -- ПРИЗНАК ПРАВИЛЬНОСТИ ПИШЕТСЯ ЗДЕСЬ, И ЭТО ОБЯЗАТЕЛЬНО. По нему считается
  -- авто-балл в окне проверки у учителя (ReviewModals): не запишем — учитель
  -- начнёт сохранять заниженный балл. Разница с прежним в том, что теперь это
  -- значение ставит сервер, а не присылает ученик.
  INSERT INTO public.test_answers
    (submission_id, question_id, selected_option_id, open_text, is_correct, school_id)
  SELECT
    v_sub.id,
    q.id,
    CASE WHEN q.question_type = 'single_choice' THEN a."selectedOptionId" END,
    CASE WHEN q.question_type = 'open' THEN COALESCE(a."openText", '') END,
    CASE
      WHEN q.question_type = 'single_choice'
        THEN COALESCE((SELECT o.is_correct
                         FROM public.test_question_options o
                        WHERE o.id = a."selectedOptionId"
                          AND o.question_id = q.id), false)
      ELSE NULL      -- открытый вопрос автоматически не проверяется, как и раньше
    END,
    v_school
  FROM jsonb_to_recordset(COALESCE(p_answers, '[]'::jsonb))
         AS a("questionId" uuid, "selectedOptionId" uuid, "openText" text)
  JOIN public.test_questions q
    ON q.id = a."questionId"
   AND q.homework_id = p_homework_id
  ON CONFLICT (submission_id, question_id) DO NOTHING;

  -- Балл — пересчётом по тому, что легло в базу, а не по присланному.
  SELECT count(*) INTO v_score
    FROM public.test_answers
   WHERE submission_id = v_sub.id
     AND is_correct IS TRUE;

  -- Оценка — та же формула, что была в autoGradeFromRatio (миграция 31), и
  -- то же условие: один открытый вопрос выключает авто-оценку целиком.
  v_grade := NULL;
  IF v_auto AND NOT v_has_open AND v_max > 0 THEN
    v_ratio := v_score::numeric / v_max::numeric;
    v_grade := CASE
                 WHEN v_ratio >= 0.85 THEN 5
                 WHEN v_ratio >= 0.70 THEN 4
                 WHEN v_ratio >= 0.50 THEN 3
                 ELSE 2
               END;
  END IF;

  UPDATE public.test_submissions
     SET score        = v_score,
         max_score    = v_max,
         grade        = v_grade,
         submitted_at = now()
   WHERE id = v_sub.id
   RETURNING * INTO v_sub;

  RETURN v_sub;
END;
$$;

-- Звать может только вошедший. anon в тестах делать нечего.
REVOKE ALL ON FUNCTION public.get_test_paper(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_test(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_test(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_test_paper(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_test(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_test(uuid, jsonb) TO authenticated, service_role;

-- ─── 4. ЧТЕНИЕ ВАРИАНТОВ УЧЕНИКУ — ТОЛЬКО ПОСЛЕ СДАЧИ ────────────────────────
-- Было: «есть моя попытка с непустым started_at» — то есть с первой секунды
-- теста. Стало: «есть моя СДАННАЯ попытка». Разбор ошибок работает как
-- работал, подсматривание до сдачи закрыто. Во время прохождения варианты
-- приезжают функцией get_test_paper, без признака правильности.
--
-- Политику учителя ("teacher manages test options in own groups") и родителя
-- ("parent reads own children test options") не трогаем.
ALTER POLICY "student reads test options" ON public.test_question_options
  USING (
    (
      EXISTS (
        SELECT 1
          FROM public.test_questions q
          JOIN public.test_submissions ts ON ts.homework_id = q.homework_id
         WHERE q.id = test_question_options.question_id
           AND ts.student_id  = public.current_student_id()
           -- score, а не submitted_at: последний NOT NULL DEFAULT now() и
           -- проставляется уже на «Начать» (см. разбор в get_test_paper).
           AND ts.score IS NOT NULL
      )
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- ─── 5. ПРЯМАЯ ЗАПИСЬ УЧЕНИКА СНЯТА ──────────────────────────────────────────
-- Создание попытки, её правку и запись ответов берут на себя функции выше.
-- Чтение своих сдач и своих ответов ученику остаётся — на нём держится и
-- показ балла, и разбор ошибок.
DROP POLICY IF EXISTS "student creates own test submission" ON public.test_submissions;
DROP POLICY IF EXISTS "student updates own test submission" ON public.test_submissions;
DROP POLICY IF EXISTS "student creates own test answers"    ON public.test_answers;

COMMIT;
