-- Migration 42: Admin role + admins table + fn_is_admin + RLS
-- Also: add 'late' back to attendance status (needed for roll-call "опоздал")
-- ──────────────────────────────────────────────────────────────────────────────

-- ── 1. Add 'late' back to attendance status constraint ────────────────────────
-- Migration 27 removed 'late' (mapped it to 'present'), but the UI design needs
-- it back as a distinct status for the teacher roll-call.

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS chk_attendance_status;

ALTER TABLE public.attendance
  ADD CONSTRAINT chk_attendance_status
  CHECK (status IN ('present', 'late', 'absent_excused', 'absent_unexcused'));

-- ── 2. Admins table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admins (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text NOT NULL DEFAULT 'Администратор',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Admin can read their own record
CREATE POLICY "admin reads own record"
  ON public.admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Only service_role can insert/update/delete admins (no self-promotion)
-- (no INSERT/UPDATE/DELETE policies → only service_role can write)

-- ── 3. fn_is_admin helper ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_is_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = p_user_id);
$$;

-- ── 4. RLS extensions: admins can do ALL on students/teachers/groups ──────────

-- students: admin can read/write all rows (for CRUD panel)
CREATE POLICY "admin full access students"
  ON public.students FOR ALL TO authenticated
  USING (public.fn_is_admin())
  WITH CHECK (public.fn_is_admin());

-- teachers: admin can read/write all rows
CREATE POLICY "admin full access teachers"
  ON public.teachers FOR ALL TO authenticated
  USING (public.fn_is_admin())
  WITH CHECK (public.fn_is_admin());

-- groups: admin can read/write all rows
CREATE POLICY "admin full access groups"
  ON public.groups FOR ALL TO authenticated
  USING (public.fn_is_admin())
  WITH CHECK (public.fn_is_admin());

-- student_groups: admin can manage enrollment
CREATE POLICY "admin full access student_groups"
  ON public.student_groups FOR ALL TO authenticated
  USING (public.fn_is_admin())
  WITH CHECK (public.fn_is_admin());

-- ── 5. Grants ─────────────────────────────────────────────────────────────────

GRANT SELECT ON public.admins TO authenticated;

-- ── 6. Seed note ─────────────────────────────────────────────────────────────
-- To create an admin account, do the following in Supabase Dashboard:
--   Authentication → Add user: email=admin@admins.snr.local, password=admin123
--   Then run: INSERT INTO public.admins (user_id, full_name)
--             VALUES ('<uid from above>', 'Администратор');
