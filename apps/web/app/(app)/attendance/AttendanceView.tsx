"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  attendanceCalcAll,
  getDictionary,
  getAttendanceWithLesson,
  type AttendanceWithLesson,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { colors } from "@snr/ui-tokens";
import { createClient } from "@/lib/supabase/client";
import { GlassCard, useLocale } from "@/components";
import { AttendanceCalendar } from "./AttendanceCalendar";
import { SubjectAttendanceList } from "./SubjectAttendanceList";

const MONTH_NAMES_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function monthRange(year: number, month: number): { from: string; to: string } {
  const from = new Date(year, month, 1).toISOString();
  const to = new Date(year, month + 1, 1).toISOString();
  return { from, to };
}

export function AttendanceView({
  initialRows,
  initialYear,
  initialMonth,
}: {
  initialRows: AttendanceWithLesson[];
  initialYear: number;
  initialMonth: number;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const sb = createClient();

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [rows, setRows] = useState<AttendanceWithLesson[]>(initialRows);
  const [loading, setLoading] = useState(false);

  const loadMonth = useCallback(
    async (y: number, m: number) => {
      setLoading(true);
      try {
        const range = monthRange(y, m);
        const data = await getAttendanceWithLesson(sb, range);
        setRows(data);
      } finally {
        setLoading(false);
      }
    },
    [sb],
  );

  const prevMonth = () => {
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    setMonth(m);
    setYear(y);
    loadMonth(y, m);
  };

  const nextMonth = () => {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    setMonth(m);
    setYear(y);
    loadMonth(y, m);
  };

  // Realtime — обновляем строки текущего месяца
  useEffect(() => {
    const range = monthRange(year, month);
    const channel = sb
      .channel("attendance-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        async () => {
          // Перезапрашиваем весь месяц при любом изменении (payload не содержит join-данных)
          const fresh = await getAttendanceWithLesson(sb, range);
          setRows(fresh);
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [year, month, sb]);

  const stats = useMemo(() => attendanceCalcAll(rows), [rows]);

  const kpiCards = [
    {
      label: d.attendance.kpiOverall,
      value: `${stats.overall}%`,
      color: colors.success,
    },
    {
      label: d.attendance.kpiDays,
      value: `${stats.daysWithoutAbsence} ${d.attendance.daysUnit}`,
      color: colors.primary,
    },
    {
      label: d.attendance.kpiMissed,
      value: `${stats.missed} ${d.attendance.lessonsUnit}`,
      color: colors.warning,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">{d.attendance.title}</h1>
      {/* Переключатель месяца */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border border-white/60 bg-white/70 px-1 py-1 shadow-sm backdrop-blur-md">
          <button
            onClick={prevMonth}
            aria-label={d.attendance.prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition hover:bg-white/80"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[140px] text-center text-[14px] font-semibold text-gray-800">
            {MONTH_NAMES_RU[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            aria-label={d.attendance.nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition hover:bg-white/80"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {loading && (
          <span className="text-[13px] text-gray-400">{d.common.loading}</span>
        )}
      </div>

      {/* KPI — карточки с белым орбом-подсветкой из poseshayemost.zip KPIGrid */}
      <div className="grid grid-cols-3 gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="relative overflow-hidden rounded-[20px] border-[1.5px] border-white/80 bg-white/70 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] backdrop-blur-2xl p-5 flex flex-col gap-1"
          >
            {/* Белый орб в правом верхнем углу */}
            <div className="pointer-events-none absolute -right-12 -top-12 h-24 w-24 rounded-full bg-white/40 blur-2xl" />
            <span className="relative z-10 text-[12px] font-medium text-gray-500">
              {card.label}
            </span>
            <span
              className="relative z-10 text-3xl font-bold leading-tight xl:text-4xl"
              style={{ color: card.color }}
            >
              {card.value}
            </span>
          </div>
        ))}
      </div>

      {/* Двухколоночная сетка */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Календарь */}
        <GlassCard className="p-6">
          <AttendanceCalendar rows={rows} year={year} month={month} />
        </GlassCard>

        {/* По предметам */}
        <GlassCard className="flex flex-col gap-5 p-6">
          <h3 className="text-[15px] font-bold text-gray-900">
            {d.attendance.bySubjectTitle}
          </h3>
          <SubjectAttendanceList rows={rows} />
        </GlassCard>
      </div>
    </div>
  );
}
