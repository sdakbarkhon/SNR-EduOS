/**
 * Подписи дат для экранов на настоящих данных.
 *
 * Язык — тот же, что и весь остальной текст: `LOCALE_TAG[locale]` из
 * `@snr/core` (так уже считают расписание, посещаемость и домашние задания).
 * Часовой пояс задаётся явно: сервер отдаёт момент в UTC, устройство живёт в
 * своей зоне, а школа — в Ташкенте, и день обязан считаться по школе.
 *
 * Ключ дня («YYYY-MM-DD») — не момент времени, а уже посчитанная дата.
 * Поэтому он привязывается к полудню Ташкента: любое смещение внутри суток
 * тогда безопасно, и подпись не съезжает на соседний день.
 */
import { getAppNowMs } from "./appTime";
import { APP_TIME_ZONE } from "@snr/core";

const TZ = { timeZone: APP_TIME_ZONE } as const;

/** «YYYY-MM-DD» → момент, однозначно попадающий в этот ташкентский день. */
function noonOf(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00+05:00`);
}

/** «29 июля» / «29-iyul» / «July 29». */
export function dayMonth(dateKey: string, localeTag: string): string {
  return noonOf(dateKey).toLocaleDateString(localeTag, { day: "numeric", month: "long", ...TZ });
}

/** «Среда, 29 июля». */
export function weekdayDayMonth(dateKey: string, localeTag: string): string {
  return noonOf(dateKey).toLocaleDateString(localeTag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...TZ,
  });
}

/** «29 июля 2026» — для карточек объявлений и новостей. */
export function fullDate(iso: string, localeTag: string): string {
  return new Date(iso).toLocaleDateString(localeTag, {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...TZ,
  });
}

/**
 * Отметка времени в списке: сегодня — часы и минуты, вчера — слово «Вчера»,
 * раньше — дата. Так уведомление, пришедшее час назад, читается временем, а
 * недельной давности — днём.
 */
export function stamp(
  iso: string,
  todayKey: string,
  yesterdayKey: string,
  localeTag: string,
  yesterdayWord: string,
): string {
  const dayKey = new Date(new Date(iso).getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (dayKey === todayKey) {
    return new Date(iso).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit", ...TZ });
  }
  if (dayKey === yesterdayKey) return yesterdayWord;
  return dayMonth(dayKey, localeTag);
}

/** «#7C3AED» → «124,58,237» — для rgba-теней и цветных подложек. */
export function hexToRgbCsv(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/**
 * «Май 2026» — подпись без числа, для достижений и сертификатов: там важен
 * месяц, а не день. Ключ — «YYYY-MM»; привязывается к 15-му числу, чтобы
 * никакое смещение внутри месяца не увело подпись на соседний.
 */
export function monthYear(monthKey: string, localeTag: string): string {
  return new Date(`${monthKey}-15T12:00:00+05:00`).toLocaleDateString(localeTag, {
    month: "long",
    year: "numeric",
    ...TZ,
  });
}

/**
 * Ключ дня «YYYY-MM-DD» по школьному времени со сдвигом назад.
 *
 * 23.08.2026: заходы 1–2 оставили в демо две подписи дней, собранные руками —
 * «21 ИЮЛЯ» в операциях кошелька и отдельный список дат в покупках питания.
 * Из-за этого одна и та же покупка показывалась в двух разделах разными
 * днями. Теперь обе стороны считают день отсюда, от школьного «сегодня».
 */
export function schoolDayKey(daysAgo = 0): string {
  const at = new Date(getAppNowMs() - daysAgo * 86400000);
  return new Intl.DateTimeFormat("en-CA", { ...TZ }).format(at);
}
