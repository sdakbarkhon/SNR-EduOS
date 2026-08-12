-- =====================================================================
-- Migration 190 — закрытие остатка Z.5: три политики без проверки школы,
-- многопредметность кафедры, вписанный номер демо-школы в правиле уроков,
-- индексы по school_id.
--
-- Всё замерено на живой базе 12.08.2026, не по документации.
-- =====================================================================

-- ── 1. ВСТАВКА В h5p_content — БЕЗ ПРОВЕРКИ ШКОЛЫ ────────────────────
--
-- Было (замер pg_policies):
--   WITH CHECK (is_super_admin() OR EXISTS (SELECT 1 FROM teachers
--               WHERE teachers.user_id = auth.uid()))
-- То есть ЛЮБОЙ учитель ЛЮБОЙ школы мог вставить строку с любым school_id,
-- в том числе чужим. Колонка school_id при этом nullable — пустая школа
-- проходила тоже, а потом такая строка не видна никому: политика чтения
-- сравнивает school_id с current_school_id().
--
-- Стало: школа строки обязана совпадать со школой автора. NULL отсекается
-- тем же условием (NULL = x даёт NULL, то есть «не прошло»), поэтому
-- отдельная проверка IS NOT NULL не нужна и колонку не трогаем: строк с
-- пустой школой в таблице ноль (проверено), а NOT NULL здесь — отдельное
-- решение про схему, которое к дыре доступа отношения не имеет.
DROP POLICY IF EXISTS "h5p_content insert by teacher" ON public.h5p_content;
CREATE POLICY "h5p_content insert by teacher"
  ON public.h5p_content FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR (
      school_id = public.current_school_id()
      AND EXISTS (SELECT 1 FROM public.teachers t WHERE t.user_id = auth.uid())
    )
  );

-- ── 2. ВСТАВКА В parent_insights — РАЗРЕШЕНА КОМУ УГОДНО ─────────────
--
-- Было: политика "system_can_insert_insights" FOR INSERT WITH CHECK (true)
-- на роль public. Любой вошедший — включая ученика и родителя чужой школы —
-- мог положить в таблицу произвольный «разбор помощника» на произвольного
-- ребёнка.
--
-- Стало: политики вставки нет вовсе. Это НЕ ломает генерацию: разбор пишет
-- служебный ключ (lib/ai/parent-insight.ts → createAdminClient), а у
-- service_role стоит BYPASSRLS. Ровно этот идиом и был описан в шапке
-- миграции 128 — «INSERT только через service_role», но политика
-- WITH CHECK (true) сводила замысел на нет.
DROP POLICY IF EXISTS "system_can_insert_insights" ON public.parent_insights;

-- ── 3. ЧТЕНИЕ schools — ВИДЕН ВЕСЬ СПИСОК ШКОЛ ──────────────────────
--
-- Было: "authenticated reads schools" USING (true) — любой вошедший читал
-- id, название, код, признак демо и дату заморозки ВСЕХ школ.
--
-- Стало: своя школа либо суперадмин. Проверено, кому список нужен на самом
-- деле:
--   • экран выбора школы при входе (два логина в разных школах) —
--     apps/web/app/actions/auth.ts:83, ходит СЛУЖЕБНЫМ клиентом
--     (createAdminClient), под эту политику не попадает вовсе;
--   • три страницы суперадминки (/superadmin/schools, /dashboard, /admins) —
--     ходят ПОЛЬЗОВАТЕЛЬСКИМ клиентом и читают чужие школы: их держит
--     ветка is_super_admin();
--   • /admin/profile, три layout'а (ученик/учитель/родитель) через
--     getSchoolFrozenDate, packages/core (autostart_enabled урока) —
--     читают СВОЮ школу, проходят по первой ветке;
--   • анонимному клиенту политики не было и нет: обе выданы роли
--     authenticated. Страницы входа в базу вообще не ходят.
-- Сама миграция 71 объясняла широкое чтение нуждой показать админу имя
-- СВОЕЙ школы — теперь предикат говорит ровно это.
DROP POLICY IF EXISTS "authenticated reads schools" ON public.schools;
CREATE POLICY "authenticated reads own school"
  ON public.schools FOR SELECT TO authenticated
  USING (id = public.current_school_id() OR public.is_super_admin());

-- ── 4. МНОГОПРЕДМЕТНОСТЬ: БИБЛИОТЕКА КАФЕДРЫ ────────────────────────
--
-- Было: обе политики кафедры сравнивали subject_slug материала со СКАЛЯРОМ
-- teachers.subject_slug — «предметом карточки». Карточка заполняется при
-- ПЕРВОМ назначении и больше не меняется (apps/web/lib/admin-api.ts,
-- ensureSubjectSlug), поэтому учитель двух предметов видел кафедру только
-- первого и во второй не мог ничего положить. Уроки при этом он видит по
-- обоим предметам — там правило смотрит на назначения (is_subject_owner).
--
-- Стало: одна функция вместо скаляра. Множество «моих» слагов =
--   слаг моей карточки
--   ∪ слаги карточек учителей МОЕЙ ШКОЛЫ, назначенных на те же предметы
--     справочника (subjects.catalog_id), что и я.
--
-- ПОЧЕМУ ЧЕРЕЗ ЧУЖИЕ КАРТОЧКИ, А НЕ НАПРЯМУЮ. Слага у назначения нет: в
-- `subjects` его не существует, в справочнике `school_subjects` — тоже.
-- Соответствие «название → слаг» живёт ТОЛЬКО в коде
-- (packages/core/src/config/subjects.ts, getSubjectKeyByLabel), и заводить
-- его вторую копию в SQL нельзя — именно на таких копиях этот проект уже
-- расходился. Поэтому слаг предмета берётся оттуда, где он в базе всё-таки
-- есть: с карточек учителей, назначенных на тот же предмет справочника.
--
-- ЧЕГО ЭТО НЕ ЧИНИТ (осознанно): если предмета нет в справочнике кода
-- («Черчение»), слаг не появится ни у кого, и кафедры у такого предмета не
-- будет. Это отдельная задача — привязать материалы кафедры к
-- `catalog_id` вместо слага; здесь она не решается.
--
-- КУРАТОР НЕ ЗАДЕТ: is_curator_teacher() по-прежнему смотрит на пустой
-- subject_slug карточки и на признак демо-школы (миграция 187). Функция
-- ниже пустые слаги просто не возвращает.
-- ДЕМО-ПУЛ НЕ ЗАДЕТ: claim_demo_slot ищет по teachers.subject_slug, эта
-- колонка и её заполнение не меняются.
CREATE OR REPLACE FUNCTION public.fn_my_subject_slugs()
RETURNS TABLE(subject_slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- 1. слаг собственной карточки
  SELECT t.subject_slug
    FROM public.teachers t
   WHERE t.id = public.current_teacher_id()
     AND t.subject_slug IS NOT NULL
  UNION
  -- 2. слаги карточек коллег по тем же предметам справочника
  SELECT other.subject_slug
    FROM public.subjects mine
    JOIN public.subjects theirs
      ON theirs.catalog_id = mine.catalog_id
     AND theirs.school_id = mine.school_id
    JOIN public.teachers other
      ON other.id = theirs.teacher_id
   WHERE mine.teacher_id = public.current_teacher_id()
     AND mine.catalog_id IS NOT NULL
     AND mine.is_active
     AND NOT mine.is_stub
     AND other.subject_slug IS NOT NULL;
$$;

COMMENT ON FUNCTION public.fn_my_subject_slugs() IS
  'Слаги всех предметов текущего учителя: слаг его карточки плюс слаги '
  'карточек коллег по тем же предметам справочника. Единственное место, '
  'где считается «мой предмет» для библиотеки кафедры.';

DROP POLICY IF EXISTS "teacher reads own subject library materials" ON public.teacher_library_materials;
CREATE POLICY "teacher reads own subject library materials"
  ON public.teacher_library_materials FOR SELECT
  USING (
    (
      school_id = public.current_school_id()
      AND subject_slug IN (SELECT s FROM public.fn_my_subject_slugs() AS s)
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "teacher inserts own library materials" ON public.teacher_library_materials;
CREATE POLICY "teacher inserts own library materials"
  ON public.teacher_library_materials FOR INSERT
  WITH CHECK (
    (
      uploaded_by = public.current_teacher_id()
      AND subject_slug IS NOT NULL
      AND subject_slug IN (SELECT s FROM public.fn_my_subject_slugs() AS s)
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- ── 5. ВПИСАННЫЙ НОМЕР ДЕМО-ШКОЛЫ В ПРАВИЛЕ УРОКОВ ──────────────────
--
-- Правило 1/2/3+ (ученик ведёт урок сам только в первые два дня демо)
-- проверяло школу вписанным идентификатором:
--     (school_id <> 'a0a0a0a0-…-0001'::uuid OR fn_lesson_day_index(id) <= 2)
-- Признак демо в проекте один — schools.is_demo, и правило обязано опираться
-- на него: иначе вторая демо-школа (или переезд идентификатора) молча
-- отключит ограничение.
--
-- Само правило НЕ меняется: порог `<= 2` и функция fn_lesson_day_index
-- остаются прежними, меняется только способ узнать, что школа демо.
-- Мест оказалось ДВА, а не одно: то же условие продублировано в политике
-- листания слайдов. Оставить одно из них означало бы половинчатую правку.
DROP POLICY IF EXISTS "student ends own in-progress lesson" ON public.lessons;
CREATE POLICY "student ends own in-progress lesson"
  ON public.lessons FOR UPDATE
  USING (
    (
      public.is_my_group(group_id)
      AND status = 'in_progress'
      AND school_id = public.current_school_id()
      AND NOT EXISTS (
        SELECT 1 FROM public.schools s WHERE s.id = lessons.school_id AND s.autostart_enabled
      )
      AND (
        NOT EXISTS (SELECT 1 FROM public.schools s WHERE s.id = lessons.school_id AND s.is_demo)
        OR public.fn_lesson_day_index(id) <= 2
      )
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      public.is_my_group(group_id)
      AND status = 'completed'
      AND school_id = public.current_school_id()
      AND NOT EXISTS (
        SELECT 1 FROM public.schools s WHERE s.id = lessons.school_id AND s.autostart_enabled
      )
      AND (
        NOT EXISTS (SELECT 1 FROM public.schools s WHERE s.id = lessons.school_id AND s.is_demo)
        OR public.fn_lesson_day_index(id) <= 2
      )
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "student navigates active lesson slide" ON public.lesson_stages;
CREATE POLICY "student navigates active lesson slide"
  ON public.lesson_stages FOR UPDATE
  USING (
    (
      school_id = public.current_school_id()
      AND EXISTS (
        SELECT 1
          FROM public.lessons l
         WHERE l.id = lesson_stages.lesson_id
           AND l.status = 'in_progress'
           AND l.active_stage_id = lesson_stages.id
           AND public.is_my_group(l.group_id)
           AND (
             NOT EXISTS (SELECT 1 FROM public.schools s WHERE s.id = l.school_id AND s.is_demo)
             OR public.fn_lesson_day_index(l.id) <= 2
           )
      )
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      school_id = public.current_school_id()
      AND EXISTS (
        SELECT 1
          FROM public.lessons l
         WHERE l.id = lesson_stages.lesson_id
           AND l.status = 'in_progress'
           AND l.active_stage_id = lesson_stages.id
           AND public.is_my_group(l.group_id)
           AND (
             NOT EXISTS (SELECT 1 FROM public.schools s WHERE s.id = l.school_id AND s.is_demo)
             OR public.fn_lesson_day_index(l.id) <= 2
           )
      )
    )
    OR public.is_super_admin()
  );

-- ── 6. ИНДЕКСЫ ПО school_id ─────────────────────────────────────────
--
-- Двенадцать таблиц несут school_id, но ни одного индекса, где он идёт
-- первым столбцом (замер по pg_index). На каждой из них RLS сравнивает
-- school_id с current_school_id() — то есть фильтр по школе стоит в КАЖДОМ
-- запросе, и на seq scan он ложится целиком.
--
-- CONCURRENTLY не используем: apply-migration.mjs оборачивает файл в общую
-- транзакцию, а CREATE INDEX CONCURRENTLY внутри транзакции запрещён.
-- Таблицы маленькие (самая большая — chat_messages, 555 строк), блокировка
-- на время построения незаметна.
CREATE INDEX IF NOT EXISTS idx_ai_homework_review_queue_school ON public.ai_homework_review_queue(school_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_school ON public.chat_messages(school_id);
CREATE INDEX IF NOT EXISTS idx_demo_leases_school ON public.demo_leases(school_id);
CREATE INDEX IF NOT EXISTS idx_group_teachers_school ON public.group_teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_homework_subtask_submissions_school ON public.homework_subtask_submissions(school_id);
CREATE INDEX IF NOT EXISTS idx_homework_subtasks_school ON public.homework_subtasks(school_id);
CREATE INDEX IF NOT EXISTS idx_lesson_stages_embedding_queue_school ON public.lesson_stages_embedding_queue(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_insights_school ON public.parent_insights(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_invites_school ON public.parent_invites(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_school ON public.parent_students(school_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_projects_school ON public.sandbox_projects(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_library_material_groups_school ON public.teacher_library_material_groups(school_id);

-- ── 7. САМОПРОВЕРКА ─────────────────────────────────────────────────
-- Падает вся миграция, если что-то из перечисленного не сошлось.
DO $$
DECLARE
  v_cnt integer;
BEGIN
  -- вставка в h5p_content знает про школу
  SELECT count(*) INTO v_cnt FROM pg_policies
   WHERE schemaname='public' AND tablename='h5p_content' AND cmd='INSERT'
     AND with_check LIKE '%current_school_id%';
  IF v_cnt <> 1 THEN RAISE EXCEPTION '190: h5p_content INSERT без проверки школы'; END IF;

  -- в parent_insights нет ни одной политики вставки
  SELECT count(*) INTO v_cnt FROM pg_policies
   WHERE schemaname='public' AND tablename='parent_insights' AND cmd='INSERT';
  IF v_cnt <> 0 THEN RAISE EXCEPTION '190: в parent_insights осталась политика вставки'; END IF;

  -- чтение школ сужено
  SELECT count(*) INTO v_cnt FROM pg_policies
   WHERE schemaname='public' AND tablename='schools' AND cmd='SELECT' AND qual = 'true';
  IF v_cnt <> 0 THEN RAISE EXCEPTION '190: чтение schools осталось широким'; END IF;

  SELECT count(*) INTO v_cnt FROM pg_policies
   WHERE schemaname='public' AND tablename='schools' AND cmd='SELECT'
     AND qual LIKE '%is_super_admin%';
  IF v_cnt <> 1 THEN RAISE EXCEPTION '190: суперадмин потерял чтение школ'; END IF;

  -- кафедра смотрит на множество предметов
  SELECT count(*) INTO v_cnt FROM pg_policies
   WHERE schemaname='public' AND tablename='teacher_library_materials'
     AND (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%fn_my_subject_slugs%';
  IF v_cnt <> 2 THEN RAISE EXCEPTION '190: политики кафедры не переведены на fn_my_subject_slugs'; END IF;

  -- вписанного номера демо-школы в политиках не осталось
  SELECT count(*) INTO v_cnt FROM pg_policies
   WHERE schemaname='public'
     AND (coalesce(qual,'') LIKE '%a0a0a0a0%' OR coalesce(with_check,'') LIKE '%a0a0a0a0%');
  IF v_cnt <> 0 THEN RAISE EXCEPTION '190: в политиках остался вписанный номер демо-школы'; END IF;

  -- индексы на месте
  SELECT count(*) INTO v_cnt FROM pg_indexes
   WHERE schemaname='public' AND indexname IN (
     'idx_ai_homework_review_queue_school','idx_chat_messages_school','idx_demo_leases_school',
     'idx_group_teachers_school','idx_homework_subtask_submissions_school','idx_homework_subtasks_school',
     'idx_lesson_stages_embedding_queue_school','idx_parent_insights_school','idx_parent_invites_school',
     'idx_parent_students_school','idx_sandbox_projects_school','idx_teacher_library_material_groups_school');
  IF v_cnt <> 12 THEN RAISE EXCEPTION '190: индексов по школе создано % из 12', v_cnt; END IF;
END $$;
