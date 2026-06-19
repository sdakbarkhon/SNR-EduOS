"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  attendanceCalcAll,
  getDictionary,
  getAttendanceWithLesson,
  getSubjectStyle,
  type AttendanceWithLesson,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { colors } from "@snr/ui-tokens";
import { createClient } from "@/lib/supabase/client";
import { GlassCard, SubjectIcon, useLocale } from "@/components";
import { AttendanceCalendar } from "./AttendanceCalendar";
import { SubjectAttendanceList } from "./SubjectAttendanceList";
import { cn } from "@/lib/cn";

const MONTH_NAMES_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

type Period = "month" | "semester" | "year";

function getPeriodRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return { from, to };
  }
  if (period === "semester") {
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
    return { from, to };
  }
  const from = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();
  return { from, to };
}

function monthRange(year: number, month: number) {
  return {
    from: new Date(year, month, 1).toISOString(),
    to: new Date(year, month + 1, 1).toISOString(),
  };
}

function statusBadge(status: string): { label: string; cls: string } {
  if (status === "present") return { label: "Присутствовал", cls: "bg-emerald-100 text-emerald-700" };
  if (status === "absent_excused") return { label: "Уважительная", cls: "bg-yellow-100 text-yellow-700" };
  return { label: "Без причины", cls: "bg-red-100 text-red-600" };
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
  const [period, setPeriod] = useState<Period>("month");
  const [periodRows, setPeriodRows] = useState<AttendanceWithLesson[]>(initialRows);

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

  const loadPeriod = useCallback(
    async (p: Period) => {
      setLoading(true);
      try {
        const range = getPeriodRange(p);
        const data = await getAttendanceWithLesson(sb, range);
        setPeriodRows(data);
      } finally {
        setLoading(false);
      }
    },
    [sb],
  );

  const prevMonth = () => {
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    setMonth(m); setYear(y);
    loadMonth(y, m);
  };

  const nextMonth = () => {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    setMonth(m); setYear(y);
    loadMonth(y, m);
  };

  // Sync period rows when period tab changes
  useEffect(() => {
    if (period === "month") {
      setPeriodRows(rows);
    } else {
      loadPeriod(period);
    }
  }, [period, rows]);

  // Realtime for calendar rows
  useEffect(() => {
    const range = monthRange(year, month);
    const channel = sb
      .channel("attendance-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, async () => {
        const fresh = await getAttendanceWithLesson(sb, range);
        setRows(fresh);
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [year, month, sb]);

  const stats = useMemo(() => attendanceCalcAll(rows), [rows]);

  // KPI for period tab
  const periodStats = useMemo(() => {
    const present = periodRows.filter((r) => r.status === "present").length;
    const excused = periodRows.filter((r) => r.status === "absent_excused").length;
    const unexcused = periodRows.filter((r) => r.status === "absent_unexcused").length;
    const total = periodRows.length;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, excused, unexcused, total, pct };
  }, [periodRows]);

  const kpiCards = [
    { label: d.attendance.kpiOverall, value: `${stats.overall}%`, color: colors.success },
    { label: d.attendance.kpiDays, value: `${stats.daysWithoutAbsence} ${d.attendance.daysUnit}`, color: colors.primary },
    { label: d.attendance.kpiMissed, value: `${stats.missed} ${d.attendance.lessonsUnit}`, color: colors.warning },
  ];

  const periodKpis = [
    { label: d.attendance.kpiPresent, value: String(periodStats.present), color: colors.success },
    { label: d.attendance.kpiExcused, value: String(periodStats.excused), color: colors.warning },
    { label: d.attendance.kpiUnexcused, value: String(periodStats.unexcused), color: colors.danger },
    { label: d.attendance.kpiTotal, value: String(periodStats.total), color: colors.primary },
  ];

  const periodTabs: { key: Period; label: string }[] = [
    { key: "month", label: d.attendance.periodMonth },
    { key: "semester", label: d.attendance.periodSemester },
    { key: "year", label: d.attendance.periodYear },
  ];

  // Sort lesson list newest first
  const sortedPeriodRows = useMemo(
    () => [...periodRows].sort((a, b) => b.lesson.starts_at.localeCompare(a.lesson.starts_at)),
    [periodRows],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">{d.attendance.title}</h1>

      {/* Month nav for calendar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border border-white/60 bg-white/70 px-1 py-1 shadow-sm backdrop-blur-md">
          <button onClick={prevMonth} aria-label={d.attendance.prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition hover:bg-white/80">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[140px] text-center text-[14px] font-semibold text-gray-800">
            {MONTH_NAMES_RU[month]} {year}
          </span>
          <button onClick={nextMonth} aria-label={d.attendance.nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition hover:bg-white/80">
            <ChevronRight size={16} />
          </button>
        </div>
        {loading && <span className="text-[13px] text-gray-400">{d.common.loading}</span>}
      </div>

      {/* KPI — month view */}
      <div className="grid grid-cols-3 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label}
            className="relative overflow-hidden rounded-[20px] border-[1.5px] border-white/80 bg-white/70 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] backdrop-blur-2xl p-5 flex flex-col gap-1">
            <div className="pointer-events-none absolute -right-12 -top-12 h-24 w-24 rounded-full bg-white/40 blur-2xl" />
            <span className="relative z-10 text-[12px] font-medium text-gray-500">{card.label}</span>
            <span className="relative z-10 text-3xl font-bold leading-tight xl:text-4xl" style={{ color: card.color }}>
              {card.value}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar + by-subject */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-6">
          <AttendanceCalendar rows={rows} year={year} month={month} />
        </GlassCard>
        <GlassCard className="flex flex-col gap-5 p-6">
          <h3 className="text-[15px] font-bold text-gray-900">{d.attendance.bySubjectTitle}</h3>
          <SubjectAttendanceList rows={rows} />
        </GlassCard>
      </div>

      {/* Period tabs + lesson list */}
      <div className="space-y-4">
        {/* Period selector */}
        <div className="flex items-center gap-2">
          {periodTabs.map((t) => (
            <button key={t.key} onClick={() => setPeriod(t.key)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all",
                period === t.key
                  ? "bg-[#185AF7] text-white shadow"
                  : "border border-white/60 bg-white/70 text-gray-700 hover:bg-white/90",
              )}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Period KPI */}
        <div className="grid grid-cols-4 gap-3">
          {periodKpis.map((k) => (
            <div key={k.label}
              className="flex flex-col rounded-[16px] border border-white/80 bg-white/70 px-4 py-3 backdrop-blur-xl"
              style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
              <span className="text-[22px] font-bold leading-tight" style={{ color: k.color }}>{k.value}</span>
              <span className="text-[12px] font-medium text-gray-500">{k.label}</span>
            </div>
          ))}
        </div>

        {/* Lesson list */}
        <div className="rounded-[20px] border border-white/80 bg-white/70 backdrop-blur-xl overflow-hidden"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-[15px] font-bold text-gray-900">{d.attendance.lessonListTitle}</h3>
          </div>

          {sortedPeriodRows.length === 0 ? (
            <div className="px-5 py-10 text-center text-[14px] text-gray-400">{d.attendance.empty}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedPeriodRows.map((row) => {
                const subject = row.lesson.group.subject;
                const style = getSubjectStyle(subject);
                const dateLbl = new Date(row.lesson.starts_at).toLocaleDateString("ru-RU", {
                  day: "numeric", month: "short",
                });
                const { label: badgeLbl, cls: badgeCls } = statusBadge(row.status);
                return (
                  <Link key={row.id} href={`/lessons/${row.lesson_id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-blue-50/30">
                    <SubjectIcon subject={subject} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-slate-800">
                        {row.lesson.topic ?? style.label}
                      </div>
                      <div className="text-[11px] text-slate-400">{style.label} · {dateLbl}</div>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold", badgeCls)}>
                      {badgeLbl}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
