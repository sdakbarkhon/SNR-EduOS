import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Связывание Google-аккаунта с родителем.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ШАГ, А НЕ «вошёл через Google — и всё». У родителя уже есть
 * учётная запись: её заводит админ, ею же родитель входит по телефону, и
 * именно её user_id стоит в parents.user_id — на него завязаны ВСЕ правила
 * доступа. Вход через Google создаёт в Supabase ДРУГУЮ учётную запись (со
 * своим user_id и почтой от Google). Пустить родителя под ней — значит пустить
 * в аккаунт, к которому не привязан ни один ребёнок: он увидит пустоту, а не
 * свой кабинет.
 *
 * Поэтому Google здесь работает только как способ ДОКАЗАТЬ владение почтой.
 * Дальше почта сверяется с parents.google_email, и сессия выдаётся настоящей
 * учётной записи родителя тем же приёмом, что и после кода из SMS: служебный
 * generateLink даёт одноразовый token_hash, он тут же меняется на сессию.
 * Наружу токен не уходит. См. app/actions/parentPhoneAuth.ts — механизм тот же.
 *
 * ПОЧЕМУ В ЧУЖОЙ АККАУНТ ПОПАСТЬ НЕЛЬЗЯ. Три замка подряд:
 *   1) почта берётся не из формы, а из ответа Google после реального входа;
 *   2) она должна быть подтверждена самим Google (email_verified);
 *   3) в parents.google_email стоит уникальный индекс по lower(btrim(...))
 *      (миграция 201), и вписывает это поле только администратор школы
 *      (миграция 204) — родитель себе адрес не назначит.
 */

export type ParentByGoogleEmail =
  | { ok: true; parentId: string; userId: string; authEmail: string; fullName: string }
  | { ok: false; reason: "not_linked" | "no_account" | "school_archived" | "failed" };

/** Ровно та же нормализация, что стоит в CHECK и в уникальном индексе 201. */
export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

/**
 * Ищет родителя по подтверждённой почте Google.
 *
 * Читает служебным ключом намеренно: до связывания у входящего нет ни роли, ни
 * строки — под его правами таблица parents пуста. Поиск идёт по одной колонке
 * и возвращает наружу только факт совпадения.
 */
export async function findParentByGoogleEmail(verifiedEmail: string): Promise<ParentByGoogleEmail> {
  const email = normalizeEmail(verifiedEmail);
  if (!email || !email.includes("@")) return { ok: false, reason: "not_linked" };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyAdmin = admin as any;

  const { data: parent, error } = await anyAdmin
    .from("parents")
    .select("id, user_id, full_name, google_email, school_id")
    .eq("google_email", email)
    .maybeSingle();

  if (error) {
    console.error("[parent-google] поиск родителя не удался:", error.message);
    return { ok: false, reason: "failed" };
  }
  if (!parent) return { ok: false, reason: "not_linked" };

  // Пояс поверх подтяжек: в базе колонка хранится уже нормализованной (CHECK
  // миграции 201), но сверяем ещё раз — сравнение почт не то место, где стоит
  // полагаться на то, что «оно и так должно совпасть».
  if (normalizeEmail(parent.google_email) !== email) return { ok: false, reason: "not_linked" };

  if (!parent.user_id) return { ok: false, reason: "no_account" };

  // Школа в архиве (миграция 202) — вход не открываем.
  const { data: active } = await anyAdmin.rpc("school_is_active", { p_school_id: parent.school_id });
  if (active === false) return { ok: false, reason: "school_archived" };

  const { data: authUser, error: userErr } = await admin.auth.admin.getUserById(parent.user_id);
  const authEmail = authUser?.user?.email;
  if (userErr || !authEmail) return { ok: false, reason: "no_account" };

  return {
    ok: true,
    parentId: parent.id as string,
    userId: parent.user_id as string,
    authEmail,
    fullName: (parent.full_name as string) ?? "",
  };
}

/**
 * Одноразовый token_hash для учётной записи родителя. Меняется на сессию
 * через verifyOtp — на сервере (веб) или на устройстве (мобильное приложение).
 */
export async function issueParentSessionToken(authEmail: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authEmail,
  });
  if (error || !link?.properties?.hashed_token) {
    console.error("[parent-google] generateLink не сработал:", error?.message);
    return null;
  }
  return link.properties.hashed_token;
}
