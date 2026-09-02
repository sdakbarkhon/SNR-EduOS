/** DB-based role resolution. Super_admin wins over manager wins over admin
 *  wins over parent wins over teacher wins over student. Works with both
 *  server and browser Supabase clients. */

/**
 * Роли системы. Порядок в объединении — порядок старшинства, и он тот же,
 * что в get_current_user_role() (миграция 250).
 *
 * МЕНЕДЖЕР ВСТАЛ ВТОРЫМ. Он «админ школы во всех школах сразу»: сильнее
 * школьного админа, потому что не привязан ни к одной школе, и слабее
 * суперадмина, потому что школ не заводит.
 */
export type UserRole =
  | "super_admin"
  | "manager"
  | "admin"
  | "parent"
  | "teacher"
  | "student"
  | null;

/** Resolves the caller's own role (super_admin → admin → parent → teacher →
 *  student priority) in a single round trip via get_current_user_role()
 *  (migration 113), which uses auth.uid() server-side — `userId` is kept in
 *  the signature for call-site compatibility but must match the role that
 *  `supabase`'s own session belongs to (this can NOT be used to look up a
 *  different user's role, unlike the old 5-query version). */
export async function getCurrentUserRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  _userId: string,
): Promise<UserRole> {
  const { data, error } = await supabase.rpc("get_current_user_role");
  if (error) return null;
  return (data as UserRole) ?? null;
}

export function roleToHome(role: UserRole): string {
  if (role === "super_admin") return "/superadmin/dashboard";
  if (role === "manager") return "/manager";
  if (role === "admin") return "/admin";
  if (role === "parent") return "/parent/home";
  if (role === "teacher") return "/teacher/dashboard";
  return "/dashboard";
}
