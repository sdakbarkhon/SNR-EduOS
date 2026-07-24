/**
 * Сервисы: тесты TESTS_D (строки 3194–3201 макета) и разбор TESTREV
 * (3378–3385), библиотека LIB_D (3202–3211) и MAT_X (3386–3392), портфолио
 * PORT_D (3212–3231) и WORK_X (3393–3398), заявления APPS_D/APP_TYPES/APP_X/
 * NA_REASONS (3232–3245, 3399–3405), медкарта MED_D/VAX_D (3246–3251),
 * транспорт TR_STOPS (3252–3255), питание MEALS_WEEK (3274–3281).
 * Все значения — ДОСЛОВНО из макета.
 */
import type {
  AchievementRow,
  ApplicationDetailRow,
  ApplicationRow,
  ApplicationTypeRow,
  CertificateRow,
  LibraryBookRow,
  MaterialDetailRow,
  MealsDayMenu,
  MedicalCardRow,
  PortfolioWorkRow,
  TestReviewQuestionRow,
  TestRow,
  TransportStopRow,
  VaccinationRow,
  WorkDetailRow,
} from "../types";
import { CHILDREN } from "./family";

// ─── Тесты ───────────────────────────────────────────────────────────────────

export const TESTS: TestRow[] = [
  { done: true, subject_id: "robo", name: "Тест «Датчики»", topic: "Робототехника · датчики и схемы", date_label: "Пройден 17 июля", result_label: "9 из 10", pct: 90, grade: 5 },
  { done: true, subject_id: "eng", name: "Тест «Past Simple»", topic: "Английский · грамматика", date_label: "Пройден 15 июля", result_label: "7 из 10", pct: 70, grade: 4 },
  { done: true, subject_id: "math", name: "Тест «Дроби и проценты»", topic: "Математика · дроби", date_label: "Пройден 10 июля", result_label: "8 из 10", pct: 80, grade: 4 },
  { done: true, subject_id: "prog", name: "Тест «Циклы в Python»", topic: "Программирование · циклы", date_label: "Пройден 8 июля", result_label: "10 из 10", pct: 100, grade: 5 },
  { done: false, subject_id: "math", name: "Тест «Геометрия. Углы»", topic: "Математика · геометрия", date_label: "Проведение: 26 июля, 10:00", countdown_label: "Через 3 дня" },
  { done: false, subject_id: "rus", name: "Тест «Пунктуация»", topic: "Русский язык · знаки препинания", date_label: "Проведение: 28 июля, 09:25", countdown_label: "Через 5 дней" },
];

/** Дополнение шапки экрана «Разбор ответов» da1: date + это. */
export const TEST_REVIEW_TIME_SPENT_SUFFIX = " · затрачено 32 мин";

export const TEST_REVIEW: TestReviewQuestionRow[] = [
  {
    no: 1,
    is_correct: true,
    text: "Сократите дробь 12/18 до несократимого вида",
    options: [{ text: "3/4" }, { text: "2/3", chosen: true, correct: true }, { text: "4/6" }, { text: "6/9" }],
  },
  {
    no: 2,
    is_correct: true,
    text: "Переведите 0,25 в обыкновенную дробь",
    options: [{ text: "1/4", chosen: true, correct: true }, { text: "1/5" }, { text: "2/5" }, { text: "1/3" }],
  },
  {
    no: 3,
    is_correct: true,
    text: "Найдите 40% от числа 250",
    options: [{ text: "90" }, { text: "100", chosen: true, correct: true }, { text: "110" }, { text: "125" }],
  },
  {
    no: 4,
    is_correct: false,
    text: "Сравните дроби 3/7 и 4/9",
    options: [{ text: "3/7 больше 4/9", chosen: true }, { text: "3/7 меньше 4/9", correct: true }, { text: "Дроби равны" }],
    explanation:
      "Приводим к общему знаменателю 63: получаем 27/63 и 28/63. Значит 3/7 меньше 4/9 — сравнивать удобнее через общий знаменатель, а не «на глаз».",
  },
  {
    no: 5,
    is_correct: true,
    text: "Вычислите сумму 1/2 + 1/3",
    options: [{ text: "2/5" }, { text: "5/6", chosen: true, correct: true }, { text: "3/5" }, { text: "1/6" }],
  },
  {
    no: 6,
    is_correct: false,
    text: "Уменьшите число 480 на 15%",
    options: [{ text: "420", chosen: true }, { text: "408", correct: true }, { text: "432" }, { text: "396" }],
    explanation:
      "Уменьшить на 15% — значит найти 85% от числа: 480 × 0,85 = 408. Ошибка — вычитание 60 вместо 72: 15% от 480 это 72, а не 60.",
  },
];

// ─── Библиотека ──────────────────────────────────────────────────────────────

export const LIBRARY: LibraryBookRow[] = [
  { subject_id: "prog", name: "Python для школьников", author: "А. Петров", meta_label: "PDF · 4.2 МБ", recommended: true },
  { subject_id: "math", name: "Сборник задач: дроби", author: "Г. Юсупова", meta_label: "PDF · 2.4 МБ", recommended: true },
  { subject_id: "eng", name: "English Grammar in Use", author: "R. Murphy", meta_label: "PDF · 8.1 МБ", recommended: true },
  { subject_id: "prog", name: "Алгоритмы в картинках", author: "А. Петров", meta_label: "PDF · 6.3 МБ" },
  { subject_id: "math", name: "Геометрия: 7 класс", author: "Г. Юсупова", meta_label: "PDF · 3.8 МБ" },
  { subject_id: "rus", name: "Сборник диктантов", author: "Д. Касымова", meta_label: "PDF · 1.9 МБ" },
  { subject_id: "robo", name: "Основы робототехники", author: "С. Волков", meta_label: "PDF · 5.6 МБ" },
  { subject_id: "rus", name: "Разбор сочинений", author: "Д. Касымова", meta_label: "PDF · 2.2 МБ" },
];

export const MATERIAL_DETAILS: MaterialDetailRow[] = [
  {
    subject_id: "prog",
    description:
      "Практический курс Python с нуля: переменные, условия, циклы и первые мини-проекты. Каждая глава заканчивается набором задач, которые ученики решают на уроках программирования и дома.",
    contents: ["Знакомство со средой", "Переменные и типы данных", "Условия и логика", "Циклы for и while", "Мини-проект: калькулятор"],
    pages: 148,
  },
  {
    subject_id: "math",
    description:
      "Сборник задач по дробям и процентам для 7 класса: от базовых упражнений на сокращение до текстовых задач с процентами. Используется на уроках математики и для домашних заданий.",
    contents: ["Обыкновенные дроби", "Сокращение и сравнение", "Десятичные дроби", "Проценты в задачах", "Итоговые контрольные"],
    pages: 96,
  },
  {
    subject_id: "eng",
    description:
      "Классический учебник грамматики английского языка: короткая теория слева, упражнения справа. Подходит для самостоятельной работы — ответы в конце книги.",
    contents: ["Present Simple / Continuous", "Past Simple", "Future forms", "Modal verbs", "Prepositions"],
    pages: 380,
  },
  {
    subject_id: "rus",
    description:
      "Методические материалы по русскому языку: разборы типовых ошибок, тренировочные упражнения и примеры сильных работ учеников прошлых лет.",
    contents: ["Части речи", "Орфография", "Пунктуация", "Работа с текстом", "Подготовка к диктанту"],
    pages: 84,
  },
  {
    subject_id: "robo",
    description:
      "Вводный курс робототехники: устройство контроллера, датчики, моторы и первые схемы. Все проекты собираются из набора, который используется на занятиях.",
    contents: ["Контроллер и питание", "Датчики света и звука", "Моторы и движение", "Сборка манипулятора", "Итоговый проект"],
    pages: 120,
  },
];

/** Блок «связанные уроки» экрана da2 — уже с исправленной опечаткой макета
 *  («Разbor» → «Разбор», как это делает сам макет на строке 4447). */
export const MATERIAL_RELATED_LESSON_LABEL = "Разбор домашних задач";

// ─── Портфолио ───────────────────────────────────────────────────────────────

export const PORTFOLIO_WORKS: PortfolioWorkRow[] = [
  { subject_id: "prog", name: "Проект «Калькулятор»", date_label: "22 июля", grade: 5 },
  { subject_id: "robo", name: "Манипулятор: сборка", date_label: "18 июля", grade: 4 },
  { subject_id: "math", name: "Проценты в жизни", date_label: "12 июля", grade: 5 },
  { subject_id: "eng", name: "Постер «My Summer»", date_label: "8 июля", grade: 4 },
];

export const PORTFOLIO_ACHIEVEMENTS: AchievementRow[] = [
  { name: "Победитель олимпиады по математике", subtitle: "Городской этап · 1 место", date_label: "май 2026", gradient: ["#facc15", "#ca8a04"] },
  { name: "Лучший проект четверти", subtitle: "Программирование · «Калькулятор»", date_label: "июль 2026", gradient: ["#38bdf8", "#0284c7"] },
  { name: "100% посещаемость", subtitle: "Июнь без единого пропуска", date_label: "июнь 2026", gradient: ["#34d399", "#059669"] },
  { name: "Активный участник дебатов", subtitle: "Школьный клуб дебатов", date_label: "апр 2026", gradient: ["#f472b6", "#db2777"] },
];

export const PORTFOLIO_CERTIFICATES: CertificateRow[] = [
  { name: "Диплом олимпиады по математике", org: "Управление образования г. Ташкента", date_label: "май 2026" },
  { name: "Сертификат «Python Basics»", org: "SNR IT Lab", date_label: "июль 2026" },
  { name: "Сертификат English A2", org: "Экзаменационный центр", date_label: "март 2026" },
  { name: "Сертификат «Робототехника: старт»", org: "SNR International School", date_label: "фев 2026" },
];

/** WORK_X — детали работ, индекс = PORTFOLIO_WORKS. */
export const WORK_DETAILS: WorkDetailRow[] = [
  {
    description:
      "Итоговый проект по теме «Циклы»: консольный калькулятор на Python с четырьмя операциями, обработкой ошибок ввода и историей вычислений.",
    criteria: [["Работоспособность", 100], ["Чистота кода", 90], ["Соблюдение требований", 95]],
    comment:
      "Отличная работа! Код читается легко, история вычислений — приятный бонус сверх задания. Жду тебя на олимпиаде по информатике.",
    comment_from_subject: "prog",
    files: [{ name: "calculator.py", size_label: "4 КБ" }, { name: "Отчёт_проект.pdf", size_label: "1.2 МБ" }],
  },
  {
    description:
      "Практическая работа по робототехнике: сборка манипулятора с двумя степенями свободы и программирование захвата предмета по сигналу датчика.",
    criteria: [["Точность сборки", 85], ["Работа программы", 80], ["Защита проекта", 90]],
    comment:
      "Сборка аккуратная, захват срабатывает стабильно. На защите стоит увереннее объяснять, почему выбран именно этот алгоритм.",
    comment_from_subject: "robo",
    files: [{ name: "manipulator_v2.ino", size_label: "6 КБ" }, { name: "Фото_сборки.jpg", size_label: "2.4 МБ" }],
  },
  {
    description:
      "Исследовательская работа по математике: где проценты встречаются в реальной жизни — скидки, налоги, банковские вклады. С расчётами на примерах семейного бюджета.",
    criteria: [["Глубина исследования", 95], ["Точность расчётов", 100], ["Оформление", 90]],
    comment:
      "Малика выбрала живые примеры и не ошиблась ни в одном расчёте. Одна из лучших работ в классе — рекомендую на школьную конференцию.",
    comment_from_subject: "math",
    files: [{ name: "Проценты_в_жизни.pdf", size_label: "3.1 МБ" }],
  },
  {
    description:
      "Творческое задание по английскому языку: постер о летних каникулах с описанием пяти событий лета в Past Simple, минимум 120 слов.",
    criteria: [["Грамматика", 80], ["Словарный запас", 85], ["Творческое оформление", 95]],
    comment:
      "Постер яркий и структурный. Обрати внимание на формы неправильных глаголов — go/went, see/saw. Разберём на следующем уроке.",
    comment_from_subject: "eng",
    files: [{ name: "My_Summer_poster.pdf", size_label: "5.8 МБ" }],
  },
];

// ─── Заявления ───────────────────────────────────────────────────────────────

export const APPLICATIONS: ApplicationRow[] = [
  { status: "rev", name: "Справка для спортивной секции", number_label: "№ 2026-07-016", date_label: "21 июля", gradient: ["#38bdf8", "#0284c7"] },
  { status: "ok", name: "Справка об обучении", number_label: "№ 2026-07-014", date_label: "18 июля", ready_label: "Готово к получению с 24 июля", gradient: ["#34d399", "#059669"] },
  { status: "rev", name: "Отсутствие по семейным обстоятельствам", number_label: "№ 2026-07-011", date_label: "15 июля", gradient: ["#fbbf24", "#f97316"] },
  { status: "no", name: "Перевод в другой класс", number_label: "№ 2026-06-021", date_label: "28 июня", gradient: ["#a78bfa", "#7c3aed"] },
  { status: "ok", name: "Академический отпуск (лето)", number_label: "№ 2026-06-015", date_label: "20 июня", ready_label: "Готово к получению с 1 июля", gradient: ["#f472b6", "#db2777"] },
];

export const APPLICATION_TYPES: ApplicationTypeRow[] = [
  { name: "Справка об обучении", subtitle: "Для работы, визы или банка" },
  { name: "Отсутствие по семейным обстоятельствам", subtitle: "Пропуск уроков по заявлению" },
  { name: "Справка для спортивной секции", subtitle: "Допуск к тренировкам" },
  { name: "Перевод в другой класс", subtitle: "Рассматривает администрация" },
  { name: "Академический отпуск", subtitle: "Длительное отсутствие" },
];

export const APPLICATION_DETAILS: Record<string, ApplicationDetailRow> = {
  "№ 2026-07-016": {
    period_label: "1 – 30 августа",
    reason: "Допуск к тренировкам",
    comment: "Заявление принято. Справка готовится врачом школы — обычно это занимает 2–3 рабочих дня.",
    comment_by: "М. Рахимова, медицинский кабинет",
    comment_date_label: "22 июля, 09:40",
  },
  "№ 2026-07-014": {
    period_label: "Без периода",
    reason: "Для оформления визы",
    comment:
      "Справка подписана директором и готова к выдаче. Получить можно в приёмной с 8:00 до 17:00, при себе иметь документ.",
    comment_by: "Л. Каримова, приёмная",
    comment_date_label: "24 июля, 08:15",
  },
  "№ 2026-07-011": {
    period_label: "28 – 30 июля",
    reason: "Семейные обстоятельства",
    comment: "Заявление передано классному руководителю на согласование. Ответ придёт уведомлением.",
    comment_by: "Автоматическое уведомление",
    comment_date_label: "15 июля, 14:20",
  },
  "№ 2026-06-021": {
    period_label: "С 1 сентября",
    reason: "Желание родителей",
    comment:
      "В 7-Б классе нет свободных мест на новый учебный год. Заявление можно подать повторно после 15 августа — при появлении мест рассмотрим в первую очередь.",
    comment_by: "Администрация школы",
    comment_date_label: "30 июня, 11:05",
  },
  "№ 2026-06-015": {
    period_label: "1 июня – 25 августа",
    reason: "Летний период",
    comment:
      "Академический отпуск на лето согласован. Домашние задания на период отпуска отменены, доступ к материалам сохраняется.",
    comment_by: "З. Умарова, завуч",
    comment_date_label: "1 июля, 10:00",
  },
};

export const ABSENCE_REASONS = ["Семейные обстоятельства", "Медицинская причина", "Поездка / соревнования", "Другое"] as const;

/** Новое заявление da5: подтверждающий текст и файлы (максимум 5). */
export const NEW_APPLICATION_SUBMIT = {
  date_label: "23 июля",
  comment: "Заявление принято. Ожидает проверки секретарём — статус обновится уведомлением.",
  comment_by: "Автоматическое уведомление",
  comment_date_label: "23 июля, 09:00",
  files: [
    { name: "Справка_врача.pdf", size_label: "640 КБ" },
    { name: "Фото_документа.jpg", size_label: "1.8 МБ" },
  ],
  max_files: 5,
} as const;

// ─── Медкарта ────────────────────────────────────────────────────────────────

/** MED_D, индекс = ребёнок. Пустые allergies → плашка «Не выявлено /
 *  Аллергий и особых ограничений нет». */
export const MEDICAL_CARDS: MedicalCardRow[] = [
  {
    student_id: CHILDREN[0].id,
    stats: [["РОСТ", "128 см"], ["ВЕС", "26 кг"], ["ГРУППА КРОВИ", "I (0+)"], ["ЗРЕНИЕ", "1.0 / 1.0"]],
    allergies: [],
  },
  {
    student_id: CHILDREN[1].id,
    stats: [["РОСТ", "158 см"], ["ВЕС", "46 кг"], ["ГРУППА КРОВИ", "II (A+)"], ["ЗРЕНИЕ", "1.0 / 0.9"]],
    allergies: [
      ["Пыльца (сезонная аллергия)", "Апрель–июнь · антигистаминные при обострении"],
      ["Очки для чтения", "Рекомендация офтальмолога от 12.02.2026"],
    ],
  },
  {
    student_id: CHILDREN[2].id,
    stats: [["РОСТ", "174 см"], ["ВЕС", "63 кг"], ["ГРУППА КРОВИ", "III (B+)"], ["ЗРЕНИЕ", "0.8 / 0.8"]],
    allergies: [],
  },
];

export const NO_ALLERGIES_TEXT = { title: "Не выявлено", sub: "Аллергий и особых ограничений нет" } as const;

export const VACCINATIONS: VaccinationRow[] = [
  { name: "АКДС (ревакцинация)", date_label: "12 марта 2015", status: "ok" },
  { name: "Корь · краснуха · паротит", date_label: "5 июня 2016", status: "ok" },
  { name: "Гепатит B (курс)", date_label: "14 января 2011", status: "ok" },
  { name: "Грипп (сезонная)", date_label: "10 октября 2025", status: "ok" },
  { name: "АДС-М (ревакцинация)", date_label: "сентябрь 2026", status: "plan" },
];

// ─── Транспорт ───────────────────────────────────────────────────────────────

export const TRANSPORT_STOPS: TransportStopRow[] = [
  { name: "Депо «Юнусабад»", time_label: "07:18", status: "past" },
  { name: "Массив Юнусабад-4", time_label: "07:26", status: "past" },
  { name: "Метро «Юнусабад»", time_label: "07:33", status: "now" },
  { name: "Ул. Амира Темура", time_label: "07:42", status: "next", is_my_stop: true },
  { name: "Сквер Дружбы", time_label: "07:48", status: "next" },
  { name: "SNR International School", time_label: "07:55", status: "next" },
];

/** Тумблеры уведомлений транспорта: trN1 вкл., trN2 выкл. */
export const TRANSPORT_NOTIFY_DEFAULTS = { arrival: true, delays: false } as const;

// ─── Питание ─────────────────────────────────────────────────────────────────

/** MEALS_WEEK — меню Пн–Сб; каждый день 4 позиции [блюдо, категория]. */
export const MEALS_WEEK: MealsDayMenu[] = [
  [["Суп мастава", "первое"], ["Котлета с пюре", "второе"], ["Салат витаминный", "салат"], ["Чай с лимоном", "напиток"]],
  [["Борщ", "первое"], ["Макароны с курицей", "второе"], ["Салат из капусты", "салат"], ["Морс ягодный", "напиток"]],
  [["Суп лагман", "первое"], ["Плов с говядиной", "второе"], ["Салат из свежих овощей", "салат"], ["Компот из сухофруктов", "напиток"]],
  [["Суп куриный", "первое"], ["Рыба с рисом", "второе"], ["Салат греческий", "салат"], ["Кисель", "напиток"]],
  [["Шурпа", "первое"], ["Манты с тыквой", "второе"], ["Салат морковный", "салат"], ["Чай зелёный", "напиток"]],
  [["Суп овощной", "первое"], ["Жаркое по-домашнему", "второе"], ["Салат свекольный", "салат"], ["Компот", "напиток"]],
];

/** Пилюли дней питания; mealDay по умолчанию = 2 (Ср). */
export const MEALS_DAY_PILLS: [string, number][] = [["Пн", 21], ["Вт", 22], ["Ср", 23], ["Чт", 24], ["Пт", 25], ["Сб", 26]];
export const DEFAULT_MEAL_DAY_INDEX = 2;
