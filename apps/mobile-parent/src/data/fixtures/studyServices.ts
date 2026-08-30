/**
 * Дневник, тесты и школьная библиотека — заготовки витрины.
 *
 * ОТКУДА ВЗЯТО. Макет «SNR EduOS v2 Light.dc.html», константы скрипта:
 * `DIARY` (строки 3180–3193), `TESTS_D` (3194–3201), `LIB_D` (3202–3211);
 * разметка экранов — 1511–1536, 1537–1559 и 1560–1588. Значения посимвольно,
 * включая «Д/З: не задано» и порядок строк.
 *
 * `DIARY_WEEKS` был удалён 14.08.2026, когда дневник перешёл на расчёт по
 * журналу. Показ снова идёт без базы — заготовка вернулась, но только ему:
 * настоящий родитель по-прежнему видит расчёт.
 *
 * ЧТО ПРОВЕРЕНО И ЧТО НЕ СОШЛОСЬ — подробно в журнале захода 5. Коротко:
 * средние баллы дней сходятся все восемь, у тестов сходятся «пройдено 4» и
 * «средний балл 4.5», а «82%» — нет: по видимым результатам выходит 85%.
 * Счётчики недели в дневнике оставлены подписями, потому что список дней в
 * макете неполный.
 */
import type { DiaryWeekRow, LibraryBookRow, TestRow } from "../types";

/** Две недели дневника; index 1 — та, что открыта в макете. */
export const DIARY_WEEKS: DiaryWeekRow[] = [
  {
    index: 1,
    label: "20 – 26 июля",
    grades_label: "8",
    avg_label: "4.6",
    homework_label: "8 из 10",
    days: [
      {
        label: "ПОНЕДЕЛЬНИК · 21 июля",
        lessons: [
          { subject_id: "rus", theme: "Части речи", homework: "Д/З: упражнения 45–48", grade: 5 },
          { subject_id: "math", theme: "Дроби и проценты", homework: "Д/З: № 140–148", grade: 4 },
          { subject_id: "eng", theme: "Past Simple: практика", homework: "Д/З: эссе «My Summer»", grade: null },
        ],
      },
      {
        label: "ВТОРНИК · 22 июля",
        lessons: [
          { subject_id: "prog", theme: "Циклы в Python", homework: "Д/З: проект «Калькулятор»", grade: 5 },
          { subject_id: "robo", theme: "Сборка манипулятора", homework: "Д/З: отчёт по сборке", grade: null },
          { subject_id: "rus", theme: "Пунктуация", homework: "Д/З: не задано", grade: 4 },
        ],
      },
      {
        label: "СРЕДА · 23 июля",
        lessons: [
          { subject_id: "math", theme: "Геометрия: углы", homework: "Д/З: задачи 12–18", grade: 5 },
          { subject_id: "eng", theme: "Vocabulary: Travel", homework: "Д/З: выучить 20 слов", grade: null },
        ],
      },
      {
        label: "ЧЕТВЕРГ · 24 июля",
        lessons: [
          { subject_id: "prog", theme: "Функции", homework: "Д/З: практика в тетради", grade: null },
          { subject_id: "rus", theme: "Сочинение-рассуждение", homework: "Д/З: план сочинения", grade: null },
          { subject_id: "math", theme: "Уравнения", homework: "Д/З: № 150–155", grade: 4 },
        ],
      },
    ],
  },
  {
    index: 0,
    label: "13 – 19 июля",
    grades_label: "11",
    avg_label: "4.4",
    homework_label: "9 из 11",
    days: [
      {
        label: "ПОНЕДЕЛЬНИК · 14 июля",
        lessons: [
          { subject_id: "math", theme: "Уравнения", homework: "Д/З: № 120–126", grade: 4 },
          { subject_id: "rus", theme: "Диктант", homework: "Д/З: не задано", grade: 4 },
          { subject_id: "eng", theme: "Reading", homework: "Д/З: пересказ текста", grade: 5 },
        ],
      },
      {
        label: "ВТОРНИК · 15 июля",
        lessons: [
          { subject_id: "prog", theme: "Списки и словари", homework: "Д/З: задачи 1–5", grade: 5 },
          { subject_id: "robo", theme: "Датчики", homework: "Д/З: схема подключения", grade: 4 },
        ],
      },
      {
        label: "СРЕДА · 16 июля",
        lessons: [
          { subject_id: "eng", theme: "Essay writing", homework: "Д/З: черновик эссе", grade: 4 },
          { subject_id: "math", theme: "Дроби", homework: "Д/З: № 130–136", grade: null },
        ],
      },
      {
        label: "ПЯТНИЦА · 18 июля",
        lessons: [
          { subject_id: "rus", theme: "Части речи", homework: "Д/З: упражнения 40–44", grade: 5 },
          { subject_id: "prog", theme: "Циклы", homework: "Д/З: не задано", grade: 5 },
          { subject_id: "math", theme: "Проценты", homework: "Д/З: № 137–139", grade: 4 },
        ],
      },
    ],
  },
];

/**
 * Шесть тестов: четыре пройденных и два предстоящих.
 *
 * Отсчёты «Через 3 дня» и «Через 5 дней» ведут от 23 июля (26 − 3 и 28 − 5),
 * то есть от того же «сегодня», что у экрана посещаемости. Главная и
 * расписание в макете нарисованы на 29 июля — это давнее расхождение самого
 * макета, описанное ещё в заходе 2. Оставлено как есть.
 */
export const TESTS: TestRow[] = [
  { subject_id: "robo", name: "Тест «Датчики»", topic: "Робототехника · датчики и схемы", date_label: "Пройден 17 июля", done: true, result_label: "9 из 10", pct: 90, grade: 5 },
  { subject_id: "eng", name: "Тест «Past Simple»", topic: "Английский · грамматика", date_label: "Пройден 15 июля", done: true, result_label: "7 из 10", pct: 70, grade: 4 },
  { subject_id: "math", name: "Тест «Дроби и проценты»", topic: "Математика · дроби", date_label: "Пройден 10 июля", done: true, result_label: "8 из 10", pct: 80, grade: 4 },
  { subject_id: "prog", name: "Тест «Циклы в Python»", topic: "Программирование · циклы", date_label: "Пройден 8 июля", done: true, result_label: "10 из 10", pct: 100, grade: 5 },
  { subject_id: "math", name: "Тест «Геометрия. Углы»", topic: "Математика · геометрия", date_label: "Проведение: 26 июля, 10:00", done: false, countdown_label: "Через 3 дня" },
  { subject_id: "rus", name: "Тест «Пунктуация»", topic: "Русский язык · знаки препинания", date_label: "Проведение: 28 июля, 09:25", done: false, countdown_label: "Через 5 дней" },
];

/** Восемь материалов; первые три помечены в макете как недавно открытые. */
export const LIBRARY_BOOKS: LibraryBookRow[] = [
  { subject_id: "prog", name: "Python для школьников", author: "А. Петров", meta_label: "PDF · 4.2 МБ", is_recent: true },
  { subject_id: "math", name: "Сборник задач: дроби", author: "Г. Юсупова", meta_label: "PDF · 2.4 МБ", is_recent: true },
  { subject_id: "eng", name: "English Grammar in Use", author: "R. Murphy", meta_label: "PDF · 8.1 МБ", is_recent: true },
  { subject_id: "prog", name: "Алгоритмы в картинках", author: "А. Петров", meta_label: "PDF · 6.3 МБ", is_recent: false },
  { subject_id: "math", name: "Геометрия: 7 класс", author: "Г. Юсупова", meta_label: "PDF · 3.8 МБ", is_recent: false },
  { subject_id: "rus", name: "Сборник диктантов", author: "Д. Касымова", meta_label: "PDF · 1.9 МБ", is_recent: false },
  { subject_id: "robo", name: "Основы робототехники", author: "С. Волков", meta_label: "PDF · 5.6 МБ", is_recent: false },
  { subject_id: "rus", name: "Разбор сочинений", author: "Д. Касымова", meta_label: "PDF · 2.2 МБ", is_recent: false },
];
