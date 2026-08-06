import { APP_TIME_ZONE } from "@snr/core";
import { getAppNow } from "./appTime";

/**
 * Заход 2, шаг 4 — общий хелпер для ScheduleScreen/HomeScreen (тот же
 * Intl-механизм, что уже локально дублирует AttendanceScreen с Шага 3;
 * тут выносим один раз для двух НОВЫХ потребителей, не трогая уже
 * отгруженный AttendanceScreen.tsx).
 *
 * ISO-таймстамп → YYYY-MM-DD по Ташкенту. НЕ toISOString().slice(0,10) —
 * та берёт UTC-дату, что даёт неверный день рядом с полуночью (UTC+5).
 */
export function tashkentDateKey(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

export function tashkentToday(): string {
  return tashkentDateKey(getAppNow().toISOString());
}

/** Индекс дня недели (Пн=0..Вс=6) для YYYY-MM-DD — чистая календарная
 *  арифметика на уже вычисленных Y-M-D, TZ тут не участвует. */
export function weekdayIndex(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Вс..6=Сб
  return (jsDay + 6) % 7;
}

/** YYYY-MM-DD понедельника недели, содержащей dateKey. */
export function mondayOfWeek(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - weekdayIndex(dateKey));
  return date.toISOString().slice(0, 10);
}

/** dateKey + N дней (может быть отрицательным) → новый dateKey. */
export function addDays(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
