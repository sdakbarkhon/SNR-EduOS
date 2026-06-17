"use client";

import Link from "next/link";
import { getDictionary, getSubjectConfig, formatTime } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { Avatar } from "@/components/Avatar";
import { Users, FileText, CheckCircle2, BookOpen, Clock } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  teacher: { id: string; full_name: string | null } | null;
  groups: Array<{ id: string; name: string; subject: string; enrolled: Array<{ student_id: string }> }>;
  homework: Array<{
    id: string; title: string; due_date: string | null;
    submissions: Array<{ status: string }>;
    test_subs: Array<{ id: string }>;
    teacher_id: string | null;
  }>;
  todayLessons: Array<{ id: string; starts_at: string; ends_at: string; topic: string | null; group: { name: string; subject: string } }>;
  recentSubmissions: Array<{
    id: string; homework_id: string; status: string; submitted_at: string;
    homework: { title: string } | null; student: { full_name: string } | null;
  }>;
  grades: Array<{ group_id: string | null; score: number }>;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const days = Math.floor(h / 24);
  return `${days} дн назад`;
}

function KpiCard({ title, value, icon: Icon, highlight }: {
  title: string; value: string | number; icon: typeof Users; highlight?: boolean;
}) {
  return (
    <div className={cn(
      "relative flex h-32 flex-col justify-between overflow-hidden rounded-[24px] p-5",
      highlight
        ? "bg-blue-600 text-white shadow-xl shadow-blue-600/30"
        : "border border-white bg-white/70 shadow-sm backdrop-blur-xl",
    )}>
      <div className="relative z-10">
        <div className={cn("mb-1 text-sm", highlight ? "opacity-80" : "text-slate-500")}>{title}</div>
        <div className={cn("text-3xl font-bold", highlight ? "text-white" : "text-slate-800")}>{value}</div>
      </div>
      {highlight && (
        <div className="absolute -bottom-2 -right-2 opacity-20">
          <Icon className="h-20 w-20" />
        </div>
      )}
    </div>
  );
}

export function TeacherDashboardView({ teacher, groups, homework, todayLessons, recentSubmissions, grades }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  // Real KPI computations
  const studentIds = new Set<string>();
  groups.forEach((g) => g.enrolled?.forEach((e) => studentIds.add(e.student_id)));
  const totalStudents = studentIds.size;

  const pendingCount = homework.reduce((acc, h) => acc + h.submissions.filter((s) => s.status === "submitted").length, 0);
  const checkedCount = homework.reduce((acc, h) => acc + h.submissions.filter((s) => s.status === "graded").length, 0);
  const avgScore = grades.length
    ? (grades.reduce((acc, g) => acc + g.score, 0) / grades.length).toFixed(1)
    : "—";

  return (
    <div className="max-w-6xl space-y-8 pb-4">
      {/* Greeting + AI button */}
      <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
          {d.dashboard.greeting.replace("{name}", teacher?.full_name ?? d.teacher.role)} 👋
        </h1>
        <button
          onClick={() => alert(d.teacher.aiStub)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:brightness-110"
        >
          ✨ Сгенерировать с помощью ИИ
        </button>
      </header>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        <KpiCard title="Всего учеников" value={totalStudents} icon={Users} />
        <KpiCard title="На проверке" value={pendingCount} icon={FileText} highlight />
        <KpiCard title="Проверено" value={checkedCount} icon={CheckCircle2} />
        <KpiCard title="Средний балл" value={avgScore} icon={BookOpen} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Today's lessons */}
        <section className="flex flex-[1.5] flex-col rounded-[24px] border border-white bg-white/70 p-6 shadow-sm backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">{d.teacher.todayLessons}</h2>
          </div>
          {todayLessons.length === 0 ? (
            <p className="text-sm text-slate-400">{d.teacher.noLessons}</p>
          ) : (
            <div className="space-y-3">
              {todayLessons.map((lesson) => {
                const cfg = getSubjectConfig(lesson.group.subject);
                return (
                  <div key={lesson.id} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white/50 p-4 transition-shadow hover:shadow-md">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                      <Clock className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-slate-800">{cfg.label}</div>
                      <div className="truncate text-xs text-slate-400">{lesson.topic ?? lesson.group.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-800">{formatTime(lesson.starts_at)}</div>
                      <div className="mt-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{lesson.group.name}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent activity */}
        <section className="flex flex-1 flex-col rounded-[24px] border border-white bg-white/70 p-6 shadow-sm backdrop-blur-xl">
          <h2 className="mb-6 text-lg font-bold text-slate-800">{d.teacher.recentActivity}</h2>
          {recentSubmissions.length === 0 ? (
            <p className="text-sm text-slate-400">{d.teacher.noActivity}</p>
          ) : (
            <div className="space-y-4">
              {recentSubmissions.slice(0, 6).map((sub) => (
                <Link key={sub.id} href={`/teacher/homework/${sub.homework_id}`} className="flex items-start gap-3">
                  <Avatar name={sub.student?.full_name ?? "?"} size={32} />
                  <div className="text-sm leading-snug">
                    <span className="font-bold text-slate-800">{sub.student?.full_name}</span>{" "}
                    {sub.status === "graded" ? "получил(а) оценку за" : "сдал(а) задание"}{" "}
                    <span className="font-medium italic text-blue-600">«{sub.homework?.title}»</span>
                    <div className="mt-1 text-[10px] text-slate-400">{timeAgo(sub.submitted_at)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
