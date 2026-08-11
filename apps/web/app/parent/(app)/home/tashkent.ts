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

/**
 * Z.3, заход 2 — «сейчас» приходит параметром. Файл чисто вычислительный,
 * клиента базы не видит, а школа известна только вызывающей странице.
 * Вызывающих у этой функции сейчас нет; сигнатура приведена к остальным,
 * чтобы при первом же использовании школа не потерялась.
 */
export function tashkentToday(nowMs: number): string {
  return tashkentDateKey(new Date(nowMs).toISOString());
}

/** ISO-таймстамп → «10:20» по Ташкенту. */
export function tashkentTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** YYYY-MM-DD → «3 августа» (без года). */
export function tashkentDayLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "long",
  }).format(new Date(`${dateKey}T12:00:00+05:00`));
}

/**
 * Человеческая подпись дня относительно «сегодня» демо-сессии:
 * «сегодня» / «завтра» / «3 августа». Возвращает null для сегодняшнего дня —
 * вызывающий сам решает, дописывать ли слово (на «Следующем уроке» сегодняшний
 * день не подписывается вовсе, как в макете).
 */
export function tashkentRelativeDayLabel(dateKey: string, todayKey: string): string | null {
  if (dateKey === todayKey) return null;
  const dayMs = 86400000;
  const diff = Math.round(
    (new Date(`${dateKey}T12:00:00+05:00`).getTime() - new Date(`${todayKey}T12:00:00+05:00`).getTime()) / dayMs,
  );
  if (diff === 1) return "завтра";
  return tashkentDayLabel(dateKey);
}
