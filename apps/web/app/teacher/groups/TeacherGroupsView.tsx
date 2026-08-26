"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDictionary, getSubjectConfig, pluralizeStudents, averageOf, groupClassLabel } from "@snr/core";
import type { Locale, TeacherGroupSubject } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { subjectIconByName } from "@/lib/subject-icons";
import { Users, MoreVertical, Search } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  groups: Array<{ id: string; name: string; subject: string; schedule_days: string | null; enrolled: Array<{ student_id: string }> }>;
  homework: Array<{ group: { id: string } }>;
  grades: Array<{ group_id: string | null; score: number }>;
  attendance: Array<{ status: string; lesson: { group_id: string } | null }>;
  /** Настоящие предметы текущего учителя по группам — см. getTeacherGroupSubjects. */
  subjects: TeacherGroupSubject[];
}

const GRADIENTS = [
  "linear-gradient(135deg,#3B82F6,#4F46E5)",
  "linear-gradient(135deg,#8B5CF6,#6D28D9)",
];

// 26.08.2026. Своя classBadge снесена: она брала последнее слово названия, а
// у всех групп это слово «класс» — не проходило по длине, и вместо класса
// печатались два первых символа имени («3-А класс» → «3-», «SNR
// Схемотехника» → «SN»). Правило переехало в @snr/core (utils/groupName):
// либо целое обозначение, либо ничего.

export function TeacherGroupsView({ groups, grades, attendance, subjects }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");

  /** Предметы этого учителя по группам. У куратора их в группе несколько. */
  const subjectsByGroup = useMemo(() => {
    const m = new Map<string, TeacherGroupSubject[]>();
    for (const s of subjects) {
      const list = m.get(s.groupId);
      if (list) list.push(s); else m.set(s.groupId, [s]);
    }
    return m;
  }, [subjects]);

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

      // 24.08.2026. Карточка считала средний балл только по оценкам за урок:
      // у Камилы Юсуповой в 7-А выходило 3.91, тогда как по всем её работам
      // того же предмета — 4.39. Теперь getTeacherGrades отдаёт четыре
      // источника по единому правилу (см. utils/gradeAverage), уже суженные
      // до предмета учителя, — здесь остаётся только усреднить.
      const avg = averageOf(groupGrades.map((g) => g.score));
      const avgGrade = avg != null ? avg.toFixed(1) : "—";
      const attended = groupAtt.filter((a) => a.status === "present").length;
      const attendancePct = groupAtt.length ? `${Math.round((attended / groupAtt.length) * 100)}%` : "—";

      return { group, studentCount, hasData, avgGrade, attendancePct };
    })
    .filter((c) => c.studentCount > 0 && c.hasData);

  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    // 26.08.2026: поиск по расписанию убран вместе с обещанием в подсказке —
    // schedule_days пуст у всех семи групп обеих школ, искать там нечего.
    // Предмет ищется по настоящему названию, а не по заглушке groups.subject.
    return cards.filter(({ group }) =>
      group.name.toLowerCase().includes(q) ||
      (subjectsByGroup.get(group.id) ?? []).some((s) => s.name.toLowerCase().includes(q)),
    );
  }, [cards, query, subjectsByGroup]);

  return (
    <div className="max-w-6xl space-y-8">
      <div className="group relative max-w-sm">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-600" />
        <input
          type="text"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder={d.teacher.groupsSearchPlaceholder}
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
            const groupSubjects = subjectsByGroup.get(group.id) ?? [];
            // Один предмет — карточка про него. Несколько (куратор) — карточка
            // про класс, а предметы перечислены подписью. Ни одного — только класс.
            const single = groupSubjects.length === 1 ? groupSubjects[0] : null;
            const cls = groupClassLabel(group.name);
            const color = single?.color ?? getSubjectConfig(null).color;
            const GroupSubjectIcon = subjectIconByName(single?.icon);
            const title = single ? single.name : group.name;
            // У куратора настоящих предметов в группе нет вовсе (все его
            // тринадцать строк в subjects — заглушки каталога), поэтому
            // подписи у него не будет: класс и так стоит на плашке.
            const subtitle = groupSubjects.length > 1
              ? groupSubjects.map((s) => s.name).join(", ")
              : single
              ? (cls ? `${d.teacher.groupClassPrefix} ${cls}` : group.name)
              : "";

            return (
              <Link key={group.id} href={`/teacher/groups/${group.id}`}
                className="group relative overflow-hidden rounded-[24px] border border-white/50 bg-white/70 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all hover:shadow-[0_8px_32px_rgba(37,99,235,0.12)]">
                <div className="absolute right-4 top-4 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">
                  <MoreVertical className="h-5 w-5" />
                </div>

                {/* Шапка: плашка класса с иконкой предмета + название предмета */}
                <div className="mb-5 flex items-center gap-4">
                  <div className={cn(
                    "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] font-bold text-white shadow-lg shadow-blue-500/20",
                    // «10-А» — четыре символа, в 20px шрифте они выходили за плашку.
                    (cls?.length ?? 0) > 3 ? "text-base" : "text-xl",
                  )}
                    style={{ background: GRADIENTS[idx % GRADIENTS.length] }}>
                    {cls ? (
                      <>
                        {cls}
                        <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm" style={{ color }}>
                          <GroupSubjectIcon className="h-3.5 w-3.5" />
                        </span>
                      </>
                    ) : (
                      // Класса в названии нет — вместо огрызка вроде «SN»
                      // плашка показывает иконку предмета во всю ширину.
                      <GroupSubjectIcon className="h-7 w-7" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-bold leading-tight text-gray-900">{title}</h3>
                    {subtitle && subtitle !== title && (
                      <p className="mt-1 truncate text-xs font-medium text-gray-500" title={subtitle}>
                        {subtitle}
                      </p>
                    )}
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
