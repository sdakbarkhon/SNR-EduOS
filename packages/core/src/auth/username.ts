import type { Db } from "../supabase/factory";

/** Домен синтетических email для username-логина (см. план §4). */
export const DEFAULT_STUDENT_EMAIL_DOMAIN = "students.snr.local";

/**
 * Преобразует username (напр. "Adilbek_07") в синтетический email для Supabase
 * Auth. Регистр приводится к нижнему — email должен совпасть с заведённым админом.
 */
export function usernameToEmail(
  username: string,
  domain: string = DEFAULT_STUDENT_EMAIL_DOMAIN,
): string {
  return `${username.trim().toLowerCase()}@${domain}`;
}

/** Вход ученика по username + паролю. */
export function signInWithUsername(
  db: Db,
  username: string,
  password: string,
  domain: string = DEFAULT_STUDENT_EMAIL_DOMAIN,
) {
  return db.auth.signInWithPassword({
    email: usernameToEmail(username, domain),
    password,
  });
}
