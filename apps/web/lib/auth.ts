/** DB-based role resolution. Admin wins over teacher wins over student.
 *  Works with both server and browser Supabase clients. */

export type UserRole = "admin" | "teacher" | "student" | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any };

/** Queries admins → teachers → students in priority order.
 *  Returns the highest-priority role the user belongs to. */
export async function getCurrentUserRole(
  supabase: AnyClient,
  userId: string,
): Promise<UserRole> {
  const [adminRes, teacherRes, studentRes] = await Promise.all([
    supabase.from("admins").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("teachers").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("students").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  if (adminRes.data) return "admin";
  if (teacherRes.data) return "teacher";
  if (studentRes.data) return "student";
  return null;
}

export function roleToHome(role: UserRole): string {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher/dashboard";
  return "/dashboard";
}
