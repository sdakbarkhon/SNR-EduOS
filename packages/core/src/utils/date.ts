/** Время урока: "09:00". */
export function formatTime(iso: string, locale = "ru-RU"): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Дата: "14 мая". */
export function formatDate(iso: string, locale = "ru-RU"): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
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
