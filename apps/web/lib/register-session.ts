import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessionIdFromAccessToken } from "@/lib/single-session";

/**
 * Регистрирует новую single-session-строку в user_sessions (одна активная
 * сессия на аккаунт, все роли — миграция 110). Общий шаг после любого
 * успешного signIn (username/password, demo, телефон) — вынесено сюда из
 * app/actions/auth.ts, чтобы новый server action телефон-входа не дублировал
 * эту логику.
 */
export async function registerSession(opts: {
  userId: string;
  accessToken: string;
}): Promise<void> {
  const sessionId = sessionIdFromAccessToken(opts.accessToken);
  if (!sessionId) {
    throw new Error("single-session: access token has no session_id claim");
  }

  const admin = createAdminClient();

  const { error: deleteError } = await admin
    .from("user_sessions")
    .delete()
    .eq("user_id", opts.userId);
  if (deleteError) {
    throw new Error(`single-session: evict failed: ${deleteError.message}`);
  }

  const ua = (await headers()).get("user-agent");
  const { error: insertError } = await admin.from("user_sessions").insert({
    user_id: opts.userId,
    session_id: sessionId,
    device_info: ua ? ua.slice(0, 512) : null,
  });
  if (insertError) {
    throw new Error(`single-session: register failed: ${insertError.message}`);
  }
}
