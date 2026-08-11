// P2: мобильные вызовы /api/demo/* — вне webApi.ts, потому что демо-сессия
// заводится ДО входа в Supabase (у webApi обязательный Bearer).
//
// 11.08.2026 — отсюда удалены claimDemoSlot() и DemoClaimResult: публичный
// endpoint /api/demo/claim закрыт (он отдавал e-mail и пароль демо-аккаунта
// кому угодно без авторизации), а вызывающих мест у функции в мобильном
// приложении не было ни одного. heartbeatDemoSlot/releaseDemoSlot остаются —
// они живые и их endpoint'ы на месте.

import Constants from "expo-constants";

type ExpoExtra = { webApiBaseUrl?: string };

function baseUrl(): string {
  const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;
  if (!extra?.webApiBaseUrl) throw new Error("webApiBaseUrl отсутствует (app.json expo.extra)");
  return extra.webApiBaseUrl;
}

export async function heartbeatDemoSlot(sessionToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl()}/api/demo/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: sessionToken }),
    });
    const json = (await res.json().catch(() => ({}))) as { active?: boolean };
    return json.active === true;
  } catch {
    return false;
  }
}

export async function releaseDemoSlot(sessionToken: string): Promise<void> {
  try {
    await fetch(`${baseUrl()}/api/demo/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: sessionToken }),
    });
  } catch {
    // best-effort: если release не прошёл — sweep протухнет через 15 мин
  }
}
