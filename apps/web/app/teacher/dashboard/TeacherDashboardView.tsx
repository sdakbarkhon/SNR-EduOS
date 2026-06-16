"use client";

import Link from "next/link";
import { getDictionary, getSubjectConfig } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { Users, ClipboardList, Clock, BookOpen } from "lucide-react";
import { formatTime } from "@snr/core";

interface Props {
  teacher: { id: string; full_name: string | null } | null;
  groups: Array<{ id: string; name: string; subject: string }>;
  homework: Array<{
    id: string; title: string; due_date: string | null;
    submissions: Array<{ status: string }>;
    teacher_id: string | null;
  }>;
  todayLessons: Array<{ id: string; starts_at: string; ends_at: string; topic: string | null; group: { name: string; subject: string } }>;
  recentSubmissions: Array<{
    id: string; homework_id: string; status: string; submitted_at: string;
    homework: { title: string } | null; student: { full_name: string } | null;
  }>;
}

function KpiCard({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`rounded-[20px] p-5 backdrop-blur-xl border ${accent
      ? "bg-gradient-to-br from-brand-blue/90 to-[#0A3CB4]/90 text-white border-brand-blue/30"
      : "bg-white/70 border-white/80 text-brand-ink"}`}
      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
      <div className={`text-[32px] font-bold leading-none ${accent ? "text-white" : "text-brand-ink"}`}>{value}</div>
      <div className={`mt-1 text-[13px] font-medium ${accent ? "text-white/80" : "text-brand-ink-muted"}`}>{label}</div>
    </div>
  );
}

export function TeacherDashboardView({ teacher, groups, homework, todayLessons, recentSubmissions }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  const myHomework = homework.filter((h) => h.teacher_id !== null);
  const pendingCount = myHomework.reduce((acc, h) => acc + h.submissions.filter((s) => s.status === "submitted").length, 0);
  const now = new Date().toISOString();
  const activeCount = myHomework.filter((h) => !h.due_date || h.due_date > now).length;
  const totalStudents = groups.length * 10; // approximation shown for demo

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-[24px] font-bold text-brand-ink">
          {d.dashboard.greeting.replace("{name}", teacher?.full_name ?? d.teacher.role)}
        </h1>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={d.teacher.kpiGroups} value={groups.length} />
        <KpiCard label={d.teacher.kpiActive} value={activeCount} />
        <KpiCard label={d.teacher.kpiPending} value={pendingCount} accent />
        <KpiCard label={d.teacher.kpiStudents} value={groups.reduce((acc) => acc, 0)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's lessons */}
        <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
          <h2 className="mb-4 text-[16px] font-bold text-brand-ink">{d.teacher.todayLessons}</h2>
          {todayLessons.length === 0 ? (
            <p className="text-[14px] text-brand-ink-muted">{d.teacher.noLessons}</p>
          ) : (
            <div className="space-y-3">
              {todayLessons.map((lesson) => {
                const cfg = getSubjectConfig(lesson.group.subject);
                return (
                  <div key={lesson.id} className="flex items-center gap-3 rounded-[14px] bg-white/60 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{ background: cfg.color + "20" }}>
                      {cfg.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold text-brand-ink">{lesson.group.name}</div>
                      <div className="text-[12px] text-brand-ink-muted">
                        {formatTime(lesson.starts_at)} – {formatTime(lesson.ends_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
          <h2 className="mb-4 text-[16px] font-bold text-brand-ink">{d.teacher.recentActivity}</h2>
          {recentSubmissions.length === 0 ? (
            <p className="text-[14px] text-brand-ink-muted">{d.teacher.noActivity}</p>
          ) : (
            <div className="space-y-2">
              {recentSubmissions.slice(0, 6).map((sub) => (
                <Link key={sub.id} href={`/teacher/homework/${sub.homework_id}`}
                  className="flex items-center gap-3 rounded-[14px] bg-white/60 p-3 transition-colors hover:bg-white/90">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
                    <ClipboardList size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-brand-ink">
                      {sub.student?.full_name} — {sub.homework?.title}
                    </div>
                    <div className={`text-[11px] font-medium ${sub.status === "submitted" ? "text-amber-500" : "text-emerald-500"}`}>
                      {sub.status === "submitted" ? d.teacher.statusPending : d.teacher.statusGraded}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
