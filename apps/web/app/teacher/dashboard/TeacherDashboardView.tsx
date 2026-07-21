"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen, Calendar, CheckCircle2, Clock, FileText, Megaphone, Users,
} from "lucide-react";
import { getDictionary, getSubjectConfig, formatTime } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { Avatar } from "@/components/Avatar";
import { SubjectIcon } from "@/components/SubjectIcon";
import { ErrorState } from "@/components/ErrorState";
import { cn } from "@/lib/cn";

// ── Types ────────────────────────────────────────────────────────────────────

type TodayLesson = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  room: string | null;
  topic: string | null;
  group: { id: string; name: string; subject: string };
};

type Submission = {
  id: string;
  homework_id: string;
  status: string;
  submitted_at: string;
  homework: { title: string } | null;
  student: { full_name: string } | null;
};

interface Props {
  teacher: { id: string; full_name: string | null } | null;
  groups: Array<{
    id: string; name: string; subject: string;
    enrolled: Array<{ student_id: string }>;
  }>;
  homework: Array<{
    id: string; title: string; due_date: string | null;
    submissions: Array<{ status: string }>;
    test_subs: Array<{ id: string }>;
    teacher_id: string | null;
  }>;
  todayLessons: TodayLesson[];
  recentSubmissions: Submission[];
  grades: Array<{ group_id: string | null; score: number }>;
  todayLessonsError?: boolean;
}

// ── Timeline constants ────────────────────────────────────────────────────────

const T_START = 8;
const T_END = 18;
const HOUR_PX = 52; // px per hour
const TOTAL_H = (T_END - T_START) * HOUR_PX;

function minuteOffset(iso: string): number {
  const d = new Date(iso);
  return (d.getHours() - T_START) * 60 + d.getMinutes();
}

function lessonTop(l: TodayLesson): number {
  return Math.max(0, minuteOffset(l.starts_at)) * HOUR_PX / 60;
}

function lessonHeight(l: TodayLesson): number {
  const ms = new Date(l.ends_at).getTime() - new Date(l.starts_at).getTime();
  return Math.max(38, (ms / 60000) * HOUR_PX / 60);
}

type LessonPalette = { bg: string; border: string; label: string; sub: string };

// Решение 21.07 (отключение авто-режима, миграция 143): scheduled-урок,
// чьё время уже прошло, но который не начали вручную, остаётся нейтральным
// "Запланирован" (синий) — статуса "Пропущен"/красного больше нет нигде,
// включая эту почасовую шкалу дня.
function lessonPalette(status: string): LessonPalette {
  if (status === "in_progress")  return { bg: "bg-yellow-50",  border: "border-l-yellow-400",  label: "text-yellow-900",  sub: "text-yellow-600" };
  if (status === "completed")    return { bg: "bg-emerald-50", border: "border-l-emerald-400", label: "text-emerald-900", sub: "text-emerald-600" };
  return                                { bg: "bg-blue-50",    border: "border-l-blue-400",    label: "text-blue-900",    sub: "text-blue-600"   };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// nowMs is null on server + first client render → returns "" to avoid hydration mismatch.
function timeAgo(iso: string, nowMs: number | null): string {
  if (nowMs === null) return "";
  const m = Math.floor((nowMs - new Date(iso).getTime()) / 60000);
  if (m < 1)  return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

function pluralMin(n: number) {
  if (n === 1) return "минуту";
  if (n >= 2 && n <= 4) return "минуты";
  return "минут";
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, icon: Icon, highlight,
}: { title: string; value: string | number; icon: typeof Users; highlight?: boolean }) {
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
        <div className="absolute -bottom-2 -right-2 opacity-20"><Icon className="h-20 w-20" /></div>
      )}
    </div>
  );
}

// ── Hero block ────────────────────────────────────────────────────────────────

type HeroMode = "in_progress" | "soon" | "next" | "none";

function findHeroLesson(
  lessons: TodayLesson[],
  now: Date,
): { lesson: TodayLesson; mode: Exclude<HeroMode, "none"> } | null {
  const active = lessons.find((l) => l.status === "in_progress");
  if (active) return { lesson: active, mode: "in_progress" };
  // "soon" ловит и уроки, чьё время уже прошло, но которые учитель ещё не
  // начал вручную (решение 21.07 — авто-старта по времени больше нет, эта
  // "дыра" раньше почти не встречалась, pg_cron закрывал её за ~1-5 мин).
  // Без нижней границы diff>0 такой урок раньше вообще не находился ни
  // одним из трёх .find() — HeroBlock показывал неверное "Уроки на сегодня
  // завершены" при живом незапущенном уроке.
  const soon = lessons.find((l) => {
    if (l.status !== "scheduled") return false;
    const diff = new Date(l.starts_at).getTime() - now.getTime();
    return diff <= 3_600_000;
  });
  if (soon) return { lesson: soon, mode: "soon" };
  const next = lessons.find((l) => l.status === "scheduled" && new Date(l.starts_at) > now);
  if (next) return { lesson: next, mode: "next" };
  return null;
}

function HeroBlock({ lessons, now }: { lessons: TodayLesson[]; now: Date | null }) {
  if (!now || lessons.length === 0) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-[20px] border border-slate-200/60 bg-white/60 py-8 text-slate-400 backdrop-blur-xl">
        <Calendar className="h-6 w-6" />
        <span className="text-[15px] font-medium">Сегодня уроков нет. Расписание свободно.</span>
      </div>
    );
  }

  const hit = findHeroLesson(lessons, now);
  if (!hit) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-[20px] border border-slate-200/60 bg-white/60 py-8 text-slate-400 backdrop-blur-xl">
        <Calendar className="h-6 w-6" />
        <span className="text-[15px] font-medium">Уроки на сегодня завершены.</span>
      </div>
    );
  }

  const { lesson, mode } = hit;
  const cfg = getSubjectConfig(lesson.group.subject);

  // "soon" ловит и уже просроченные-но-не-начатые уроки (см. findHeroLesson)
  // — tillMin отрицателен в этом случае, что нельзя показывать как обратный
  // отсчёт ("До начала: -12 мин" выглядело бы как раз тем самым "просрочено",
  // которого решение 21.07 просит избегать). isOverdue разводит эти два
  // случая на разные, оба нейтральные (без красного/тревожного) варианты.
  const tillMin = mode === "soon"
    ? Math.ceil((new Date(lesson.starts_at).getTime() - now.getTime()) / 60000)
    : null;
  const isOverdueUnstarted = mode === "soon" && tillMin !== null && tillMin <= 0;

  const containerCls =
    mode === "in_progress" ? "bg-emerald-50/60 border-emerald-200" :
    mode === "soon" && !isOverdueUnstarted ? "bg-yellow-50/60 border-yellow-200" :
                             "bg-white/60 border-slate-200/60";

  const badge = mode === "in_progress" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-[12px] font-bold text-white">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      Идёт сейчас
    </span>
  ) : mode === "soon" && !isOverdueUnstarted ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400 px-3 py-1 text-[12px] font-bold text-yellow-900">
      <Clock className="h-3 w-3" /> Скоро начнётся
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-600">
      <Calendar className="h-3 w-3" /> Запланировано
    </span>
  );

  // Часть 3 (решение 21.07): счётчик "Длится N мин" убран полностью — в
  // in_progress статус меняется только вручную, elapsed-с-момента-старта
  // не показываем нигде в статусной строке/hero. "До начала" остаётся
  // только для реально предстоящих уроков (isOverdueUnstarted их исключает).
  const counter = tillMin != null && !isOverdueUnstarted ? (
    <span className="text-[13px] font-medium text-yellow-700">
      До начала: {tillMin} {pluralMin(tillMin)}
    </span>
  ) : null;

  const ctaCls = mode === "in_progress" ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700";

  return (
    <div className={cn("flex items-center justify-between gap-6 rounded-[20px] border p-6 backdrop-blur-xl", containerCls)}>
      <div className="flex items-start gap-4">
        <SubjectIcon subject={lesson.group.subject} size={56} />
        <div>
          {badge}
          <h2 className="mt-2 text-[20px] font-bold text-slate-800">
            {lesson.topic ?? `${cfg.label} — ${lesson.group.name}`}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">
            <span>{cfg.label}</span>
            <span>·</span>
            <span>{lesson.group.name}</span>
            {lesson.room && <><span>·</span><span>Кабинет {lesson.room}</span></>}
            <span>·</span>
            <span>{formatTime(lesson.starts_at)} — {formatTime(lesson.ends_at)}</span>
          </div>
          {counter && <div className="mt-2">{counter}</div>}
        </div>
      </div>
      <Link
        href={`/teacher/lessons/${lesson.id}`}
        className={cn("shrink-0 rounded-xl px-5 py-3 text-[14px] font-bold text-white shadow-md transition-all hover:shadow-lg", ctaCls)}
      >
        Открыть урок
      </Link>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TeacherDashboardView({
  teacher, groups, homework, todayLessons, recentSubmissions, grades,
  todayLessonsError = false,
}: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // KPI
  const studentIds = new Set<string>();
  groups.forEach((g) => g.enrolled?.forEach((e) => studentIds.add(e.student_id)));
  const totalStudents = studentIds.size;
  const pendingCount = homework.reduce(
    (acc, h) => acc + h.submissions.filter((s) => s.status === "submitted").length, 0,
  );
  const checkedCount = homework.reduce(
    (acc, h) => acc + h.submissions.filter((s) => s.status === "graded").length, 0,
  );
  const avgScore = grades.length
    ? (grades.reduce((a, g) => a + g.score, 0) / grades.length).toFixed(1)
    : "—";

  // Timeline — current-time indicator
  const nowTop = useMemo(() => {
    if (!now) return null;
    const h = now.getHours(), m = now.getMinutes();
    if (h < T_START || h >= T_END) return null;
    return ((h - T_START) * 60 + m) * HOUR_PX / 60;
  }, [now]);

  // Right column data
  const pendingReview = recentSubmissions.filter((s) => s.status === "submitted").slice(0, 5);
  const allActivity = recentSubmissions.slice(0, 5);

  const hours = Array.from({ length: T_END - T_START }, (_, i) => T_START + i);

  return (
    <div className="max-w-6xl space-y-6 pb-6">

      {/* Greeting */}
      <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
        {d.dashboard.greeting.replace("{name}", teacher?.full_name ?? d.teacher.role)}
      </h1>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard title="Всего учеников" value={totalStudents} icon={Users} />
        <KpiCard title="На проверке"    value={pendingCount}   icon={FileText}     highlight />
        <KpiCard title="Проверено"      value={checkedCount}   icon={CheckCircle2} />
        <KpiCard title="Средний балл"   value={avgScore}       icon={BookOpen}     />
      </div>

      {/* Hero: current / next lesson */}
      <HeroBlock lessons={todayLessons} now={now} />

      {/* Two-column layout */}
      <div className="grid grid-cols-12 gap-6">

        {/* LEFT: Day timeline (8 cols) */}
        <section className="col-span-8 rounded-[24px] border border-white bg-white/70 p-6 shadow-sm backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Расписание сегодня</h2>
            <span className="text-[13px] text-slate-400">
              {now ? now.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : ""}
            </span>
          </div>

          {todayLessonsError ? (
            <div className="py-8"><ErrorState>{d.common.error}</ErrorState></div>
          ) : todayLessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <Calendar className="h-10 w-10 opacity-30" />
              <p className="text-sm">Свободный день</p>
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: 540 }}>
              <div className="relative" style={{ height: TOTAL_H }}>

                {/* Hour rows */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 flex items-start gap-3"
                    style={{ top: (h - T_START) * HOUR_PX }}
                  >
                    <span className="w-11 shrink-0 pt-0.5 text-right text-[11px] font-medium leading-none text-slate-400">
                      {String(h).padStart(2, "0")}:00
                    </span>
                    <div className="mt-2 flex-1 border-t border-slate-100" />
                  </div>
                ))}

                {/* Lesson blocks */}
                {todayLessons.map((lesson) => {
                  const top    = lessonTop(lesson);
                  const height = lessonHeight(lesson);
                  const pal    = lessonPalette(lesson.status);
                  const cfg    = getSubjectConfig(lesson.group.subject);
                  return (
                    <Link
                      key={lesson.id}
                      href={`/teacher/lessons/${lesson.id}`}
                      className={cn(
                        "absolute left-14 right-1 overflow-hidden rounded-xl border-l-4 px-3 py-2 shadow-sm transition-shadow hover:shadow-md",
                        pal.bg, pal.border,
                      )}
                      style={{ top, height: Math.max(36, height) }}
                    >
                      <div className={cn("truncate text-[13px] font-bold leading-tight", pal.label)}>
                        {lesson.topic ?? cfg.label}
                      </div>
                      <div className={cn("mt-0.5 truncate text-[11px]", pal.sub)}>
                        {formatTime(lesson.starts_at)}–{formatTime(lesson.ends_at)}
                        {" · "}{lesson.group.name}
                        {lesson.room ? ` · каб. ${lesson.room}` : ""}
                      </div>
                      {lesson.status === "in_progress" && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-yellow-700">
                          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-yellow-500" />
                          Идёт
                        </span>
                      )}
                    </Link>
                  );
                })}

                {/* Current-time red line */}
                {nowTop != null && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 flex items-center"
                    style={{ top: nowTop }}
                  >
                    <span className="w-11 shrink-0 text-right text-[10px] font-bold leading-none text-red-500">
                      {now!.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="flex-1 border-t-2 border-red-400" />
                    <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT: 3 blocks (4 cols) */}
        <div className="col-span-4 flex flex-col gap-4">

          {/* Block 1 — Pending review */}
          <section className="rounded-[24px] border border-white bg-white/70 p-5 shadow-sm backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-slate-800">Работы на проверку</h2>
              {pendingCount > 0 && (
                <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </div>
            {pendingReview.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-5 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                <p className="text-[13px] font-medium text-emerald-600">Все работы проверены!</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {pendingReview.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/teacher/homework/${sub.homework_id}`}
                      className="flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-slate-50"
                    >
                      <Avatar name={sub.student?.full_name ?? "?"} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-slate-800">
                          {sub.student?.full_name}
                        </div>
                        <div className="truncate text-[11px] text-slate-400">
                          {sub.homework?.title}
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {timeAgo(sub.submitted_at, now?.getTime() ?? null)}
                      </span>
                    </Link>
                  ))}
                </div>
                {pendingCount > 5 && (
                  <Link
                    href="/teacher/homework"
                    className="mt-3 block text-center text-[12px] font-semibold text-blue-600 hover:underline"
                  >
                    Все работы →
                  </Link>
                )}
              </>
            )}
          </section>

          {/* Block 2 — Announcements stub */}
          <section className="rounded-[24px] border border-white bg-white/70 p-5 shadow-sm backdrop-blur-xl">
            <h2 className="mb-3 text-[15px] font-bold text-slate-800">Объявления</h2>
            <div className="flex flex-col items-center gap-2 py-4 text-center text-slate-400">
              <Megaphone className="h-7 w-7 opacity-40" />
              <p className="text-[12px] leading-relaxed">
                Здесь скоро появится<br />школьная лента объявлений
              </p>
            </div>
          </section>

          {/* Block 3 — Activity feed */}
          <section className="rounded-[24px] border border-white bg-white/70 p-5 shadow-sm backdrop-blur-xl">
            <h2 className="mb-4 text-[15px] font-bold text-slate-800">{d.teacher.recentActivity}</h2>
            {allActivity.length === 0 ? (
              <p className="text-[12px] text-slate-400">{d.teacher.noActivity}</p>
            ) : (
              <div className="space-y-3">
                {allActivity.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/teacher/homework/${sub.homework_id}`}
                    className="flex items-start gap-2"
                  >
                    <Avatar name={sub.student?.full_name ?? "?"} size={28} />
                    <div className="min-w-0 text-[12px] leading-snug">
                      <span className="font-semibold text-slate-800">{sub.student?.full_name}</span>{" "}
                      <span className="text-slate-500">
                        {sub.status === "graded" ? "получил(а) оценку за" : "сдал(а)"}
                      </span>{" "}
                      <span className="font-medium italic text-blue-600">
                        «{sub.homework?.title}»
                      </span>
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {timeAgo(sub.submitted_at, now?.getTime() ?? null)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
