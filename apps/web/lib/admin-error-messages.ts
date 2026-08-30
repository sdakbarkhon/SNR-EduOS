import { getDictionary, type Locale } from "@snr/core";

/** П.3 Заход 1 security-guard messages — already human-readable, must pass
 *  through unchanged (not re-mapped, not prefixed). See admin-api.ts. */
const PASSTHROUGH_MESSAGES = new Set([
  "Нельзя редактировать записи чужой школы",
  "Нельзя привязать ученика чужой школы",
]);

/** Текст ошибки из чего угодно. Ошибки Supabase — обычные объекты
 *  `{ message, details, hint, code }`, а не `Error`, и прежнее
 *  `String(err)` превращало их в «[object Object]». Имя нарушенного
 *  ограничения лежит в `details`, поэтому берём и его. */
function rawTextOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    const parts = [o.message, o.details, o.hint, o.code]
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    if (parts.length) return parts.join(" | ");
  }
  return String(err);
}

/** Converts a raw Postgres/Supabase/auth error into a short, human-readable
 *  message in the caller's locale — the customer's school admin should never
 *  see "duplicate key value violates unique constraint ..." on screen. */
export function humanizeAdminError(err: unknown, locale: Locale = "ru"): string {
  const raw = rawTextOf(err);
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

  // Миграция 213 — логин уникален во всей системе, почта привязана к одному
  // человеку. Обе проверки живут в базе (индексы плюс триггер между
  // таблицами) и бросают машинный код: администратору читать
  // «duplicate key value violates unique constraint» незачем.
  if (/LOGIN_TAKEN/i.test(raw)
    || /duplicate key.*(students|teachers|admins)_username_global_uniq/i.test(raw)) {
    return t.usernameTaken;
  }
  if (/EMAIL_TAKEN/i.test(raw)
    || /duplicate key.*(students|teachers|admins|parents)_google_email_uniq/i.test(raw)) {
    return t.googleEmailTaken;
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
  // Окно ученика, миграция 232. Дата рождения и пол проверяются на сервере,
  // а не только браузером: поле формы обходится запросом мимо неё.
  if (raw === "BAD_BIRTH_DATE") return t.birthDateBad;
  if (raw === "BIRTH_DATE_FUTURE") return t.birthDateInFuture;
  if (raw === "BIRTH_DATE_TOO_OLD") return t.birthDateTooOld;
  // Последний рубеж пола — проверка students_gender_known из 232: сюда
  // отказ доходит, если значение пошло мимо разбора формы.
  if (raw === "BAD_GENDER" || /students_gender_known/i.test(raw)) return t.genderBad;
  // Заход 2 по платежам. BAD_PRICE / PRICE_TOO_BIG бросает разбор формы
  // (lib/course-price.ts), а groups_course_price_not_negative — проверка из
  // миграции 227: последний рубеж, если запись пойдёт мимо разбора.
  if (raw === "BAD_PRICE" || /groups_course_price_not_negative/i.test(raw)) {
    return t.coursePriceInvalid;
  }
  if (raw === "PRICE_TOO_BIG" || /integer out of range/i.test(raw)) {
    return t.coursePriceTooBig;
  }
  // Миграция 228 — последнего администратора школы удалять нельзя. Код
  // LAST_SCHOOL_ADMIN бросает первый рубеж (admin-api.ts) и именно он доезжает
  // до человека; last_school_admin — второй рубеж, триггер в базе: он до
  // экрана добирается редко, потому что удаление идёт через Auth API, а тот
  // подменяет ошибку базы своим текстом. Ловим оба на случай, если доберётся.
  if (raw === "LAST_SCHOOL_ADMIN" || /last_school_admin/i.test(raw)) {
    return t.lastSchoolAdmin;
  }

  // Миграция 237 — удалению учётной записи мешают ссылки на неё. Код с
  // числами приходит из deleteSchoolAdmin: он спрашивает причину у базы
  // ДО вызова Auth API, пока она ещё читается.
  const userRefs = raw.match(/^BLOCKED_USER_REFS:(\d+):(.*)$/);
  if (userRefs) {
    return t.userHasRefs.replace("{count}", userRefs[1] ?? "0")
      + (userRefs[2] ? ` (${userRefs[2]})` : "");
  }

  // ПОСЛЕДНИЙ РУБЕЖ ДЛЯ ТЕКСТА. Если ссылка всё-таки проскочила мимо
  // проверки выше (её добавили новым триггером, а не внешним ключом), Auth
  // API вернёт свою английскую заглушку. Ветка foreignKeyBlocked её не
  // поймает: слов «violates foreign key constraint» в подменённом тексте
  // уже нет. Пусть человек хотя бы понимает, что произошло и что делать.
  if (/database error (deleting|creating|updating) user/i.test(raw)) {
    return t.authUserOperationFailed;
  }

  // Заход 3 по платежам — разбор суммы ручного пополнения баланса.
  if (raw === "BAD_TOPUP_AMOUNT" || raw === "BAD_PRICE_TOPUP") {
    return t.topUpAmountInvalid;
  }
  if (raw === "TOPUP_REASON_REQUIRED") {
    return t.topUpReasonRequired;
  }

  // Заход 5 по платежам — правка и отмена счетов.
  if (raw === "INVOICE_NOT_OPEN") return t.invoiceNotOpen;
  if (raw === "INVOICE_NOT_CANCELED") return t.invoiceNotCanceled;
  if (raw === "INVOICE_NOT_FOUND") return t.invoiceNotFound;
  if (raw === "BAD_INVOICE_AMOUNT") return t.invoiceAmountInvalid;
  if (raw === "INVOICE_REASON_REQUIRED") return t.invoiceReasonRequired;
  // Последний рубеж: проверка из 227 не даст пометить счёт «поправлен админом» без автора и времени.
  if (/tuition_invoices_adjusted_has_author/i.test(raw)) return t.invoiceReasonRequired;
  if (/tuition_invoices_amount_not_negative/i.test(raw)) return t.invoiceAmountInvalid;
  // Последний рубеж баланса — проверка из 227. Сюда отказ доходит, если
  // списание пошло мимо расчёта; человеку важно, что денег не хватило.
  if (/students_balance_not_negative/i.test(raw)) {
    return t.topUpAmountInvalid;
  }

  // Миграция 222 — суперадмин не пишет в школьные таблицы под своим токеном.
  // Ограничительное правило отвергает вставку с кодом 42501; на изменении и
  // удалении оно не бросается вовсе, а просто не находит строк, и туда эта
  // ветка не попадёт — но там и сообщать не о чем.
  //
  // Из интерфейса суперадмин сюда не приходит: его собственные экраны пишут
  // служебным ключом, а на админские он не попадает — middleware уводит его на
  // свою панель. Ветка нужна на случай запроса в обход экранов: показывать
  // человеку английский текст Postgres нечего.
  if (/row-level security policy/i.test(raw) || /42501/.test(raw)) {
    // Различаем по самому тексту: имя сторожевой функции попадает в
    // сообщение, только если отказ поднят ею. Гадать по роли не из чего —
    // на клиенте её нет.
    return /is_super_admin|sa_write_allowed/i.test(raw)
      ? t.superadminWriteBlocked
      : t.rlsWriteBlocked;
  }
  // Миграция 226 — у урока обязан быть предмет, а внешний ключ стал
  // RESTRICT. Гвард в admin-api.ts ловит это раньше и объясняет числами; сюда
  // отказ доходит, только если удаление пошло мимо гварда. Общая фраза «есть
  // связанные записи» в этом случае не подсказывает ничего, поэтому
  // разбираем отдельно.
  if (/lessons_subject_id_fkey/i.test(raw)) {
    return t.subjectHasLessons;
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
