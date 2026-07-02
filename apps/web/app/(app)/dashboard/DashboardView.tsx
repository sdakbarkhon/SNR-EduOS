"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot, BookOpen,
  Sparkles, ArrowRight, FileText, Folder, UserPlus, Calendar,
} from "lucide-react";
import {
  formatTime,
  getDictionary,
  type Lesson,
  type Group,
  type Homework,
  type HomeworkSubmission,
  type WeeklyStageProgress,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components";
import { useToast } from "@/components/Toast";
import { getClassLabel } from "@/lib/student-class-label";
import { LUCIDE_ICONS } from "@/lib/subject-icons";
import type { Database } from "@snr/core";
import { FloatingActionButton } from "./FloatingActionButton";

type Student = Database["public"]["Tables"]["students"]["Row"];
type SubjectRow = { id: string; name: string; group_id: string; icon: string; color: string };

function dayOfYear(d: Date): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
}

export function DashboardView({
  student,
  lessons,
  homework,
  submissions,
  groups,
  weeklyProgress,
}: {
  student: Student;
  lessons: Lesson[];
  homework: Homework[];
  submissions: HomeworkSubmission[];
  groups: Group[];
  weeklyProgress: WeeklyStageProgress;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.dashboard;
  const db = createClient();
  const showToast = useToast();

  // Subjects loaded from the subjects table, realtime-synced (Iter4 P2).
  const [mySubjects, setMySubjects] = useState<SubjectRow[]>([]);
  const stableLoadSubjects = useRef<() => Promise<void>>(undefined);

  // null until client mounts — avoids a UTC(server)/local(client) hydration mismatch
  // when deciding which lessons count as "today" (project-wide rule, see memory).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);

  useEffect(() => {
    stableLoadSubjects.current = async () => {
      if (!groups.length) return;
      const groupIds = groups.map((g) => g.id);
      const { data } = await (db as any).from("subjects").select("id, name, group_id, icon, color").in("group_id", groupIds);
      if (data) setMySubjects(data as SubjectRow[]);
    };
    stableLoadSubjects.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  useEffect(() => {
    const channel = db
      .channel("dashboard-subjects")
      .on("postgres_changes", { event: "*", schema: "public", table: "subjects" }, () => {
        stableLoadSubjects.current?.();
      })
      .subscribe();
    return () => { db.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI fact of the day (unchanged logic from before the redesign).
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

  // There's no "full description" backing the fact of the day — searching it
  // on Google is the fallback the spec allows when no extended content exists.
  function learnMore() {
    if (!aiFactText) return;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(aiFactText)}`, "_blank", "noopener,noreferrer");
  }

  const submittedIds = new Set(submissions.map((s) => s.homework_id));
  const activeHomeworkCount = homework.filter((h) => !submittedIds.has(h.id)).length;
  const firstName = student.full_name.split(" ")[0] ?? student.full_name;
  const classLabel = getClassLabel(groups);
  const greeting = t.greetings[dayOfYear(now ?? new Date()) % t.greetings.length];

  // Today's lessons (all of them, not just the next one) — only computed
  // client-side once `now` is set, for the same hydration-safety reason above.
  const todayLessons = now
    ? lessons
        .filter((l) => new Date(l.starts_at).toDateString() === now.toDateString())
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    : [];
  const subjectById = new Map(mySubjects.map((s) => [s.id, s]));

  // Per-subject progress: completed vs. total lessons for that subject_id.
  const subjectsWithProgress = mySubjects.map((sub) => {
    const subjectLessons = lessons.filter((l) => l.subject_id === sub.id);
    const total = subjectLessons.length;
    const done = subjectLessons.filter((l) => l.status === "completed").length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { ...sub, percent };
  });

  const progressCirc = 2 * Math.PI * 45;
  const progressOffset = progressCirc * (1 - weeklyProgress.percent / 100);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Левая часть (2 колонки) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Приветствие */}
          <div>
            <h1 className="flex items-center gap-2 text-[28px] font-bold tracking-tight text-slate-900 md:text-[32px]">
              {t.greeting.replace("{name}", firstName)}
              <span className="inline-block animate-wave text-3xl">👋</span>
            </h1>
            <p className="mt-2 text-base text-slate-600">{greeting}</p>
          </div>

          {/* Факт дня */}
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 p-6 text-white shadow-lg">
            <div className="absolute top-2 right-6 h-2 w-2 rounded-full bg-white/40" />
            <div className="absolute top-8 right-12 h-1.5 w-1.5 rounded-full bg-white/60" />
            <div className="absolute bottom-4 right-4 h-3 w-3 rounded-full bg-white/30" />

            <div className="relative z-10">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-medium">{t.factOfDay}</span>
              </div>

              {factLoading ? (
                <div className="flex gap-1.5 py-2">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:300ms]" />
                </div>
              ) : (
                <p className="mb-4 max-w-md text-xl font-bold leading-tight">{aiFactText}</p>
              )}

              {!factLoading && aiFactText && (
                <button
                  onClick={learnMore}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm transition hover:bg-white/30"
                >
                  {t.learnMore}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Быстрые действия */}
          <div>
            <h2 className="mb-4 text-lg font-bold text-slate-900">{t.quickActions}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <QuickAction icon={<FileText />} color="orange" label={t.qaHomework} badge={activeHomeworkCount} href="/homework" />
              <QuickAction icon={<Folder />} color="violet" label={t.qaFiles} href="/materials" />
              <QuickAction icon={<UserPlus />} color="pink" label={t.qaTeacher} onClick={() => showToast(d.auth.comingSoon)} />
              <QuickAction icon={<Bot />} color="green" label={t.qaAI} href="/ai-assistant" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Мой прогресс */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6">
              <h3 className="mb-4 text-base font-bold text-slate-900">{t.myProgress}</h3>
              <div className="relative mx-auto h-48 w-48">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                  <circle
                    cx="50" cy="50" r="45" fill="none"
                    stroke="url(#dashboard-progress-gradient)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={progressCirc}
                    strokeDashoffset={progressOffset}
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="dashboard-progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-slate-900">{weeklyProgress.percent}%</span>
                  <span className="mt-1 text-xs text-slate-500">{t.progressWeekly}</span>
                </div>
              </div>
            </div>

            {/* Мои предметы */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">{t.mySubjects}</h3>
                <Link href="/lessons" className="text-sm text-orange-500 hover:text-orange-600">
                  {t.seeAll}
                </Link>
              </div>
              {subjectsWithProgress.length ? (
                <div className="grid grid-cols-3 gap-3">
                  {subjectsWithProgress.slice(0, 3).map((sub) => {
                    const SubIcon = LUCIDE_ICONS[sub.icon] ?? BookOpen;
                    return (
                      <div key={sub.id} className="rounded-2xl p-3" style={{ backgroundColor: `${sub.color}14` }}>
                        <div
                          className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
                          style={{ backgroundColor: sub.color }}
                        >
                          <SubIcon className="h-5 w-5 text-white" />
                        </div>
                        <p className="truncate text-sm font-bold text-slate-900">{sub.name}</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{sub.percent}%</p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/60">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${sub.percent}%`, backgroundColor: sub.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-400">{d.common.none}</p>
              )}
            </div>
          </div>
        </div>

        {/* Правая часть (1 колонка) */}
        <div className="space-y-6">
          {/* Расписание на сегодня */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              <h3 className="text-base font-bold text-slate-900">{t.todaySchedule}</h3>
            </div>
            <div className="space-y-3">
              {todayLessons.map((lesson) => {
                const sub = lesson.subject_id ? subjectById.get(lesson.subject_id) : undefined;
                const SubIcon = sub ? (LUCIDE_ICONS[sub.icon] ?? BookOpen) : BookOpen;
                const start = new Date(lesson.starts_at);
                const end = lesson.ends_at ? new Date(lesson.ends_at) : null;
                const isNow = now !== null && now >= start && (!end || now <= end);
                return (
                  <div key={lesson.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 transition hover:bg-slate-100">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: sub ? `${sub.color}22` : "#f1f5f9", color: sub?.color ?? "#64748b" }}
                    >
                      <SubIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {sub?.name ?? lesson.title ?? lesson.topic ?? "—"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatTime(lesson.starts_at)}{lesson.room ? ` · ${t.room} ${lesson.room}` : ""}
                      </p>
                    </div>
                    {isNow && (
                      <span className="rounded-md bg-orange-500 px-2 py-1 text-xs font-medium text-white">
                        {t.now}
                      </span>
                    )}
                  </div>
                );
              })}

              {now && todayLessons.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">{t.noLessonsToday}</p>
              )}
            </div>

            <Link
              href="/lessons"
              className="mt-4 flex items-center justify-center gap-1 text-sm font-medium text-orange-500 hover:text-orange-600"
            >
              {t.fullSchedule}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Мои достижения — заглушка, реальной таблицы нет */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">{t.myAchievements}</h3>
              <button onClick={() => showToast(d.auth.comingSoon)} className="text-sm text-orange-500 hover:text-orange-600">
                {t.allAchievements}
              </button>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-3">
              <AchievementBadge emoji="🎖️" label="Исследователь" color="from-yellow-400 to-orange-500" isNew />
              <AchievementBadge emoji="🏆" label="Трудолюбивый" color="from-purple-400 to-pink-500" isNew />
              <AchievementBadge emoji="🎯" label="Целеустремлённый" color="from-blue-400 to-cyan-500" />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                <span>{t.nextReward}</span>
                <span className="font-bold text-orange-500">150 XP</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500" style={{ width: "70%" }} />
                </div>
                <span className="text-xl">🎁</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FloatingActionButton />
    </div>
  );
}

function QuickAction({
  icon, color, label, badge, href, onClick,
}: {
  icon: React.ReactNode;
  color: "orange" | "violet" | "pink" | "green";
  label: string;
  badge?: number;
  href?: string;
  onClick?: () => void;
}) {
  const colorClasses: Record<typeof color, string> = {
    orange: "bg-orange-50 text-orange-500",
    violet: "bg-violet-50 text-violet-500",
    pink: "bg-pink-50 text-pink-500",
    green: "bg-green-50 text-green-500",
  };

  const content = (
    <div className="relative flex cursor-pointer flex-col items-center rounded-2xl border border-slate-100 bg-white p-4 transition hover:shadow-md">
      <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl ${colorClasses[color]}`}>
        <div className="h-6 w-6">{icon}</div>
      </div>
      <p className="text-center text-sm font-medium text-slate-700">{label}</p>
      {badge !== undefined && badge > 0 && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
          {badge}
        </span>
      )}
    </div>
  );

  if (onClick) {
    return <button onClick={onClick} type="button" className="w-full">{content}</button>;
  }
  return <Link href={href ?? "#"}>{content}</Link>;
}

function AchievementBadge({
  emoji, label, color, isNew,
}: {
  emoji: string;
  label: string;
  color: string;
  isNew?: boolean;
}) {
  return (
    <div className="relative flex flex-col items-center gap-2">
      {isNew && (
        <span className="absolute -top-2 z-10 rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] font-bold text-white">
          NEW
        </span>
      )}
      <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-2xl shadow-inner ${color}`}>
        {emoji}
      </div>
      <span className="text-center text-[10px] font-medium text-slate-700">{label}</span>
    </div>
  );
}
