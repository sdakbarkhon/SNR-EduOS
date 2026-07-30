/**
 * Форматирование и производные UI-поля для экранов родителя.
 *
 * Всё считается ОДИН раз на сервере и уезжает в клиентские компоненты уже
 * строками: `new Date()` на клиенте дал бы другой результат, чем на сервере
 * (часовой пояс браузера + замороженная демо-дата), и React ругался бы на
 * рассинхрон гидратации.
 *
 * Часовой пояс — Asia/Tashkent = UTC+5 без переходов на летнее время, тот же
 * приём, что в `lib/parent-queries.ts` (parentToday / parentWeekMonday).
 */

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
] as const;

const MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
] as const;

/** Момент времени, сдвинутый в Ташкент: с ним UTC-геттеры дают местные значения. */
function tashkent(iso: string): Date {
  return new Date(new Date(iso).getTime() + TASHKENT_OFFSET_MS);
}

/** YYYY-MM-DD по Ташкенту. */
export function tashkentDay(iso: string): string {
  return tashkent(iso).toISOString().slice(0, 10);
}

/** HH:MM по Ташкенту. */
export function formatTime(iso: string): string {
  const d = tashkent(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** «21 июля 2026». */
export function formatDateLong(iso: string): string {
  const d = tashkent(iso);
  return `${d.getUTCDate()} ${MONTHS_GEN[d.getUTCMonth()] ?? ""} ${d.getUTCFullYear()}`;
}

/** «21 июл». */
export function formatDateShort(iso: string): string {
  const d = tashkent(iso);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()] ?? ""}`;
}

/** Метка времени в списках: сегодня → «14:32», вчера → «Вчера», иначе «21 июл». */
export function relativeStamp(iso: string, todayStr: string, yesterdayStr: string): string {
  const day = tashkentDay(iso);
  if (day === todayStr) return formatTime(iso);
  if (day === yesterdayStr) return "Вчера";
  return formatDateShort(iso);
}

/** YYYY-MM-DD за день до переданного дня. */
export function previousDay(dayStr: string): string {
  const d = new Date(`${dayStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** «Сегодня, 23 июля» — разделитель дней в переписке. */
export function dayDivider(iso: string, todayStr: string, yesterdayStr: string): string {
  const day = tashkentDay(iso);
  const d = tashkent(iso);
  const dm = `${d.getUTCDate()} ${MONTHS_GEN[d.getUTCMonth()] ?? ""}`;
  if (day === todayStr) return `Сегодня, ${dm}`;
  if (day === yesterdayStr) return `Вчера, ${dm}`;
  return `${dm} ${d.getUTCFullYear()}`;
}

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
