/**
 * Оценки и успехи: дневник DIARY (строки 3180–3193 макета), сводка «Успехи»
 * П10 (C2), периоды успеваемости (B9). Все значения — ДОСЛОВНО из макета.
 */
import type { DiaryWeekRow, GradesSummary } from "../types";

/** DIARY — дневник по неделям (week_index 1 — текущая «20 – 26 июля»). */
export const DIARY_WEEKS: DiaryWeekRow[] = [
  {
    week_index: 1,
    label: "20 – 26 июля",
    grades_count_label: "8",
    avg_label: "4.6",
    homework_label: "8 из 10",
    days: [
      {
        day_label: "ПОНЕДЕЛЬНИК · 21 июля",
        avg_label: "4.5",
        lessons: [
          { subject_id: "rus", topic: "Части речи", homework_label: "Д/З: упражнения 45–48", grade: 5 },
          { subject_id: "math", topic: "Дроби и проценты", homework_label: "Д/З: № 140–148", grade: 4 },
          { subject_id: "eng", topic: "Past Simple: практика", homework_label: "Д/З: эссе «My Summer»", grade: null },
        ],
      },
      {
        day_label: "ВТОРНИК · 22 июля",
        avg_label: "4.5",
        lessons: [
          { subject_id: "prog", topic: "Циклы в Python", homework_label: "Д/З: проект «Калькулятор»", grade: 5 },
          { subject_id: "robo", topic: "Сборка манипулятора", homework_label: "Д/З: отчёт по сборке", grade: null },
          { subject_id: "rus", topic: "Пунктуация", homework_label: "Д/З: не задано", grade: 4 },
        ],
      },
      {
        day_label: "СРЕДА · 23 июля",
        avg_label: "5.0",
        lessons: [
          { subject_id: "math", topic: "Геометрия: углы", homework_label: "Д/З: задачи 12–18", grade: 5 },
          { subject_id: "eng", topic: "Vocabulary: Travel", homework_label: "Д/З: выучить 20 слов", grade: null },
        ],
      },
      {
        day_label: "ЧЕТВЕРГ · 24 июля",
        avg_label: "4.0",
        lessons: [
          { subject_id: "prog", topic: "Функции", homework_label: "Д/З: практика в тетради", grade: null },
          { subject_id: "rus", topic: "Сочинение-рассуждение", homework_label: "Д/З: план сочинения", grade: null },
          { subject_id: "math", topic: "Уравнения", homework_label: "Д/З: № 150–155", grade: 4 },
        ],
      },
    ],
  },
  {
    week_index: 0,
    label: "13 – 19 июля",
    grades_count_label: "11",
    avg_label: "4.4",
    homework_label: "9 из 11",
    days: [
      {
        day_label: "ПОНЕДЕЛЬНИК · 14 июля",
        avg_label: "4.3",
        lessons: [
          { subject_id: "math", topic: "Уравнения", homework_label: "Д/З: № 120–126", grade: 4 },
          { subject_id: "rus", topic: "Диктант", homework_label: "Д/З: не задано", grade: 4 },
          { subject_id: "eng", topic: "Reading", homework_label: "Д/З: пересказ текста", grade: 5 },
        ],
      },
      {
        day_label: "ВТОРНИК · 15 июля",
        avg_label: "4.5",
        lessons: [
          { subject_id: "prog", topic: "Списки и словари", homework_label: "Д/З: задачи 1–5", grade: 5 },
          { subject_id: "robo", topic: "Датчики", homework_label: "Д/З: схема подключения", grade: 4 },
        ],
      },
      {
        day_label: "СРЕДА · 16 июля",
        avg_label: "4.0",
        lessons: [
          { subject_id: "eng", topic: "Essay writing", homework_label: "Д/З: черновик эссе", grade: 4 },
          { subject_id: "math", topic: "Дроби", homework_label: "Д/З: № 130–136", grade: null },
        ],
      },
      {
        day_label: "ПЯТНИЦА · 18 июля",
        avg_label: "4.7",
        lessons: [
          { subject_id: "rus", topic: "Части речи", homework_label: "Д/З: упражнения 40–44", grade: 5 },
          { subject_id: "prog", topic: "Циклы", homework_label: "Д/З: не задано", grade: 5 },
          { subject_id: "math", topic: "Проценты", homework_label: "Д/З: № 137–139", grade: 4 },
        ],
      },
    ],
  },
];

/** Сводка «Успехи» П10 (C2) — витринные значения макета дословно. */
export const GRADES_SUMMARY: GradesSummary = {
  average_label: "4.6",
  average_max_label: "5.0",
  average_chip: "Отлично!",
  stars_filled: 4,
  week_progress_label: "↑ 12%",
  week_progress_note: "отличный рост",
  sparkline_points: "2,19 14,16 26,17 38,10 50,12 62,4",
  attendance_pct: 96,
  attendance_ratio_label: "24/25",
  vs_prev_month_note: "Выше на 0.2, чем в июне",
  strengths: ["Программирование", "Математика", "Логика"],
  growth_areas: ["Английский язык", "Говорение", "Сочинения"],
  dynamics_points: "10,66 70,60 130,62 190,44 250,36 310,20",
  dynamics_months: [
    { month_label: "Май", avg_label: "4.3", delta_label: "↑0.1" },
    { month_label: "Июнь", avg_label: "4.4", delta_label: "↑0.1" },
    { month_label: "Июль", avg_label: "4.6", delta_label: "↑0.2" },
  ],
  dynamics_note: "Рост три месяца подряд — быстрее всего растут программирование и математика",
};

/** Вкладка «Навыки» П10 (C2) — плитки и чипы. */
export const SKILLS_TAB = {
  tiles: [
    { name: "Знания", pct: 92 },
    { name: "Мышление", pct: 88 },
  ],
  chips: [
    { name: "Логика", value_label: "4.8" },
    { name: "Коммуникация", value_label: "3.8" },
    { name: "Дисциплина", value_label: "4.7" },
    { name: "Креативность", value_label: "4.2" },
  ],
} as const;

/** Баннеры EduOS Assistant на вкладках П10 (C2). */
export const GRADES_ASSISTANT_NOTES = {
  grades: "Отличная динамика по точным наукам. Добавьте 20 минут практики сочинений в неделю.",
  skills: "Сильные стороны — логика и математика. Рекомендуем развивать коммуникацию через дебаты и проекты.",
} as const;

/** Периоды успеваемости (B9); дефолт initial state — «За июль». */
export const GRADE_PERIODS = ["За июль", "За 4 четверть", "За 3 четверть", "Весь год"] as const;
export const DEFAULT_GRADE_PERIOD = "За июль";
