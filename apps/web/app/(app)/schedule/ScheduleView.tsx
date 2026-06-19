"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { CheckCircle, ChevronLeft, ChevronRight, Coffee } from "lucide-react";
import {
  formatTime,
  getDictionary,
  getSubjectStyle,
  lessonsOnDay,
  type Group,
  type Homework,
  type HomeworkSubmission,
  type Lesson,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { SubjectIcon, useLocale } from "@/components";

type TeacherMin = { id: string; full_name: string };

// ─── Week helpers ─────────────────────────────────────────────────────────────

function getWeekMonday(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const dow = date.getDay();
  date.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1));
  return date;
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function weekRangeLabel(ws: Date): string {
  const we = addDays(ws, 6);
  const sD = ws.getDate();
  const eD = we.getDate();
  const eM = we.toLocaleDateString("ru-RU", { month: "long" });
  const eY = we.getFullYear();
  if (ws.getMonth() === we.getMonth()) {
    return `${sD} — ${eD} ${eM} ${eY}`;
  }
  const sM = ws.toLocaleDateString("ru-RU", { month: "long" });
  return `${sD} ${sM} — ${eD} ${eM} ${eY}`;
}

const DAY_ABBREVS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

// ─── Lesson card style ────────────────────────────────────────────────────────

type CardStyle = {
  cls: string;
  badge: { label: string; ping?: boolean; cls: string } | null;
};

function getLessonCardStyle(lesson: Lesson, nowMs: number): CardStyle {
  if (lesson.status === "in_progress")
    return {
      cls: "bg-yellow-50 border-l-4 border-yellow-400",
      badge: { label: "Идёт", ping: true, cls: "bg-yellow-100 text-yellow-700" },
    };
  if (lesson.status === "completed")
    return {
      cls: "bg-emerald-50 border-l-4 border-emerald-400",
      badge: { label: "Завершён", cls: "bg-emerald-100 text-emerald-700" },
    };
  if (new Date(lesson.starts_at).getTime() < nowMs)
    return {
      cls: "bg-red-50 border-l-4 border-red-400",
      badge: { label: "Пропущен", cls: "bg-red-100 text-red-600" },
    };
  return {
    cls: "border border-white/80 bg-white/70 backdrop-blur-xl",
    badge: null,
  };
}

// ─── Homework zone ────────────────────────────────────────────────────────────

type HwZone = "overdue" | "urgent" | "active";

const ZONE_ORDER: Record<HwZone, number> = { overdue: 0, urgent: 1, active: 2 };

function getHwZone(
  hw: Homework,
  submittedIds: Set<string>,
  nowMs: number,
): HwZone | null {
  if (submittedIds.has(hw.id)) return null;
  const due = hw.due_date ? new Date(hw.due_date).setHours(23, 59, 59, 999) : null;
  if (!due) return "active";
  if (due < nowMs) return "overdue";
  if (due - nowMs <= 24 * 3_600_000) return "urgent";
  return "active";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScheduleView({
  initialLessons,
  groups,
  teachers: _teachers,
  homework,
  submissions,
}: {
  initialLessons: Lesson[];
  groups: Group[];
  teachers: TeacherMin[];
  homework: Homework[];
  submissions: HomeworkSubmission[];
}) {
  const { locale } = useLocale();
  const dict = getDictionary(locale as Locale);

  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekMonday(new Date()));
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  // Gate time-dependent UI until after mount: Vercel renders in UTC, the client in
  // local TZ, so "today"/current-week would differ and trigger hydration error #418.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel("schedule-lessons-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lessons" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLessons((prev) =>
              [...prev, payload.new as Lesson].sort((a, b) =>
                a.starts_at.localeCompare(b.starts_at),
              ),
            );
          } else if (payload.eventType === "UPDATE") {
            const upd = payload.new as Lesson;
            setLessons((prev) =>
              prev.map((l) => (l.id === upd.id ? { ...l, ...upd } : l)),
            );
          } else if (payload.eventType === "DELETE") {
            setLessons((prev) =>
              prev.filter((l) => l.id !== (payload.old as { id: string }).id),
            );
          }
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const groupById = useMemo(
    () => new Map(groups.map((g) => [g.id, g])),
    [groups],
  );

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const submittedIds = useMemo(
    () => new Set(submissions.map((s) => s.homework_id)),
    [submissions],
  );

  const activeHw = useMemo(() => {
    const zoned: Array<{ hw: Homework; zone: HwZone }> = [];
    for (const hw of homework) {
      const zone = getHwZone(hw, submittedIds, nowMs);
      if (zone) zoned.push({ hw, zone });
    }
    zoned.sort((a, b) => {
      const o = ZONE_ORDER[a.zone] - ZONE_ORDER[b.zone];
      if (o !== 0) return o;
      return (a.hw.due_date ?? "9999").localeCompare(b.hw.due_date ?? "9999");
    });
    return zoned;
  }, [homework, submittedIds, nowMs]);

  const visibleHw = activeHw.slice(0, 5);
  const navBtnCls =
    "flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/70 text-slate-700 shadow-sm backdrop-blur-md transition hover:bg-white/90";

  return (
    <div className="space-y-6">
      <h1 className="text-[22px] font-bold text-gray-900 md:text-[26px]">
        {dict.schedule.title}
      </h1>

      {!mounted ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : (
      <>
      {/* ── Week navigation ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <button
          className={navBtnCls}
          onClick={() => setWeekStart((ws) => addDays(ws, -7))}
          aria-label="Предыдущая неделя"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex flex-col items-center gap-1">
          <span className="text-[15px] font-semibold text-slate-700">
            {weekRangeLabel(weekStart)}
          </span>
          <button
            onClick={() => setWeekStart(getWeekMonday(new Date()))}
            className="text-[12px] font-medium text-blue-600 transition-colors hover:underline"
          >
            Сегодня
          </button>
        </div>

        <button
          className={navBtnCls}
          onClick={() => setWeekStart((ws) => addDays(ws, 7))}
          aria-label="Следующая неделя"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── 7-column weekly grid ─────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <div className="grid min-w-[700px] grid-cols-7 gap-1.5">
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, today);
            const isPast = !isToday && day < today;
            const isWeekend = i >= 5;
            const dayLessons = lessonsOnDay(lessons, day);

            return (
              <div
                key={day.toISOString()}
                className={cn("flex flex-col gap-1.5", isWeekend && "opacity-75")}
              >
                {/* Column header */}
                <div
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-2xl py-2",
                    isToday && "bg-blue-600",
                    isPast && "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-bold uppercase tracking-wide",
                      isToday ? "text-blue-200" : "text-slate-400",
                    )}
                  >
                    {DAY_ABBREVS[i]}
                  </span>
                  <span
                    className={cn(
                      "text-[22px] font-bold leading-none",
                      isToday ? "text-white" : "text-slate-800",
                    )}
                  >
                    {day.getDate()}
                  </span>
                </div>

                {/* Lessons */}
                {dayLessons.length === 0 ? (
                  <div className="flex flex-col items-center py-3 text-slate-200">
                    <Coffee size={16} />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {dayLessons.map((lesson) => {
                      const group = groupById.get(lesson.group_id);
                      const subject = group?.subject ?? null;
                      const style = getSubjectStyle(subject);
                      const { cls, badge } = getLessonCardStyle(lesson, nowMs);
                      const title =
                        lesson.topic ??
                        (lesson.lesson_no != null
                          ? `Урок ${lesson.lesson_no}`
                          : style.label);

                      return (
                        <Link
                          key={lesson.id}
                          href={`/lessons/${lesson.id}`}
                          className={cn(
                            "block overflow-hidden rounded-[12px] p-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                            cls,
                          )}
                        >
                          <div className="font-mono text-[10px] font-semibold text-slate-500">
                            {formatTime(lesson.starts_at)}
                            {lesson.ends_at && ` — ${formatTime(lesson.ends_at)}`}
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            <SubjectIcon subject={subject} size={14} />
                            <span className="truncate text-[10px] text-slate-500">
                              {style.label}
                            </span>
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-[11px] font-semibold text-slate-800">
                            {title}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-1">
                            {lesson.room ? (
                              <span className="truncate text-[9px] text-slate-400">
                                Каб. {lesson.room}
                              </span>
                            ) : (
                              <span />
                            )}
                            {badge && (
                              <span
                                className={cn(
                                  "ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-full px-1 py-0.5 text-[8px] font-bold whitespace-nowrap",
                                  badge.cls,
                                )}
                              >
                                {badge.ping && (
                                  <span className="h-1 w-1 animate-ping rounded-full bg-yellow-500" />
                                )}
                                {badge.label}
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Мои задания ──────────────────────────────────────────────── */}
      <div className="rounded-[24px] border border-white bg-white/70 p-5 shadow-sm backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2">
          <Link
            href="/homework"
            className="text-[16px] font-bold text-slate-800 transition-colors hover:text-blue-600 hover:underline"
          >
            {dict.homework.title}
          </Link>
          {activeHw.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[12px] font-bold text-blue-700">
              {activeHw.length}
            </span>
          )}
        </div>

        {visibleHw.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
            <p className="text-[14px] font-semibold text-slate-600">
              Все задания выполнены!
            </p>
            <Link
              href="/homework"
              className="text-[12px] text-blue-600 hover:underline"
            >
              Посмотреть выполненные →
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {visibleHw.map(({ hw, zone }) => {
                const subject = groupById.get(hw.group_id)?.subject ?? null;
                const style = getSubjectStyle(subject);
                const dueLbl = hw.due_date
                  ? new Date(hw.due_date).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      timeZone: "Asia/Tashkent",
                    })
                  : null;

                const cardCls =
                  zone === "overdue"
                    ? "bg-red-50 border-l-4 border-red-400"
                    : zone === "urgent"
                      ? "bg-orange-50 border-l-4 border-orange-400"
                      : "border border-white/80 bg-white/60 backdrop-blur-xl";

                const badgeCls =
                  zone === "overdue"
                    ? "bg-red-100 text-red-600"
                    : zone === "urgent"
                      ? "bg-orange-100 text-orange-600"
                      : "";

                const badgeLbl =
                  zone === "overdue"
                    ? "Просрочено"
                    : zone === "urgent"
                      ? "Срочно"
                      : null;

                return (
                  <Link
                    key={hw.id}
                    href={`/homework/${hw.id}`}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[14px] p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                      cardCls,
                    )}
                  >
                    <SubjectIcon subject={subject} size={20} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-slate-800">
                        {hw.title}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {style.label}
                        {dueLbl && ` · до ${dueLbl}`}
                      </div>
                    </div>
                    {badgeLbl && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap",
                          badgeCls,
                        )}
                      >
                        {badgeLbl}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {activeHw.length > 5 && (
              <Link
                href="/homework"
                className="mt-3 block text-center text-[12px] font-semibold text-blue-600 hover:underline"
              >
                Ещё {activeHw.length - 5} заданий →
              </Link>
            )}
          </>
        )}
      </div>
      </>
      )}
    </div>
  );
}
