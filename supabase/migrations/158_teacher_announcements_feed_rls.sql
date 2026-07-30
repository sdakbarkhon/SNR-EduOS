-- =====================================================================
-- Migration 158 — объявления в учительском дашборде (Большой фикс, Блок 4).
--
-- РАЗВЕДКА: "Объявления" в TeacherDashboardView.tsx — статичная заглушка
-- ("Здесь скоро появится школьная лента объявлений"), без единого запроса.
-- Но добавить запрос было бы недостаточно: единственная существующая
-- SELECT-политика на announcements — "teacher or admin reads own
-- announcements" (миграция 121) — пускает учителя ТОЛЬКО к created_by=он
-- сам. Живая проверка (demo-школа): учитель teacher_karim (куратор всех 3
-- групп) видел 6 своих классных объявлений и 0 из 5 школьных админских;
-- остальные 5 демо-учителей (ведут только предметы, не кураторы) не видели
-- НИ ОДНОГО. Это не поправимо клиентским фильтром — RLS запрещает данные
-- ДО того, как их увидит запрос. Нужна новая SELECT-политика (аддитивная —
-- Postgres OR'ит политики одной команды, старая "reads own" не трогается,
-- продолжает работать для страницы "Мои объявления"/TeacherAnnouncementsView).
--
-- Паттерн — зеркало миграции 126 ("parent reads announcements for their
-- children"), только is_my_teacher_group() вместо is_my_child_group():
-- ровно то, что просил промт — "общешкольные (scope='all_my_groups', от
-- админа) + классные для СВОИХ групп" — без побочной ветки "чужое
-- all_my_groups от другого учителя общей группы" (которая есть у
-- родительской версии для другого сценария, но не запрашивалась здесь и
-- не встречается в демо-данных — не выдумываю).
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS "teacher reads announcements for their groups" ON public.announcements;
CREATE POLICY "teacher reads announcements for their groups"
  ON public.announcements FOR SELECT TO authenticated
  USING (
    (
      public.current_teacher_id() IS NOT NULL
      AND school_id = public.current_school_id()
      AND (
        (scope = 'group' AND public.is_my_teacher_group(group_id))
        OR (scope = 'all_my_groups' AND admin_id IS NOT NULL)
      )
    )
    OR public.is_super_admin()
  );

-- Догоняем schema_migrations за 154-156 (у них этой строки не было —
-- упущение, конвенция была в 108-153, но не соблюдалась начиная со 154;
-- 157 уже вставляет свою версию сам). Не влияет на DDL выше, только на то,
-- что Supabase CLI увидит их как применённые после того, как заказчик
-- прогонит 154-158 через Dashboard по порядку.
INSERT INTO supabase_migrations.schema_migrations (version) VALUES
  ('154'), ('155'), ('156'), ('158')
ON CONFLICT DO NOTHING;

COMMIT;
