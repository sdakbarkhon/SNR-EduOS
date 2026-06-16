import type { Db } from "../supabase/factory";

export const DEFAULT_STUDENT_EMAIL_DOMAIN = "students.snr.local";
export const TEACHER_EMAIL_DOMAIN = "teachers.snr.local";

export function usernameToEmail(
  username: string,
  domain: string = DEFAULT_STUDENT_EMAIL_DOMAIN,
): string {
  return `${username.trim().toLowerCase()}@${domain}`;
}

export function isTeacherEmail(email: string | null | undefined): boolean {
  return !!email?.endsWith(`@${TEACHER_EMAIL_DOMAIN}`);
}

/** Tries student domain first, then teacher domain. Returns role alongside auth result. */
export async function signInWithUsername(
  db: Db,
  username: string,
  password: string,
) {
  const studentResult = await db.auth.signInWithPassword({
    email: usernameToEmail(username, DEFAULT_STUDENT_EMAIL_DOMAIN),
    password,
  });
  if (!studentResult.error) return { ...studentResult, role: "student" as const };

  const teacherResult = await db.auth.signInWithPassword({
    email: usernameToEmail(username, TEACHER_EMAIL_DOMAIN),
    password,
  });
  if (!teacherResult.error) return { ...teacherResult, role: "teacher" as const };

  return { ...studentResult, role: null };
}
