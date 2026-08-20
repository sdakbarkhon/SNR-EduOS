-- Миграция 218: часы замка оценок заводит УЧИТЕЛЬ, а не сдача ученика.
--
-- БЕДА, КОТОРУЮ ЧИНИМ. Замок из миграции 203 отсчитывает 15 минут от
-- graded_at. А отметку graded_at до сих пор ставили в момент, когда ученик
-- СДАВАЛ работу:
--
--   • Тесты. Триггер set_grading_meta (миграция 19) стреляет на любое
--     изменение score — «NEW.score is not null and OLD.score is distinct from
--     NEW.score». Кто пишет, он не спрашивал. Сдача теста — ровно такое
--     изменение: строка уже создана кнопкой «Начать», сдача проставляет в неё
--     балл. Итог: graded_at = момент сдачи, graded_by = NULL (у ученика
--     current_teacher_id() пуст).
--   • Квиз и Kahoot. Функции submit_quiz (216) и kahoot_finish (217) писали
--     graded_at = now() ЯВНО, при сдаче — просто перенесли на сервер то, что
--     раньше делал браузер.
--
-- Дальше замок добивал: на любом UPDATE он возвращает старую отметку
-- (NEW.graded_at := OLD.graded_at), чтобы окно нельзя было открыть заново.
-- Поэтому учитель, открывший проверку через час, получал отказ mark_locked за
-- чужое действие — за то, что ученик сдал работу. Свежую отметку, которую
-- ставил set_grading_meta прямо перед замком, замок выбрасывал: триггеры на
-- одной таблице идут по алфавиту, trg_grading_meta_test раньше
-- trg_lock_teacher_marks.
--
-- ЧТО МЕНЯЕМ. Ровно одно правило: отметку времени и автора оценки заводит
-- только рука учителя. Пишет ученик — отметки нет. Замок не трогаем совсем: у
-- него уже есть «отметки нет → значит первое выставление → разрешаю», и
-- начиная с этой миграции оно наконец означает то, что написано.
--
-- ЧТО НЕ МЕНЯЕТСЯ:
--   • 15 минут остаются 15 минутами (public.mark_edit_window);
--   • право администратора школы править запертое остаётся;
--   • запрет удаления оценок за урок остаётся;
--   • отказ учителю, который правит СВОЮ оценку через сутки, остаётся — это
--     и есть смысл замка;
--   • домашние задания не затронуты: там set_grading_meta и раньше ставил
--     отметку только когда grade уже не пуст, а ученик grade не пишет.
--
-- ОСОЗНАННОЕ СЛЕДСТВИЕ (решение заказчика от 20.08.2026). Автоматическая
-- оценка за тест, квиз и Kahoot теперь остаётся ОТКРЫТОЙ, пока к ней не
-- притронется учитель: часы стартуют с первого касания живого человека.
-- Вариант «считать от конца урока» отклонён как лишний механизм.
--
-- ВИДИМОЕ СЛЕДСТВИЕ, О КОТОРОМ НАДО ЗНАТЬ. В карточке учителя «оценено за
-- неделю» (getTeacherGradeStats, packages/core/src/queries/index.ts) счёт идёт
-- по graded_at. Автоматически оценённые тесты в него больше не попадают, пока
-- учитель их не откроет. Это не поломка, а восстановленный смысл: учитель их
-- и не оценивал.
--
-- ДАННЫЕ НЕ ТРОГАЕМ. 16 сдач теста и 2 прохождения квиза с пустым автором
-- остаются как есть — чистка отдельным заходом.

-- ── 1. Отметку ставит только учитель ────────────────────────────────────────
-- Единственная содержательная правка: сверху появилась проверка «есть ли перед
-- нами учитель». Тело веток слово в слово прежнее.
--
-- Побочно чинится ещё одно: раньше правка администратора СТИРАЛА автора
-- (graded_by := current_teacher_id(), а у админа он пуст), хотя миграция 203
-- прямо обещает «автор при этом НЕ меняется». Теперь у не-учителя функция не
-- трогает ни отметку, ни автора, и обещание выполняется.
CREATE OR REPLACE FUNCTION public.set_grading_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher uuid;
BEGIN
  -- ЧАСЫ ЗАМКА ЗАВОДИТ ТОЛЬКО РУКА УЧИТЕЛЯ.
  -- Пусто у: ученика (его сдача — не оценка), администратора и суперадмина
  -- (они исправляют чужое, автор остаётся прежним), служебного ключа и крона
  -- (auth.uid() пуст → и учителя нет).
  v_teacher := public.current_teacher_id();
  IF v_teacher IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'homework_submissions' THEN
    IF NEW.grade IS NOT NULL
       AND (OLD.grade IS DISTINCT FROM NEW.grade OR OLD.status IS DISTINCT FROM NEW.status) THEN
      NEW.graded_at := now();
      NEW.graded_by := v_teacher;
    END IF;
  ELSIF TG_TABLE_NAME = 'test_submissions' THEN
    IF NEW.score IS NOT NULL AND (OLD.score IS DISTINCT FROM NEW.score) THEN
      NEW.graded_at := now();
      NEW.graded_by := v_teacher;
    END IF;
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.set_grading_meta() IS
  'Отметка времени и автор оценки. Заводится ТОЛЬКО когда пишет учитель: сдача '
  'ученика оценкой не считается и часы замка (миграция 203) не запускает. '
  'Миграции 19 и 218.';

-- Триггеры не пересоздаём: trg_grading_meta_hw и trg_grading_meta_test уже
-- висят и указывают на эту же функцию по имени.

-- ── 2. Квиз: сдача больше не проставляет отметку ────────────────────────────
-- Тело функции из миграции 216 слово в слово, кроме двух мест: из INSERT ушли
-- graded_at/graded_by, из DO UPDATE — graded_at. Оценку (grade) сервер
-- по-прежнему считает и пишет сам — это не менялось.
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
  -- самооценки (миграция 216): запрет смотрит на auth.uid(), а он у функции с
  -- правами владельца остаётся ученическим, и без метки сервер запретил бы
  -- сам себе.
  --
  -- ОТМЕТКИ ВРЕМЕНИ ЗДЕСЬ БОЛЬШЕ НЕТ (миграция 218). Дата сдачи живёт в
  -- completed_at, она никуда не делась; graded_at остаётся пустым до тех пор,
  -- пока этап не откроет учитель. Пустой graded_at — это и есть «ещё не
  -- проверено» для замка и для уведомления.
  PERFORM set_config('app.quiz_server_scoring', '1', true);

  INSERT INTO public.lesson_stage_progress
    (stage_id, student_id, is_completed, completed_at, grade, submission_data, school_id)
  VALUES (p_stage_id, v_student, true, v_now, v_grade,
          jsonb_build_object('kind', 'quiz', 'correct', v_correct, 'total', v_total, 'total_score', v_score),
          v_school)
  ON CONFLICT (stage_id, student_id)
  DO UPDATE SET is_completed    = true,
                completed_at    = v_now,
                grade           = EXCLUDED.grade,
                submission_data = EXCLUDED.submission_data;

  PERFORM set_config('app.quiz_server_scoring', '', true);

  RETURN jsonb_build_object('correct', v_correct, 'total', v_total, 'grade', v_grade);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_quiz(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_quiz(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.submit_quiz(uuid) IS
  'Сдача QIA-квиза: сервер сверяет ответы, считает балл и оценку. Отметку '
  'времени проверки НЕ ставит — её заводит только учитель. Миграции 216 и 218.';

-- ── 3. Kahoot: завершение игры больше не проставляет отметку ────────────────
-- Тело из миграции 217 слово в слово, кроме тех же двух мест.
--
-- Отдельно про Kahoot: игру завершает УЧИТЕЛЬ, но завершение — это подсчёт
-- очков, а не проверка работы. Часы замка от него стартовать не должны, иначе
-- учитель, вернувшийся к оценкам через полчаса после игры, снова упрётся в
-- запертую запись.
CREATE OR REPLACE FUNCTION public.kahoot_finish(p_stage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      (stage_id, student_id, is_completed, completed_at, grade, submission_data, school_id)
    VALUES (p_stage_id, r.student_id, true, v_now,
            CASE
              WHEN v_total = 0 THEN 1
              WHEN (r.correct::numeric / v_total::numeric) * 100 >= 90 THEN 5
              WHEN (r.correct::numeric / v_total::numeric) * 100 >= 75 THEN 4
              WHEN (r.correct::numeric / v_total::numeric) * 100 >= 60 THEN 3
              WHEN (r.correct::numeric / v_total::numeric) * 100 >= 40 THEN 2
              ELSE 1 END,
            jsonb_build_object('kind', 'kahoot', 'correct', r.correct,
                               'total', COALESCE(v_total, 0), 'total_score', r.score),
            v_school)
    ON CONFLICT (stage_id, student_id)
    DO UPDATE SET is_completed = true, completed_at = v_now,
                  grade = EXCLUDED.grade,
                  submission_data = EXCLUDED.submission_data;
  END LOOP;

  UPDATE public.kahoot_sessions SET status = 'finished', finished_at = v_now
   WHERE stage_id = p_stage_id;

  RETURN jsonb_build_object('players', v_players, 'total_questions', COALESCE(v_total, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.kahoot_finish(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kahoot_finish(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.kahoot_finish(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.kahoot_finish(uuid) IS
  'Завершение игры Kahoot: подсчёт очков и оценка за этап. Отметку времени '
  'проверки НЕ ставит — подсчёт очков это не проверка. Миграции 217 и 218.';

-- ── 4. «Этап проверен» — на действие учителя, а не на сдачу ─────────────────
-- Условие было «graded_at появился». Пока отметку ставила сдача, ученик
-- получал «Этап проверен» сам от себя в ту же секунду, а когда этап проверял
-- живой учитель — уведомление уже не уходило никогда (graded_at не пуст →
-- выход в первой строке).
--
-- Пунктов 1–3 хватило бы: graded_at теперь и так появляется только от
-- учителя. Но проверку автора добавляем явно, чтобы правило читалось само
-- собой и не зависело от того, кто и что пишет в эту колонку завтра.
CREATE OR REPLACE FUNCTION public.fn_stage_grade_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Только переход отметки из пустой в заполненную.
  IF OLD.graded_at IS NOT NULL OR NEW.graded_at IS NULL THEN
    RETURN NEW;
  END IF;
  -- Отметка без автора — машинная (автооценка за квиз, Kahoot, сид).
  -- «Этап проверен» о ней не пишем: никто ничего не проверял.
  IF NEW.graded_by IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.grade IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM public.notify_user_and_parents(
    NEW.student_id, 'grade_received',
    'Оценка за этап: ' || NEW.grade::text || '/5',
    CASE WHEN NEW.teacher_comment IS NOT NULL AND NEW.teacher_comment <> ''
         THEN 'Комментарий: ' || NEW.teacher_comment ELSE 'Этап проверен' END,
    '/grades',
    NEW.id
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_stage_grade_notify() IS
  'Уведомление «Оценка за этап». Уходит, когда этап проверил ЖИВОЙ учитель '
  '(есть и отметка времени, и автор). Автооценка за квиз и Kahoot молчит. '
  'Миграции 49 и 218.';

-- Триггер не пересоздаём: trg_stage_grade_notify уже висит на
-- lesson_stage_progress и указывает на эту же функцию по имени.

-- ── 5. Пятнадцать минут: где лежит число ────────────────────────────────────
-- Число живёт в ДВУХ местах, и это осознанно не сведено к одному (см. отчёт
-- к миграции): SQL нельзя импортировать в браузер, а окно нужно синхронно при
-- отрисовке. Прежний комментарий тут врал, будто интерфейс спрашивает базу, —
-- исправляем текст, чтобы следующий не поверил.
COMMENT ON FUNCTION public.mark_edit_window() IS
  'Окно, в которое учитель ещё может исправить свою оценку. ГЛАВНОЕ значение: '
  'запрет стоит триггером fn_lock_teacher_marks и сверяется именно с ним. '
  'ВТОРАЯ КОПИЯ ЧИСЛА живёт в packages/core/src/utils/markLock.ts '
  '(MARK_EDIT_WINDOW_MINUTES) — она рисует обратный отсчёт на экране учителя. '
  'Меняешь здесь — поменяй и там, иначе экран будет врать. Миграции 203 и 218.';

NOTIFY pgrst, 'reload schema';
