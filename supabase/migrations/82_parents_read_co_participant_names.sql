-- Итерация 6, Промт 9 (доп.): два бага, обнаруженные живой проверкой
-- Сценария B3, оба блокировали родительский групповой чат целиком.
--
-- ---------------------------------------------------------------------
-- Баг 1 — родитель не видел имена других родителей-участников треда.
-- ---------------------------------------------------------------------
-- parent_ismailov открывал "3-А класс — Родители" и в шапке видел только
-- своё собственное имя (Nargiza Ismailova), хотя в треде есть ещё куратор
-- и второй родитель (Farida Nazarova). Учительские/ученические имена в
-- том же списке участников резолвились нормально (teachers/students
-- читаемы шире), а вот таблица parents имеет только одну SELECT-политику:
--   "parent reads own record": user_id = auth.uid() (+ admin/superadmin)
-- — родитель физически не может прочитать чужую строку parents, поэтому
-- getMyThreadSummaries() (packages/core/src/queries/chat.ts) получал
-- пустой full_name для всех НЕ-своих родителей-участников.
--
-- ---------------------------------------------------------------------
-- Баг 2 — родитель вообще не мог отправить сообщение (более серьёзный).
-- ---------------------------------------------------------------------
-- Попытка отправить "Тестовое от родителя" падала с 400:
--   "null value in column "school_id" of relation "chat_messages"
--    violates not-null constraint"
-- chat_messages.school_id имеет DEFAULT current_school_id(), но эта
-- функция (созданная в миграции 71, до появления роли parent) проверяет
-- только students/teachers/admins:
--   SELECT school_id FROM students WHERE user_id = auth.uid()
--   UNION ALL SELECT school_id FROM teachers ...
--   UNION ALL SELECT school_id FROM admins ...
-- — для родителя ничего не находит, возвращает NULL. Это фундаментальная,
-- ранее не обнаруженная дыра: ЛЮБАЯ вставка от имени родителя в таблицу
-- с school_id DEFAULT current_school_id() падает точно так же (сейчас
-- единственный такой путь для родителя в UI — это отправка сообщений и
-- отметка "прочитано" в чате, но сам баг шире, чем чат).
--
-- Фикс — добавить parents в UNION ALL, чисто аддитивно (не меняет
-- поведение для student/teacher/admin, у любого auth.uid() может
-- совпасть максимум с одной из четырёх таблиц).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parents' AND policyname = 'parent reads co-participant parent names'
  ) THEN
    CREATE POLICY "parent reads co-participant parent names" ON public.parents
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.chat_participants cp1
          JOIN public.chat_participants cp2 ON cp1.thread_id = cp2.thread_id
          WHERE cp1.user_id = parents.user_id
            AND cp2.user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT school_id FROM public.students WHERE user_id = auth.uid()
  UNION ALL
  SELECT school_id FROM public.teachers WHERE user_id = auth.uid()
  UNION ALL
  SELECT school_id FROM public.admins WHERE user_id = auth.uid()
  UNION ALL
  SELECT school_id FROM public.parents WHERE user_id = auth.uid()
  LIMIT 1
$function$;

COMMIT;
