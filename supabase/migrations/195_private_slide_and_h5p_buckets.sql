-- 195 — закрываем два публичных бакета.
--
-- ЗАЧЕМ. slide-images и h5p-content были помечены public: их содержимое
-- отдавалось по адресу /storage/v1/object/public/<бакет>/<путь> вообще без
-- входа. Разделение по школам этого не закрывало — достаточно знать путь.
--
-- ПОЧЕМУ ЭТО БЕЗОПАСНО ИМЕННО СЕЙЧАС (проверено фактом до правки):
--   • slide-images — 22 объекта, и НИ ОДНА строка базы на него не ссылается.
--     Картинки этапов лежат в приватном lesson-stage-images, а в
--     lesson_stages.image_url и в slides (JSON) нет ни одного упоминания
--     slide-images: искали по всем текстовым и json-колонкам схемы public.
--     Показывать из этого бакета нечего, ломать нечего.
--   • h5p-content — 6 объектов одного задания, и читает их единственный
--     потребитель: прокси apps/h5p/app/api/h5p-static/[contentId]/[...path].
--     Он ходит на сервере, и в этом же заходе переведён на служебный ключ,
--     для которого ни признак public, ни RLS не имеют значения.
--
-- Политика чтения h5p-content раньше была выдана роли public — при приватном
-- бакете этого мало: анонимный ключ тоже входит в public, и файл читался бы
-- через /object/. Сужаем до вошедших пользователей, как у slide-images.

BEGIN;

UPDATE storage.buckets SET public = false WHERE id IN ('slide-images', 'h5p-content');

DROP POLICY IF EXISTS "public reads h5p-content" ON storage.objects;

CREATE POLICY "authenticated reads h5p-content"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'h5p-content');

-- ── самопроверки ──────────────────────────────────────────────────────────
DO $$
DECLARE
  still_public int;
  read_pol     int;
BEGIN
  SELECT count(*) INTO still_public FROM storage.buckets WHERE public IS TRUE;
  IF still_public > 0 THEN
    RAISE EXCEPTION 'остались публичные бакеты: %', still_public;
  END IF;

  SELECT count(*) INTO read_pol FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND cmd = 'SELECT' AND qual LIKE '%h5p-content%';
  IF read_pol <> 1 THEN
    RAISE EXCEPTION 'политик чтения h5p-content должно быть ровно одна, а их %', read_pol;
  END IF;

  RAISE NOTICE 'публичных бакетов не осталось; чтение h5p-content — только для вошедших';
END $$;

COMMIT;
