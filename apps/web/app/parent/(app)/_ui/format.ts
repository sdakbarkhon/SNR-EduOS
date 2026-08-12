/**
 * Форматирование и производные UI-поля для экранов родителя.
 *
 * ЕДИНСТВЕННЫЙ форматчик дат веб-родителя. До 12.08.2026 их было три:
 * этот файл (руками сдвигал время на +5 и склеивал русские названия месяцев
 * из своей таблицы), `_study/util.ts` (Intl с прибитой константой RU) и
 * `home/tashkent.ts` (Intl с прибитым "ru-RU"). Из-за этого раздел показывал
 * русские даты на узбекском и английском. Теперь дата считается здесь и
 * только здесь; те два файла свои копии потеряли.
 *
 * ЯЗЫК приходит параметром `locale` — тем же, что и весь остальной текст
 * раздела (LocaleProvider → useLocale → getDictionary). Второго способа
 * определить язык нет:
 *  • названия месяцев, дни недели и «Сегодня/Вчера/Завтра» — из словаря
 *    `parentApp.date`, он уже переведён на три языка и уже используется
 *    мобилкой. Своих таблиц названий в коде нет ни одной;
 *  • порядок слов тоже из словаря (`patDayMonth` и соседи): ru «21 июля»,
 *    uz «21-iyul», en «July 21».
 *
 * ГДЕ ЭТО ВЫЗЫВАТЬ. Язык живёт в клиенте (localStorage → LocaleProvider),
 * поэтому дату собирает КЛИЕНТСКИЙ компонент: хук `useDates()` (../_ui/dates)
 * или компонент `<DateText/>` для серверных страниц. Серверные страницы
 * передают вниз сырой ISO/ключ дня, а не готовую строку.
 *
 * Часовой пояс — Asia/Tashkent (UTC+5, без переходов): считается сдвигом
 * на +5 часов, а не Intl-ом с `timeZone`. Сервер Vercel живёт в UTC, браузер —
 * в своей зоне, и любая строка обязана совпасть до символа, иначе гидратация
 * разойдётся (React #418).
 */

import { getDictionary, type Locale } from "@snr/core";

/** Asia/Tashkent = UTC+5 круглый год, без переходов на летнее время. */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Словарь дат текущего языка: дни недели, «Сегодня/Вчера/Завтра». */
function dateDict(locale: Locale) {
  return getDictionary(locale).parentApp.date;
}

/* ── Ключ дня ──────────────────────────────────────────────────────────── */

/**
 * ISO-таймстамп → «YYYY-MM-DD» по Ташкенту.
 *
 * Ташкент — UTC+5 круглый год, без переходов, поэтому день считается сдвигом
 * на +5 часов и срезом ISO. Через Intl это делать нельзя: браузер и сервер
 * подставляют разные наборы CLDR (см. ниже про uz), а ключ дня обязан
 * совпадать до символа — по нему сходятся «сегодня» и «вчера».
 */
export function tashkentDay(iso: string): string {
  return new Date(new Date(iso).getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Прежнее имя той же функции в `_study/util.ts` — оставлено как псевдоним,
 *  чтобы «учебные» экраны не переучивать на новое слово. */
export const tashkentDateKey = tashkentDay;

/** YYYY-MM-DD за день до переданного дня. */
export function previousDay(dayStr: string): string {
  const d = new Date(`${dayStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
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

/** Пн-первый индекс дня недели (0 = понедельник) для ключа «YYYY-MM-DD». */
export function weekdayIndexOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay(); // 0 = вс
  return (dow + 6) % 7;
}

/** Ключ дня «YYYY-MM-DD» → момент полудня по Ташкенту.
 *  Полдень, а не полночь: у полуночи любой сдвиг зоны меняет календарный день. */
function noonOfKey(key: string): Date {
  return new Date(`${key}T12:00:00+05:00`);
}

/* ── Время и даты ──────────────────────────────────────────────────────── */

/**
 * НАЗВАНИЯ МЕСЯЦЕВ БЕРУТСЯ ИЗ СЛОВАРЯ, А НЕ ИЗ Intl.
 *
 * Проверено живьём 12.08.2026: Chromium форматирует `uz-Latn-UZ` по корневому
 * CLDR и выдаёт «M07 29» вместо «29-iyul», тогда как Node с полным ICU даёт
 * правильную строку — то есть сервер и браузер ещё и разошлись бы между собой
 * (React #418). Поэтому все названия — из `parentApp.date`, а порядок слов —
 * из шаблонов того же словаря (`patDayMonth` и соседи): в ru «21 июля», в uz
 * «21-iyul», в en «July 21».
 *
 * Само время тоже не идёт через Intl: en-US отдал бы «02:32 PM», а колонка
 * времени в макете рассчитана на 5 знаков. Часы школы всюду 24-часовые.
 */

/** Момент времени, сдвинутый в Ташкент: с ним UTC-геттеры дают местные значения. */
function tashkent(iso: string): Date {
  return new Date(new Date(iso).getTime() + TASHKENT_OFFSET_MS);
}

function fill(pattern: string, vars: Record<string, string | number>): string {
  return pattern.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

/** HH:MM по Ташкенту, 24 часа — одинаково на всех языках. */
export function formatTime(iso: string): string {
  const d = tashkent(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Полная дата: ru «21 июля 2026», uz «21-iyul 2026», en «July 21, 2026». */
export function formatDateLong(iso: string, locale: Locale): string {
  const d = tashkent(iso);
  const dd = dateDict(locale);
  return fill(dd.patDayMonthYear, {
    d: d.getUTCDate(),
    month: dd.monthsGen[d.getUTCMonth()] ?? "",
    year: d.getUTCFullYear(),
  });
}

/** Короткая дата: ru «21 июл», uz «21-iyl», en «Jul 21». */
export function formatDateShort(iso: string, locale: Locale): string {
  const d = tashkent(iso);
  const dd = dateDict(locale);
  return fill(dd.patDayMonth, {
    d: d.getUTCDate(),
    month: dd.monthsShort[d.getUTCMonth()] ?? "",
  });
}

/** Дата с временем: ru «21 июля 2026, 14:32». */
export function formatDateTime(iso: string, locale: Locale): string {
  return `${formatDateLong(iso, locale)}, ${formatTime(iso)}`;
}

/** День и месяц без года из ключа «YYYY-MM-DD»: ru «21 июля», en «July 21». */
export function dayMonthOfKey(key: string, locale: Locale): string {
  const dd = dateDict(locale);
  return fill(dd.patDayMonth, {
    d: dayOfKey(key),
    month: dd.monthsGen[monthOfKey(key) - 1] ?? "",
  });
}

/** Месяц из ключа «YYYY-MM» или «YYYY-MM-DD», 1..12. */
function monthOfKey(key: string): number {
  return Number(key.slice(5, 7));
}

/** Заголовок календаря: ru «Июль 2026», uz «Iyul 2026», en «July 2026». */
export function monthYearLabel(year: number, month: number, locale: Locale): string {
  const dd = dateDict(locale);
  return fill(dd.patMonthYear, { month: dd.monthsNom[month - 1] ?? "", year });
}

/** Месяц отдельным словом: ru «Июль», uz «Iyul», en «July». */
export function monthName(month: number, locale: Locale): string {
  return dateDict(locale).monthsNom[month - 1] ?? "";
}

/** Короткий месяц для оси графика: ru «июл», uz «iyl», en «Jul». */
export function monthNameShort(month: number, locale: Locale): string {
  return dateDict(locale).monthsShort[month - 1] ?? "";
}

/** Месяц в форме для фразы «…чем в {month}»: в русском предложный падеж. */
export function monthNameIn(month: number, locale: Locale): string {
  return dateDict(locale).monthsIn[month - 1] ?? "";
}

/* ── Дни недели (из словаря, не из Intl) ───────────────────────────────── */

/**
 * Дни недели берём из `parentApp.date`, а не из Intl, по двум причинам:
 * они уже переведены на три языка и уже используются мобильным приложением
 * (второй источник правды тут был бы лишним), и написание в макете —
 * с заглавной («Пн», «Du»), а Intl отдаёт строчное («пн»).
 */
export function weekdayShort(index: number, locale: Locale): string {
  const d = dateDict(locale);
  return [d.mon, d.tue, d.wed, d.thu, d.fri, d.sat, d.sun][index] ?? "";
}

export function weekdayFull(index: number, locale: Locale): string {
  const d = dateDict(locale);
  return [d.monFull, d.tueFull, d.wedFull, d.thuFull, d.friFull, d.satFull, d.sunFull][index] ?? "";
}

/** Все семь коротких подписей подряд — лента дней в расписании и календаре. */
export function weekdaysShort(locale: Locale): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => weekdayShort(i, locale));
}

/* ── Относительные метки ───────────────────────────────────────────────── */

/** Метка времени в списках: сегодня → «14:32», вчера → «Вчера», иначе «21 июл.». */
export function relativeStamp(
  iso: string,
  todayStr: string,
  yesterdayStr: string,
  locale: Locale,
): string {
  const day = tashkentDay(iso);
  if (day === todayStr) return formatTime(iso);
  if (day === yesterdayStr) return dateDict(locale).yesterday;
  return formatDateShort(iso, locale);
}

/** «Сегодня, 23 июля» — разделитель дней в переписке. */
export function dayDivider(
  iso: string,
  todayStr: string,
  yesterdayStr: string,
  locale: Locale,
): string {
  const day = tashkentDay(iso);
  const dm = dayMonthOfKey(day, locale);
  const d = dateDict(locale);
  if (day === todayStr) return `${d.today}, ${dm}`;
  if (day === yesterdayStr) return `${d.yesterday}, ${dm}`;
  // Старая переписка подписывается полной датой — тем же шаблоном языка,
  // что и всё остальное, иначе в en терялась запятая («July 21 2026»).
  return formatDateLong(iso, locale);
}

/** Подпись дня по ключу: «Сегодня, 3 августа» / «Вчера, 2 августа» / «1 августа». */
export function dayLabelOfKey(
  key: string,
  todayStr: string,
  yesterdayStr: string,
  locale: Locale,
): string {
  const dm = dayMonthOfKey(key, locale);
  const d = dateDict(locale);
  if (key === todayStr) return `${d.today}, ${dm}`;
  if (key === yesterdayStr) return `${d.yesterday}, ${dm}`;
  return dm;
}

/**
 * «завтра» / «3 августа» относительно дня-«сегодня»; для самого сегодняшнего
 * дня — null: вызывающий сам решает, дописывать ли слово (на «Следующем
 * уроке» сегодняшний день не подписывается вовсе, как в макете).
 */
export function relativeDayOfKey(key: string, todayKey: string, locale: Locale): string | null {
  if (key === todayKey) return null;
  const diff = Math.round((noonOfKey(key).getTime() - noonOfKey(todayKey).getTime()) / 86400000);
  if (diff === 1) return dateDict(locale).tomorrow.toLowerCase();
  return dayMonthOfKey(key, locale);
}

/* ── Прочее (не даты) ──────────────────────────────────────────────────── */

/** Инициалы: «Исмаилов Шерзод» → «ИШ», односложное имя → одна буква. */
export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

/**
 * Первая буква ИМЕНИ — для крупных аватаров (в мобилке это было
 * `child.first_name.slice(0,1)`).
 *
 * В БД хранится одно поле `full_name` в порядке «Фамилия Имя [Отчество]»
 * («Исмаилов Шерзод»), поэтому имя — второе слово; если слово одно, берём его.
 */
export function givenNameLetter(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const given = parts[1] ?? parts[0] ?? "?";
  return (given[0] ?? "?").toUpperCase();
}

/**
 * Палитра аватаров макета. Цвет выбирается детерминированно по строке (id/ФИО),
 * а не случайно: у одного и того же человека аватар обязан совпадать между
 * рендерами сервера и клиента и между экранами.
 */
const AVATAR_GRADIENTS: readonly (readonly [string, string])[] = [
  ["#8b5cf6", "#6366f1"],
  ["#f472b6", "#db2777"],
  ["#38bdf8", "#0284c7"],
  ["#2dd4bf", "#0d9488"],
  ["#facc15", "#ca8a04"],
  ["#a78bfa", "#7c3aed"],
  ["#34d399", "#059669"],
  ["#fb923c", "#ea580c"],
];

export function avatarGradient(seed: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const idx = hash % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx] ?? AVATAR_GRADIENTS[0]!;
}

/** Кольцо вокруг аватара — первый стоп градиента. */
export function avatarRing(gradient: readonly [string, string]): string {
  return gradient[0];
}

/** Обрезка превью последнего сообщения до одной осмысленной строки. */
export function previewOf(body: string, max = 120): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
