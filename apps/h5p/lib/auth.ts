/** Minimal role check -- mirrors apps/web/lib/auth.ts. Only teacher/super_admin
 *  may reach /editor; any authenticated user in the same school (or is_public
 *  content) can view /library and /player. */

export type UserRole = "super_admin" | "teacher" | "student" | "parent" | "admin" | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any };

export async function getCurrentUserRole(supabase: AnyClient, userId: string): Promise<UserRole> {
  const [superAdminRes, adminRes, teacherRes, parentRes, studentRes] = await Promise.all([
    supabase.from("super_admins").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("admins").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("teachers").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("parents").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("students").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  if (superAdminRes.data) return "super_admin";
  if (adminRes.data) return "admin";
  if (teacherRes.data) return "teacher";
  if (parentRes.data) return "parent";
  if (studentRes.data) return "student";
  return null;
}
