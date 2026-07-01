import type { Db } from "../supabase/factory";

export const DEFAULT_STUDENT_EMAIL_DOMAIN = "students.snr.local";
export const TEACHER_EMAIL_DOMAIN = "teachers.snr.local";
export const ADMIN_EMAIL_DOMAIN = "admins.snr.local";
export const DEMO_EMAIL_DOMAIN = "demo.snr.local";

export function usernameToEmail(
  username: string,
  domain: string = DEFAULT_STUDENT_EMAIL_DOMAIN,
): string {
  return `${username.trim().toLowerCase()}@${domain}`;
}

export function isTeacherEmail(email: string | null | undefined): boolean {
  return !!email?.endsWith(`@${TEACHER_EMAIL_DOMAIN}`);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email?.endsWith(`@${ADMIN_EMAIL_DOMAIN}`);
}

/** Tries student → teacher → admin domain. Returns role alongside auth result.
 *  If username already contains "@" it is treated as a full email and tried directly first. */
export async function signInWithUsername(
  db: Db,
  username: string,
  password: string,
) {
  const input = username.trim();

  // Support entering the full synthetic email (e.g. admin@admins.snr.local)
  if (input.includes("@")) {
    const direct = await db.auth.signInWithPassword({
      email: input.toLowerCase(),
      password,
    });
    if (!direct.error) {
      const role = isAdminEmail(input) ? "admin" as const
        : isTeacherEmail(input) ? "teacher" as const
        : "student" as const;
      return { ...direct, role };
    }
  }

  const studentResult = await db.auth.signInWithPassword({
    email: usernameToEmail(input, DEFAULT_STUDENT_EMAIL_DOMAIN),
    password,
  });
  if (!studentResult.error) return { ...studentResult, role: "student" as const };

  const teacherResult = await db.auth.signInWithPassword({
    email: usernameToEmail(input, TEACHER_EMAIL_DOMAIN),
    password,
  });
  if (!teacherResult.error) return { ...teacherResult, role: "teacher" as const };

  const adminResult = await db.auth.signInWithPassword({
    email: usernameToEmail(input, ADMIN_EMAIL_DOMAIN),
    password,
  });
  if (!adminResult.error) return { ...adminResult, role: "admin" as const };

  // demo_teacher/demo_student (migration 66) share one domain, so role can't
  // be derived from the domain the way it is above — go by exact username.
  const lower = input.toLowerCase();
  if (lower === "demo_teacher" || lower === "demo_student") {
    const demoResult = await db.auth.signInWithPassword({
      email: usernameToEmail(input, DEMO_EMAIL_DOMAIN),
      password,
    });
    if (!demoResult.error) {
      return { ...demoResult, role: lower === "demo_teacher" ? "teacher" as const : "student" as const };
    }
  }

  return { ...studentResult, role: null };
}
