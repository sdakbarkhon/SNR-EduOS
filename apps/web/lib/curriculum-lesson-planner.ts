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

// ─────────────────────────────────────────────────────────────────────────────
// МАССОВОЕ СОЗДАНИЕ: правило «эти дни недели, это время, с такого числа по
// такое».
//
// ПОЧЕМУ ЗДЕСЬ, А НЕ В НОВОМ ФАЙЛЕ. Раскладка одна, поводов для неё два:
// «разложи темы плана сам» (planLessonSlots выше) и «разложи по моему
// расписанию» (planWeeklySchedule ниже). Общего у них всё, кроме способа
// выбрать дату и время: длительность урока, кабинет, запрет ставить урок в
// прошлом, правило «не наезжать на существующий урок группы», перевод дат в
// ташкентское время. Разнеси их по двум файлам — и через месяц один способ
// будет ставить 45 минут, а другой 40.
// ─────────────────────────────────────────────────────────────────────────────

/** Дни недели по ISO: 1 — понедельник, 7 — воскресенье. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** День недели даты. Считается от календарной даты, а не от момента времени:
 *  у «2026-09-01» день недели один и тот же в любом часовом поясе. */
export function weekdayOf(dateStr: string): Weekday {
  const [y, m, d] = dateStr.split("-").map(Number);
  const js = new Date(Date.UTC(y!, (m ?? 1) - 1, d)).getUTCDay(); // 0 — вс
  return (js === 0 ? 7 : js) as Weekday;
}

export type PlannedLesson = {
  date: string;
  time: string;
  /** Урок на это место уже есть — создавать не будем. Строка всё равно
   *  попадает в предпросмотр: учитель должен видеть, что пропущено и почему,
   *  а не гадать, почему уроков вышло меньше, чем дней. */
  occupied: boolean;
  /** Тема из плана. null — тем не хватило либо учитель их не просил. */
  topicId: string | null;
  topicTitle: string | null;
  topicDescription: string | null;
};

export type WeeklyPlanInput = {
  weekdays: Weekday[];
  /** «HH:MM» по Ташкенту. */
  time: string;
  /** Обе границы включительно, «YYYY-MM-DD». */
  from: string;
  to: string;
  durationMinutes?: number;
};

/** Сколько дней подряд разрешено раскладывать. Год с запасом: больше учебного
 *  года за один заход не задают, а бесконечный цикл при кривых датах не нужен. */
const MAX_PERIOD_DAYS = 400;

/**
 * Раскладывает период по правилу «эти дни недели в это время».
 *
 * Что делает и чего НЕ делает:
 *   • пропускает даты вне периода и не те дни недели;
 *   • отмечает occupied там, где у группы уже есть урок, накрывающий это время
 *     (то же правило пересечения, что и у автоматической раскладки выше) —
 *     поэтому повторный запуск того же периода не создаёт ничего;
 *   • молча выбрасывает даты в прошлом: система такие уроки всё равно
 *     отвергает, и показывать их в предпросмотре значило бы обещать
 *     несбыточное;
 *   • тем не назначает — это делает вызывающий, потому что «какие темы
 *     свободны» знает он.
 */
export async function planWeeklySchedule(
  db: AnyDb,
  groupId: string,
  input: WeeklyPlanInput,
  /** Школьное «сейчас» — то же, что уходит в createLesson. */
  nowMs: number,
): Promise<PlannedLesson[]> {
  if (input.weekdays.length === 0) return [];
  if (input.to < input.from) return [];

  const dur = input.durationMinutes ?? SLOT_DURATION_MIN;
  const existing = await getGroupLessonsInDateRange(db, groupId, input.from, input.to);

  const byDate = new Map<string, Busy[]>();
  for (const l of existing) {
    const key = tashkentDateOf(l.starts_at);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(l);
  }

  const wanted = new Set<Weekday>(input.weekdays);
  const out: PlannedLesson[] = [];

  let cursor = input.from;
  for (let guard = 0; guard < MAX_PERIOD_DAYS && cursor <= input.to; guard++) {
    if (wanted.has(weekdayOf(cursor))) {
      const startMs = new Date(`${cursor}T${input.time}:00+05:00`).getTime();
      const endMs = startMs + dur * 60 * 1000;

      // Прошедшее время: createLesson такой урок отвергает, а триггер на
      // таблице — тем более. Не показываем и не считаем.
      if (startMs > nowMs) {
        const dayLessons = byDate.get(cursor) ?? [];
        const occupied = dayLessons.some((l) => {
          const ls = new Date(l.starts_at).getTime();
          const le = l.ends_at ? new Date(l.ends_at).getTime() : ls + dur * 60 * 1000;
          return startMs < le && endMs > ls;
        });
        out.push({
          date: cursor, time: input.time, occupied,
          topicId: null, topicTitle: null, topicDescription: null,
        });
      }
    }
    cursor = addDaysUTC(cursor, 1);
  }

  return out;
}

/**
 * Раскладывает темы по свободным местам ПО ПОРЯДКУ.
 *
 * Занятые места тем не получают: урок там уже есть, у него своя тема, и
 * тратить на него следующую по списку значило бы её потерять.
 *
 * Возвращает те же уроки плюс счётчики для предупреждений: сколько уроков
 * останется без темы и сколько тем не поместилось в период.
 */
export function assignTopicsInOrder(
  lessons: PlannedLesson[],
  topics: Array<{ id: string; title: string; description: string | null }>,
): { lessons: PlannedLesson[]; lessonsWithoutTopic: number; topicsLeftOver: number } {
  const free = lessons.filter((l) => !l.occupied);
  let i = 0;
  const result = lessons.map((l) => {
    if (l.occupied) return l;
    const t = topics[i];
    i += 1;
    return t
      ? { ...l, topicId: t.id, topicTitle: t.title, topicDescription: t.description }
      : l;
  });
  return {
    lessons: result,
    lessonsWithoutTopic: Math.max(0, free.length - topics.length),
    topicsLeftOver: Math.max(0, topics.length - free.length),
  };
}
