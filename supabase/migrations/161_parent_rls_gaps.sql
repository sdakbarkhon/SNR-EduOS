-- =====================================================================
-- Migration 161 — четыре пробела в RLS для роли parent.
--
-- Найдено при подготовке веб-родителя к работе на РЕАЛЬНЫХ данных
-- (до этого экраны /parent жили на фикстурах). Базовое покрытие для
-- родителя уже есть — миграции 74 (lessons/homework/attendance/grades/
-- payments/course_materials + хелпер is_my_child), 75 (SECURITY DEFINER
-- хелперы is_my_child_group/is_my_child_lesson вместо прямого подзапроса
-- к RLS-защищённой student_groups), 76 (test/classwork/project
-- submissions, lesson_stage_progress), 77 (students/student_groups/
-- charges/groups), 82 (current_school_id резолвит parents), 87
-- (homework_subtasks), 126 (announcements + current_parent_id), 128
-- (parent_insights). Блокера «родитель ничего не видит» НЕТ.
--
-- Но остались 4 точечные дыры. Все они опасны тем, что дают ТИХИЙ НОЛЬ
-- (или ошибку скачивания), а не понятный отказ:
--
--   1) public.classwork и public.projects — parent-политики нет вовсе.
--      getStudentGrades() джойнит их как classwork!inner / project!inner,
--      а PostgREST при `!inner` роняет ВСЮ строку, если embedded-таблица
--      невидима. Значит classwork- и project-оценки молча исчезают из
--      журнала родителя, хотя сами classwork_submissions/
--      project_submissions ему уже открыты миграцией 76. Это ровно тот же
--      класс бага, который миграция 77 чинила для `groups`.
--
--   2) public.lesson_materials — политика чтения построена на
--      is_my_group()/is_my_teacher_group(), родителя там нет. Материалы,
--      привязанные к конкретному уроку, родителю не видны. (Раздел
--      «Материалы» целиком работает и без этого — миграция 124
--      автопубликует их в course_materials, который родителю открыт, —
--      но карточка урока с вложениями пустая.)
--
--   3) storage.objects, бакет 'homework-files' — SELECT есть только у
--      учителя-владельца папки и у самого ученика
--      (20260617000022_homework_files.sql). Родителю запрещено, поэтому
--      getSubmissionFileUrl/getHomeworkAttachmentUrl БРОСАЮТ ошибку (не
--      пустоту) на экране деталей ДЗ. Раскладка пути подтверждена той же
--      миграцией: <teacher_id>/<homework_id>/attachment/<file> и
--      <teacher_id>/<homework_id>/submissions/<student_id>/<file>.
--
--   4) Разбор теста родителю (test_questions / test_question_options /
--      test_answers) — нужен, чтобы экран оценки за тест показывал сами
--      вопросы, а не только балл.
--
-- ВАЖНО про рекурсию RLS: во всех предикатах используются ТОЛЬКО
-- SECURITY DEFINER-хелперы (is_my_child / is_my_child_group /
-- is_my_child_lesson). Прямой подзапрос к student_groups здесь запрещён —
-- именно на этом обжигалась миграция 75 (подзапрос к RLS-защищённой
-- таблице внутри политики давал тихий ноль).
--
-- Идемпотентна: DO-блок + NOT EXISTS по pg_policies, как в 76/77.
--
-- !!! НЕ ПРИМЕНЕНА К ПРОД-БАЗЕ ЭТИМ ЗАХОДОМ — в среде нет прямого
-- Postgres-подключения/привязанного Supabase CLI (только PostgREST через
-- service-role, не DDL). Ручной шаг заказчика: Supabase Dashboard →
-- SQL Editor. До применения экраны родителя, завязанные на classwork/
-- project-оценки, вложения ДЗ и разбор теста, будут неполными.
-- =====================================================================

BEGIN;

DO $$
BEGIN
  -- 1a. classwork — через урок, к группе которого привязан ребёнок.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'classwork'
      AND policyname = 'parent reads own children classwork'
  ) THEN
    CREATE POLICY "parent reads own children classwork" ON public.classwork
      FOR SELECT
      USING (
        public.is_my_child_lesson(lesson_id)
        OR (school_id = public.current_school_id() AND public.fn_is_admin())
        OR public.is_super_admin()
      );
  END IF;

  -- 1b. projects — привязаны к группе напрямую.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects'
      AND policyname = 'parent reads own children projects'
  ) THEN
    CREATE POLICY "parent reads own children projects" ON public.projects
      FOR SELECT
      USING (
        public.is_my_child_group(group_id)
        OR (school_id = public.current_school_id() AND public.fn_is_admin())
        OR public.is_super_admin()
      );
  END IF;

  -- 2. lesson_materials — вложения конкретного урока.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lesson_materials'
      AND policyname = 'parent reads own children lesson materials'
  ) THEN
    CREATE POLICY "parent reads own children lesson materials" ON public.lesson_materials
      FOR SELECT
      USING (
        public.is_my_child_lesson(lesson_id)
        OR (school_id = public.current_school_id() AND public.fn_is_admin())
        OR public.is_super_admin()
      );
  END IF;

  -- 4. Разбор теста: вопросы, варианты и ответы СВОЕГО ребёнка.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'test_questions'
      AND policyname = 'parent reads own children test questions'
  ) THEN
    CREATE POLICY "parent reads own children test questions" ON public.test_questions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.homework h
          WHERE h.id = test_questions.homework_id
            AND public.is_my_child_group(h.group_id)
        )
        OR (school_id = public.current_school_id() AND public.fn_is_admin())
        OR public.is_super_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'test_question_options'
      AND policyname = 'parent reads own children test options'
  ) THEN
    CREATE POLICY "parent reads own children test options" ON public.test_question_options
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.test_questions q
          JOIN public.homework h ON h.id = q.homework_id
          WHERE q.id = test_question_options.question_id
            AND public.is_my_child_group(h.group_id)
        )
        OR (school_id = public.current_school_id() AND public.fn_is_admin())
        OR public.is_super_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'test_answers'
      AND policyname = 'parent reads own children test answers'
  ) THEN
    CREATE POLICY "parent reads own children test answers" ON public.test_answers
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.test_submissions ts
          WHERE ts.id = test_answers.submission_id
            AND public.is_my_child(ts.student_id)
        )
        OR (school_id = public.current_school_id() AND public.fn_is_admin())
        OR public.is_super_admin()
      );
  END IF;
END $$;

-- 3. Файлы ДЗ в Storage. Раскладка пути (миграция 20260617000022):
--    [1]=teacher_id, [2]=homework_id, [3]='attachment'|'submissions',
--    [4]=student_id (только для submissions).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'parent reads child homework files'
  ) THEN
    CREATE POLICY "parent reads child homework files" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'homework-files'
        AND (
          -- Материалы задания, выданные учителем всей группе ребёнка.
          (
            (storage.foldername(name))[3] = 'attachment'
            AND EXISTS (
              SELECT 1 FROM public.homework h
              WHERE h.id::text = (storage.foldername(name))[2]
                AND public.is_my_child_group(h.group_id)
            )
          )
          -- Работа, сданная именно СВОИМ ребёнком.
          OR (
            (storage.foldername(name))[3] = 'submissions'
            AND public.is_my_child(((storage.foldername(name))[4])::uuid)
          )
        )
      );
  END IF;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('161')
ON CONFLICT DO NOTHING;

COMMIT;
