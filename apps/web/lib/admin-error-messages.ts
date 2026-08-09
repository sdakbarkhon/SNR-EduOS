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

  // Z.2.3 — гварды удаления. Причина отказа приходит из admin-api.ts кодом с
  // числами; собираем из них фразу, объясняющую ЧТО мешает, вместо «нельзя».
  const blocked = raw.match(/^BLOCKED_([A-Z_]+):(.*)$/);
  if (blocked) {
    const [kind, rest] = [blocked[1]!, blocked[2]!];
    const parts = rest.split(":");
    const num = (i: number) => Number(parts[i] ?? 0) || 0;
    if (kind === "TEACHER_LESSONS") {
      const where = parts.slice(1).join(":").trim();
      return t.teacherHasLessons.replace("{count}", String(num(0)))
        + (where ? ` (${where})` : "");
    }
    if (kind === "TEACHER_GRADES") {
      return t.teacherHasGrades.replace("{count}", String(num(0)));
    }
    if (kind === "SUBJECT_IN_USE") {
      return t.subjectInUse
        .replace("{lessons}", String(num(0)))
        .replace("{homework}", String(num(1)))
        .replace("{plans}", String(num(2)));
    }
    if (kind === "CATALOG_IN_USE") {
      return t.catalogSubjectInUse
        .replace("{assignments}", String(num(0)))
        .replace("{lessons}", String(num(1)))
        .replace("{homework}", String(num(2)))
        .replace("{plans}", String(num(3)));
    }
  }

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
