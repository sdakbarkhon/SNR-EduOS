/**
 * Блок 7.2 — чистые хелперы «учебных» экранов веб-родителя
 * (schedule / homework / attendance / subject / subjects / day).
 *
 * Папка `_study` начинается с подчёркивания → Next.js App Router считает её
 * ПРИВАТНОЙ и не делает из неё маршрут. Здесь живёт только то, что реально
 * общее у нескольких моих экранов; всё, что уже есть в ../v2 (токены,
 * GlassCard, RootHeader, каркас), не дублируется.
 *
 * Даты: школа в Ташкенте (UTC+5). Любое форматирование — с ЯВНЫМ timeZone,
 * иначе сервер (UTC на Vercel) и браузер дают разные строки → hydration
 * mismatch (React #418, уже ловили на /schedule ученика). По той же причине
 * ключ дня НЕЛЬЗЯ получать через toISOString().slice(0,10) — та берёт UTC.
 */

import { APP_TIME_ZONE } from "@snr/core";

/** ru-локаль всего веб-родителя (переводы v2 пока только русские). */
export const RU = "ru-RU";

/** ISO-таймстамп → «YYYY-MM-DD» в Ташкенте (en-CA даёт ровно этот формат). */
export function tashkentDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** «YYYY-MM-DD» + n дней. Чистая календарная арифметика на UTC-полночь —
 *  таймзона тут не участвует (это уже вычисленная дата, а не момент). */
export function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const base = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  base.setUTCDate(base.getUTCDate() + n);
  return base.toISOString().slice(0, 10);
}

/** День месяца из ключа «YYYY-MM-DD». */
export function dayOfKey(key: string): number {
  return Number(key.slice(8, 10));
}

/** «2026-07-30» → «30 июля». */
export function ruDayMonth(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString(RU, {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** «Июль 2026» — заголовок календаря. */
export function ruMonthYear(year: number, month: number): string {
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(RU, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Пн-первый индекс дня недели (0 = понедельник) для ключа «YYYY-MM-DD». */
export function weekdayIndexOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay(); // 0 = Вс
  return (dow + 6) % 7;
}

export const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
export const WEEKDAY_FULL = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
] as const;

/** «#ca8a04» → «202,138,4» для rgba()-теней и chip()-фонов. Тот же локальный
 *  приём, что в RN-экранах (ScheduleScreen/HomeworksScreen). */
export function hexToRgbCsv(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return "99,102,241"; // индиго-фолбэк, как в мобилке
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** Цвет предмета из БД или общий индиго-фолбэк (subjects.color бывает NULL). */
export const SUBJECT_FALLBACK_COLOR = "#6366F1";

export function subjectColor(color: string | null | undefined): string {
  return color && color.startsWith("#") ? color : SUBJECT_FALLBACK_COLOR;
}

/** Градиент плитки предмета: 135°, светлый стоп — тот же цвет прозрачнее.
 *  В макете у каждого предмета своя пара стопов, но в БД цвет ОДИН, поэтому
 *  вторую точку выводим из первой, а не выдумываем палитру. */
export function subjectGradientCss(color: string | null | undefined): string {
  const base = subjectColor(color);
  return `linear-gradient(135deg, ${base}E6, ${base})`;
}

/** Глиф плитки: 2 первые буквы названия предмета (приём мобилки для
 *  реальных данных — фикстурных «√x»/«Aa» в БД нет). */
export function subjectGlyph(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  return n ? n.slice(0, 2).toUpperCase() : "—";
}

/** «12.4 МБ» / «312 КБ» — размер вложения. */
export function fileSizeLabel(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/** Расширение файла заглавными для плитки вложения. */
export function fileExtLabel(filename: string | null): string {
  const dot = (filename ?? "").lastIndexOf(".");
  if (dot < 0) return "FILE";
  return (filename ?? "").slice(dot + 1).toUpperCase().slice(0, 4);
}

/** Инициалы ФИО для аватара учителя. */
export function initials(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "—";
}
