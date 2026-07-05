/** DB-based role resolution. Super_admin wins over admin wins over parent
 *  wins over teacher wins over student. Works with both server and browser
 *  Supabase clients. */

export type UserRole = "super_admin" | "admin" | "parent" | "teacher" | "student" | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any };

/** Queries super_admins → admins → parents → teachers → students in
 *  priority order. Returns the highest-priority role the user belongs to. */
export async function getCurrentUserRole(
  supabase: AnyClient,
  userId: string,
): Promise<UserRole> {
  const [superAdminRes, adminRes, parentRes, teacherRes, studentRes] = await Promise.all([
    supabase.from("super_admins").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("admins").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("parents").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("teachers").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("students").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  if (superAdminRes.data) return "super_admin";
  if (adminRes.data) return "admin";
  if (parentRes.data) return "parent";
  if (teacherRes.data) return "teacher";
  if (studentRes.data) return "student";
  return null;
}

export function roleToHome(role: UserRole): string {
  if (role === "super_admin") return "/superadmin/dashboard";
  if (role === "admin") return "/admin";
  if (role === "parent") return "/parent/dashboard";
  if (role === "teacher") return "/teacher/dashboard";
  return "/dashboard";
}
