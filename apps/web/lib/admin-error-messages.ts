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

  // Логотип школы: код отказа приходит из lib/school-card.ts вместе с числами,
  // потому что фраза живёт в словарях, а сервер языка вызывающего не знает.
  const logo = raw.match(/^LOGO_([A-Z_]+):(.*)$/);
  if (logo) {
    const kind = logo[1]!;
    let info: { maxMb?: number; gotMb?: number; got?: string } = {};
    try { info = JSON.parse(logo[2]!); } catch { /* без чисел — фраза всё равно понятна */ }
    if (kind === "TOO_BIG") {
      return t.logoTooBig
        .replace("{got}", String(info.gotMb ?? "?"))
        .replace("{max}", String(info.maxMb ?? 2));
    }
    if (kind === "BAD_TYPE") return t.logoBadType.replace("{got}", String(info.got ?? "?"));
    if (kind === "EMPTY") return t.logoEmpty;
    return t.logoUploadFailed;
  }

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

  // Z.2.9 — имена ограничений сверены с живой базой. Прежние
  // `students_username_key` / `teachers_username_key` НЕ СУЩЕСТВУЮТ: реальные
  // называются `students_school_username_key` и `teachers_school_username_key`
  // (уникальность в пределах школы). Из-за этого дубль логина проходил мимо
  // всех веток и показывался сырым английским текстом Postgres.
  if (/duplicate key.*(students|teachers)_school_username_key/i.test(raw)
    || /duplicate key.*(students|teachers)_username_key/i.test(raw)) {
    return t.usernameTaken;
  }
  // Логин занят на уровне учётных записей: адрес auth.users уникален
  // глобально, поэтому один и тот же логин в двух школах упирается сюда
  // раньше, чем в ограничение таблицы. Снятие этого предела — Z.2.10.
  if (/already.*registered/i.test(raw) || /email_exists/i.test(raw)
    || /duplicate key.*users_email/i.test(raw)) {
    return t.usernameTaken;
  }
  // Миграция 202: демо-школа защищена триггером в базе, а название школы
  // сверяется на сервере — сюда приходят их машинные коды.
  if (/demo_school_cannot_be_deleted|demo_school_cannot_be_archived|demo_flag_is_permanent/i.test(raw)) {
    return t.demoSchoolProtected;
  }
  if (/school_name_mismatch/i.test(raw)) {
    return t.schoolNameMismatch;
  }
  if (/duplicate key.*parents_phone_key/i.test(raw)) {
    return t.phoneTaken;
  }
  // Миграция 201: одну почту нельзя привязать двум родителям. Ловим обе —
  // Google и Apple — и объясняем человеку, а не показываем текст Postgres.
  if (/duplicate key.*parents_google_email_key/i.test(raw)) {
    return t.googleEmailTaken;
  }
  if (/duplicate key.*parents_apple_email_key/i.test(raw)) {
    return t.appleEmailTaken;
  }
  if (/parents_google_email_shape|parents_apple_email_shape/i.test(raw)) {
    return t.socialEmailInvalid;
  }
  if (/duplicate key.*schools_code_key/i.test(raw)) {
    return t.schoolCodeTaken;
  }
  if (/duplicate key.*school_subjects_name_unique/i.test(raw)) {
    return t.subjectNameTaken;
  }
  if (/duplicate key.*subjects_name_group_id_key/i.test(raw)) {
    return t.assignmentExists;
  }
  if (raw === "BAD_PHONE" || /Некорректный номер телефона/.test(raw)) {
    return t.phoneInvalid;
  }
  if (raw === "GROUP_NAME_TAKEN") {
    return t.groupNameTaken;
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
