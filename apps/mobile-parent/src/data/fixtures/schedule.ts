/**
 * Расписание: SLOT_S/SLOT_E, LESSON_SETS, SETS_BY_CHILD, SCHED_DAYS
 * (строки 3353–3377 макета), DS_MONTHS (3480), демо-«сегодня».
 * Все значения — ДОСЛОВНО из макета. Date.now НЕ используется — «сегодня»
 * прототипа зафиксировано константой DEMO_TODAY.
 */
import type { DatePickerMonth, DemoToday, LessonSetId, ScheduleDayRow, SubjectKey } from "../types";

/** Демо-«сегодня» = среда 29 июля 2026 (05.08.2026: заморозка времени
 *  навсегда, client requirement — было 23 июля). weekday_index не менялся —
 *  29.07.2026 тоже среда (index 2), совпало. Время внутри now_iso (10:42,
 *  «идёт 3-й урок») НЕ трогаю — привязано к отдельной, защищённой логике
 *  "1-completed/2-in_progress/3+ ручной старт" (TODAY_LIVE_LESSON_INDEX
 *  ниже), которую эта задача явно просила не трогать/не рефакторить. Только
 *  дата внутри now_iso сдвинута на новую, время осталось как было. */
export const DEMO_TODAY: DemoToday = {
  iso_date: "2026-07-29",
  now_iso: "2026-07-29T10:42:00+05:00",
  day: 29,
  month_index: 1,
  weekday_index: 2,
  label_full: "Среда, 29 июля",
  label_today: "Сегодня, 29 июля",
};

export const SLOT_STARTS = ["08:30", "09:25", "10:20", "11:15", "12:10", "13:05"] as const;
export const SLOT_ENDS = ["09:15", "10:10", "11:05", "12:00", "12:55", "13:50"] as const;

/** Кабинет всех рядов расписания (schedRowsFor и d6) — «Кабинет 101».
 *  Единый для всей платформы; «Каб. 204» на Dashboard макета был рудиментом
 *  и приведён к 101 (см. NEXT_LESSON_CARD в home.ts). */
export const SCHEDULE_ROOM_LABEL = "Кабинет 101";

export const LESSON_SETS: Record<LessonSetId, SubjectKey[]> = {
  A: ["rus", "eng", "math", "prog", "robo", "rusF"],
  B: ["math", "rus", "eng", "robo", "prog"],
  C: ["math", "eng", "prog"],
};

/** Сеты уроков по детям (SETS_BY_CHILD), индекс = ребёнок.
 *  Заход 5: индексы 3–5 — новые семьи (Азизбек 3-А, Мадина 7-А, Хумоюн 10-А).
 *  Наборы отражают классы (3-А ~ индекс 0, 7-А ~ 1, 10-А ~ 2), чтобы
 *  getDaySchedule() по index-based lookup не падал. */
export const SETS_BY_CHILD: Record<LessonSetId, SubjectKey[]>[] = [
  { A: ["rus", "math", "eng", "robo"], B: ["math", "prog", "rus"], C: ["eng", "math", "prog"] },
  { A: ["rus", "eng", "math", "prog", "robo", "rusF"], B: ["math", "rus", "eng", "robo", "prog"], C: ["math", "eng", "prog"] },
  { A: ["prog", "math", "robo", "eng", "rus"], B: ["robo", "prog", "math", "eng"], C: ["prog", "math", "eng"] },
  { A: ["rus", "math", "eng", "robo"], B: ["math", "prog", "rus"], C: ["eng", "math", "prog"] },
  { A: ["rus", "eng", "math", "prog", "robo", "rusF"], B: ["math", "rus", "eng", "robo", "prog"], C: ["math", "eng", "prog"] },
  { A: ["prog", "math", "robo", "eng", "rus"], B: ["robo", "prog", "math", "eng"], C: ["prog", "math", "eng"] },
];

/** Неделя расписания (SCHED_DAYS); индекс DEMO_TODAY.weekday_index = сегодня. */
export const SCHEDULE_DAYS: ScheduleDayRow[] = [
  { weekday_label: "Пн", day: 21, set_id: "A", grades: [5, 4, 5, null, 4, null] },
  { weekday_label: "Вт", day: 22, set_id: "B", grades: [5, null, 4, 4, null] },
  { weekday_label: "Ср", day: 23, set_id: "A", grades: [5, null] },
  { weekday_label: "Чт", day: 24, set_id: "B", grades: [] },
  { weekday_label: "Пт", day: 25, set_id: "A", grades: [] },
  { weekday_label: "Сб", day: 26, set_id: "B", grades: [] },
  { weekday_label: "Вс", day: 27, set_id: "C", grades: [] },
];

/** Логика schedRowsFor: сегодня done — первые N уроков, следующий — live. */
export const TODAY_DONE_LESSONS = 2;
export const TODAY_LIVE_LESSON_INDEX = 2;

/**
 * Экран 6 «Статус дня» — то немногое, чего нет в других заготовках.
 * Разметка 424 и 446–449 макета.
 *
 * Остальное на этом экране НЕ дублируется, а берётся у соседей, и это
 * важнее самой заготовки:
 *  · список уроков дня — getDaySchedule(DEMO_TODAY.weekday_index);
 *  · сколько прошло и какой идёт — TODAY_DONE_LESSONS и
 *    TODAY_LIVE_LESSON_INDEX выше, то есть те же, что у расписания;
 *  · время прихода — DASHBOARD_CHILD_STATUS.at_school_since_label,
 *    тот же «08:12», что на главной;
 *  · баланс питания — WALLET_BALANCE, тот же, что в кошельке.
 *
 * Скопируй мы эти числа сюда — они разошлись бы при первой же правке
 * соседнего экрана.
 */
export const DAY_STATUS = {
  menu_label: "стандартное",
  lunch_label: "Обед в 12:40 · столовая",
} as const;

/** Месяцы дейтпикера (DS_MONTHS). */
export const DATE_PICKER_MONTHS: DatePickerMonth[] = [
  { name: "Июнь 2026", days: 30, offset: 0, gen_label: "июня" },
  { name: "Июль 2026", days: 31, offset: 2, gen_label: "июля" },
  { name: "Август 2026", days: 31, offset: 5, gen_label: "августа" },
];

/** Быстрые чипы дейтпикера. */
export const DATE_PICKER_QUICK_CHIPS = [
  { label: "Сегодня", month_index: 1, day: 23 },
  { label: "Вчера", month_index: 1, day: 22 },
  { label: "Начало недели", month_index: 1, day: 20 },
] as const;
