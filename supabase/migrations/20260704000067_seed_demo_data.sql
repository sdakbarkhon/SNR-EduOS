-- =====================================================================
-- Migration 67 — Seed persistent demo data + disable nightly demo-reset.
--
-- Context: demo_teacher / demo_student (migration 66) currently log into an
-- EMPTY account — no lessons, no homework, nothing to show off. This
-- migration seeds a realistic one-time dataset for their shared group
-- ("Демо-класс") and disables the `reset-demo-data` cron job (migration 65)
-- so the seed survives indefinitely instead of being wiped every night at
-- 22:00 UTC. `reset_demo_data()` itself is left intact (just unscheduled) —
-- it can be re-scheduled later if a "fresh demo" reset is ever wanted again.
--
-- Schema note: this migration was written against the REAL, current schema
-- (read directly from migrations 1-66, not from database.types.ts, which is
-- stale — it predates lesson_stages/quiz_questions/subjects entirely). A few
-- names differ from what an earlier draft spec assumed; corrected here:
--   - lessons.duration_minutes (not duration_min)
--   - lesson_stages.position   (not order_index)
--   - lesson_stages content config for scratch/wokwi/codesandbox uses key
--     "embed_url" (not "external_url") — see ExternalStageModal.tsx. An
--     empty config `{}` is fine too: the UI falls back to a sensible default
--     editor URL per service (TurboWarp / wokwi new-project / CodeSandbox).
--   - homework_submissions has no generic jsonb "content" column. The real
--     per-content-type answer fields are: code_text (programming),
--     answer_text (free text), file_storage_path (file). Test-type homework
--     is tracked in the separate test_questions/test_submissions/test_answers
--     tables (migration 17), not in homework_submissions at all.
--   - groups.subject is still a live text column (not fully replaced by the
--     newer `subjects` table); the demo group's subjects row does not exist
--     yet (migration 53's one-time backfill ran before migration 66 created
--     this group), so this migration finds-or-creates it.
-- =====================================================================

DO $$
DECLARE
  v_teacher_user   uuid;
  v_teacher_id     uuid;
  v_student_user   uuid;
  v_student_id     uuid;
  v_group_id       uuid;
  v_subject_id     uuid;

  v_lesson_id      uuid;
  v_stage_id       uuid;
  v_l2_stage2_id   uuid;

  v_hw_id          uuid;
  v_sub_id         uuid;
  v_q_id           uuid;

  v_real_lessons_before  bigint;
  v_real_homework_before bigint;
  v_real_lessons_after   bigint;
  v_real_homework_after  bigint;
BEGIN
  -- ── 1. Resolve base IDs (NULL-guarded — bail out quietly if migration 66
  --      hasn't run, rather than failing the whole deploy) ────────────────
  SELECT id INTO v_teacher_user FROM auth.users WHERE email = 'demo_teacher@demo.snr.local';
  SELECT id INTO v_student_user FROM auth.users WHERE email = 'demo_student@demo.snr.local';
  IF v_teacher_user IS NULL OR v_student_user IS NULL THEN
    RAISE NOTICE '[seed-demo] demo auth users not found (migration 66 not applied?) — skipping seed';
    RETURN;
  END IF;

  SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = v_teacher_user;
  SELECT id INTO v_student_id FROM public.students WHERE user_id = v_student_user;
  IF v_teacher_id IS NULL OR v_student_id IS NULL THEN
    RAISE NOTICE '[seed-demo] demo teacher/student rows not found — skipping seed';
    RETURN;
  END IF;

  SELECT id INTO v_group_id FROM public.groups WHERE teacher_id = v_teacher_id AND name = 'Демо-класс';
  IF v_group_id IS NULL THEN
    RAISE NOTICE '[seed-demo] demo group "Демо-класс" not found — skipping seed';
    RETURN;
  END IF;

  -- Safety snapshot: real-user data untouched by this migration (checked again at the end).
  SELECT count(*) INTO v_real_lessons_before  FROM public.lessons  WHERE group_id <> v_group_id;
  SELECT count(*) INTO v_real_homework_before FROM public.homework WHERE teacher_id IS DISTINCT FROM v_teacher_id;

  -- ── 2. Find or create the "Программирование" subject for the demo group ──
  -- (migration 53's one-time backfill ran before this group existed, so it
  -- has no subjects row yet; icon/color mirror migration 53's own mapping
  -- for subject key 'programming'.)
  SELECT id INTO v_subject_id FROM public.subjects WHERE group_id = v_group_id AND name = 'Программирование';
  IF v_subject_id IS NULL THEN
    INSERT INTO public.subjects (name, group_id, teacher_id, icon, color)
    VALUES ('Программирование', v_group_id, v_teacher_id, 'Code', '#0EA5E9')
    RETURNING id INTO v_subject_id;
  END IF;

  -- =====================================================================
  -- 3. LESSONS (5, spanning yesterday .. +3 days)
  -- =====================================================================

  -- ── Lesson 1 — yesterday, completed ──────────────────────────────────
  SELECT id INTO v_lesson_id FROM public.lessons
    WHERE group_id = v_group_id AND title = 'Python: переменные и типы данных'
      AND starts_at::date = (CURRENT_DATE - INTERVAL '1 day')::date;
  IF v_lesson_id IS NULL THEN
    INSERT INTO public.lessons (
      group_id, subject_id, title, topic, room, starts_at, duration_minutes,
      status, started_at, ended_at
    ) VALUES (
      v_group_id, v_subject_id, 'Python: переменные и типы данных', 'Python: переменные и типы данных', 'Каб. 305',
      CURRENT_DATE - INTERVAL '1 day' + INTERVAL '9 hours', 45,
      'completed',
      CURRENT_DATE - INTERVAL '1 day' + INTERVAL '9 hours',
      CURRENT_DATE - INTERVAL '1 day' + INTERVAL '9 hours 45 minutes'
    ) RETURNING id INTO v_lesson_id;
  END IF;

  -- Stage 1: presentation "Введение в Python"
  SELECT id INTO v_stage_id FROM public.lesson_stages WHERE lesson_id = v_lesson_id AND position = 1;
  IF v_stage_id IS NULL THEN
    INSERT INTO public.lesson_stages (
      lesson_id, position, stage_role, stage_type, content_type, title,
      is_completed, completed_at, was_activated, slides
    ) VALUES (
      v_lesson_id, 1, 'middle', 'theory', 'presentation', 'Введение в Python',
      true, CURRENT_DATE - INTERVAL '1 day' + INTERVAL '9 hours 10 minutes', true,
      '[
        {"layout":"title","title":"Введение в Python","content":"Python: переменные и типы данных"},
        {"layout":"default","title":"Переменные","content":"Переменная — это именованная область памяти для хранения данных. В Python не нужно объявлять тип заранее — интерпретатор определяет его автоматически."},
        {"layout":"code","title":"Пример кода","content":"Создание переменных в Python","code":{"language":"python","content":"x = 10\ny = ''hello''"}}
      ]'::jsonb
    );
  END IF;

  -- Stage 2: code "Первая программа"
  SELECT id INTO v_stage_id FROM public.lesson_stages WHERE lesson_id = v_lesson_id AND position = 2;
  IF v_stage_id IS NULL THEN
    INSERT INTO public.lesson_stages (
      lesson_id, position, stage_role, stage_type, content_type, title,
      is_completed, completed_at, was_activated, starter_code, programming_language
    ) VALUES (
      v_lesson_id, 2, 'middle', 'task', 'code', 'Первая программа',
      true, CURRENT_DATE - INTERVAL '1 day' + INTERVAL '9 hours 25 minutes', true,
      E'print(''Hello, world!'')', 'python'
    );
  END IF;

  -- Stage 3: quiz_qia "Проверка знаний" (+ 3 quiz_questions)
  SELECT id INTO v_stage_id FROM public.lesson_stages WHERE lesson_id = v_lesson_id AND position = 3;
  IF v_stage_id IS NULL THEN
    INSERT INTO public.lesson_stages (
      lesson_id, position, stage_role, stage_type, content_type, title,
      is_completed, completed_at, was_activated
    ) VALUES (
      v_lesson_id, 3, 'middle', 'task', 'quiz_qia', 'Проверка знаний',
      true, CURRENT_DATE - INTERVAL '1 day' + INTERVAL '9 hours 40 minutes', true
    ) RETURNING id INTO v_stage_id;

    INSERT INTO public.quiz_questions (stage_id, position, question_text, options, correct_option_index)
    VALUES
      (v_stage_id, 0, 'Что такое переменная в Python?',
        '["Число","Именованная область памяти для хранения данных","Функция","Файл"]'::jsonb, 1),
      (v_stage_id, 1, 'Какой символ используется для комментариев в Python?',
        '["//","#","--","/* */"]'::jsonb, 1),
      (v_stage_id, 2, 'Какая функция используется для вывода данных на экран?',
        '["print()","input()","echo()","output()"]'::jsonb, 0);
  END IF;

  -- lesson_stage_progress: all 3 content stages completed for demo_student
  INSERT INTO public.lesson_stage_progress (stage_id, student_id, is_completed, completed_at)
  SELECT ls.id, v_student_id, true,
         CURRENT_DATE - INTERVAL '1 day' + INTERVAL '9 hours' +
           (10 + 15 * (ls.position - 1)) * INTERVAL '1 minute'
  FROM public.lesson_stages ls
  WHERE ls.lesson_id = v_lesson_id AND ls.position IN (1, 2, 3)
  ON CONFLICT (stage_id, student_id) DO NOTHING;

  -- Auto-created Старт/Итог (position 0/9999) are normally marked completed
  -- by the fn_auto_start_lessons/fn_auto_end_lessons cron jobs as a lesson
  -- transitions through its lifecycle in real time; this lesson is inserted
  -- directly with status='completed', bypassing that, so set them here too.
  UPDATE public.lesson_stages
  SET is_completed = true, completed_at = COALESCE(completed_at, CURRENT_DATE - INTERVAL '1 day' + INTERVAL '9 hours 45 minutes')
  WHERE lesson_id = v_lesson_id AND stage_role IN ('start', 'summary') AND NOT is_completed;

  -- ── Lesson 2 — today, in_progress ────────────────────────────────────
  SELECT id INTO v_lesson_id FROM public.lessons
    WHERE group_id = v_group_id AND title = 'Циклы for и while'
      AND starts_at::date = CURRENT_DATE;
  IF v_lesson_id IS NULL THEN
    INSERT INTO public.lessons (
      group_id, subject_id, title, topic, room, starts_at, duration_minutes,
      status, started_at
    ) VALUES (
      v_group_id, v_subject_id, 'Циклы for и while', 'Циклы for и while', 'Каб. 305',
      CURRENT_DATE + INTERVAL '10 hours', 45,
      'in_progress', CURRENT_DATE + INTERVAL '10 hours'
    ) RETURNING id INTO v_lesson_id;
  END IF;

  -- Stage 1: presentation "Что такое цикл" — was_activated
  SELECT id INTO v_stage_id FROM public.lesson_stages WHERE lesson_id = v_lesson_id AND position = 1;
  IF v_stage_id IS NULL THEN
    INSERT INTO public.lesson_stages (
      lesson_id, position, stage_role, stage_type, content_type, title, was_activated,
      is_completed, completed_at, slides
    ) VALUES (
      v_lesson_id, 1, 'middle', 'theory', 'presentation', 'Что такое цикл', true,
      true, CURRENT_DATE + INTERVAL '10 hours 10 minutes',
      '[
        {"layout":"title","title":"Что такое цикл","content":"Циклы for и while в Python"},
        {"layout":"default","title":"Зачем нужны циклы","content":"Цикл позволяет повторять один и тот же блок кода несколько раз без дублирования строк."}
      ]'::jsonb
    );
  END IF;

  -- Stage 2: code "Задача: сумма чисел от 1 до N" — was_activated + active
  SELECT id INTO v_l2_stage2_id FROM public.lesson_stages WHERE lesson_id = v_lesson_id AND position = 2;
  IF v_l2_stage2_id IS NULL THEN
    INSERT INTO public.lesson_stages (
      lesson_id, position, stage_role, stage_type, content_type, title, was_activated,
      starter_code, programming_language
    ) VALUES (
      v_lesson_id, 2, 'middle', 'task', 'code', 'Задача: сумма чисел от 1 до N', true,
      E'n = 10\ntotal = 0\n\n# TODO: посчитай сумму чисел от 1 до n с помощью цикла for\n\nprint(total)', 'python'
    ) RETURNING id INTO v_l2_stage2_id;
  END IF;

  -- Stage 3: code "Задача: FizzBuzz" — not yet activated
  SELECT id INTO v_stage_id FROM public.lesson_stages WHERE lesson_id = v_lesson_id AND position = 3;
  IF v_stage_id IS NULL THEN
    INSERT INTO public.lesson_stages (
      lesson_id, position, stage_role, stage_type, content_type, title, was_activated,
      starter_code, programming_language
    ) VALUES (
      v_lesson_id, 3, 'middle', 'task', 'code', 'Задача: FizzBuzz', false,
      E'# TODO: выведи числа от 1 до 20\n# кратные 3 замени на "Fizz", кратные 5 на "Buzz", кратные обоим на "FizzBuzz"\nfor i in range(1, 21):\n    pass', 'python'
    );
  END IF;

  -- active_stage_id → stage 2 (simulates a lesson currently "in progress" on that stage)
  UPDATE public.lessons SET active_stage_id = v_l2_stage2_id WHERE id = v_lesson_id;

  -- Старт stage: lesson has started (fn_auto_start_lessons' job, bypassed by direct insert — see lesson 1 note above).
  UPDATE public.lesson_stages
  SET is_completed = true, completed_at = COALESCE(completed_at, CURRENT_DATE + INTERVAL '10 hours 2 minutes')
  WHERE lesson_id = v_lesson_id AND stage_role = 'start' AND NOT is_completed;

  -- lesson_stage_progress: only stage 1 (presentation) completed so far
  INSERT INTO public.lesson_stage_progress (stage_id, student_id, is_completed, completed_at)
  SELECT ls.id, v_student_id, true, CURRENT_DATE + INTERVAL '10 hours 12 minutes'
  FROM public.lesson_stages ls
  WHERE ls.lesson_id = v_lesson_id AND ls.position = 1
  ON CONFLICT (stage_id, student_id) DO NOTHING;

  -- ── Lesson 3 — tomorrow, scheduled ───────────────────────────────────
  SELECT id INTO v_lesson_id FROM public.lessons
    WHERE group_id = v_group_id AND title = 'Мигающий светодиод Arduino'
      AND starts_at::date = (CURRENT_DATE + INTERVAL '1 day')::date;
  IF v_lesson_id IS NULL THEN
    INSERT INTO public.lessons (
      group_id, subject_id, title, topic, room, starts_at, duration_minutes, status
    ) VALUES (
      v_group_id, v_subject_id, 'Мигающий светодиод Arduino', 'Мигающий светодиод Arduino', 'Лаб. 2',
      CURRENT_DATE + INTERVAL '1 day' + INTERVAL '11 hours', 45, 'scheduled'
    ) RETURNING id INTO v_lesson_id;
  END IF;

  SELECT id INTO v_stage_id FROM public.lesson_stages WHERE lesson_id = v_lesson_id AND position = 1;
  IF v_stage_id IS NULL THEN
    INSERT INTO public.lesson_stages (lesson_id, position, stage_role, stage_type, content_type, title, slides)
    VALUES (v_lesson_id, 1, 'middle', 'theory', 'presentation', 'Введение в Arduino',
      '[{"layout":"title","title":"Мигающий светодиод","content":"Основы Arduino"}]'::jsonb);
  END IF;

  SELECT id INTO v_stage_id FROM public.lesson_stages WHERE lesson_id = v_lesson_id AND position = 2;
  IF v_stage_id IS NULL THEN
    INSERT INTO public.lesson_stages (lesson_id, position, stage_role, stage_type, content_type, title)
    VALUES (v_lesson_id, 2, 'middle', 'task', 'wokwi', 'Демо схема');
  END IF;

  SELECT id INTO v_stage_id FROM public.lesson_stages WHERE lesson_id = v_lesson_id AND position = 3;
  IF v_stage_id IS NULL THEN
    INSERT INTO public.lesson_stages (lesson_id, position, stage_role, stage_type, content_type, title)
    VALUES (v_lesson_id, 3, 'middle', 'task', 'wokwi', 'Задача: добавь второй светодиод');
  END IF;

  -- ── Lesson 4 — +2 days, scheduled ────────────────────────────────────
  SELECT id INTO v_lesson_id FROM public.lessons
    WHERE group_id = v_group_id AND title = 'Танцующий кот в Scratch'
      AND starts_at::date = (CURRENT_DATE + INTERVAL '2 days')::date;
  IF v_lesson_id IS NULL THEN
    INSERT INTO public.lessons (
      group_id, subject_id, title, topic, room, starts_at, duration_minutes, status
    ) VALUES (
      v_group_id, v_subject_id, 'Танцующий кот в Scratch', 'Танцующий кот в Scratch', 'Каб. 207',
      CURRENT_DATE + INTERVAL '2 days' + INTERVAL '9 hours', 45, 'scheduled'
    ) RETURNING id INTO v_lesson_id;
  END IF;

  SELECT id INTO v_stage_id FROM public.lesson_stages WHERE lesson_id = v_lesson_id AND position = 1;
  IF v_stage_id IS NULL THEN
    INSERT INTO public.lesson_stages (lesson_id, position, stage_role, stage_type, content_type, title, slides)
    VALUES (v_lesson_id, 1, 'middle', 'theory', 'presentation', 'Знакомство со Scratch',
      '[{"layout":"title","title":"Танцующий кот","content":"Анимация в Scratch"}]'::jsonb);
  END IF;

  SELECT id INTO v_stage_id FROM public.lesson_stages WHERE lesson_id = v_lesson_id AND position = 2;
  IF v_stage_id IS NULL THEN
    INSERT INTO public.lesson_stages (lesson_id, position, stage_role, stage_type, content_type, title)
    VALUES (v_lesson_id, 2, 'middle', 'task', 'scratch', 'Анимация кота');
  END IF;

  -- ── Lesson 5 — +3 days, scheduled ────────────────────────────────────
  SELECT id INTO v_lesson_id FROM public.lessons
    WHERE group_id = v_group_id AND title = 'Создание первого сайта: HTML'
      AND starts_at::date = (CURRENT_DATE + INTERVAL '3 days')::date;
  IF v_lesson_id IS NULL THEN
    INSERT INTO public.lessons (
      group_id, subject_id, title, topic, room, starts_at, duration_minutes, status
    ) VALUES (
      v_group_id, v_subject_id, 'Создание первого сайта: HTML', 'Создание первого сайта: HTML', 'Каб. 207',
      CURRENT_DATE + INTERVAL '3 days' + INTERVAL '10 hours', 45, 'scheduled'
    ) RETURNING id INTO v_lesson_id;
  END IF;

  SELECT id INTO v_stage_id FROM public.lesson_stages WHERE lesson_id = v_lesson_id AND position = 1;
  IF v_stage_id IS NULL THEN
    INSERT INTO public.lesson_stages (lesson_id, position, stage_role, stage_type, content_type, title, slides)
    VALUES (v_lesson_id, 1, 'middle', 'theory', 'presentation', 'Основы HTML',
      '[{"layout":"title","title":"Первый сайт","content":"Введение в HTML"}]'::jsonb);
  END IF;

  SELECT id INTO v_stage_id FROM public.lesson_stages WHERE lesson_id = v_lesson_id AND position = 2;
  IF v_stage_id IS NULL THEN
    INSERT INTO public.lesson_stages (lesson_id, position, stage_role, stage_type, content_type, title)
    VALUES (v_lesson_id, 2, 'middle', 'task', 'codesandbox', 'Практика HTML');
  END IF;

  SELECT id INTO v_stage_id FROM public.lesson_stages WHERE lesson_id = v_lesson_id AND position = 3;
  IF v_stage_id IS NULL THEN
    INSERT INTO public.lesson_stages (lesson_id, position, stage_role, stage_type, content_type, title)
    VALUES (v_lesson_id, 3, 'middle', 'task', 'codesandbox', 'Добавь CSS');
  END IF;

  -- =====================================================================
  -- 4. HOMEWORK — 3 current + 2 old graded (5 total, 4 submissions)
  -- =====================================================================

  -- ── A.4.1 — "Программа приветствия" (programming, graded 5) ─────────
  SELECT id INTO v_hw_id FROM public.homework WHERE title = 'Программа приветствия' AND teacher_id = v_teacher_id;
  IF v_hw_id IS NULL THEN
    INSERT INTO public.homework (
      group_id, title, description, due_date, content_type, source, teacher_id, programming_language
    ) VALUES (
      v_group_id, 'Программа приветствия', 'Напиши программу, которая выводит на экран приветствие пользователю.',
      CURRENT_DATE - INTERVAL '3 days', 'programming', 'teacher', v_teacher_id, 'python'
    ) RETURNING id INTO v_hw_id;
  END IF;
  INSERT INTO public.homework_submissions (
    homework_id, student_id, submitted_at, code_text, grade, teacher_comment, status, graded_at, graded_by
  ) VALUES (
    v_hw_id, v_student_id, CURRENT_DATE - INTERVAL '4 days',
    E'name = input(''Как тебя зовут? '')\nprint(f''Привет, {name}!'')',
    5, 'Отличная работа! Всё работает правильно 👏', 'graded',
    CURRENT_DATE - INTERVAL '4 days', v_teacher_id
  ) ON CONFLICT (homework_id, student_id) DO NOTHING;

  -- ── A.4.2 — "Тест по переменным Python" (test, submitted, awaiting grade) ─
  SELECT id INTO v_hw_id FROM public.homework WHERE title = 'Тест по переменным Python' AND teacher_id = v_teacher_id;
  IF v_hw_id IS NULL THEN
    INSERT INTO public.homework (
      group_id, title, description, due_date, content_type, source, teacher_id
    ) VALUES (
      v_group_id, 'Тест по переменным Python', 'Проверь свои знания о переменных и типах данных.',
      CURRENT_DATE + INTERVAL '1 day', 'test', 'teacher', v_teacher_id
    ) RETURNING id INTO v_hw_id;
  END IF;

  -- 2 single_choice + 1 open (the open question keeps the submission ungraded — matches submitTest()'s
  -- real auto-grade rule: grade stays NULL whenever a test contains any open question).
  SELECT id INTO v_q_id FROM public.test_questions WHERE homework_id = v_hw_id AND order_index = 0;
  IF v_q_id IS NULL THEN
    INSERT INTO public.test_questions (homework_id, question_text, question_type, order_index)
    VALUES (v_hw_id, 'Как правильно объявить переменную x со значением 10 в Python?', 'single_choice', 0)
    RETURNING id INTO v_q_id;
    INSERT INTO public.test_question_options (question_id, option_text, is_correct, order_index) VALUES
      (v_q_id, 'x = 10', true, 0),
      (v_q_id, 'var x = 10', false, 1),
      (v_q_id, 'int x = 10;', false, 2),
      (v_q_id, 'x := 10', false, 3);
  END IF;

  SELECT id INTO v_q_id FROM public.test_questions WHERE homework_id = v_hw_id AND order_index = 1;
  IF v_q_id IS NULL THEN
    INSERT INTO public.test_questions (homework_id, question_text, question_type, order_index)
    VALUES (v_hw_id, 'Какой тип данных у значения "hello"?', 'single_choice', 1)
    RETURNING id INTO v_q_id;
    INSERT INTO public.test_question_options (question_id, option_text, is_correct, order_index) VALUES
      (v_q_id, 'int', false, 0),
      (v_q_id, 'str', true, 1),
      (v_q_id, 'bool', false, 2),
      (v_q_id, 'float', false, 3);
  END IF;

  SELECT id INTO v_q_id FROM public.test_questions WHERE homework_id = v_hw_id AND order_index = 2;
  IF v_q_id IS NULL THEN
    INSERT INTO public.test_questions (homework_id, question_text, question_type, order_index)
    VALUES (v_hw_id, 'Объясни своими словами, зачем в программе нужны переменные.', 'open', 2)
    RETURNING id INTO v_q_id;
  END IF;

  SELECT id INTO v_sub_id FROM public.test_submissions WHERE homework_id = v_hw_id AND student_id = v_student_id;
  IF v_sub_id IS NULL THEN
    INSERT INTO public.test_submissions (homework_id, student_id, submitted_at, score, max_score)
    VALUES (v_hw_id, v_student_id, CURRENT_DATE, 2, 2)
    RETURNING id INTO v_sub_id;

    INSERT INTO public.test_answers (submission_id, question_id, selected_option_id, is_correct)
    SELECT v_sub_id, tq.id, tqo.id, true
    FROM public.test_questions tq
    JOIN public.test_question_options tqo ON tqo.question_id = tq.id AND tqo.is_correct = true
    WHERE tq.homework_id = v_hw_id AND tq.order_index IN (0, 1);

    INSERT INTO public.test_answers (submission_id, question_id, open_text, is_correct)
    SELECT v_sub_id, tq.id, 'Переменные позволяют хранить и переиспользовать значения в программе, не повторяя их вручную.', NULL
    FROM public.test_questions tq WHERE tq.homework_id = v_hw_id AND tq.order_index = 2;
  END IF;

  -- ── A.4.3 — "Мигающий светодиод Arduino" (file, no submission) ──────
  SELECT id INTO v_hw_id FROM public.homework WHERE title = 'Мигающий светодиод Arduino' AND teacher_id = v_teacher_id;
  IF v_hw_id IS NULL THEN
    INSERT INTO public.homework (group_id, title, description, due_date, content_type, source, teacher_id)
    VALUES (
      v_group_id, 'Мигающий светодиод Arduino', 'Собери схему с мигающим светодиодом и приложи фото/видео результата.',
      CURRENT_DATE + INTERVAL '3 days', 'file', 'teacher', v_teacher_id
    );
  END IF;

  -- ── A.5.1 — "Первые шаги в Python" (old, graded 4) ──────────────────
  SELECT id INTO v_hw_id FROM public.homework WHERE title = 'Первые шаги в Python' AND teacher_id = v_teacher_id;
  IF v_hw_id IS NULL THEN
    INSERT INTO public.homework (
      group_id, title, description, due_date, content_type, source, teacher_id, programming_language
    ) VALUES (
      v_group_id, 'Первые шаги в Python', 'Выведи на экран числа от 1 до 10.',
      CURRENT_DATE - INTERVAL '14 days', 'programming', 'teacher', v_teacher_id, 'python'
    ) RETURNING id INTO v_hw_id;
  END IF;
  INSERT INTO public.homework_submissions (
    homework_id, student_id, submitted_at, code_text, grade, teacher_comment, status, graded_at, graded_by
  ) VALUES (
    v_hw_id, v_student_id, CURRENT_DATE - INTERVAL '15 days',
    E'for i in range(1, 11):\n    print(i)',
    4, 'Хорошая работа, есть небольшие замечания', 'graded',
    CURRENT_DATE - INTERVAL '15 days', v_teacher_id
  ) ON CONFLICT (homework_id, student_id) DO NOTHING;

  -- ── A.5.2 — "Условия if/else" (old, graded 5) ───────────────────────
  SELECT id INTO v_hw_id FROM public.homework WHERE title = 'Условия if/else' AND teacher_id = v_teacher_id;
  IF v_hw_id IS NULL THEN
    INSERT INTO public.homework (
      group_id, title, description, due_date, content_type, source, teacher_id, programming_language
    ) VALUES (
      v_group_id, 'Условия if/else', 'Напиши программу, определяющую чётное число или нечётное.',
      CURRENT_DATE - INTERVAL '21 days', 'programming', 'teacher', v_teacher_id, 'python'
    ) RETURNING id INTO v_hw_id;
  END IF;
  INSERT INTO public.homework_submissions (
    homework_id, student_id, submitted_at, code_text, grade, teacher_comment, status, graded_at, graded_by
  ) VALUES (
    v_hw_id, v_student_id, CURRENT_DATE - INTERVAL '22 days',
    E'n = int(input())\nif n % 2 == 0:\n    print(''чётное'')\nelse:\n    print(''нечётное'')',
    5, 'Идеально!', 'graded',
    CURRENT_DATE - INTERVAL '22 days', v_teacher_id
  ) ON CONFLICT (homework_id, student_id) DO NOTHING;

  -- ── Safety check: real users' data must be byte-for-byte unaffected ──
  SELECT count(*) INTO v_real_lessons_after  FROM public.lessons  WHERE group_id <> v_group_id;
  SELECT count(*) INTO v_real_homework_after FROM public.homework WHERE teacher_id IS DISTINCT FROM v_teacher_id;
  IF v_real_lessons_after <> v_real_lessons_before OR v_real_homework_after <> v_real_homework_before THEN
    RAISE EXCEPTION '[seed-demo] real-user row counts changed (lessons % -> %, homework % -> %) — aborting',
      v_real_lessons_before, v_real_lessons_after, v_real_homework_before, v_real_homework_after;
  END IF;

  RAISE NOTICE '[seed-demo] done. real-user lessons=% (unchanged), real-user homework=% (unchanged)',
    v_real_lessons_after, v_real_homework_after;
END $$;

-- =====================================================================
-- 5. Disable the nightly demo-reset cron job (function stays intact).
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-demo-data') THEN
    PERFORM cron.unschedule('reset-demo-data');
    RAISE NOTICE '[seed-demo] unscheduled cron job "reset-demo-data"';
  ELSE
    RAISE NOTICE '[seed-demo] cron job "reset-demo-data" already absent';
  END IF;
END $$;

COMMENT ON FUNCTION public.reset_demo_data() IS
  'Чистит данные демо-аккаунтов (is_demo=true) — БОЛЬШЕ НЕ запускается по расписанию (миграция 67 отключила cron-job "reset-demo-data", чтобы сидовые данные demo_teacher/demo_student из этой миграции были персистентными). Функция оставлена на случай, если понадобится вручную сбросить демо-данные.';
