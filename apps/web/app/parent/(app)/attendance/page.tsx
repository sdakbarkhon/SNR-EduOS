import { formatTime } from "@snr/core";
import type { AttendanceStatus } from "@snr/core";
import { childAttendanceRecords, getSelectedChild, parentToday } from "@/lib/parent-queries";
import { AttendanceView, type AttendanceLastDay } from "./AttendanceView";
import { RU, addDaysKey, ruDayMonth, tashkentDateKey } from "../_study/util";

/**
 * Экран #14 «Посещаемость» — веб-порт apps/mobile-parent/src/screens/study/
 * AttendanceScreen.tsx (ветка feat/mobile-parent-redesign).
 *
 * Данные РЕАЛЬНЫЕ: childAttendanceRecords() → core getStudentAttendance с
 * явным studentId выбранного ребёнка. Запрос ОДИН и БЕЗ month-фильтра —
 * календарь листается по уже загруженной истории, без рефетча (тот же приём,
 * что в мобилке).
 *
 * Опозданий на экране нет (правило заказчика и схема БД: только present /
 * absent_excused / absent_unexcused).
 *
 * При нескольких отметках за один ташкентский день на ячейку календаря
 * побеждает «худший» статус — иначе порядок строк в ответе произвольно решал
 * бы, что увидит родитель.
 */
const STATUS_PRIORITY: Record<AttendanceStatus, number> = {
  present: 0,
  absent_excused: 1,
  absent_unexcused: 2,
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Присутствовал",
  absent_excused: "Уважительная причина",
  absent_unexcused: "Пропуск без причины",
};

export default async function ParentAttendancePage() {
  const [child, attendance] = await Promise.all([getSelectedChild(), childAttendanceRecords()]);

  const today = await parentToday();
  const yesterday = addDaysKey(today, -1);

  const statusByDate: Record<string, AttendanceStatus> = {};
  for (const r of attendance.records) {
    const key = tashkentDateKey(r.lesson_date);
    const prev = statusByDate[key];
    if (!prev || STATUS_PRIORITY[r.status] > STATUS_PRIORITY[prev]) statusByDate[key] = r.status;
  }

  const lastDays: AttendanceLastDay[] = attendance.records.slice(0, 5).map((r) => {
    const key = tashkentDateKey(r.lesson_date);
    const plain = ruDayMonth(key);
    return {
      id: r.id,
      dateLabel: key === today ? `Сегодня, ${plain}` : key === yesterday ? `Вчера, ${plain}` : plain,
      subject: r.lesson_title,
      statusLabel: STATUS_LABEL[r.status],
      status: r.status,
      arrivedLabel: r.status === "present" && r.marked_at ? formatTime(r.marked_at, RU) : null,
    };
  });

  return (
    <AttendanceView
      childName={child?.full_name ?? "Ребёнок"}
      childClass={child?.className ?? null}
      stats={attendance.stats}
      statusByDate={statusByDate}
      lastDays={lastDays}
      todayKey={today}
    />
  );
}
