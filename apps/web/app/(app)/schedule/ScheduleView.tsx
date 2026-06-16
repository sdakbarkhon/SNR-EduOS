"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatDate,
  formatTime,
  getDictionary,
  getSubjectStyle,
  lessonStatus,
  lessonsOnDay,
  type Group,
  type Homework,
  type HomeworkSubmission,
  type Lesson,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { EmptyState, GlassCard, LessonRow, SubjectIcon, useLocale } from "@/components";

type TeacherMin = { id: string; full_name: string };
type Tab = "today" | "week";

export function ScheduleView({
  initialLessons,
  groups,
  teachers,
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
  const d = getDictionary(locale as Locale);
  const [tab, setTab] = useState<Tab>("today");
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const teacherById = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);

  // Realtime: обновляем уроки без перезагрузки страницы
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel("schedule-lessons-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lessons" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newLesson = payload.new as Lesson;
            setLessons((prev) =>
              [...prev, newLesson].sort((a, b) =>
                a.starts_at.localeCompare(b.starts_at),
              ),
            );
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Lesson;
            setLessons((prev) =>
              prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)),
            );
          } else if (payload.eventType === "DELETE") {
            const removed = payload.old as { id: string };
            setLessons((prev) => prev.filter((l) => l.id !== removed.id));
          }
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const now = Date.now();

  function buildRow(lesson: Lesson) {
    const group = groupById.get(lesson.group_id);
    const subject = group?.subject ?? null;
    const teacherName = group?.teacher_id
      ? teacherById.get(group.teacher_id)?.full_name
      : undefined;
    const style = getSubjectStyle(subject);
    const badge = lessonStatus(lesson, now);
    const startMs = new Date(lesson.starts_at).getTime();
    const endMs = lesson.ends_at
      ? new Date(lesson.ends_at).getTime()
      : startMs + 45 * 60 * 1000;
    const durationMin = Math.round((endMs - startMs) / 60000);
    const lessonTitle =
      lesson.topic ?? (lesson.lesson_no ? `Урок ${lesson.lesson_no}` : "Урок");

    return (
      <LessonRow
        key={lesson.id}
        time={formatTime(lesson.starts_at)}
        duration={`${durationMin} мин`}
        subject={subject}
        title={lessonTitle}
        room={lesson.room}
        teacher={teacherName ?? null}
        colorBar={style.color}
        status={{ variant: badge.variant, label: d.status[badge.key] }}
      />
    );
  }

  // --- Вид «Сегодня» ---
  const dayLessons = useMemo(
    () => lessonsOnDay(lessons, selectedDay),
    [lessons, selectedDay],
  );

  const dayLabel = (() => {
    const s = selectedDay.toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  const prevDay = () =>
    setSelectedDay((d) => new Date(d.getTime() - 86_400_000));
  const nextDay = () =>
    setSelectedDay((d) => new Date(d.getTime() + 86_400_000));

  // --- Вид «Неделя» (ближайшие 7 дней) ---
  const weekData = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const result: { date: Date; items: Lesson[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start.getTime() + i * 86_400_000);
      const items = lessonsOnDay(lessons, date);
      if (items.length) result.push({ date, items });
    }
    return result;
  }, [lessons]);

  // --- Домашние задания в правой колонке ---
  const pendingHW = useMemo(() => {
    const submittedIds = new Set(submissions.map((s) => s.homework_id));
    return homework.filter((h) => !submittedIds.has(h.id)).slice(0, 5);
  }, [homework, submissions]);

  const tabBtnClass = (active: boolean) =>
    cn(
      "rounded-full px-5 py-2.5 text-sm font-medium transition",
      active
        ? "bg-[#185AF7] text-white shadow-md"
        : "border border-white/50 bg-white/60 text-gray-800 backdrop-blur-md hover:bg-white/80",
    );

  const navBtnClass =
    "flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/70 text-gray-800 shadow-sm backdrop-blur-md transition hover:bg-white/90";

  return (
    <div className="space-y-6">
    <h1 className="text-[22px] font-bold text-gray-900 md:text-[26px]">{d.schedule.title}</h1>
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Левая колонка — расписание */}
      <div className="flex flex-col gap-5 lg:col-span-8">
        {/* Табы */}
        <div className="flex gap-3">
          <button className={tabBtnClass(tab === "today")} onClick={() => setTab("today")}>
            {d.schedule.today}
          </button>
          <button className={tabBtnClass(tab === "week")} onClick={() => setTab("week")}>
            {d.schedule.week}
          </button>
        </div>

        {tab === "today" ? (
          <>
            {/* Навигация по дням */}
            <div className="flex items-center justify-between pl-1">
              <h2 className="text-xl font-bold text-gray-900">{dayLabel}</h2>
              <div className="flex gap-2">
                <button className={navBtnClass} onClick={prevDay} aria-label="Предыдущий день">
                  <ChevronLeft size={18} />
                </button>
                <button className={navBtnClass} onClick={nextDay} aria-label="Следующий день">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Список уроков */}
            <div className="space-y-3">
              {dayLessons.length ? (
                dayLessons.map(buildRow)
              ) : (
                <EmptyState>{d.schedule.noLessons}</EmptyState>
              )}
            </div>
          </>
        ) : (
          /* Вид «Неделя» */
          <div className="space-y-6">
            {weekData.length ? (
              weekData.map(({ date, items }) => {
                const label = date.toLocaleDateString("ru-RU", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                });
                const labelCap = label.charAt(0).toUpperCase() + label.slice(1);
                return (
                  <div key={date.toISOString()}>
                    <h3 className="mb-3 pl-1 text-base font-bold text-gray-700">
                      {labelCap}
                    </h3>
                    <div className="space-y-3">{items.map(buildRow)}</div>
                  </div>
                );
              })
            ) : (
              <EmptyState>{d.common.none}</EmptyState>
            )}
          </div>
        )}
      </div>

      {/* Правая колонка — текущие ДЗ */}
      <div className="lg:col-span-4">
        <GlassCard className="flex flex-col gap-5 p-6">
          <h2 className="text-lg font-bold text-gray-900">{d.homework.title}</h2>

          {pendingHW.length ? (
            <div className="space-y-3">
              {pendingHW.map((hw) => {
                const subject = groupById.get(hw.group_id)?.subject ?? null;
                return (
                  <div
                    key={hw.id}
                    className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/60 p-3 backdrop-blur-md"
                  >
                    <SubjectIcon subject={subject} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-gray-900">
                        {hw.title}
                      </div>
                      {hw.due_date && (
                        <div className="mt-0.5 text-xs text-gray-500">
                          до {formatDate(hw.due_date)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState>{d.common.none}</EmptyState>
          )}
        </GlassCard>
      </div>
    </div>
    </div>
  );
}
