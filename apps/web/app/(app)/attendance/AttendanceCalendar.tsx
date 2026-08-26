"use client";

import { useMemo, useState, useEffect } from "react";
import {
  attendanceForDay,
  getDictionary,
  defaultLocale,
  tashkentDayKey,
  type AttendanceWithLesson,
} from "@snr/core";
import { colors } from "@snr/ui-tokens";
import { useSchoolNow } from "@/components/SchoolTimeProvider";

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Цветная рамка: absent_unexcused > absent_excused > present */
function getBorderColor(dayRows: AttendanceWithLesson[]): string | null {
  if (dayRows.length === 0) return null;
  if (dayRows.some((r) => r.status === "absent_unexcused")) return colors.danger;
  if (dayRows.some((r) => r.status === "absent_excused")) return colors.warning;
  if (dayRows.some((r) => r.status === "present")) return colors.success;
  return null;
}

// 26.08.2026 — СЕТКА СТРОИТСЯ В UTC, А НЕ В ПОЯСЕ СРЕДЫ.
// Ячейка календаря — это не момент времени, а позиция в сетке. Раньше она
// строилась через new Date(year, month, 1) и читалась через getDay()/
// getMonth(), то есть в поясе сервера. На Vercel это UTC, и с 00:00 до 05:00
// по Ташкенту вся сетка съезжала на день. Теперь ячейки — полночь UTC, а
// принадлежность урока дню считает isSameTashkentDay по единому правилу
// (packages/core/src/utils/date.ts).
function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const startDow = firstDay.getUTCDay();
  const mondayOffset = startDow === 0 ? -6 : 1 - startDow;
  const start = new Date(firstDay);
  start.setUTCDate(start.getUTCDate() + mondayOffset);
  const endDow = lastDay.getUTCDay();
  const sundayOffset = endDow === 0 ? 0 : 7 - endDow;
  const end = new Date(lastDay);
  end.setUTCDate(end.getUTCDate() + sundayOffset);
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
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
  // Z.3, заход 3 — «сегодня» из школы. Прежний null-до-маунта не нужен:
  // начальное значение приходит с сервера, гидратация не расходится.
  const schoolNowDate = useSchoolNow();
  // Ключ «сегодня» — по Ташкенту. Было getFullYear/getMonth/getDate: в те же
  // ночные часы подсветка вставала на вчерашнюю клетку.
  const todayKey = tashkentDayKey(schoolNowDate);

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
          const inMonth = day.getUTCMonth() === month;
          const isToday = tashkentDayKey(day) === todayKey;
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
                {day.getUTCDate()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
