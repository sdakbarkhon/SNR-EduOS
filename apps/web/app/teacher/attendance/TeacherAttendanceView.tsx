"use client";

import { useCallback, useMemo, useState } from "react";
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
  const sb = useMemo(() => createClient(), []);

  const [groupId, setGroupId] = useState<string>(groups[0]?.id ?? "");
  const [month, setMonth] = useState<string>(defaultMonth);
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(false);

  const monthOptions = useMemo(() => getMonthOptions(12), []);

  const load = useCallback(
    async (gId: string, m: string) => {
      if (!gId) return;
      setLoading(true);
      try {
        const result = await getGroupAttendance(sb, gId, m || undefined);
        setData(result);
      } finally {
        setLoading(false);
      }
    },
    [sb],
  );

  // Initial load on mount
  const [initialized, setInitialized] = useState(false);
  if (!initialized && groups.length > 0) {
    setInitialized(true);
    const firstGroup = groups[0];
    if (firstGroup) load(firstGroup.id, defaultMonth);
  }

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

      {/* Legend */}
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

      {/* Matrix */}
      {!data || (data.lessons.length === 0 || data.students.length === 0) ? (
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
      )}
    </div>
  );
}
