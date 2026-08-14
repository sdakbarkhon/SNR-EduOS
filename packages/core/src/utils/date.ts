/**
 * Школа в Узбекистане → все даты/время показываем в фиксированной таймзоне
 * Asia/Tashkent (UTC+5). Это КРИТИЧНО: сервер Vercel работает в UTC, клиент — в
 * локальной TZ. Без явного `timeZone` один и тот же таймстамп форматируется
 * по-разному на сервере и клиенте → hydration mismatch (React #418).
 */
export const APP_TIME_ZONE = "Asia/Tashkent";

/**
 * ISO-таймстамп → «YYYY-MM-DD» по Ташкенту.
 *
 * Ташкент — UTC+5 круглый год, без переходов, поэтому день считается сдвигом
 * на +5 часов и срезом ISO, а не через Intl: ключ дня обязан совпадать до
 * символа на сервере и на клиенте (по нему сходятся «сегодня» и «вчера»), а
 * наборы CLDR у них разные.
 */
export function tashkentDayKey(iso: string): string {
  return new Date(new Date(iso).getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

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
