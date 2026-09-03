// Подбор места в расписании под уроки из учебного плана.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. Раскладка по свободным слотам жила внутри роута
// «создать все уроки автоматически». Кнопка «Создать урок» рядом с одной темой
// делает ровно то же самое, только для одной темы, — и если бы она несла свою
// копию правил, через месяц одна кнопка ставила бы уроки в 09:00, а другая в
// 08:30, и никто бы не понял почему. Правила лежат здесь, оба вызывающих места
// берут их отсюда, второго способа не появляется.
//
// ПРАВИЛА ПЕРЕНЕСЕНЫ КАК БЫЛИ: 09:00, шаг 55 (45 + перемена 10).
// Позже изменились три вещи, и каждая по делу: кабинет перестали выдумывать
// (см. ROOM ниже), длительность уехала к школе (миграция 246), а день начала
// перестал быть константой — его выбирает учитель и передаёт доводом
// startDate (02.09.2026, пункт 13).

import { getGroupLessonsInDateRange, tashkentDayKey } from "@snr/core";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

/**
 * ДАТЫ НАЧАЛА ЗДЕСЬ БОЛЬШЕ НЕТ (02.09.2026, пункт 13).
 *
 * Стояла `export const AUTO_START_DATE = "2026-08-01"` — жёсткая дата начала
 * учебного года. Пока она была впереди, всё работало; к 18 августа она ушла в
 * прошлое, и раскладку пришлось подпирать функцией `startDateFor`, бравшей
 * позднее из константы и школьного сегодня. Обе ушли: с какого дня
 * раскладывать, теперь решает учитель, и дата приходит доводом `startDate`.
 */

/**
 * ДЛИТЕЛЬНОСТИ УРОКА ЗДЕСЬ БОЛЬШЕ НЕТ (01.09.2026, миграция 246).
 *
 * Стояла `export const SLOT_DURATION_MIN = 45`, и это был третий источник
 * одного числа — рядом с полем в форме урока и полем в окне массового
 * создания. Теперь число одно и лежит у школы
 * (`schools.lesson_duration_minutes`); раскладка получает его доводом
 * `durationMinutes`, а вызывающие роуты читают его через
 * `getLessonDurationForGroup` из общего слоя.
 *
 * Довод сделан ОБЯЗАТЕЛЬНЫМ, без умолчания: со значением по умолчанию любой
 * новый вызывающий молча вернул бы сюда сорок пять, и разошлись бы снова.
 */

/**
 * КАБИНЕТА У НАС НЕТ, И ВЫДУМЫВАТЬ ЕГО БОЛЬШЕ НЕ БУДЕМ (20.08.2026).
 *
 * Здесь стояло `export const ROOM = "Кабинет 101"`, и все уроки, созданные из
 * учебного плана, получали этот кабинет — 126 уроков из 128 в базе именно с
 * ним. Взять настоящий номер неоткуда: колонки кабинета нет ни у группы, ни у
 * школы, ни у предмета, ни в учебном плане — во всей схеме кабинет живёт
 * только в самом уроке (lessons.room).
 *
 * Пустое значение честнее выдуманного: колонка допускает NULL, а каждый экран
 * рисует кабинет через проверку `lesson.room && …`, поэтому при пустом поле
 * строка просто не показывается — ни «undefined», ни обрубка «Каб. ».
 *
 * Заодно уходит вторая беда: экраны сами подписывают «Каб.» или «Кабинет»,
 * поэтому «Кабинет 101» в колонке читался как «Каб. Кабинет 101». В колонке
 * должен лежать голый номер — плейсхолдер ручной формы учителя так и говорит,
 * «например: 305».
 *
 * Понадобится кабинет по умолчанию — это отдельная колонка (у группы или у
 * школы) и миграция, а не строка в планировщике.
 */
export const ROOM: string | null = null;

const SLOT_START_MIN = 9 * 60; // 09:00
/**
 * Шаг сетки: во сколько может начаться следующий урок дня. 45 + перемена 10.
 *
 * ОСТАВЛЕН ЧИСЛОМ НАМЕРЕННО (01.09.2026) — ждёт отдельного решения заказчика.
 * Длительность урока уехала к школе, а шаг нет, и это не забывчивость: они
 * про разное. Длительность — сколько идёт урок, шаг — через сколько начинается
 * следующий, то есть длительность ПЛЮС перемена, а перемена нигде не хранится.
 *
 * Рассогласования при этом не возникает: findFreeSlot ниже сверяет
 * ПРЕДПОЛАГАЕМЫЙ отрезок урока (durationMinutes) с уже существующими уроками
 * группы, поэтому при длительности больше шага он просто пропустит наехавшие
 * места и возьмёт следующее свободное. Меняется плотность сетки, а не её
 * правильность.
 */
const SLOT_STRIDE_MIN = 55;
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
  return tashkentDayKey(utcMs);
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type Busy = { starts_at: string; ends_at: string | null };

/** Первый свободный слот сетки на эту дату для этой группы, либо null если
 *  день занят целиком. */
function findFreeSlot(dayLessons: Busy[], date: string, nowMs: number, durationMinutes: number): string | null {
  for (let n = 0; n < MAX_SLOTS_PER_DAY; n++) {
    const hhmm = minutesToHHMM(SLOT_START_MIN + n * SLOT_STRIDE_MIN);
    const candStartMs = new Date(`${date}T${hhmm}:00+05:00`).getTime();
    const candEndMs = candStartMs + durationMinutes * 60 * 1000;
    // Сегодняшние утренние слоты могли уже пройти — урок в прошлом создать
    // нельзя, и предлагать такое место бессмысленно.
    if (candStartMs <= nowMs) continue;
    const overlaps = dayLessons.some((l) => {
      const ls = new Date(l.starts_at).getTime();
      const le = l.ends_at ? new Date(l.ends_at).getTime() : ls + durationMinutes * 60 * 1000;
      return candStartMs < le && candEndMs > ls;
    });
    if (!overlaps) return hhmm;
  }
  return null;
}

export type PlannedSlot = { topicId: string; title: string; description: string | null; date: string; time: string };

/** Раскладывает темы по свободным местам: по одной в день, начиная с
 *  startDate, пропуская занятые и уже прошедшие слоты этой группы.
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
  /** Длительность урока у школы (миграция 246). Обязателен и без умолчания:
   *  с умолчанием любой новый вызывающий молча вернул бы сюда сорок пять. */
  durationMinutes: number,
  /** «YYYY-MM-DD» — с какого дня раскладывать. Выбирает учитель (пункт 13).
   *  Обязателен и без умолчания: с умолчанием сюда вернулась бы жёсткая дата.
   *  Прошедшую дату брать не запрещено — прошедшие слоты раскладка пропускает
   *  сама (см. findFreeSlot), и первый свободный найдётся уже в будущем. */
  startDate: string,
): Promise<PlannedSlot[]> {
  if (topics.length === 0) return [];

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
      const slot = findFreeSlot(dayLessons, cursorDate, nowMs, durationMinutes);
      if (slot) {
        out.push({ topicId: topic.id, title: topic.title, description: topic.description, date: cursorDate, time: slot });
        // Занимаем слот сразу же, чтобы следующая тема не встала в тот же
        // промежуток.
        const startsAtMs = new Date(`${cursorDate}T${slot}:00+05:00`).getTime();
        byDate.set(cursorDate, [...dayLessons, {
          starts_at: new Date(startsAtMs).toISOString(),
          ends_at: new Date(startsAtMs + durationMinutes * 60 * 1000).toISOString(),
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
// такое». С 02.09.2026 время можно задать каждому дню своё (пункт 11).
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
  /** «HH:MM» по Ташкенту — время ПО УМОЛЧАНИЮ для всех выбранных дней. */
  time: string;
  /**
   * Своё время для отдельных дней недели: «в понедельник первым уроком, в
   * среду третьим». День, которого здесь нет, идёт по `time`.
   *
   * 02.09.2026, пункт 11. Поле необязательное намеренно: не передали — работает
   * ровно как раньше, одно время на все дни. Заставлять заполнять семь полей
   * ради одного урока было бы хуже прежнего.
   */
  timeByWeekday?: Partial<Record<Weekday, string>>;
  /** Обе границы включительно, «YYYY-MM-DD». */
  from: string;
  to: string;
  /** Длительность урока у школы (миграция 246). Обязательна и без умолчания:
   *  раньше здесь стояло `?? SLOT_DURATION_MIN`, то есть молчаливые 45. */
  durationMinutes: number;
  /**
   * Выходные и праздники, «YYYY-MM-DD» по Ташкенту. 03.09.2026.
   *
   * СЛОТ В ТАКОЙ ДЕНЬ ПРОСТО НЕ РОЖДАЕТСЯ — и этого достаточно, чтобы урок
   * СДВИНУЛСЯ, а не пропал. Раздачу тем трогать не пришлось: темы садятся на
   * слоты по порядку, значит убранный слот сдвигает всё, что за ним, на один
   * вперёд, и последняя тема уезжает в запас периода. Ни одна тема не
   * теряется — а «тема должна быть проведена» и есть суть просьбы.
   *
   * Поле необязательное: не передали — раскладка работает ровно как раньше.
   */
  holidays?: string[];
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
 *   • не даёт слота в день из `holidays` — урок с праздника сдвигается на
 *     следующий рабочий слот сам, потому что темы садятся по порядку;
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

  const dur = input.durationMinutes;
  const existing = await getGroupLessonsInDateRange(db, groupId, input.from, input.to);

  const byDate = new Map<string, Busy[]>();
  for (const l of existing) {
    const key = tashkentDateOf(l.starts_at);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(l);
  }

  const wanted = new Set<Weekday>(input.weekdays);
  // Множеством, а не массивом: дней в периоде до 400, праздников до полусотни,
  // и линейный поиск по каждому дню — лишняя работа на ровном месте.
  const выходные = new Set<string>(input.holidays ?? []);
  const out: PlannedLesson[] = [];

  let cursor = input.from;
  for (let guard = 0; guard < MAX_PERIOD_DAYS && cursor <= input.to; guard++) {
    const wd = weekdayOf(cursor);
    // Праздник слота не даёт. Отбраковка стоит рядом с отбраковкой прошедших
    // слотов ниже, и порядок между ними значения не имеет: обе просто не
    // кладут день в раскладку.
    if (wanted.has(wd) && !выходные.has(cursor)) {
      // Время этого дня недели, если оно задано отдельно; иначе общее.
      const time = input.timeByWeekday?.[wd] ?? input.time;
      const startMs = new Date(`${cursor}T${time}:00+05:00`).getTime();
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
          date: cursor, time, occupied,
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
