/**
 * Школа в Узбекистане → все даты/время показываем в фиксированной таймзоне
 * Asia/Tashkent (UTC+5). Это КРИТИЧНО: сервер Vercel работает в UTC, клиент — в
 * локальной TZ. Без явного `timeZone` один и тот же таймстамп форматируется
 * по-разному на сервере и клиенте → hydration mismatch (React #418).
 */
export const APP_TIME_ZONE = "Asia/Tashkent";

/** Время урока: "09:00". */
export function formatTime(iso: string, locale = "ru-RU"): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  });
}

/** Дата: "14 мая". */
export function formatDate(iso: string, locale = "ru-RU"): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    timeZone: APP_TIME_ZONE,
  });
}

/** Дата+время: "14 мая, 09:00". */
export function formatDateTime(iso: string, locale = "ru-RU"): string {
  return `${formatDate(iso, locale)}, ${formatTime(iso, locale)}`;
}

/** true, если дедлайн в прошлом. */
export function isOverdue(dueIso: string | null): boolean {
  if (!dueIso) return false;
  return new Date(dueIso).getTime() < Date.now();
}
