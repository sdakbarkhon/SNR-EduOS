import type { Dictionary } from "@snr/core";

const TZ = "Asia/Tashkent";

function isoDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Ключ дня (YYYY-MM-DD в Asia/Tashkent) — для группировки сообщений по дате. */
export function dayKey(iso: string): string {
  return isoDayKey(iso);
}

/** "Сегодня" / "Вчера" / "14 мая" (short=true → "14.05" для превью в списке тредов). */
export function dayLabel(iso: string, d: Dictionary, locale: string, short: boolean): string {
  const key = isoDayKey(iso);
  const todayKey = isoDayKey(new Date().toISOString());
  const yesterdayKey = isoDayKey(new Date(Date.now() - 86400000).toISOString());

  if (!short) {
    if (key === todayKey) return d.chat.today;
    if (key === yesterdayKey) return d.chat.yesterday;
  }

  const localeTag = locale === "ru" ? "ru-RU" : locale === "uz" ? "uz-UZ" : "en-US";
  return new Date(iso).toLocaleDateString(localeTag, short ? { day: "numeric", month: "numeric", timeZone: TZ } : { day: "numeric", month: "long", timeZone: TZ });
}
