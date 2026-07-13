"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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

type Stats = { total: number; present: number; excused: number; unexcused: number; percentage: number };

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const MONTH_NAMES_RU = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

const MONTH_NAMES_RU_SHORT = [
  "янв","фев","мар","апр","мая","июн",
  "июл","авг","сен","окт","ноя","дек",
];

function statusLabel(status: AttendanceStatus, d: ReturnType<typeof getDictionary>): string {
  if (status === "present") return d.attendance.statusPresent;
  if (status === "absent_excused") return d.attendance.statusExcused;
  return d.attendance.statusUnexcused;
}

function statusColor(status: AttendanceStatus): string {
  if (status === "present") return "#22c55e";
  if (status === "absent_excused") return "#f59e0b";
  return "#ef4444";
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

/** For a given day string, return the "dominant" attendance status (worst first). */
function getDayStatus(
  records: AttendanceRecord[],
  dayStr: string,
): { status: "present" | "excused" | "unexcused" | "none"; dayRecords: AttendanceRecord[] } {
  const dayRecs = records.filter((r) => r.lesson_date.slice(0, 10) === dayStr);
  if (dayRecs.length === 0) return { status: "none", dayRecords: [] };
  if (dayRecs.some((r) => r.status === "absent_unexcused")) return { status: "unexcused", dayRecords: dayRecs };
  if (dayRecs.some((r) => r.status === "absent_excused")) return { status: "excused", dayRecords: dayRecs };
  return { status: "present", dayRecords: dayRecs };
}

function daySquareClass(status: "present" | "excused" | "unexcused" | "none", isToday: boolean): string {
  const base = "aspect-square rounded-2xl backdrop-blur-md border shadow-sm flex items-center justify-center transition-all duration-150";
  if (isToday) return cn(base, "ring-2 ring-blue-500");
  if (status === "present") return cn(base, "bg-emerald-200/40 border-emerald-300/60 cursor-pointer hover:scale-105");
  if (status === "excused") return cn(base, "bg-amber-200/40 border-amber-300/60 cursor-pointer hover:scale-105");
  if (status === "unexcused") return cn(base, "bg-rose-200/40 border-rose-300/60 cursor-pointer hover:scale-105");
  return cn(base, "bg-slate-100/40 border-slate-200/40 cursor-default");
}

function dayTextClass(status: "present" | "excused" | "unexcused" | "none", inMonth: boolean): string {
  if (!inMonth) return "text-[11px] font-medium text-slate-300";
  if (status === "present") return "text-[12px] font-bold text-emerald-900";
  if (status === "excused") return "text-[12px] font-bold text-amber-900";
  if (status === "unexcused") return "text-[12px] font-bold text-rose-900";
  return "text-[12px] font-medium text-slate-400";
}

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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const reload = useCallback(
    async (newSubject: string, newMonth: string) => {
      setLoading(true);
      setSelectedDate(null);
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

  const onSubjectChange = (s: string) => { setSubject(s); reload(s, month); };
  const onMonthChange = (m: string) => { setMonth(m); reload(subject, m); };

  const subjectOptions = useMemo(() => {
    const set = new Set(initialRecords.map((r) => r.subject));
    return Array.from(set).sort();
  }, [initialRecords]);

  const calYear = month ? parseInt(month.slice(0, 4)) : new Date().getFullYear();
  const calMonth = month ? parseInt(month.slice(5, 7)) - 1 : new Date().getMonth();
  const calendarDays = useMemo(() => getCalendarDays(calYear, calMonth), [calYear, calMonth]);

  const [todayKey, setTodayKey] = useState("");
  useEffect(() => {
    const t = new Date();
    setTodayKey(t.toISOString().slice(0, 10));
  }, []);

  const monthOptions = useMemo(() => getMonthOptions(12), []);

  const kpiCards = [
    { label: d.attendance.kpiTotal, value: allStats.total, color: "#6366f1" },
    { label: d.attendance.kpiPresent, value: allStats.present, color: "#22c55e", pct: allStats.percentage },
    { label: d.attendance.kpiExcused, value: allStats.excused, color: "#f59e0b" },
    { label: d.attendance.kpiAbsent, value: allStats.unexcused, color: "#ef4444" },
  ];

  const sortedRecords = useMemo(
    () => [...allRecords].sort((a, b) => b.lesson_date.localeCompare(a.lesson_date)),
    [allRecords],
  );

  const selectedMonthLabel = monthOptions.find((o) => o.value === month)?.label ?? month;

  // Detail panel for selected day
  const selectedDayRecords = useMemo(() => {
    if (!selectedDate) return [];
    return allRecords
      .filter((r) => r.lesson_date.slice(0, 10) === selectedDate)
      .sort((a, b) => a.lesson_date.localeCompare(b.lesson_date));
  }, [selectedDate, allRecords]);

  const selectedDayLabel = useMemo(() => {
    if (!selectedDate) return "";
    const d2 = new Date(selectedDate);
    return `${d2.getDate()} ${MONTH_NAMES_RU_SHORT[d2.getMonth()]} ${d2.getFullYear()}`;
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">{d.attendance.title}</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
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
        <div className="space-y-4">
          <div
            className="rounded-[20px] border border-white/80 bg-white/70 backdrop-blur-xl p-5"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
          >
            <h3 className="mb-4 text-[14px] font-bold text-gray-800">{d.attendance.calendarTitle}</h3>

            {/* Legend */}
            <div className="mb-4 flex flex-wrap gap-3">
              {[
                { cls: "bg-emerald-200/60 border-emerald-300/60", label: d.attendance.calendarLegendPresent },
                { cls: "bg-amber-200/60 border-amber-300/60", label: d.attendance.calendarLegendExcused },
                { cls: "bg-rose-200/60 border-rose-300/60", label: d.attendance.calendarLegendAbsent },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <span className={cn("inline-block h-3 w-3 rounded border", l.cls)} />
                  {l.label}
                </span>
              ))}
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_LABELS.map((label) => (
                <div key={label} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {label}
                </div>
              ))}
            </div>

            {/* Calendar grid — glass squares */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const inMonth = day.getMonth() === calMonth;
                const dayStr = day.toISOString().slice(0, 10);
                const isToday = mounted && dayStr === todayKey;
                const { status, dayRecords } = inMonth
                  ? getDayStatus(allRecords, dayStr)
                  : { status: "none" as const, dayRecords: [] };
                const hasLesson = dayRecords.length > 0;
                const isSelected = selectedDate === dayStr;

                return (
                  <button
                    key={dayStr}
                    type="button"
                    disabled={!inMonth || !hasLesson}
                    onClick={() => {
                      if (!hasLesson) return;
                      setSelectedDate((prev) => (prev === dayStr ? null : dayStr));
                    }}
                    className={cn(
                      daySquareClass(inMonth ? status : "none", isToday),
                      isSelected && "ring-2 ring-blue-400",
                    )}
                  >
                    <span className={dayTextClass(inMonth ? status : "none", inMonth)}>
                      {day.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day detail panel */}
          {selectedDate && selectedDayRecords.length > 0 && (
            <div
              className="rounded-[20px] border border-white/80 bg-white/80 backdrop-blur-xl overflow-hidden"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                <h4 className="text-[13px] font-bold text-gray-800">
                  Уроки {selectedDayLabel}
                </h4>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {selectedDayRecords.map((row) => {
                  const style = getSubjectStyle(row.subject);
                  const timeLbl = new Date(row.lesson_date).toLocaleTimeString("ru-RU", {
                    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent",
                  });
                  const sColor = statusColor(row.status);
                  const sLbl = statusLabel(row.status, d);
                  return (
                    <div key={row.id} className="flex items-center gap-3 px-5 py-3">
                      <SubjectIcon subject={row.subject} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-slate-800">
                          {row.lesson_topic || style.label}
                        </div>
                        <div className="text-[11px] text-slate-400">{style.label} · {timeLbl}</div>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white"
                        style={{ backgroundColor: sColor }}
                      >
                        {sLbl}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Detail list */}
        <div
          className="rounded-[20px] border border-white/80 bg-white/70 backdrop-blur-xl overflow-hidden"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
        >
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-[14px] font-bold text-gray-800">{d.attendance.lessonListTitle}</h3>
          </div>

          {sortedRecords.length === 0 ? (
            <div className="px-5 py-10 text-center text-[14px] text-gray-400">{d.attendance.empty}</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[440px] overflow-y-auto">
              {sortedRecords.map((row) => {
                const style = getSubjectStyle(row.subject);
                const dateLbl = new Date(row.lesson_date).toLocaleDateString("ru-RU", {
                  day: "numeric", month: "short", timeZone: "Asia/Tashkent",
                });
                const sColor = statusColor(row.status);
                const sLbl = statusLabel(row.status, d);
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
                      {sLbl}
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
