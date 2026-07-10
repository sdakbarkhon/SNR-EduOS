// Single-session (PROMT 3): общие константы/хелперы для server actions,
// middleware и клиентского useIsDemoSession. Файл без server-only зависимостей —
// импортируется и из Edge middleware, и из клиентских компонентов.

/**
 * Кука демо-сессии. НЕ httpOnly сознательно: клиентский хук useIsDemoSession()
 * читает её для UI-ограничений (disabled-кнопки на реальных записях). Это не
 * секрет и не граница безопасности — подделка куки меняет только вид кнопок,
 * жёсткий запрет живёт в БД (триггер fn_stamp_is_demo, ошибка
 * editing_real_data_in_demo).
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
