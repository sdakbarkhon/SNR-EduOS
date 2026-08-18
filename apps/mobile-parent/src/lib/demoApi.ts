// P2: мобильные вызовы /api/demo/* — вне webApi.ts, потому что демо-сессия
// заводится ДО входа в Supabase (у webApi обязательный Bearer).
//
// 11.08.2026 — отсюда были удалены claimDemoSlot() и DemoClaimResult: публичный
// endpoint /api/demo/claim отдавал e-mail и ПАРОЛЬ демо-аккаунта кому угодно без
// авторизации.
//
// 18.08.2026 — демо-вход вернулся, но по-другому. Новый /api/demo/claim-parent
// входит НА СЕРВЕРЕ и отдаёт готовую пару токенов, а не пароль: токен живёт час
// и привязан к этой аренде, пароль же давал бы бессрочный доступ любому, кто
// прочитал ответ. Слот берётся той же функцией claim_demo_slot, что и кнопка
// «Демо» в браузере, — второго механизма не появилось.

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

export type DemoParentSession = {
  access_token: string;
  refresh_token: string;
  /** Ключ аренды — уходит в heartbeat и release. */
  session_token: string;
};

/** Взять демо-слот родителя и получить готовую сессию.
 *
 *  Возвращает null, если свободных слотов нет или демо не настроено —
 *  вызывающий показывает это словами, а не молчанием. */
export async function claimDemoParent(): Promise<DemoParentSession | { error: string } | null> {
  try {
    const res = await fetch(`${baseUrl()}/api/demo/claim-parent`, { method: "POST" });
    const json = (await res.json().catch(() => ({}))) as Partial<DemoParentSession> & { error?: string };
    if (!res.ok || !json.access_token || !json.refresh_token || !json.session_token) {
      return json.error ? { error: json.error } : null;
    }
    return {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      session_token: json.session_token,
    };
  } catch {
    return null;
  }
}
