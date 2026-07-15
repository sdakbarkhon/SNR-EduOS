"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDictionary, getSubjectConfig, pluralizeStudents } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { resolveSubjectIcon } from "@/components/SubjectIcon";
import { Users, MoreVertical, Search } from "lucide-react";

interface Props {
  groups: Array<{ id: string; name: string; subject: string; schedule_days: string | null; enrolled: Array<{ student_id: string }> }>;
  homework: Array<{ group: { id: string } }>;
  grades: Array<{ group_id: string | null; score: number }>;
  attendance: Array<{ status: string; lesson: { group_id: string } | null }>;
}

const GRADIENTS = [
  "linear-gradient(135deg,#3B82F6,#4F46E5)",
  "linear-gradient(135deg,#8B5CF6,#6D28D9)",
];

/** Short class badge from group name, e.g. "Programming 7A" → "7A". */
function classBadge(name: string): string {
  const last = name.trim().split(/\s+/).pop() ?? name;
  return last.length <= 4 ? last : name.slice(0, 2).toUpperCase();
}

export function TeacherGroupsView({ groups, grades, attendance }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // Build per-group stats; keep only groups with students AND some real data.
  const cards = groups
    .map((group) => {
      const studentCount = group.enrolled?.length ?? 0;
      const groupGrades = grades.filter((g) => g.group_id === group.id);
      const groupAtt = attendance.filter((a) => a.lesson?.group_id === group.id);
      const hasData = groupGrades.length > 0 || groupAtt.length > 0;

      const avgGrade = groupGrades.length
        ? (groupGrades.reduce((a, g) => a + g.score, 0) / groupGrades.length).toFixed(1)
        : "—";
      const attended = groupAtt.filter((a) => a.status === "present").length;
      const attendancePct = groupAtt.length ? `${Math.round((attended / groupAtt.length) * 100)}%` : "—";

      return { group, studentCount, hasData, avgGrade, attendancePct };
    })
    .filter((c) => c.studentCount > 0 && c.hasData);

  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(({ group }) =>
      group.name.toLowerCase().includes(q) ||
      getSubjectConfig(group.subject).label.toLowerCase().includes(q) ||
      (group.schedule_days ?? "").toLowerCase().includes(q),
    );
  }, [cards, query]);

  return (
    <div className="max-w-6xl space-y-8">
      <div className="group relative max-w-sm">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-600" />
        <input
          type="text"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder="Поиск по классу, предмету или расписанию…"
          className="w-full rounded-[16px] border border-white/50 bg-white/60 py-3 pl-11 pr-4 text-sm font-medium text-gray-700 shadow-sm backdrop-blur outline-none transition-all placeholder:text-gray-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {filteredCards.length === 0 ? (
        <div className="rounded-[20px] border border-white/80 bg-white/70 p-8 text-center text-brand-ink-muted">
          {d.common.none}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCards.map(({ group, studentCount, avgGrade, attendancePct }, idx) => {
            const cfg = getSubjectConfig(group.subject);
            const { Icon: GroupSubjectIcon } = resolveSubjectIcon(group.subject);
            const badge = classBadge(group.name);
            const schedule = group.schedule_days?.trim();

            return (
              <Link key={group.id} href={`/teacher/groups/${group.id}`}
                className="group relative overflow-hidden rounded-[24px] border border-white/50 bg-white/70 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all hover:shadow-[0_8px_32px_rgba(37,99,235,0.12)]">
                <div className="absolute right-4 top-4 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">
                  <MoreVertical className="h-5 w-5" />
                </div>

                {/* Header: class tile (with subject emoji) + subject name + schedule */}
                <div className="mb-5 flex items-center gap-4">
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] text-xl font-bold text-white shadow-lg shadow-blue-500/20"
                    style={{ background: GRADIENTS[idx % GRADIENTS.length] }}>
                    {badge}
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm" style={{ color: cfg.color }}>
                      <GroupSubjectIcon className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-bold leading-tight text-gray-900">{cfg.label}</h3>
                    <p className="mt-1 truncate text-xs font-medium text-gray-500">
                      Класс {badge}{schedule ? ` · ${schedule}` : ""}
                    </p>
                  </div>
                </div>

                {/* Stats: student count + avg grade + attendance */}
                <div className="border-t border-gray-100/50 pt-4">
                  <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                    <Users className="h-3.5 w-3.5" />
                    {pluralizeStudents(studentCount, locale)}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-1 text-xs font-medium text-gray-500">{d.teacher.groupAvgScore}</p>
                      <p className="flex items-baseline space-x-1 text-2xl font-bold text-gray-900">
                        <span>{avgGrade}</span>
                        <span className="text-sm font-medium text-gray-400">/ 5</span>
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-gray-500">{d.teacher.groupAttendance}</p>
                      <p className="text-2xl font-bold text-gray-900">{attendancePct}</p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
