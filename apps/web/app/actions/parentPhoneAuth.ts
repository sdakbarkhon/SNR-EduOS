"use server";

import { cookies } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { DEMO_SESSION_COOKIE } from "@/lib/single-session";
import { registerSession } from "@/lib/register-session";
import { issueParentCode, verifyParentCode } from "@/lib/parent-sms";

/**
 * Z.2.8 — вход родителя по телефону с настоящим кодом подтверждения.
 *
 * ЧТО БЫЛО. Захардкоженная карта трёх номеров в packages/core, общий пароль
 * `parent2026` открытым текстом и код, который не проверялся вовсе: любые
 * четыре цифры проходили. Всё это удалено.
 *
 * КАК СТАЛО. Телефон ищется в `parents` (phone NOT NULL + UNIQUE, миграция
 * 180), на него выдаётся одноразовый код со сроком жизни и лимитом попыток,
 * и только после его проверки выдаётся сессия.
 *
 * ПОЧЕМУ СЕССИЯ БЕЗ ПАРОЛЯ. Родитель пароль не вводит — он подтверждает
 * владение номером. Пароль у учётной записи есть (его задаёт админ и он
 * нужен мобильному приложению), но серверу он неизвестен: в базе хеш.
 * Поэтому сессия выдаётся штатным приёмом Supabase — service-role
 * `generateLink` даёт одноразовый token_hash, который тут же обменивается на
 * сессию через `verifyOtp`. Наружу этот токен не уходит.
 *
 * СУЩЕСТВУЮЩИЕ АДРЕСА НЕ МИГРИРУЮТСЯ: адрес берётся у самого пользователя по
 * `parents.user_id`, а не собирается из номера. Демо-родитель как входил
 * (parent_ismailov@…), так и входит, ему лишь проставлен телефон.
 */

export type CodeRequestResult =
  | { ok: true; delivered: boolean }
  | { ok: false; error: "invalid_phone" | "not_found" | "too_soon" | "failed" };

export async function requestParentCode(nationalDigits: string): Promise<CodeRequestResult> {
  const result = await issueParentCode(nationalDigits);
  if (!result.ok) return result;
  return { ok: true, delivered: result.delivered };
}

export type PhoneLoginResult =
  | { ok: true; dest: string }
  | { ok: false; error: "invalid_phone" | "invalid_code" | "not_found" | "failed" };

export async function loginParentByPhone(
  nationalDigits: string,
  code: string,
): Promise<PhoneLoginResult> {
  const verified = await verifyParentCode(nationalDigits, code);
  if (!verified.ok) {
    if (verified.error === "invalid_phone") return { ok: false, error: "invalid_phone" };
    if (verified.error === "failed") return { ok: false, error: "failed" };
    // no_code / expired / too_many / wrong_code — для человека это всё «код
    // не подошёл, запросите новый»; подробности в тексте экрана.
    return { ok: false, error: "invalid_code" };
  }
  if (!verified.userId) return { ok: false, error: "failed" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: "failed" };
  const admin = createServiceClient(url, key, { auth: { persistSession: false } });

  const { data: authUser, error: userErr } = await admin.auth.admin.getUserById(verified.userId);
  const email = authUser?.user?.email;
  if (userErr || !email) return { ok: false, error: "failed" };

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink", email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) return { ok: false, error: "failed" };

  const supabase = await createClient();
  const { data: session, error: otpErr } = await supabase.auth.verifyOtp({
    type: "email", token_hash: tokenHash,
  });
  if (otpErr || !session.user || !session.session) return { ok: false, error: "failed" };

  await registerSession({
    userId: session.user.id,
    accessToken: session.session.access_token,
  });

  (await cookies()).delete(DEMO_SESSION_COOKIE);

  return { ok: true, dest: "/parent/home" };
}
