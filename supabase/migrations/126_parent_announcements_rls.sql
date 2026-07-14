-- Промт МОБ-4 — родительский доступ на чтение к announcements.
--
-- Аудит (read-only, Management API): у public.announcements сейчас РОВНО
-- 4 политики (student reads / teacher-admin creates / reads own / updates
-- own / deletes own) — ни одна не ссылается на parent_students или любой
-- parent-идентити хелпер. current_school_id() уже умеет резолвить школу
-- через parents (см. её тело), но identity-хелперов для "мой ребёнок"
-- не существовало вовсе. Родительская SELECT-сессия получала 0 строк —
-- не частично отфильтрованный набор, а полный запрет. Родители сейчас
-- узнают об объявлениях только через notifications (усечённый body до
-- 100 симв., без category/is_pinned/valid_until) — trg_announce_notify
-- уже фан-аутит на них корректно, это не трогаем.
--
-- Новые хелперы копируют структуру current_student_id()/is_my_group()
-- (SECURITY DEFINER, STABLE, search_path='public') один в один, только
-- через parent_students вместо прямой student_groups-принадлежности.
-- Новая политика — ТОЛЬКО SELECT (не ALL, как у студенческой) и зеркалит
-- ровно ту же scope-логику (group/all_my_groups/student), что и
-- "student reads announcements".

BEGIN;

CREATE OR REPLACE FUNCTION public.current_parent_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM public.parents WHERE user_id = auth.uid() LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.is_my_child_group(p_group_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.parent_students ps
    JOIN public.student_groups sg ON sg.student_id = ps.student_id
    WHERE ps.parent_id = (SELECT id FROM public.parents WHERE user_id = auth.uid() LIMIT 1)
      AND sg.group_id = p_group_id
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_my_child(p_student_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_students ps
    WHERE ps.parent_id = (SELECT id FROM public.parents WHERE user_id = auth.uid() LIMIT 1)
      AND ps.student_id = p_student_id
  )
$function$;

DROP POLICY IF EXISTS "parent reads announcements for their children" ON public.announcements;
CREATE POLICY "parent reads announcements for their children"
ON public.announcements
FOR SELECT
TO public
USING (
  current_parent_id() IS NOT NULL
  AND school_id = current_school_id()
  AND (
    (scope = 'group' AND is_my_child_group(group_id))
    OR (scope = 'all_my_groups' AND (
      admin_id IS NOT NULL
      OR (created_by IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.teacher_id = announcements.created_by
          AND is_my_child_group(g.id)
      ))
    ))
    OR (scope = 'student' AND is_my_child(target_student_id))
  )
  OR is_super_admin()
);

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('126')
ON CONFLICT DO NOTHING;

COMMIT;
