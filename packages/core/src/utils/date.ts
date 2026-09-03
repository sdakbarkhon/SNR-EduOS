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
export function tashkentDayKey(value: DateLike): string {
  return shifted(value).toISOString().slice(0, 10);
}

/**
 * ЕДИНЫЙ РАЗБОР ДАТЫ ПО ТАШКЕНТУ. 26.08.2026.
 *
 * БЕДА, КОТОРУЮ ЛЕЧИМ. Момент времени по всему продукту брался верно — через
 * школьное «сейчас». Ломался РАЗБОР: `getFullYear()`, `getMonth()`,
 * `getDate()`, `getDay()` читают дату в поясе среды, а на Vercel это UTC.
 * Каждые сутки с 00:00 до 05:00 по Ташкенту сервер отдавал вчерашний день, а
 * на границе месяца — прошлый месяц. Учитель, открывший расписание в 01:00
 * первого сентября, запрашивал уроки за АВГУСТ и видел пустой список.
 * В демо-школе не было видно из-за заморозки на 29.07, полдень.
 *
 * ПОЧЕМУ СМЕЩЕНИЕ, А НЕ Intl. Ташкент — UTC+5 круглый год, без переходов на
 * летнее время. Сдвиг на пять часов и чтение через `getUTC*` даёт результат,
 * совпадающий до символа на сервере и в браузере, а наборы CLDR у них разные
 * (отсюда рассинхрон разметки, React #418).
 *
 * ПОЧЕМУ ВСЁ ЗДЕСЬ, А НЕ ПО МЕСТУ. На 26.08 смещение «плюс пять часов» было
 * переписано руками в ВОСЕМНАДЦАТИ местах: семь объявлений `TZ_MS` и четыре
 * собственные функции ключа дня. Это ровно та болезнь, что уже разошлась на
 * среднем балле — четыре экрана про одну группу показывали четыре числа.
 * Шестнадцатую копию не заводить: если помощнику чего-то не хватает, дописать
 * надо ЕГО.
 */

/** Смещение Ташкента. Единственное место в продукте, где оно записано. */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Момент времени в любом виде, в каком он приходит на вызове. */
export type DateLike = string | number | Date;

function toMs(value: DateLike): number {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  return new Date(value).getTime();
}

/** Момент, сдвинутый на +5 часов: дальше читается через getUTC*. */
function shifted(value: DateLike): Date {
  return new Date(toMs(value) + TASHKENT_OFFSET_MS);
}

/**
 * Время суток по Ташкенту, «09:05». 04.09.2026.
 *
 * Считается тем же сдвигом, что и ключ дня, а не через Intl — по той же
 * причине: строка обязана совпадать до символа на сервере и на клиенте, и не
 * зависеть от языка интерфейса. По ней не только подписывают урок, но и
 * складывают колонки недельной сетки — «9:00 AM» сломал бы сортировку.
 */
export function tashkentTimeHm(value: DateLike): string {
  return shifted(value).toISOString().slice(11, 16);
}

/** Год, месяц (1–12) и число по Ташкенту. */
export function tashkentParts(value: DateLike): { year: number; month: number; day: number } {
  const d = shifted(value);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Ключ месяца по Ташкенту: «YYYY-MM». */
export function tashkentMonthKey(value: DateLike): string {
  return shifted(value).toISOString().slice(0, 7);
}

/**
 * День недели по Ташкенту. Возвращает то же, что `Date.getDay()`:
 * 0 — воскресенье, 1 — понедельник … 6 — суббота. Нумерация оставлена
 * привычной намеренно: календарные сетки на экранах уже считают отступы от
 * неё, и менять их арифметику заодно с поясом — лишний риск.
 */
export function tashkentWeekday(value: DateLike): number {
  return shifted(value).getUTCDay();
}

/** Час суток по Ташкенту, 0–23. */
export function tashkentHour(value: DateLike): number {
  return shifted(value).getUTCHours();
}

/** Один ли это день по Ташкенту. */
export function isSameTashkentDay(a: DateLike, b: DateLike): boolean {
  return tashkentDayKey(a) === tashkentDayKey(b);
}

/** Понедельник недели, в которую попадает момент. «YYYY-MM-DD» по Ташкенту. */
export function tashkentWeekMonday(value: DateLike): string {
  const d = shifted(value);
  const dow = d.getUTCDay(); // 0 — воскресенье
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

/** Номер дня в году по Ташкенту, 1–366. */
export function tashkentDayOfYear(value: DateLike): number {
  const d = shifted(value);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86_400_000) + 1;
}

/** Границы ташкентского месяца в UTC (month — 1-based). */
export function tashkentMonthBoundsUtc(year: number, month: number): { startIso: string; endIso: string } {
  const start = Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - TASHKENT_OFFSET_MS;
  const end = Date.UTC(year, month, 0, 23, 59, 59, 999) - TASHKENT_OFFSET_MS;
  return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };
}

/**
 * Границы ташкентских суток, выраженные в UTC — для запросов по `starts_at`.
 * Возвращает ISO-строки, готовые для `.gte()` / `.lte()`.
 */
export function tashkentDayBoundsUtc(value: DateLike): { startIso: string; endIso: string } {
  const { year, month, day } = tashkentParts(value);
  const start = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - TASHKENT_OFFSET_MS;
  const end = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - TASHKENT_OFFSET_MS;
  return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };
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
