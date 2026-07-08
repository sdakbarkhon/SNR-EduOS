import type { Db } from "../supabase/factory";

export const DEFAULT_STUDENT_EMAIL_DOMAIN = "students.snr.local";
export const TEACHER_EMAIL_DOMAIN = "teachers.snr.local";
export const ADMIN_EMAIL_DOMAIN = "admins.snr.local";
export const DEMO_EMAIL_DOMAIN = "demo.snr.local";
export const PARENT_EMAIL_DOMAIN = "parents.snr.local";

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

export function isParentEmail(email: string | null | undefined): boolean {
  return !!email?.endsWith(`@${PARENT_EMAIL_DOMAIN}`);
}

/** Tries student → teacher → admin → parent domain. Returns role alongside auth result.
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
        : isParentEmail(input) ? "parent" as const
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

  const parentResult = await db.auth.signInWithPassword({
    email: usernameToEmail(input, PARENT_EMAIL_DOMAIN),
    password,
  });
  if (!parentResult.error) return { ...parentResult, role: "parent" as const };

  // All demo accounts (demo_teacher/demo_student from migration 66,
  // demo_student_3/7/10 from migration 70, and demo_student_{grade}_NN /
  // demo_teacher_NN from БОЛЬШОЕ ОБНОВЛЕНИЕ migration 97) share one email
  // domain — role can't be derived from the domain the way it is above, so
  // it's derived from the username prefix instead (was an exact-match
  // allowlist of only the two original names, which silently rejected every
  // newer demo_* username with "Неверный логин или пароль").
  const lower = input.toLowerCase();
  if (lower.startsWith("demo_teacher") || lower.startsWith("demo_student")) {
    const demoResult = await db.auth.signInWithPassword({
      email: usernameToEmail(input, DEMO_EMAIL_DOMAIN),
      password,
    });
    if (!demoResult.error) {
      return { ...demoResult, role: lower.startsWith("demo_teacher") ? "teacher" as const : "student" as const };
    }
  }

  return { ...studentResult, role: null };
}
