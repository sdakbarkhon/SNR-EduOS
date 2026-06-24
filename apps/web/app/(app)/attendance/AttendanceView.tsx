"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getDictionary,
  getStudentAttendance,
  getSubjectStyle,
  type AttendanceStatus,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { SubjectIcon, useLocale } from "@/components";
import { cn } from "@/lib/cn";

type AttendanceRecord = {
  id: string;
  lesson_id: string;
  lesson_title: string;
  lesson_topic: string;
  subject: string;
  lesson_date: string;
  status: AttendanceStatus;
  marked_at: string | null;
};

type Stats = { total: number; present: number; late: number; absent: number; percentage: number };

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const MONTH_NAMES_RU = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

function statusColor(status: AttendanceStatus): string {
  if (status === "present") return "#22c55e";
  if (status === "late") return "#f59e0b";
  return "#ef4444";
}

function statusLabel(status: AttendanceStatus, d: ReturnType<typeof getDictionary>): string {
  if (status === "present") return d.attendance.statusPresent;
  if (status === "late") return d.attendance.statusLate;
  if (status === "absent_excused") return d.attendance.statusExcused;
  return d.attendance.statusUnexcused;
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
  while (cur <= end) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return days;
}

function getDotColor(records: AttendanceRecord[], day: Date): string | null {
  const dayStr = day.toISOString().slice(0, 10);
  const dayRecs = records.filter((r) => r.lesson_date.slice(0, 10) === dayStr);
  if (dayRecs.length === 0) return null;
  if (dayRecs.some((r) => r.status === "absent_unexcused")) return "#ef4444";
  if (dayRecs.some((r) => r.status === "absent_excused")) return "#f59e0b";
  if (dayRecs.some((r) => r.status === "late")) return "#f59e0b";
  return "#22c55e";
}

// Generate list of last N months for filter dropdown
function getMonthOptions(n: number): Array<{ value: string; label: string }> {
  const opts: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ value, label: `${MONTH_NAMES_RU[d.getMonth()]} ${d.getFullYear()}` });
  }
  return opts;
}

export function AttendanceView({
  initialRecords,
  initialStats,
  defaultMonth,
}: {
  initialRecords: AttendanceRecord[];
  initialStats: Stats;
  defaultMonth: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const sb = useMemo(() => createClient(), []);

  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>(initialRecords);
  const [allStats, setAllStats] = useState<Stats>(initialStats);
  const [subject, setSubject] = useState<string>("");
  const [month, setMonth] = useState<string>(defaultMonth);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const reload = useCallback(
    async (newSubject: string, newMonth: string) => {
      setLoading(true);
      try {
        const { records, stats } = await getStudentAttendance(sb, {
          subject: newSubject || undefined,
          month: newMonth || undefined,
        });
        setAllRecords(records);
        setAllStats(stats);
      } finally {
        setLoading(false);
      }
    },
    [sb],
  );

  const onSubjectChange = (s: string) => {
    setSubject(s);
    reload(s, month);
  };

  const onMonthChange = (m: string) => {
    setMonth(m);
    reload(subject, m);
  };

  // Build subject list from all initial records (unfiltered)
  const subjectOptions = useMemo(() => {
    const set = new Set(initialRecords.map((r) => r.subject));
    return Array.from(set).sort();
  }, [initialRecords]);

  // Calendar month derived from filter
  const calYear = month ? parseInt(month.slice(0, 4)) : new Date().getFullYear();
  const calMonth = month ? parseInt(month.slice(5, 7)) - 1 : new Date().getMonth();

  const calendarDays = useMemo(() => getCalendarDays(calYear, calMonth), [calYear, calMonth]);

  // Today key for highlight (set after mount to avoid hydration mismatch)
  const [todayKey, setTodayKey] = useState("");
  useEffect(() => {
    const t = new Date();
    setTodayKey(t.toISOString().slice(0, 10));
  }, []);

  const monthOptions = useMemo(() => getMonthOptions(12), []);

  const kpiCards = [
    { label: d.attendance.kpiTotal, value: allStats.total, color: "#6366f1" },
    { label: d.attendance.kpiPresent, value: allStats.present, color: "#22c55e", pct: allStats.percentage },
    { label: d.attendance.kpiLate, value: allStats.late, color: "#f59e0b" },
    { label: d.attendance.kpiAbsent, value: allStats.absent, color: "#ef4444" },
  ];

  const sortedRecords = useMemo(
    () => [...allRecords].sort((a, b) => b.lesson_date.localeCompare(a.lesson_date)),
    [allRecords],
  );

  const selectedMonthLabel = monthOptions.find((o) => o.value === month)?.label ?? month;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">{d.attendance.title}</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Subject filter */}
        <div className="relative">
          <select
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            className="appearance-none rounded-full border border-white/60 bg-white/70 px-4 py-1.5 pr-8 text-[13px] font-semibold text-gray-700 shadow-sm backdrop-blur-md outline-none cursor-pointer"
          >
            <option value="">{d.attendance.filterAllSubjects}</option>
            {subjectOptions.map((s) => (
              <option key={s} value={s}>{getSubjectStyle(s).label}</option>
            ))}
          </select>
          <ChevronRight className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rotate-90 h-3.5 w-3.5 text-gray-400" />
        </div>

        {/* Month filter */}
        <div className="flex items-center gap-1 rounded-full border border-white/60 bg-white/70 px-1 py-1 shadow-sm backdrop-blur-md">
          <button
            onClick={() => {
              const idx = monthOptions.findIndex((o) => o.value === month);
              const next = monthOptions[idx + 1];
              if (idx < monthOptions.length - 1 && next) onMonthChange(next.value);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition hover:bg-white/80"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[140px] text-center text-[13px] font-semibold text-gray-800">
            {selectedMonthLabel}
          </span>
          <button
            onClick={() => {
              const idx = monthOptions.findIndex((o) => o.value === month);
              const prev = monthOptions[idx - 1];
              if (idx > 0 && prev) onMonthChange(prev.value);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition hover:bg-white/80"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {loading && <span className="text-[12px] text-gray-400">{d.common.loading}</span>}
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="relative overflow-hidden rounded-[20px] border-[1.5px] border-white/80 bg-white/70 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] backdrop-blur-2xl p-5 flex flex-col gap-1"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-20 w-20 rounded-full bg-white/40 blur-2xl" />
            <span className="relative z-10 text-[11px] font-medium uppercase tracking-wide text-gray-400">
              {card.label}
            </span>
            <span
              className="relative z-10 text-3xl font-bold leading-tight"
              style={{ color: card.color }}
            >
              {card.value}
            </span>
            {card.pct !== undefined && (
              <span className="relative z-10 text-[12px] font-semibold text-gray-500">
                {card.pct}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Calendar + List */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Calendar */}
        <div className="rounded-[20px] border border-white/80 bg-white/70 backdrop-blur-xl p-5"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <h3 className="mb-4 text-[14px] font-bold text-gray-800">{d.attendance.calendarTitle}</h3>

          {/* Legend */}
          <div className="mb-3 flex flex-wrap gap-3">
            {[
              { color: "#22c55e", label: d.attendance.calendarLegendPresent },
              { color: "#f59e0b", label: d.attendance.calendarLegendLate },
              { color: "#ef4444", label: d.attendance.calendarLegendAbsent },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-x-1 gap-y-1">
            {DAY_LABELS.map((label) => (
              <div key={label} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {label}
              </div>
            ))}
            {calendarDays.map((day) => {
              const inMonth = day.getMonth() === calMonth;
              const dayStr = day.toISOString().slice(0, 10);
              const isToday = mounted && dayStr === todayKey;
              const dotColor = inMonth ? getDotColor(allRecords, day) : null;

              return (
                <div key={dayStr} className="flex flex-col items-center gap-0.5 py-0.5">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center text-[12px] font-medium rounded-full",
                      isToday ? "bg-blue-600 text-white font-bold" : "",
                      !inMonth ? "text-gray-300" : (!isToday ? "text-gray-700" : ""),
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {dotColor && inMonth && (
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail list */}
        <div className="rounded-[20px] border border-white/80 bg-white/70 backdrop-blur-xl overflow-hidden"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-[14px] font-bold text-gray-800">{d.attendance.lessonListTitle}</h3>
          </div>

          {sortedRecords.length === 0 ? (
            <div className="px-5 py-10 text-center text-[14px] text-gray-400">{d.attendance.empty}</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
              {sortedRecords.map((row) => {
                const style = getSubjectStyle(row.subject);
                const dateLbl = new Date(row.lesson_date).toLocaleDateString("ru-RU", {
                  day: "numeric", month: "short", timeZone: "Asia/Tashkent",
                });
                const sColor = statusColor(row.status);
                const sLabel = statusLabel(row.status, d);
                return (
                  <div key={row.id} className="flex items-center gap-3 px-5 py-3">
                    <SubjectIcon subject={row.subject} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-slate-800">
                        {row.lesson_topic || style.label}
                      </div>
                      <div className="text-[11px] text-slate-400">{style.label} · {dateLbl}</div>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white"
                      style={{ backgroundColor: sColor }}
                    >
                      {sLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
