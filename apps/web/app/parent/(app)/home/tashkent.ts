import { APP_TIME_ZONE } from "@snr/core";

/** ISO-таймстамп → YYYY-MM-DD по Ташкенту. Тот же приём, что уже
 *  используется веб-родителем (dashboard/page.tsx, старый) и мобилкой
 *  (apps/mobile-parent/src/lib/tashkent.ts) — не централизован в core. */
export function tashkentDateKey(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

export function tashkentToday(): string {
  return tashkentDateKey(new Date().toISOString());
}
