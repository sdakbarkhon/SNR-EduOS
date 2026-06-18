-- ============================================================
-- HOSTED DB CLEANUP — шаг 2
-- Запускать в Supabase Dashboard › SQL Editor
-- Проект: qaljcmkkajqyawccxetq
-- ============================================================

-- 1. Посмотреть что сейчас есть
SELECT id, name, subject, teacher_id FROM public.groups ORDER BY name;

-- ============================================================
-- 2. Удалить лишние группы (Программирование 7А и 7Б)
-- CASCADE удалит связанные lessons, homework, student_groups
-- ============================================================
DELETE FROM public.groups
WHERE id IN (
  '94c84f73-22ba-4682-8e88-5743dd4bd609',
  'cf0ca5a5-aab7-496c-8c3b-957b4f1fe3fc'
);

-- ============================================================
-- 3. Найти и удалить дубликат Информатика 7А
-- Оставить ту, у которой teacher_id = cccccccc (Ivan)
-- ============================================================
DELETE FROM public.groups
WHERE name ILIKE '%информатика%7а%'
  AND id NOT IN (
    SELECT id FROM public.groups
    WHERE name ILIKE '%информатика%7а%'
      AND teacher_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    LIMIT 1
  );

-- ============================================================
-- 4. На всякий случай: подчистить уроки осиротевших групп
-- (CASCADE должен был сделать это, но страховка)
-- ============================================================
DELETE FROM public.lessons
WHERE group_id NOT IN (SELECT id FROM public.groups);

-- ============================================================
-- 5. Применить migration 25 вручную
-- (если db push ещё не был выполнен)
-- ============================================================
GRANT INSERT, UPDATE, DELETE ON public.lessons TO authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'lessons' AND cmd IN ('INSERT', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.lessons', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "teachers_insert_lessons"
  ON public.lessons FOR INSERT TO authenticated
  WITH CHECK (public.is_my_teacher_group(group_id));

CREATE POLICY "teachers_delete_lessons"
  ON public.lessons FOR DELETE TO authenticated
  USING (public.is_my_teacher_group(group_id));

-- ============================================================
-- 6. Проверка — должно быть РОВНО 4 группы
-- ============================================================
SELECT id, name, subject, teacher_id FROM public.groups ORDER BY name;

-- Проверка политик
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'lessons' ORDER BY cmd;
