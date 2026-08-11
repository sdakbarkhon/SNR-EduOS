-- =====================================================================
-- Migration 189 — старые правила «своей папки» учатся видеть школьный префикс.
--
-- ЧТО СЛУЧИЛОСЬ. Миграция 188 ввела соглашение: новые файлы кладутся в папку
-- с идентификатором школы, `<school_id>/<как было раньше>`. Ограничительная
-- политика поверх пятидесяти существующих закрыла чужие школы, и это
-- сработало. Но у сорока политик условие «моя папка» опирается на НОМЕР
-- СЕГМЕНТА пути: `(storage.foldername(name))[1] = мой id`, а у файлов
-- домашних заданий — вплоть до [4].
--
-- Школьный префикс сдвигает все сегменты на один. Замер сразу после 188
-- поймал это на живом примере: ученик настоящей школы перестал видеть
-- СОБСТВЕННУЮ сдачу домашнего задания — было видно 1, стало 0. Это ровно тот
-- случай, который страшнее исходной дыры: дыра никого не задевала, а
-- невидимость своих файлов задевает сразу.
--
-- ПРАВКА. Вместо переписывания сорока условий с пересчётом индексов вводится
-- одна функция: `fn_storage_rel(name)` отрезает школьный префикс, если он
-- есть, и возвращает путь в прежнем виде. Каждое `storage.foldername(name)`
-- заменено на `storage.foldername(fn_storage_rel(name))` — номера сегментов
-- остаются теми же, что были, и для наследия, и для новых путей. Сами условия
-- (кто владелец, какая подпапка, чей ребёнок) не тронуты ни в одном месте:
-- политики пересозданы из ЖИВЫХ определений, снятых из pg_policies, а не
-- переписаны от руки.
--
-- Ограничительные политики из 188 остаются как есть: школу проверяют они,
-- владельца — эти сорок.
-- =====================================================================

-- ── 1. Путь без школьного префикса ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_storage_rel(p_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.schools s WHERE s.id::text = split_part(p_name, '/', 1))
      THEN substr(p_name, strpos(p_name, '/') + 1)
    ELSE p_name
  END;
$fn$;

COMMENT ON FUNCTION public.fn_storage_rel(text) IS
  'Путь в хранилище без школьного префикса. Нужна политикам, которые считают '
  'сегменты пути: после соглашения из миграции 188 все сегменты сдвинулись на '
  'один, и эта функция возвращает их на прежние места.';

-- ── 2. Политики, пересозданные из живых определений ─────────────────
DROP POLICY IF EXISTS "lesson-materials: teacher deletes own files" ON storage.objects;
CREATE POLICY "lesson-materials: teacher deletes own files" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'lesson-materials'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = ( SELECT (teachers.id)::text AS id
   FROM teachers
  WHERE (teachers.user_id = auth.uid())))));

DROP POLICY IF EXISTS "lesson-materials: teacher uploads own folder" ON storage.objects;
CREATE POLICY "lesson-materials: teacher uploads own folder" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'lesson-materials'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = ( SELECT (teachers.id)::text AS id
   FROM teachers
  WHERE (teachers.user_id = auth.uid())))));

DROP POLICY IF EXISTS "parent reads child homework files" ON storage.objects;
CREATE POLICY "parent reads child homework files" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'homework-files'::text) AND ((((storage.foldername(public.fn_storage_rel(name)))[3] = 'attachment'::text) AND (EXISTS ( SELECT 1
   FROM homework h
  WHERE (((h.id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[2]) AND is_my_child_group(h.group_id))))) OR (((storage.foldername(public.fn_storage_rel(name)))[3] = 'submissions'::text) AND is_my_child(((storage.foldername(public.fn_storage_rel(name)))[4])::uuid)))));

DROP POLICY IF EXISTS "read homework-tests bucket" ON storage.objects;
CREATE POLICY "read homework-tests bucket" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'homework-tests'::text) AND (((storage.foldername(public.fn_storage_rel(name)))[1] = (current_teacher_id())::text) OR (EXISTS ( SELECT 1
   FROM homework h
  WHERE (((h.id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[2]) AND is_my_group(h.group_id)))))));

DROP POLICY IF EXISTS "student deletes own avatar" ON storage.objects;
CREATE POLICY "student deletes own avatar" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_student_id())::text)));

DROP POLICY IF EXISTS "student deletes own project files" ON storage.objects;
CREATE POLICY "student deletes own project files" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'project-files'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_student_id())::text)));

DROP POLICY IF EXISTS "student deletes own stage attachments" ON storage.objects;
CREATE POLICY "student deletes own stage attachments" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'stage-attachments'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_student_id())::text)));

DROP POLICY IF EXISTS "student inserts own stage attachments" ON storage.objects;
CREATE POLICY "student inserts own stage attachments" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'stage-attachments'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_student_id())::text)));

DROP POLICY IF EXISTS "student manages own project files" ON storage.objects;
CREATE POLICY "student manages own project files" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'project-files'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_student_id())::text)));

DROP POLICY IF EXISTS "student reads homework attachment" ON storage.objects;
CREATE POLICY "student reads homework attachment" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'homework-files'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[3] = 'attachment'::text) AND (EXISTS ( SELECT 1
   FROM (homework h
     JOIN student_groups sg ON ((sg.group_id = h.group_id)))
  WHERE (((h.teacher_id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[1]) AND ((h.id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[2]) AND (sg.student_id = current_student_id()))))));

DROP POLICY IF EXISTS "student reads homework hint" ON storage.objects;
CREATE POLICY "student reads homework hint" ON storage.objects
  AS PERMISSIVE FOR SELECT TO public
  USING (((bucket_id = 'homework-files'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[3] = 'hint'::text) AND (EXISTS ( SELECT 1
   FROM (homework h
     JOIN student_groups sg ON ((sg.group_id = h.group_id)))
  WHERE (((h.teacher_id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[1]) AND ((h.id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[2]) AND (sg.student_id = current_student_id()))))));

DROP POLICY IF EXISTS "student reads own avatar" ON storage.objects;
CREATE POLICY "student reads own avatar" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_student_id())::text)));

DROP POLICY IF EXISTS "student reads own group materials" ON storage.objects;
CREATE POLICY "student reads own group materials" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'course-materials'::text) AND is_my_group(((storage.foldername(public.fn_storage_rel(name)))[1])::uuid)));

DROP POLICY IF EXISTS "student reads own project files" ON storage.objects;
CREATE POLICY "student reads own project files" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'project-files'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_student_id())::text)));

DROP POLICY IF EXISTS "student reads own stage attachments" ON storage.objects;
CREATE POLICY "student reads own stage attachments" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'stage-attachments'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_student_id())::text)));

DROP POLICY IF EXISTS "student reads own submission files" ON storage.objects;
CREATE POLICY "student reads own submission files" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'homework-submissions'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_student_id())::text)));

DROP POLICY IF EXISTS "student rw own homework submission files" ON storage.objects;
CREATE POLICY "student rw own homework submission files" ON storage.objects
  AS PERMISSIVE FOR ALL TO authenticated
  USING (((bucket_id = 'homework-files'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[3] = 'submissions'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[4] = (current_student_id())::text) AND (EXISTS ( SELECT 1
   FROM (homework h
     JOIN student_groups sg ON ((sg.group_id = h.group_id)))
  WHERE (((h.teacher_id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[1]) AND ((h.id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[2]) AND (sg.student_id = current_student_id()))))))
  WITH CHECK (((bucket_id = 'homework-files'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[3] = 'submissions'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[4] = (current_student_id())::text) AND (EXISTS ( SELECT 1
   FROM (homework h
     JOIN student_groups sg ON ((sg.group_id = h.group_id)))
  WHERE (((h.teacher_id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[1]) AND ((h.id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[2]) AND (sg.student_id = current_student_id()))))));

DROP POLICY IF EXISTS "student updates own avatar" ON storage.objects;
CREATE POLICY "student updates own avatar" ON storage.objects
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_student_id())::text)));

DROP POLICY IF EXISTS "student updates own submission files" ON storage.objects;
CREATE POLICY "student updates own submission files" ON storage.objects
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'homework-submissions'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_student_id())::text)));

DROP POLICY IF EXISTS "student uploads own avatar" ON storage.objects;
CREATE POLICY "student uploads own avatar" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_student_id())::text)));

DROP POLICY IF EXISTS "student uploads own submission files" ON storage.objects;
CREATE POLICY "student uploads own submission files" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'homework-submissions'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_student_id())::text)));

DROP POLICY IF EXISTS "teacher deletes from books bucket" ON storage.objects;
CREATE POLICY "teacher deletes from books bucket" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'books'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_teacher_id())::text)));

DROP POLICY IF EXISTS "teacher deletes from materials bucket" ON storage.objects;
CREATE POLICY "teacher deletes from materials bucket" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'materials'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_teacher_id())::text)));

DROP POLICY IF EXISTS "teacher deletes homework-tests" ON storage.objects;
CREATE POLICY "teacher deletes homework-tests" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'homework-tests'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_teacher_id())::text)));

DROP POLICY IF EXISTS "teacher deletes own avatar" ON storage.objects;
CREATE POLICY "teacher deletes own avatar" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = 'teachers'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[2] = (( SELECT teachers.id
   FROM teachers
  WHERE (teachers.user_id = auth.uid())))::text)));

DROP POLICY IF EXISTS "teacher deletes own curriculum-plans files" ON storage.objects;
CREATE POLICY "teacher deletes own curriculum-plans files" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'curriculum-plans'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_teacher_id())::text)));

DROP POLICY IF EXISTS "teacher manages own lesson-videos" ON storage.objects;
CREATE POLICY "teacher manages own lesson-videos" ON storage.objects
  AS PERMISSIVE FOR ALL TO authenticated
  USING (((bucket_id = 'lesson-videos'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_teacher_id())::text)))
  WITH CHECK (((bucket_id = 'lesson-videos'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_teacher_id())::text)));

DROP POLICY IF EXISTS "teacher reads group project files" ON storage.objects;
CREATE POLICY "teacher reads group project files" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'project-files'::text) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE (((p.id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[2]) AND is_my_teacher_group(p.group_id))))));

DROP POLICY IF EXISTS "teacher reads group stage attachments" ON storage.objects;
CREATE POLICY "teacher reads group stage attachments" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'stage-attachments'::text) AND (EXISTS ( SELECT 1
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (((ls.id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[2]) AND is_my_teacher_group(l.group_id))))));

DROP POLICY IF EXISTS "teacher reads own avatar" ON storage.objects;
CREATE POLICY "teacher reads own avatar" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = 'teachers'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[2] = (( SELECT teachers.id
   FROM teachers
  WHERE (teachers.user_id = auth.uid())))::text)));

DROP POLICY IF EXISTS "teacher rw homework-files" ON storage.objects;
CREATE POLICY "teacher rw homework-files" ON storage.objects
  AS PERMISSIVE FOR ALL TO authenticated
  USING (((bucket_id = 'homework-files'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_teacher_id())::text)))
  WITH CHECK (((bucket_id = 'homework-files'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_teacher_id())::text)));

DROP POLICY IF EXISTS "teacher updates homework-tests" ON storage.objects;
CREATE POLICY "teacher updates homework-tests" ON storage.objects
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'homework-tests'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_teacher_id())::text)));

DROP POLICY IF EXISTS "teacher updates own avatar" ON storage.objects;
CREATE POLICY "teacher updates own avatar" ON storage.objects
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = 'teachers'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[2] = (( SELECT teachers.id
   FROM teachers
  WHERE (teachers.user_id = auth.uid())))::text)));

DROP POLICY IF EXISTS "teacher uploads lesson-videos" ON storage.objects;
CREATE POLICY "teacher uploads lesson-videos" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'lesson-videos'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_teacher_id())::text)));

DROP POLICY IF EXISTS "teacher uploads own avatar" ON storage.objects;
CREATE POLICY "teacher uploads own avatar" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = 'teachers'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[2] = (( SELECT teachers.id
   FROM teachers
  WHERE (teachers.user_id = auth.uid())))::text)));

DROP POLICY IF EXISTS "teacher uploads to books bucket" ON storage.objects;
CREATE POLICY "teacher uploads to books bucket" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'books'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_teacher_id())::text)));

DROP POLICY IF EXISTS "teacher uploads to curriculum-plans bucket" ON storage.objects;
CREATE POLICY "teacher uploads to curriculum-plans bucket" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'curriculum-plans'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_teacher_id())::text)));

DROP POLICY IF EXISTS "teacher uploads to materials bucket" ON storage.objects;
CREATE POLICY "teacher uploads to materials bucket" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'materials'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_teacher_id())::text)));

DROP POLICY IF EXISTS "teacher writes homework-tests" ON storage.objects;
CREATE POLICY "teacher writes homework-tests" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'homework-tests'::text) AND ((storage.foldername(public.fn_storage_rel(name)))[1] = (current_teacher_id())::text)));

-- ── 3. Самопроверка ─────────────────────────────────────────────────
DO $$
DECLARE
  v_school uuid;
  v_rel    text;
  v_count  integer;
BEGIN
  SELECT id INTO v_school FROM public.schools WHERE NOT is_demo LIMIT 1;

  -- Префикс снимается…
  SELECT public.fn_storage_rel(v_school::text || '/abc/def.pdf') INTO v_rel;
  IF v_rel <> 'abc/def.pdf' THEN
    RAISE EXCEPTION 'fn_storage_rel не снял школьный префикс: %', v_rel;
  END IF;

  -- …а путь без префикса остаётся нетронутым.
  SELECT public.fn_storage_rel('abc/def.pdf') INTO v_rel;
  IF v_rel <> 'abc/def.pdf' THEN
    RAISE EXCEPTION 'fn_storage_rel испортил путь наследия: %', v_rel;
  END IF;

  SELECT public.fn_storage_rel('flat.png') INTO v_rel;
  IF v_rel <> 'flat.png' THEN
    RAISE EXCEPTION 'fn_storage_rel испортил плоский путь: %', v_rel;
  END IF;

  -- Ограничительные политики из 188 на месте.
  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects' AND permissive = 'RESTRICTIVE';
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'ограничительных политик % вместо 4 — 188 повреждена', v_count;
  END IF;

  -- Ни одна политика не осталась с прямым foldername(name).
  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND (coalesce(qual,'') LIKE '%foldername(name)%' OR coalesce(with_check,'') LIKE '%foldername(name)%');
  IF v_count <> 0 THEN
    RAISE EXCEPTION '% политик всё ещё считают сегменты без снятия префикса', v_count;
  END IF;

  RAISE NOTICE 'Миграция 189: сегменты пути считаются от пути без школьного префикса';
END $$;
