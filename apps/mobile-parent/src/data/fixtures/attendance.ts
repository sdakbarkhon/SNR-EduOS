/**
 * Посещаемость: коды календаря attCells (строки 3807–3828 макета),
 * статистика и «Последние дни» экрана d14 (разметка 593–595, 616–619).
 * Все значения — ДОСЛОВНО из макета.
 */
import type { AttendanceCellCode, AttendanceDayRow, AttendanceMonthRow, AttendanceStats } from "../types";

function cells(src: string): AttendanceCellCode[] {
  return src.replace(/ /g, "").split("") as AttendanceCellCode[];
}

/** Сетка 35 ячеек (5 недель), Пн–Вс; month_index 1 = «Июль 2026». */
export const ATTENDANCE_MONTHS: AttendanceMonthRow[] = [
  { month_index: 0, label: "Июнь 2026", cells: cells("ppppp ww ppupp ww ppppp ww ppppp ww pp eeeee") },
  { month_index: 1, label: "Июль 2026", cells: cells("ee ppuww ppppp ww pupp p ww pnpt f ww fffff ee") },
];

/** Статистика экрана «Посещаемость»: 96% · 2 уважительные · 1 неуважительная. */
export const ATTENDANCE_STATS: AttendanceStats = {
  attendance_pct: 96,
  excused_count: 2,
  unexcused_count: 1,
};

/** «Последние дни» (разметка 616–619) — дословно.
 *  {suf} — гендерный суффикс ребёнка (макет: «Присутствовал{{ childSuf }}»,
 *  childSuf = k.f ? 'а' : '', строка 3853); подставляется через format()
 *  + is_female в аксессоре. */
export const ATTENDANCE_LAST_DAYS: AttendanceDayRow[] = [
  { date_label: "Сегодня, 23 июля", status_label: "Присутствует", arrived_label: "08:12", left_label: null },
  { date_label: "Вчера, 22 июля", status_label: "Присутствовал{suf}", arrived_label: "08:05", left_label: "15:34" },
  { date_label: "Вторник, 21 июля", status_label: "Отсутствовал{suf} без уважительной причины", arrived_label: null, left_label: null },
  { date_label: "Вторник, 14 июля", status_label: "Уважительная причина · справка врача", arrived_label: null, left_label: null },
];
