"use server";

import { cookies } from "next/headers";
import { signInWithUsername, resolveParentPhone, PARENT_PHONE_PASSWORD } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { DEMO_SESSION_COOKIE } from "@/lib/single-session";
import { registerSession } from "@/lib/register-session";

export type PhoneLoginResult =
  | { ok: true; dest: string }
  | { ok: false; error: "invalid_phone" | "invalid_code" | "not_found" | "failed" };

/**
 * Вход родителя по номеру телефона (веб-родитель, узкая мобильная вёрстка
 * apps/web/app/parent/**). Код из SMS не проверяется по-настоящему — так же
 * устроен вход в apps/mobile-parent (см. LoginSmsScreen): любые 4 цифры
 * проходят, реальная аутентификация — это резолв телефон → username
 * (packages/core/src/auth/phone.ts) → signInWithUsername под общим тестовым
 * паролем одного из 3 реальных родителей.
 */
export async function loginParentByPhone(
  nationalDigits: string,
  code: string,
): Promise<PhoneLoginResult> {
  if (!/^\d{9}$/.test(nationalDigits)) {
    return { ok: false, error: "invalid_phone" };
  }
  if (!/^\d{4}$/.test(code)) {
    return { ok: false, error: "invalid_code" };
  }

  const account = resolveParentPhone(nationalDigits);
  if (!account) {
    return { ok: false, error: "not_found" };
  }

  const supabase = await createClient();
  const result = await signInWithUsername(supabase, account.username, PARENT_PHONE_PASSWORD);
  if (result.error || !result.data?.user || !result.data.session) {
    return { ok: false, error: "failed" };
  }
  if (result.role !== "parent") {
    await supabase.auth.signOut({ scope: "local" });
    return { ok: false, error: "failed" };
  }

  await registerSession({
    userId: result.data.user.id,
    accessToken: result.data.session.access_token,
  });

  (await cookies()).delete(DEMO_SESSION_COOKIE);

  return { ok: true, dest: "/parent/home" };
}
