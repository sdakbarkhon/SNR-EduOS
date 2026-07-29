import { getDictionary, type Locale } from "@snr/core";

/** П.3 Заход 1 security-guard messages — already human-readable, must pass
 *  through unchanged (not re-mapped, not prefixed). See admin-api.ts. */
const PASSTHROUGH_MESSAGES = new Set([
  "Нельзя редактировать записи чужой школы",
  "Нельзя привязать ученика чужой школы",
]);

/** Converts a raw Postgres/Supabase/auth error into a short, human-readable
 *  message in the caller's locale — the customer's school admin should never
 *  see "duplicate key value violates unique constraint ..." on screen. */
export function humanizeAdminError(err: unknown, locale: Locale = "ru"): string {
  const raw = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number; code?: number } | null)?.status
    ?? (err as { status?: number; code?: number } | null)?.code;
  const t = getDictionary(locale).adminErrors;

  if (PASSTHROUGH_MESSAGES.has(raw)) return raw;

  if (/duplicate key.*students_username_key/i.test(raw) || /duplicate key.*teachers_username_key/i.test(raw)) {
    return t.usernameTaken;
  }
  if (/duplicate key.*parents_phone_key/i.test(raw)) {
    return t.phoneTaken;
  }
  if (/duplicate key.*schools_code_key/i.test(raw)) {
    return t.schoolCodeTaken;
  }
  if (/violates foreign key constraint/i.test(raw)) {
    return t.foreignKeyBlocked;
  }
  if (/not-null constraint/i.test(raw)) {
    const column = raw.match(/column "([^"]+)"/i)?.[1] ?? "";
    return t.requiredField.replace("{field}", column);
  }
  if (/invalid login credentials/i.test(raw)) {
    return t.invalidCredentials;
  }
  if (status === 429 || /\b429\b/.test(raw) || /too many requests/i.test(raw) || /rate limit/i.test(raw)) {
    return t.rateLimited;
  }

  const short = (raw.split("\n")[0] ?? raw).slice(0, 160);
  return `${t.genericPrefix}${short}`;
}
