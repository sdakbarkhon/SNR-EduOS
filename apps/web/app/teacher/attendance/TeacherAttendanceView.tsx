"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDictionary, getGroupAttendance, getSubjectStyle, type AttendanceStatus } from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components";
import { cn } from "@/lib/cn";

type Group = { id: string; name: string; subject: string };
type MatrixData = {
  lessons: Array<{ id: string; topic: string | null; starts_at: string }>;
  students: Array<{ id: string; full_name: string }>;
  matrix: Record<string, Record<string, AttendanceStatus | null>>;
  groupAvgPct: number;
};

const MONTH_NAMES_RU = [
  "Янв","Фев","Мар","Апр","Май","Июн",
  "Июл","Авг","Сен","Окт","Ноя","Дек",
];

function cellStyle(status: AttendanceStatus | null): string {
  if (status === "present") return "bg-emerald-100 text-emerald-700";
  if (status === "absent_excused") return "bg-amber-100 text-amber-700";
  if (status === "absent_unexcused") return "bg-red-200 text-red-700";
  return "bg-gray-50 text-gray-300";
}

function cellIcon(status: AttendanceStatus | null): string {
  if (status === "present") return "✓";
  if (status === "absent_excused") return "у";
  if (status === "absent_unexcused") return "—";
  return "·";
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

export function TeacherAttendanceView({
  groups,
  defaultMonth,
}: {
  groups: Group[];
  defaultMonth: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const da = d.attendance;
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null);

  const [groupId, setGroupId] = useState<string>(groups[0]?.id ?? "");
  const [month, setMonth] = useState<string>(defaultMonth);
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"matrix" | "calendar">("matrix");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthOptions = useMemo(() => getMonthOptions(12), []);

  const load = useCallback(async (gId: string, m: string) => {
    const sb = sbRef.current;
    if (!gId || !sb) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await getGroupAttendance(sb as any, gId, m || undefined);
      setData(result ?? { lessons: [], students: [], matrix: {}, groupAvgPct: 0 });
    } catch {
      setData({ lessons: [], students: [], matrix: {}, groupAvgPct: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    sbRef.current = createClient();
    if (groups.length > 0) {
      const firstGroup = groups[0];
      if (firstGroup) load(firstGroup.id, defaultMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onGroupChange = (gId: string) => {
    setGroupId(gId);
    load(gId, month);
  };

  const onMonthChange = (m: string) => {
    setMonth(m);
    load(groupId, m);
  };

  const selectedGroup = groups.find((g) => g.id === groupId);
  const subjectStyle = selectedGroup ? getSubjectStyle(selectedGroup.subject) : null;

  // Lessons grouped by calendar date (YYYY-MM-DD)
  const lessonsByDate = useMemo(() => {
    const map = new Map<string, Array<{ id: string; topic: string | null; starts_at: string }>>();
    if (!data) return map;
    data.lessons.forEach((l) => {
      const date = new Date(l.starts_at).toLocaleDateString("sv", { timeZone: "Asia/Tashkent" }); // "YYYY-MM-DD"
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(l);
    });
    return map;
  }, [data]);

  // Aggregate attendance % for one calendar date
  function dayStats(date: string): { pct: number; present: number; total: number } | null {
    if (!data) return null;
    const lessons = lessonsByDate.get(date);
    if (!lessons?.length) return null;
    let present = 0, total = 0;
    lessons.forEach((l) => {
      data.students.forEach((s) => {
        total++;
        if (data.matrix[s.id]?.[l.id] === "present") present++;
      });
    });
    return { pct: total > 0 ? Math.round((present / total) * 100) : 0, present, total };
  }

  // Calendar grid: array of { date, day } for the selected month
  const calendarCells = useMemo(() => {
    const [ys, ms] = month.split("-");
    const y = Number(ys), m = Number(ms) - 1;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // Mon=0
    const cells: Array<{ date: string | null; day: number | null }> = [];
    for (let i = 0; i < firstDow; i++) cells.push({ date: null, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${ys}-${ms}-${String(d).padStart(2, "0")}`;
      cells.push({ date, day: d });
    }
    return cells;
  }, [month]);

  function daySquareClass(pct: number): string {
    if (pct >= 80) return "bg-emerald-400/30 border-emerald-400/40 text-emerald-800";
    if (pct >= 50) return "bg-amber-400/30 border-amber-400/40 text-amber-800";
    return "bg-rose-400/30 border-rose-400/40 text-rose-800";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">{da.teacherTitle}</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={groupId}
          onChange={(e) => onGroupChange(e.target.value)}
          className="appearance-none rounded-full border border-white/60 bg-white/70 px-4 py-1.5 pr-8 text-[13px] font-semibold text-gray-700 shadow-sm backdrop-blur-md outline-none cursor-pointer"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        <select
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="appearance-none rounded-full border border-white/60 bg-white/70 px-4 py-1.5 pr-8 text-[13px] font-semibold text-gray-700 shadow-sm backdrop-blur-md outline-none cursor-pointer"
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {loading && <span className="text-[12px] text-gray-400">{d.common.loading}</span>}
      </div>

      {/* Avg attendance badge */}
      {data && (
        <div className="flex items-center gap-2">
          <span className="text-[14px] text-gray-600">{da.teacherAvgPct}:</span>
          <span className={cn(
            "rounded-full px-3 py-0.5 text-[14px] font-bold",
            data.groupAvgPct >= 80 ? "bg-emerald-100 text-emerald-700" :
            data.groupAvgPct >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600",
          )}>
            {data.groupAvgPct}%
          </span>
          {subjectStyle && (
            <span className="ml-2 text-[13px] text-gray-500">{subjectStyle.label}</span>
          )}
        </div>
      )}

      {/* Legend + view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-[12px] text-gray-500">
          {[
            { icon: "✓", label: da.teacherLegendPresent, cls: "text-emerald-600" },
            { icon: "у", label: da.teacherLegendLate, cls: "text-amber-600" },
            { icon: "—", label: da.teacherLegendAbsent, cls: "text-red-600" },
            { icon: "·", label: da.teacherLegendNone, cls: "text-gray-300" },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1">
              <span className={cn("font-bold text-[14px]", l.cls)}>{l.icon}</span>
              {l.label}
            </span>
          ))}
        </div>
        <div className="flex items-center rounded-[12px] border border-white/60 bg-white/60 p-1 shadow-sm backdrop-blur-md">
          {(["matrix", "calendar"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => { setViewMode(mode); setSelectedDate(null); }}
              className={cn(
                "rounded-[9px] px-3 py-1.5 text-[13px] font-semibold transition-all",
                viewMode === mode
                  ? "bg-white text-brand-ink shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {mode === "matrix" ? "Матрица" : "Календарь"}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar view */}
      {viewMode === "calendar" && (
        <div className="space-y-4">
          {(!data || data.lessons.length === 0 || data.students.length === 0) ? (
            <div className="rounded-[20px] border border-white/80 bg-white/70 backdrop-blur-xl p-10 text-center">
              <p className="text-[14px] text-gray-400">{da.teacherMatrixEmpty}</p>
            </div>
          ) : (
            <>
              {/* Calendar grid */}
              <div className="rounded-[20px] border border-white/80 bg-white/70 backdrop-blur-xl p-4"
                style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
                {/* Weekday headers */}
                <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map((d2) => (
                    <div key={d2}>{d2}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarCells.map((cell, i) => {
                    if (!cell.date || !cell.day) {
                      return <div key={`empty-${i}`} />;
                    }
                    const stats = dayStats(cell.date);
                    const hasLesson = stats !== null;
                    const isSelected = selectedDate === cell.date;
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        disabled={!hasLesson}
                        onClick={() => setSelectedDate(isSelected ? null : cell.date)}
                        className={cn(
                          "relative flex flex-col items-center justify-center rounded-[10px] border p-1.5 aspect-square transition-all",
                          hasLesson
                            ? cn(daySquareClass(stats!.pct), "cursor-pointer backdrop-blur-sm hover:scale-[1.06] hover:shadow-md", isSelected && "ring-2 ring-brand-blue ring-offset-1")
                            : "border-transparent bg-transparent text-gray-300 cursor-default",
                        )}
                      >
                        <span className={cn("text-[13px] font-bold leading-none", !hasLesson && "text-gray-300")}>
                          {cell.day}
                        </span>
                        {hasLesson && (
                          <span className="mt-0.5 text-[9px] font-semibold opacity-75">
                            {stats!.pct}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected day detail */}
              {selectedDate && (() => {
                const lessons = lessonsByDate.get(selectedDate) ?? [];
                return (
                  <div className="rounded-[20px] border border-white/80 bg-white/70 backdrop-blur-xl p-4"
                    style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
                    <h3 className="mb-3 text-[13px] font-bold text-brand-ink">
                      {new Date(selectedDate + "T12:00:00").toLocaleDateString("ru", { day: "numeric", month: "long", timeZone: "Asia/Tashkent" })}
                      {lessons[0]?.topic ? ` — ${lessons[0].topic}` : ""}
                    </h3>
                    <div className="space-y-1">
                      {data!.students.map((s) => {
                        const statuses = lessons.map((l) => data!.matrix[s.id]?.[l.id] ?? null);
                        const present = statuses.some((st) => st === "present");
                        const excused = !present && statuses.some((st) => st === "absent_excused");
                        return (
                          <div key={s.id} className="flex items-center gap-3 rounded-[10px] px-3 py-2 hover:bg-slate-50/60">
                            <span className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                              present ? "bg-emerald-100 text-emerald-700" :
                              excused ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600",
                            )}>
                              {present ? "✓" : excused ? "у" : "—"}
                            </span>
                            <span className="text-[13px] font-medium text-gray-800">{s.full_name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Matrix view */}
      {viewMode === "matrix" && ((!data || (data.lessons.length === 0 || data.students.length === 0)) ? (
        <div className="rounded-[20px] border border-white/80 bg-white/70 backdrop-blur-xl p-10 text-center space-y-2">
          <p className="text-[14px] text-gray-400">{da.teacherMatrixEmpty}</p>
          {data && data.students.length > 0 && data.lessons.length === 0 && (
            <p className="text-[12px] text-gray-300">Попробуйте выбрать другой месяц</p>
          )}
        </div>
      ) : (
        <div className="rounded-[20px] border border-white/80 bg-white/70 backdrop-blur-xl overflow-x-auto"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <table className="min-w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="sticky left-0 z-10 bg-white/90 px-4 py-3 text-left font-semibold text-gray-600 backdrop-blur-sm min-w-[160px]">
                  {d.teacher.groupStudents}
                </th>
                {data.lessons.map((l) => {
                  const d2 = new Date(l.starts_at);
                  return (
                    <th key={l.id} className="px-2 py-3 text-center font-medium text-gray-400 whitespace-nowrap min-w-[36px]">
                      <div>{d2.getDate()}</div>
                      <div>{MONTH_NAMES_RU[d2.getMonth()]}</div>
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-center font-semibold text-gray-600 whitespace-nowrap">
                  %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.students.map((student) => {
                const row = data.matrix[student.id] ?? {};
                const attended = Object.values(row).filter(
                  (s) => s === "present",
                ).length;
                const total = data.lessons.length;
                const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
                return (
                  <tr key={student.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="sticky left-0 z-10 bg-white/90 px-4 py-2.5 font-medium text-gray-800 backdrop-blur-sm">
                      {student.full_name}
                    </td>
                    {data.lessons.map((l) => {
                      const status = row[l.id] ?? null;
                      return (
                        <td key={l.id} className="px-2 py-2.5 text-center">
                          <span className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold",
                            cellStyle(status),
                          )}>
                            {cellIcon(status)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-center">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold",
                        pct >= 80 ? "bg-emerald-100 text-emerald-700" :
                        pct >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600",
                      )}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
