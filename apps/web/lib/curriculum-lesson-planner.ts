// Подбор места в расписании под уроки из учебного плана.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. Раскладка по свободным слотам жила внутри роута
// «создать все уроки автоматически». Кнопка «Создать урок» рядом с одной темой
// делает ровно то же самое, только для одной темы, — и если бы она несла свою
// копию правил, через месяц одна кнопка ставила бы уроки в 09:00, а другая в
// 08:30, и никто бы не понял почему. Правила лежат здесь, оба вызывающих места
// берут их отсюда, второго способа не появляется.
//
// ПРАВИЛА ПЕРЕНЕСЕНЫ КАК БЫЛИ: 09:00, урок 45 минут, шаг 55 (45 + перемена 10),
// «Кабинет 101». Изменилось ровно одно и по необходимости — день начала: он
// был жёстко «1 августа 2026», а к 18 августа эта дата ушла в прошлое, из-за
// чего createLesson отверг бы любой такой урок. Теперь берётся позднее из
// «1 августа» и школьного сегодня, см. startDateFor. Демо-школе это ничего не
// меняет: она заморожена на 28 июля, для неё позднее — по-прежнему 1 августа.

import { getGroupLessonsInDateRange } from "@snr/core";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

/** С какого дня раскладывать. Дата начала учебного года — но только как
 *  НИЖНЯЯ граница: см. startDateFor ниже. */
export const AUTO_START_DATE = "2026-08-01";
export const SLOT_DURATION_MIN = 45;
export const ROOM = "Кабинет 101";

const SLOT_START_MIN = 9 * 60; // 09:00
const SLOT_STRIDE_MIN = 55; // урок 45 + перемена 10
const MAX_SLOTS_PER_DAY = 16; // 09:00 .. ~22:00, с большим запасом
/** Сколько дней подряд разрешено просматривать в поисках свободного места,
 *  прежде чем признать расписание забитым. */
const MAX_DAYS_SCANNED = 400;

export function addDaysUTC(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function tashkentDateOf(iso: string): string {
  const utcMs = new Date(iso).getTime();
  return new Date(utcMs + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type Busy = { starts_at: string; ends_at: string | null };

/** День, с которого начинается раскладка: позднее из «1 августа» и школьного
 *  сегодня.
 *
 *  ЗАЧЕМ. Дата 1 августа была вписана как константа, и пока она была впереди,
 *  всё работало. К 18 августа она ушла в прошлое — а createLesson отвергает
 *  урок в прошедшем времени. То есть кнопка «создать все автоматически» в
 *  настоящей школе гарантированно падала бы с «Нельзя создать урок в
 *  прошедшее время», и кнопка у отдельной темы падала бы так же.
 *
 *  Демо-школы это не касается и поведения ей не меняет: она живёт на
 *  замороженном 28 июля, для неё 1 августа по-прежнему впереди, и позднее из
 *  двух — то же самое 1 августа. */
function startDateFor(nowMs: number): string {
  const today = tashkentDateOf(new Date(nowMs).toISOString());
  return today > AUTO_START_DATE ? today : AUTO_START_DATE;
}

/** Первый свободный слот сетки на эту дату для этой группы, либо null если
 *  день занят целиком. */
function findFreeSlot(dayLessons: Busy[], date: string, nowMs: number): string | null {
  for (let n = 0; n < MAX_SLOTS_PER_DAY; n++) {
    const hhmm = minutesToHHMM(SLOT_START_MIN + n * SLOT_STRIDE_MIN);
    const candStartMs = new Date(`${date}T${hhmm}:00+05:00`).getTime();
    const candEndMs = candStartMs + SLOT_DURATION_MIN * 60 * 1000;
    // Сегодняшние утренние слоты могли уже пройти — урок в прошлом создать
    // нельзя, и предлагать такое место бессмысленно.
    if (candStartMs <= nowMs) continue;
    const overlaps = dayLessons.some((l) => {
      const ls = new Date(l.starts_at).getTime();
      const le = l.ends_at ? new Date(l.ends_at).getTime() : ls + SLOT_DURATION_MIN * 60 * 1000;
      return candStartMs < le && candEndMs > ls;
    });
    if (!overlaps) return hhmm;
  }
  return null;
}

export type PlannedSlot = { topicId: string; title: string; description: string | null; date: string; time: string };

/** Раскладывает темы по свободным местам: по одной в день, начиная с
 *  startDateFor(nowMs), пропуская занятые и уже прошедшие слоты этой группы.
 *
 *  Бросает с понятным текстом, если для какой-то темы места не нашлось —
 *  вызывающий превращает это в ответ пользователю. */
export async function planLessonSlots(
  db: AnyDb,
  groupId: string,
  topics: Array<{ id: string; title: string; description: string | null }>,
  /** Школьное «сейчас» — то же, что уходит в createLesson. Обязателен: без
   *  него раскладка предлагала бы прошедшие даты, а createLesson их отвергал. */
  nowMs: number,
): Promise<PlannedSlot[]> {
  if (topics.length === 0) return [];

  const startDate = startDateFor(nowMs);
  const rangeTo = addDaysUTC(startDate, topics.length + 30);
  const existing = await getGroupLessonsInDateRange(db, groupId, startDate, rangeTo);

  const byDate = new Map<string, Busy[]>();
  for (const l of existing) {
    const key = tashkentDateOf(l.starts_at);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(l);
  }

  const out: PlannedSlot[] = [];
  let cursorDate = startDate;
  for (const topic of topics) {
    let assigned = false;
    for (let guard = 0; guard < MAX_DAYS_SCANNED && !assigned; guard++) {
      const dayLessons = byDate.get(cursorDate) ?? [];
      const slot = findFreeSlot(dayLessons, cursorDate, nowMs);
      if (slot) {
        out.push({ topicId: topic.id, title: topic.title, description: topic.description, date: cursorDate, time: slot });
        // Занимаем слот сразу же, чтобы следующая тема не встала в тот же
        // промежуток.
        const startsAtMs = new Date(`${cursorDate}T${slot}:00+05:00`).getTime();
        byDate.set(cursorDate, [...dayLessons, {
          starts_at: new Date(startsAtMs).toISOString(),
          ends_at: new Date(startsAtMs + SLOT_DURATION_MIN * 60 * 1000).toISOString(),
        }]);
        cursorDate = addDaysUTC(cursorDate, 1);
        assigned = true;
      } else {
        cursorDate = addDaysUTC(cursorDate, 1);
      }
    }
    if (!assigned) {
      throw new Error(
        `Не удалось найти свободный слот для темы «${topic.title}» — расписание группы забито слишком плотно`,
      );
    }
  }
  return out;
}
