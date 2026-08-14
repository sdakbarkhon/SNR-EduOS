/**
 * Оценки и успехи: дневник DIARY (строки 3180–3193 макета), сводка «Успехи»
 * П10 (C2), периоды успеваемости (B9). Все значения — ДОСЛОВНО из макета.
 */
import type { GradesSummary } from "../types";

/* DIARY_WEEKS удалён 14.08.2026: «Дневник» собирается из расписания класса
 * и оценок за уроки (getChildDiaryWeek), двухнедельная фикстура не нужна. */
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

/** Вкладка «Навыки» П10 (C2) — плитки, чипы и радар.
 *  Расширения Захода 4:
 *   - `tiles` укомплектован 4 плитками макета (строка 343–348): «Творчество 85» и
 *     «Коммуникация 90» с градиентами (значения и градиенты из макета);
 *   - у каждой плитки добавлен градиент 135° (макет строка 343);
 *   - `radar_values` — 6 значений полигона радара (строка 351: точки
 *     `60,20 90,38 84,72 60,90 32,68 38,40` при R=44 → проценты вершин к R,
 *     видимые в макете как ~90/86/68/82/64/68). */
export const SKILLS_TAB = {
  tiles: [
    { name: "Знания", pct: 92, gradient: ["#a78bfa", "#7c3aed"] as [string, string] },
    { name: "Мышление", pct: 88, gradient: ["#60a5fa", "#2563eb"] as [string, string] },
    { name: "Творчество", pct: 85, gradient: ["#f472b6", "#db2777"] as [string, string] },
    { name: "Коммуникация", pct: 90, gradient: ["#34d399", "#059669"] as [string, string] },
  ],
  chips: [
    { name: "Логика", value_label: "4.8", tone: "violet" as const },
    { name: "Коммуникация", value_label: "3.8", tone: "blue" as const },
    { name: "Дисциплина", value_label: "4.7", tone: "green" as const },
    { name: "Креативность", value_label: "4.2", tone: "red" as const },
  ],
  /** 6 значений полигона радара (0..100), извлечены из макета (строка 351). */
  radar_values: [90, 86, 68, 82, 64, 68] as [number, number, number, number, number, number],
} as const;

/** Баннеры EduOS Assistant на вкладках П10 (C2). */
export const GRADES_ASSISTANT_NOTES = {
  grades: "Отличная динамика по точным наукам. Добавьте 20 минут практики сочинений в неделю.",
  skills: "Сильные стороны — логика и математика. Рекомендуем развивать коммуникацию через дебаты и проекты.",
} as const;

/** Периоды успеваемости (B9); дефолт initial state — «За июль». */
export const GRADE_PERIODS = ["За июль", "За 4 четверть", "За 3 четверть", "Весь год"] as const;
export const DEFAULT_GRADE_PERIOD = "За июль";
