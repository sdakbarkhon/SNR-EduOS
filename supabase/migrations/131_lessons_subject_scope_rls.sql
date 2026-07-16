-- Промт «учителя/уроки», ЧАСТЬ Б — subject-scope RLS на lessons/lesson_stages.
--
-- Проблема: все teacher-политики на lessons висели на is_my_teacher_group()
-- (group-based), а с миграции 109 ВСЕ учителя (5 предметников + куратор)
-- состоят в group_teachers всех 3 групп — поэтому каждый учитель видел и мог
-- редактировать уроки ВСЕХ предметов (проверено: teacher_prog видел 397/397
-- уроков всех 5 предметов). Клиентский фильтр filterBySubject (query-слой,
-- index.ts:1372-1398) прятал чужие уроки из списков, но БД не защищала:
-- прямой запрос/активация этапа чужого урока проходили.
--
-- Новая модель:
--   * Предметник (teachers.subject_slug IS NOT NULL) — видит и правит ТОЛЬКО
--     уроки своего предмета: lessons.subject_id -> subjects.teacher_id = он.
--   * Куратор (subject_slug IS NULL, teacher_karim) — видит все уроки своих
--     групп (наблюдательная роль), но НЕ создаёт/меняет/удаляет.
--     Стаб-предметы (is_stub=true, висят на кураторе) владения не дают.
--   * Демо-уроки (lessons.is_demo = true) — старое group-based правило
--     (parity демо-функционала, см. 99/109/110/127; сейчас demo-уроков 0).
--   * Студенты / родители / школьный админ / super_admin — политики не тронуты.
--
-- Куратор в SQL = teachers.subject_slug IS NULL — канонический признак
-- (COMMENT в 109; те же проверки в TeacherHeaderInfo.tsx и curriculum/page.tsx).
--
-- lesson_stages: SELECT = «видишь урок — видишь его этапы» (подзапрос к
-- lessons исполняется под RLS lessons текущего пользователя); запись — только
-- владелец предмета урока (через SECURITY DEFINER-хелпер, обход RLS-рекурсии —
-- тот же идиом, что все хелперы проекта: is_my_group / is_my_teacher_group).

BEGIN;

-- ── 1. Хелперы ────────────────────────────────────────────────────────────

-- Владеет ли текущий учитель предметом p_subject_id (реальным, не стабом).
-- NULL subject_id => false (урок без предмета редактирует только super_admin;
-- сейчас таких уроков 0, форма создания делает предмет обязательным).
CREATE OR REPLACE FUNCTION public.is_subject_owner(p_subject_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subjects s
    WHERE s.id = p_subject_id
      AND s.is_stub = false
      AND s.teacher_id = (SELECT t.id FROM public.teachers t WHERE t.user_id = auth.uid() LIMIT 1)
  );
$$;

-- Является ли текущий пользователь куратором (учитель без предмета).
CREATE OR REPLACE FUNCTION public.is_curator_teacher()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.user_id = auth.uid() AND t.subject_slug IS NULL
  );
$$;

-- Может ли текущий учитель ПИСАТЬ в урок p_lesson_id (для lesson_stages):
-- владелец предмета урока, либо демо-урок в его группе (parity).
-- SECURITY DEFINER: читает lessons в обход RLS — без рекурсии политик.
CREATE OR REPLACE FUNCTION public.teacher_can_write_lesson(p_lesson_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lessons l
    WHERE l.id = p_lesson_id
      AND (
        public.is_subject_owner(l.subject_id)
        OR (l.is_demo = true AND public.is_my_teacher_group(l.group_id))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_subject_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_curator_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_write_lesson(uuid) TO authenticated;

-- ── 2. lessons: пересобрать teacher-политики ─────────────────────────────

-- SELECT: предметник — свой предмет; куратор — все уроки своих групп
-- (read-only обеспечивают write-политики ниже); демо — group-based.
DROP POLICY IF EXISTS "teacher reads lessons in own groups" ON public.lessons;
CREATE POLICY "teacher reads lessons in own groups" ON public.lessons
  FOR SELECT USING (
    (
      (
        public.is_subject_owner(subject_id)
        OR (public.is_curator_teacher() AND public.is_my_teacher_group(group_id))
        OR (is_demo = true AND public.is_my_teacher_group(group_id))
      )
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- INSERT: только предметник со СВОИМ предметом в своей группе (куратор
-- заблокирован: он не владеет ни одним не-стаб предметом); демо — как раньше.
DROP POLICY IF EXISTS "teachers_insert_lessons" ON public.lessons;
CREATE POLICY "teachers_insert_lessons" ON public.lessons
  FOR INSERT WITH CHECK (
    (
      public.is_my_teacher_group(group_id)
      AND (public.is_subject_owner(subject_id) OR is_demo = true)
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- UPDATE: только владелец предмета урока; демо — group-based.
DROP POLICY IF EXISTS "teacher updates own group lessons" ON public.lessons;
CREATE POLICY "teacher updates own group lessons" ON public.lessons
  FOR UPDATE USING (
    (
      (
        public.is_subject_owner(subject_id)
        OR (is_demo = true AND public.is_my_teacher_group(group_id))
      )
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      (
        public.is_subject_owner(subject_id)
        OR (is_demo = true AND public.is_my_teacher_group(group_id))
      )
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- DELETE: симметрично UPDATE.
DROP POLICY IF EXISTS "teachers_delete_lessons" ON public.lessons;
CREATE POLICY "teachers_delete_lessons" ON public.lessons
  FOR DELETE USING (
    (
      (
        public.is_subject_owner(subject_id)
        OR (is_demo = true AND public.is_my_teacher_group(group_id))
      )
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- ── 3. lesson_stages: разбить FOR ALL на SELECT + write ──────────────────
-- Было: "teacher manages own lesson stages" FOR ALL по is_my_teacher_group —
-- любой учитель группы (включая куратора) мог менять этапы любого урока.

DROP POLICY IF EXISTS "teacher manages own lesson stages" ON public.lesson_stages;

-- SELECT: этапы видны тому, кому виден сам урок (подзапрос под RLS lessons):
-- предметник — свои уроки, куратор — уроки своих групп. Студенты/родители
-- ходят по своим политикам (не тронуты) — эта добавляет доступ учителям.
CREATE POLICY "teacher reads visible lesson stages" ON public.lesson_stages
  FOR SELECT USING (
    (
      EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_stages.lesson_id)
      AND school_id = public.current_school_id()
    )
    OR public.is_super_admin()
  );

-- INSERT/UPDATE/DELETE: только владелец предмета урока (или демо-parity).
CREATE POLICY "teacher writes own subject lesson stages" ON public.lesson_stages
  FOR INSERT WITH CHECK (
    (public.teacher_can_write_lesson(lesson_id) AND school_id = public.current_school_id())
    OR public.is_super_admin()
  );

CREATE POLICY "teacher updates own subject lesson stages" ON public.lesson_stages
  FOR UPDATE USING (
    (public.teacher_can_write_lesson(lesson_id) AND school_id = public.current_school_id())
    OR public.is_super_admin()
  )
  WITH CHECK (
    (public.teacher_can_write_lesson(lesson_id) AND school_id = public.current_school_id())
    OR public.is_super_admin()
  );

CREATE POLICY "teacher deletes own subject lesson stages" ON public.lesson_stages
  FOR DELETE USING (
    (public.teacher_can_write_lesson(lesson_id) AND school_id = public.current_school_id())
    OR public.is_super_admin()
  );

-- ── 4. Регистрация ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('131')
ON CONFLICT (version) DO NOTHING;

COMMIT;
