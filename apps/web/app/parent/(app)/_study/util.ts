/**
 * Блок 7.2 — чистые хелперы «учебных» экранов веб-родителя
 * (schedule / homework / attendance / subject / subjects / day).
 *
 * Папка `_study` начинается с подчёркивания → Next.js App Router считает её
 * ПРИВАТНОЙ и не делает из неё маршрут. Здесь живёт только то, что реально
 * общее у нескольких моих экранов; всё, что уже есть в ../v2 (токены,
 * GlassCard, RootHeader, каркас), не дублируется.
 *
 * ДАТ ЗДЕСЬ БОЛЬШЕ НЕТ. 12.08.2026 отсюда убраны `RU`, `tashkentDateKey`,
 * `addDaysKey`, `dayOfKey`, `weekdayIndexOfKey`, `ruDayMonth`, `ruMonthYear`,
 * `WEEKDAY_SHORT`, `WEEKDAY_FULL`: это была вторая копия форматирования, и
 * именно она печатала русские месяцы и «Пн» на узбекском и английском.
 * Всё перечисленное живёт в `../_ui/format.ts` (чистые функции с параметром
 * языка) и `../_ui/dates.tsx` (доставка языка). Оттуда и импортируйте.
 */

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
