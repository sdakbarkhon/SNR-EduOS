"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, RefreshCw } from "lucide-react";
import {
  attendancePercent,
  format,
  formatDate,
  formatTime,
  getDictionary,
  getSubjectStyle,
  nextLesson,
  type Lesson,
  type Group,
  type Homework,
  type HomeworkSubmission,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { factBanner } from "@snr/ui-tokens";
import { EmptyState, MaterialTile, RingProgress, SubjectIcon, useLocale } from "@/components";
import { DashboardCard } from "@/components/DashboardCard";
import type { Database } from "@snr/core";
import { FloatingActionButton } from "./FloatingActionButton";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Material = Database["public"]["Tables"]["course_materials"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

function getClassLabel(groups: Group[]): string {
  if (!groups.length) return "";
  const extract = (name: string) => {
    const m = name.match(/(\d+\s*[А-ЯA-Z][а-яa-z]?)$/);
    return m?.[1]?.replace(/\s+/, "") ?? null;
  };
  const labels = [...new Set(groups.map((g) => extract(g.name)).filter(Boolean))];
  return labels.length === 1 ? (labels[0] as string) : (extract(groups[0]?.name ?? "") ?? "");
}

export function DashboardView({
  student,
  lessons,
  homework,
  submissions,
  attendance,
  groups,
  materials,
}: {
  student: Student;
  lessons: Lesson[];
  homework: Homework[];
  submissions: HomeworkSubmission[];
  attendance: Attendance[];
  groups: Group[];
  materials: Material[];
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  // Live clock — null until client mounts to avoid hydration mismatch
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // AI fact of day
  const [aiFactText, setAiFactText] = useState<string | null>(null);
  const [factLoading, setFactLoading] = useState(true);

  async function loadFact() {
    setFactLoading(true);
    try {
      const res = await fetch("/api/daily-fact");
      const data = (await res.json()) as { text?: string; error?: string };
      if (data.text) setAiFactText(data.text);
    } catch {
      // noop — fact stays null, banner hides
    }
    setFactLoading(false);
  }

  useEffect(() => { loadFact(); }, []);

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const next = nextLesson(lessons);
  const nextSubject = next ? (groupById.get(next.group_id)?.subject ?? null) : null;
  const submittedIds = new Set(submissions.map((s) => s.homework_id));
  const activeCount = homework.filter((h) => !submittedIds.has(h.id)).length;
  const attPct = attendancePercent(attendance as any);
  const subjects = Array.from(new Set(groups.map((g) => g.subject)));
  const recent = materials.slice(0, 4);
  const firstName = student.full_name.split(" ")[0] ?? student.full_name;
  const classLabel = getClassLabel(groups);

  // Active homework count per subject (for badges)
  const activeBySub = new Map<string, number>();
  for (const h of homework) {
    if (!submittedIds.has(h.id)) {
      const g = groupById.get(h.group_id);
      if (g) activeBySub.set(g.subject, (activeBySub.get(g.subject) ?? 0) + 1);
    }
  }

  const timeStr = now
    ? now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";
  // null on server + first client render → empty placeholder to avoid hydration mismatch
  // (Vercel renders in UTC, client is in local TZ — the date string can differ).
  const dateStr = now
    ? now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })
    : "";
  const dateCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const activeSuffix = format(d.dashboard.activeTasks, { count: "" }).trim();

  return (
    <div className="space-y-6">
      {/* Header: greeting (left) + live clock (right) */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-gray-900 md:text-[34px]">
            {format(d.dashboard.greeting, { name: firstName })}
          </h2>
          {classLabel && (
            <p className="mt-0.5 text-[15px] font-medium text-gray-500">
              Группа — {classLabel}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-[26px] font-semibold text-slate-700 tabular-nums">
            {timeStr}
          </p>
          <p className="mt-0.5 text-[13px] text-slate-400">{dateCapitalized}</p>
        </div>
      </div>

      {/* KPI — 3 clickable cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <DashboardCard title={d.dashboard.nextLesson} href={next ? `/lessons/${next.id}` : "/schedule"}>
          {next ? (
            <div className="flex items-center gap-4">
              <SubjectIcon subject={nextSubject} size={64} />
              <div className="flex flex-col">
                <span className="text-[18px] font-bold text-gray-900">
                  {getSubjectStyle(nextSubject).label}
                </span>
                <span className="text-[14px] text-gray-500">
                  {formatTime(next.starts_at)}
                </span>
                {next.room && (
                  <span className="text-[13px] text-gray-400">
                    {d.dashboard.room} {next.room}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-[14px] text-gray-400">{d.dashboard.noNextLesson}</span>
          )}
        </DashboardCard>

        <DashboardCard title={d.dashboard.myTasks} href="/homework">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 shadow-sm">
              <Copy size={22} className="text-blue-600" />
            </div>
            <p className="text-[28px] font-bold leading-none text-gray-900">
              {activeCount}
              <span className="ml-2 text-base font-medium text-gray-500">{activeSuffix}</span>
            </p>
          </div>
        </DashboardCard>

        <DashboardCard title={d.dashboard.weekProgress} href="/attendance">
          <div className="flex items-center gap-5">
            <RingProgress value={attPct} size={72} />
            <div>
              <p className="text-[32px] font-bold leading-none text-gray-900">{attPct}%</p>
              <p className="mt-1 text-[13px] text-gray-400">{d.attendance.overall}</p>
            </div>
          </div>
        </DashboardCard>
      </div>

      {/* AI Факт дня */}
      <div
        className="relative overflow-hidden rounded-[28px] p-7 text-white shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${factBanner.from} 0%, ${factBanner.mid} 50%, ${factBanner.to} 100%)`,
        }}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-20 right-12 h-64 w-64 rounded-full bg-white/5" />
        <span className="relative text-xs font-bold uppercase tracking-widest text-blue-200">
          {d.dashboard.factOfDay}
        </span>
        {factLoading ? (
          <div className="relative mt-3 flex gap-1.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:300ms]" />
          </div>
        ) : aiFactText ? (
          <p className="relative mt-3 max-w-[75%] text-[15px] leading-relaxed text-blue-100/95">
            {aiFactText}
          </p>
        ) : (
          <button
            type="button"
            onClick={loadFact}
            className="relative mt-3 flex items-center gap-1.5 text-sm text-blue-100/80 transition-colors hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Загрузить факт
          </button>
        )}
      </div>

      {/* Предметы + Материалы */}
      <div className="grid gap-6 lg:grid-cols-3">
        <DashboardCard title={d.dashboard.mySubjects} className="lg:col-span-2">
          {subjects.length ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {subjects.map((s) => {
                const badge = activeBySub.get(s) ?? 0;
                return (
                  <Link href={`/homework?subject=${encodeURIComponent(s)}`} key={s}>
                    <div className="relative flex flex-col items-center gap-2 rounded-2xl p-3 transition-all hover:scale-[1.02] hover:bg-slate-50 cursor-pointer">
                      <div className="relative">
                        <SubjectIcon subject={s} size={60} />
                        {badge > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                            {badge}
                          </span>
                        )}
                      </div>
                      <span className="w-full truncate text-center text-[13px] font-semibold text-gray-800">
                        {getSubjectStyle(s).label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState>{d.common.none}</EmptyState>
          )}
        </DashboardCard>

        <DashboardCard title={d.dashboard.recentMaterials} href="/materials">
          {recent.length ? (
            <div className="flex flex-col">
              {recent.map((m) => (
                <MaterialTile
                  key={m.id}
                  title={m.title}
                  type={m.type}
                  meta={formatDate(m.created_at)}
                  layout="row"
                />
              ))}
            </div>
          ) : (
            <EmptyState>{d.common.none}</EmptyState>
          )}
        </DashboardCard>
      </div>

      <FloatingActionButton />
    </div>
  );
}
