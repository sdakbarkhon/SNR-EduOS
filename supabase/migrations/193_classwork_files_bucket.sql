-- =====================================================================
-- Migration 193 — бакет classwork-files.
--
-- ЧТО БЫЛО. Код сдачи классной работы (packages/core, submitClasswork)
-- пишет файл в бакет `classwork-files`, а такого бакета в хранилище НЕТ:
-- в storage.buckets 16 записей, этой среди них нет. Сдача с файлом упала бы
-- с «Bucket not found». Никто не видел, потому что classwork_submissions
-- пуста — функцией ни разу не пользовались.
--
-- ЧТО ДЕЛАЕМ. Заводим приватный бакет и четыре политики. Права зеркалят те,
-- что УЖЕ стоят на таблицах classwork / classwork_submissions, чтобы файл и
-- строка о нём не расходились в доступе:
--   • ученик пишет и читает СВОИ сдачи (student_id в пути), и только если
--     классная работа из урока ЕГО группы;
--   • учитель читает сдачи по своим классным работам и полностью владеет
--     своими вложениями к заданию;
--   • родитель читает сдачи своего ребёнка (у таблицы такая политика есть,
--     без неё файл был бы виден в списке, но не открывался).
--
-- ПУТЬ. Соглашение миграции 188 обязательно: первый сегмент — школа.
-- Дальше — то, что уже строит код:
--   <school>/submissions/<classwork_id>/<student_id>/<файл>   — сдача ученика
--   <school>/<teacher_id>/<classwork_id>/attachment/<файл>    — вложение учителя
-- Поэтому во всех предикатах путь берётся через fn_storage_rel(name)
-- (миграция 189) — она срезает префикс школы, и нумерация сегментов ниже
-- считается уже БЕЗ него. Ограничительные политики из 188 продолжают
-- действовать поверх и держат изоляцию по школе.
--
-- ДЕМО-ШКОЛА НЕ ЗАТРАГИВАЕТСЯ: ни одного объекта не создаётся и не
-- переносится, меняются только правила доступа к новому бакету.
-- =====================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('classwork-files', 'classwork-files', false)
ON CONFLICT (id) DO NOTHING;

-- ── 1. Ученик: свои сдачи ───────────────────────────────────────────
-- Читает и пишет только файлы, лежащие в его папке внутри своей классной
-- работы. Проверка «работа из урока моей группы» — та же, что в политике
-- вставки на classwork_submissions, слово в слово.
DROP POLICY IF EXISTS "student rw own classwork submission files" ON storage.objects;
CREATE POLICY "student rw own classwork submission files" ON storage.objects
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    bucket_id = 'classwork-files'
    AND (storage.foldername(public.fn_storage_rel(name)))[1] = 'submissions'
    AND (storage.foldername(public.fn_storage_rel(name)))[3] = (public.current_student_id())::text
    AND EXISTS (
      SELECT 1
        FROM public.classwork c
        JOIN public.lessons l ON l.id = c.lesson_id
       WHERE (c.id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[2]
         AND public.is_my_group(l.group_id)
    )
  )
  WITH CHECK (
    bucket_id = 'classwork-files'
    AND (storage.foldername(public.fn_storage_rel(name)))[1] = 'submissions'
    AND (storage.foldername(public.fn_storage_rel(name)))[3] = (public.current_student_id())::text
    AND EXISTS (
      SELECT 1
        FROM public.classwork c
        JOIN public.lessons l ON l.id = c.lesson_id
       WHERE (c.id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[2]
         AND public.is_my_group(l.group_id)
    )
  );

-- ── 2. Ученик: вложение учителя к заданию ───────────────────────────
-- Только чтение и только для работ своей группы. Путь вложения начинается с
-- идентификатора учителя, поэтому ученику нужен отдельный предикат.
DROP POLICY IF EXISTS "student reads classwork attachment" ON storage.objects;
CREATE POLICY "student reads classwork attachment" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    bucket_id = 'classwork-files'
    AND (storage.foldername(public.fn_storage_rel(name)))[3] = 'attachment'
    AND EXISTS (
      SELECT 1
        FROM public.classwork c
        JOIN public.lessons l ON l.id = c.lesson_id
       WHERE (c.id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[2]
         AND public.is_my_group(l.group_id)
    )
  );

-- ── 3. Учитель ──────────────────────────────────────────────────────
-- Своя папка вложений (первый сегмент — его идентификатор) — полностью;
-- сдачи учеников по своим классным работам — на чтение.
DROP POLICY IF EXISTS "teacher rw own classwork files" ON storage.objects;
CREATE POLICY "teacher rw own classwork files" ON storage.objects
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    bucket_id = 'classwork-files'
    AND (storage.foldername(public.fn_storage_rel(name)))[1] = (public.current_teacher_id())::text
  )
  WITH CHECK (
    bucket_id = 'classwork-files'
    AND (storage.foldername(public.fn_storage_rel(name)))[1] = (public.current_teacher_id())::text
  );

DROP POLICY IF EXISTS "teacher reads classwork submission files" ON storage.objects;
CREATE POLICY "teacher reads classwork submission files" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    bucket_id = 'classwork-files'
    AND (storage.foldername(public.fn_storage_rel(name)))[1] = 'submissions'
    AND EXISTS (
      SELECT 1
        FROM public.classwork c
        JOIN public.lessons l ON l.id = c.lesson_id
       WHERE (c.id)::text = (storage.foldername(public.fn_storage_rel(objects.name)))[2]
         AND public.is_my_teacher_group(l.group_id)
    )
  );

-- ── 4. Родитель ─────────────────────────────────────────────────────
-- Читает файл сдачи своего ребёнка. Без этой политики родитель видел бы в
-- приложении имя файла (строка таблицы ему открыта), но не смог бы открыть
-- сам файл — худший вид «работает наполовину».
DROP POLICY IF EXISTS "parent reads child classwork submission files" ON storage.objects;
CREATE POLICY "parent reads child classwork submission files" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    bucket_id = 'classwork-files'
    AND (storage.foldername(public.fn_storage_rel(name)))[1] = 'submissions'
    AND public.is_my_child(((storage.foldername(public.fn_storage_rel(name)))[3])::uuid)
  );

-- ── 5. Самопроверка ─────────────────────────────────────────────────
DO $$
DECLARE
  v_cnt integer;
BEGIN
  SELECT count(*) INTO v_cnt FROM storage.buckets WHERE id = 'classwork-files' AND NOT public;
  IF v_cnt <> 1 THEN RAISE EXCEPTION '193: приватный бакет classwork-files не создан'; END IF;

  SELECT count(*) INTO v_cnt FROM pg_policies
   WHERE schemaname = 'storage'
     AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%classwork-files%';
  IF v_cnt <> 5 THEN RAISE EXCEPTION '193: политик на classwork-files создано % из 5', v_cnt; END IF;

  -- Путь обязан проверяться через fn_storage_rel: иначе префикс школы сдвинет
  -- нумерацию сегментов и любая проверка владельца станет ложной.
  SELECT count(*) INTO v_cnt FROM pg_policies
   WHERE schemaname = 'storage'
     AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%classwork-files%'
     AND (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%fn_storage_rel%';
  IF v_cnt <> 0 THEN RAISE EXCEPTION '193: % политик читают путь без fn_storage_rel', v_cnt; END IF;
END $$;
