import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail, issueParentSessionToken } from "@/lib/parent-google";

/**
 * Поиск человека по подтверждённой почте Google — по всем ролям сразу.
 *
 * ЭТО РАСШИРЕНИЕ, А НЕ ВТОРОЙ МЕХАНИЗМ. Родительский путь (lib/parent-google.ts)
 * остаётся как был и продолжает работать; здесь тот же приём, распространённый
 * на учеников, учителей и администраторов. Нормализация почты берётся оттуда
 * же — одна функция на всё приложение, иначе «Ivan@Gmail.com » и
 * «ivan@gmail.com» разошлись бы между ролями. Выдача сессии — тоже общая
 * (issueParentSessionToken): она про учётную запись, а не про роль, и второй
 * копии ей не нужно.
 *
 * ПОЧЕМУ В ЧУЖОЙ КАБИНЕТ ПОПАСТЬ НЕЛЬЗЯ. Четыре замка подряд:
 *   1) почта берётся не из формы, а из ответа Google после реального входа;
 *   2) она должна быть подтверждена самим Google (email_verified);
 *   3) одна почта принадлежит одному человеку — это держит база
 *      (миграция 213: уникальные индексы плюс проверка между таблицами);
 *   4) почту вписывает не сам человек, а администратор школы (ученикам,
 *      учителям, родителям) или суперадминистратор (администраторам).
 *
 * ШКОЛА СВЕРЯЕТСЯ ОТДЕЛЬНО. На экране входа человек выбирает школу, и вход
 * через Google обязан её учитывать: ученик школы А, выбравший школу Б, войти
 * не должен. Проверка стоит в конце, когда роль уже найдена, — до неё мы не
 * знаем, чья это почта, и любой ответ был бы подсказкой постороннему.
 */

export type GoogleRole = "student" | "teacher" | "admin" | "parent";

export type GoogleIdentity =
  | {
      ok: true;
      role: GoogleRole;
      rowId: string;
      userId: string;
      authEmail: string;
      fullName: string;
      schoolId: string | null;
      /** Куда вести после входа — тот же порядок, что у обычного входа. */
      dest: string;
    }
  | { ok: false; reason: "not_linked" | "no_account" | "school_archived" | "wrong_school" | "demo_school" | "failed" };

/** Где искать и куда вести. Порядок тот же, что у приоритета ролей в обычном
 *  входе: администратор → родитель → учитель → ученик. */
const LOOKUP: Array<{ table: string; role: GoogleRole; dest: string }> = [
  { table: "admins", role: "admin", dest: "/admin" },
  { table: "parents", role: "parent", dest: "/parent/home" },
  { table: "teachers", role: "teacher", dest: "/teacher/dashboard" },
  { table: "students", role: "student", dest: "/dashboard" },
];

/**
 * Ищет человека по почте.
 *
 * `expectedSchoolId` — школа, выбранная на экране входа. null означает «выбора
 * не было» (например, вход из приложения родителя, где школу не спрашивают) —
 * тогда сверка не делается.
 *
 * Читает служебным ключом намеренно: до связывания у входящего нет ни роли, ни
 * строки — под его правами все эти таблицы пусты.
 */
export async function findIdentityByGoogleEmail(
  verifiedEmail: string,
  expectedSchoolId?: string | null,
): Promise<GoogleIdentity> {
  const email = normalizeEmail(verifiedEmail);
  if (!email || !email.includes("@")) return { ok: false, reason: "not_linked" };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyAdmin = admin as any;

  for (const { table, role, dest } of LOOKUP) {
    const { data, error } = await anyAdmin
      .from(table)
      .select("id, user_id, full_name, google_email, school_id")
      .eq("google_email", email)
      .maybeSingle();

    if (error) {
      console.error(`[google-identity] поиск в ${table} не удался:`, error.message);
      return { ok: false, reason: "failed" };
    }
    if (!data) continue;

    // Пояс поверх подтяжек: в базе колонка хранится уже нормализованной
    // (CHECK миграций 201 и 213), но сравнение почт не то место, где стоит
    // полагаться на то, что «оно и так должно совпасть».
    if (normalizeEmail(data.google_email) !== email) continue;

    if (!data.user_id) return { ok: false, reason: "no_account" };

    // Школа в архиве (миграция 202) — вход не открываем.
    const { data: active } = await anyAdmin.rpc("school_is_active", { p_school_id: data.school_id });
    if (active === false) return { ok: false, reason: "school_archived" };

    // В ДЕМО-ШКОЛУ ЧЕРЕЗ GOOGLE НЕ ПУСКАЕМ ВОВСЕ.
    //
    // Найдено 18.08.2026: у демо-родителя в карточке была вписана настоящая
    // почта, и вход через Google заводил его как обычного пользователя —
    // мимо аренды демо-слота, мимо срока жизни и мимо баннера «это демо».
    // Проверялся только архив, а демо-школа не архивная, поэтому проверка её
    // пропускала.
    //
    // Демо — витрина с собственной кнопкой, и это единственная дверь в неё.
    // Правило шире родителя намеренно: впиши кто-нибудь почту демо-учителю,
    // повторилось бы то же самое.
    const { data: school } = await anyAdmin
      .from("schools").select("is_demo").eq("id", data.school_id).maybeSingle();
    if ((school as { is_demo: boolean } | null)?.is_demo) {
      return { ok: false, reason: "demo_school" };
    }

    // Выбрана школа — она должна совпасть. Отказ отдельный, не «почта не
    // привязана»: почта-то привязана, человек ошибся школой, и говорить ему
    // про почту значило бы отправить искать несуществующую поломку.
    if (expectedSchoolId && data.school_id && data.school_id !== expectedSchoolId) {
      return { ok: false, reason: "wrong_school" };
    }

    const { data: authUser, error: userErr } = await admin.auth.admin.getUserById(data.user_id);
    const authEmail = authUser?.user?.email;
    if (userErr || !authEmail) return { ok: false, reason: "no_account" };

    return {
      ok: true,
      role,
      rowId: data.id as string,
      userId: data.user_id as string,
      authEmail,
      fullName: (data.full_name as string) ?? "",
      schoolId: (data.school_id as string) ?? null,
      dest,
    };
  }

  return { ok: false, reason: "not_linked" };
}

export { issueParentSessionToken as issueSessionToken };
