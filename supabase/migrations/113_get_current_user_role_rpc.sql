-- Migration 113 — Промт «скорость», Задача 4: middleware round-trips
--
-- getCurrentUserRole() (apps/web/lib/auth.ts) делает 5 отдельных PostgREST
-- запросов (super_admins/admins/parents/teachers/students) через Promise.all
-- на КАЖДЫЙ защищённый запрос в middleware — параллельно по времени, но это
-- 5 отдельных HTTP/connection-pool round trips, а не один. Схлопываем в одну
-- SQL-функцию с тем же порядком приоритета (тот же трюк, что current_school_id()
-- в 71_super_admin_and_school_id.sql: UNION ALL + LIMIT), auth.uid() вместо
-- параметра — оба вызывающих места (middleware, app/page.tsx) резолвят роль
-- только для текущего пользователя.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM (
    SELECT 'super_admin' AS role, 1 AS prio FROM public.super_admins WHERE user_id = auth.uid()
    UNION ALL
    SELECT 'admin', 2 FROM public.admins WHERE user_id = auth.uid()
    UNION ALL
    SELECT 'parent', 3 FROM public.parents WHERE user_id = auth.uid()
    UNION ALL
    SELECT 'teacher', 4 FROM public.teachers WHERE user_id = auth.uid()
    UNION ALL
    SELECT 'student', 5 FROM public.students WHERE user_id = auth.uid()
  ) roles
  ORDER BY prio
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('113')
ON CONFLICT (version) DO NOTHING;

COMMIT;
