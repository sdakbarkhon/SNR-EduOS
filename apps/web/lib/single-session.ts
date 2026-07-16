// Single-session (PROMT 3) + P2 демо-lease: общие константы/хелперы.
// Файл без server-only зависимостей — импортируется и из Edge middleware,
// и из клиентских компонентов.

/**
 * Кука демо-сессии. Значение — session_token от RPC claim_demo_slot
 * (миграция 133), используется для heartbeat / release / определения
 * «сейчас в демо». НЕ httpOnly сознательно: клиентский хук
 * useIsDemoSession() читает её для рендера баннера. В P2 запись реальных
 * данных из демо-сессии больше не блокируется (триггер fn_stamp_is_demo
 * снят миграцией 132) — демо-режим ≡ вход в реальный аккаунт + баннер.
 */
export const DEMO_SESSION_COOKIE = "snr-demo-session";

/**
 * session_id-claim из Supabase access-токена (стабилен при refresh — им
 * идентифицируется "устройство" в user_sessions). atob вместо Buffer, чтобы
 * работало в Edge-runtime middleware.
 */
export function sessionIdFromAccessToken(accessToken: string): string | null {
  try {
    const part = accessToken.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64)) as { session_id?: string };
    return payload.session_id ?? null;
  } catch {
    return null;
  }
}
