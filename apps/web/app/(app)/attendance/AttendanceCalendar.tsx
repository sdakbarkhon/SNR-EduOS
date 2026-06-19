"use client";

import { useMemo, useState, useEffect } from "react";
import {
  attendanceForDay,
  getDictionary,
  defaultLocale,
  type AttendanceWithLesson,
} from "@snr/core";
import { colors } from "@snr/ui-tokens";

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Цветная рамка: absent_unexcused > absent_excused > present */
function getBorderColor(dayRows: AttendanceWithLesson[]): string | null {
  if (dayRows.length === 0) return null;
  if (dayRows.some((r) => r.status === "absent_unexcused")) return colors.danger;
  if (dayRows.some((r) => r.status === "absent_excused")) return colors.warning;
  if (dayRows.some((r) => r.status === "present")) return colors.success;
  return null;
}

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const mondayOffset = startDow === 0 ? -6 : 1 - startDow;
  const start = new Date(firstDay);
  start.setDate(start.getDate() + mondayOffset);
  const endDow = lastDay.getDay();
  const sundayOffset = endDow === 0 ? 0 : 7 - endDow;
  const end = new Date(lastDay);
  end.setDate(end.getDate() + sundayOffset);
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function AttendanceCalendar({
  rows,
  year,
  month,
}: {
  rows: AttendanceWithLesson[];
  year: number;
  month: number;
}) {
  const d = getDictionary(defaultLocale);
  // "" on server + first client render → no "today" highlight, set after mount to
  // avoid hydration error #418 (server UTC date vs client local date can differ).
  const [todayKey, setTodayKey] = useState<string>("");
  useEffect(() => {
    const t = new Date();
    setTodayKey(`${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`);
  }, []);

  const days = useMemo(() => getCalendarDays(year, month), [year, month]);

  const LEGEND = [
    { color: colors.success, label: d.attendance.legendPresent },
    { color: colors.danger,  label: d.attendance.legendUnexcused },
    { color: colors.warning, label: d.attendance.legendExcused },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Заголовок + легенда */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-bold text-gray-900">
          {d.attendance.calendarTitle}
        </h3>
        <div className="flex flex-col gap-1 items-end shrink-0">
          {LEGEND.map((l) => (
            <span
              key={l.label}
              className="flex items-center gap-1.5 text-[11px] text-gray-500"
            >
              {/* Цветной квадратик */}
              <span
                className="inline-block w-2.5 h-2.5 rounded-[3px] shrink-0"
                style={{ backgroundColor: l.color }}
              />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Сетка */}
      <div className="grid grid-cols-7 gap-x-1 gap-y-2">
        {/* Заголовки дней */}
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400"
          >
            {label}
          </div>
        ))}

        {/* Дни */}
        {days.map((day) => {
          const inMonth = day.getMonth() === month;
          const isToday =
            `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}` === todayKey;
          const dayRows = attendanceForDay(rows, day);
          const borderColor = inMonth ? getBorderColor(dayRows) : null;

          let cellStyle: React.CSSProperties = {};

          if (isToday && borderColor) {
            // Синяя заливка + цветное кольцо снаружи через layered box-shadow
            cellStyle = {
              backgroundColor: colors.primary,
              color: "#fff",
              boxShadow: `0 4px 10px rgba(45,91,255,0.35), 0 0 0 2.5px #fff, 0 0 0 4.5px ${borderColor}`,
            };
          } else if (isToday) {
            cellStyle = {
              backgroundColor: colors.primary,
              color: "#fff",
              boxShadow: "0 4px 10px rgba(45,91,255,0.35)",
            };
          } else if (borderColor) {
            cellStyle = { border: `2px solid ${borderColor}` };
          }

          return (
            <div
              key={day.toISOString()}
              className="flex items-center justify-center"
            >
              <span
                className={[
                  "flex h-8 w-8 items-center justify-center text-[13px] font-medium transition-all",
                  isToday ? "rounded-full font-bold" : "rounded-lg",
                  !isToday && inMonth ? "text-gray-800" : "",
                  !inMonth ? "text-gray-300" : "",
                ].join(" ")}
                style={cellStyle}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
