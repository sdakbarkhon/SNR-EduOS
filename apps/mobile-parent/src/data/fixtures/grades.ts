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

/* SKILLS_TAB удалён 14.08.2026: навыки на вкладке «Успехи» и на экране
 * «Навыки и развитие» считаются из оценок, посещаемости и сданных работ
 * (getChildSkills). Четыре выдуманных процента и радар на шесть осей ушли. */

/** Баннеры EduOS Assistant на вкладках П10 (C2). */
export const GRADES_ASSISTANT_NOTES = {
  grades: "Отличная динамика по точным наукам. Добавьте 20 минут практики сочинений в неделю.",
  skills: "Сильные стороны — логика и математика. Рекомендуем развивать коммуникацию через дебаты и проекты.",
} as const;

/** Периоды успеваемости (B9); дефолт initial state — «За июль». */
export const GRADE_PERIODS = ["За июль", "За 4 четверть", "За 3 четверть", "Весь год"] as const;
export const DEFAULT_GRADE_PERIOD = "За июль";
