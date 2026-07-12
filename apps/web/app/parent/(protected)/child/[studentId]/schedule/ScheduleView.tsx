"use client";

import { useState } from "react";
import { getDictionary } from "@snr/core";
import type { Locale, LessonWithSubject } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { LessonSubjectIcon, FALLBACK_SUBJECT_COLOR } from "@/components/LessonSubjectIcon";
import { ErrorState } from "@/components/ErrorState";
import type { ParentChild } from "@/lib/parent-child";

const LOCALE_TAG: Record<string, string> = { ru: "ru-RU", en: "en-US", uz: "uz-UZ" };

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
}

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function groupByDay(lessons: LessonWithSubject[]) {
  const map = new Map<string, LessonWithSubject[]>();
  for (const l of lessons) {
    const key = dayKey(l.starts_at);
    const arr = map.get(key) ?? [];
    arr.push(l);
    map.set(key, arr);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function ScheduleView({
  child,
  thisWeekStart: _thisWeekStart,
  nextWeekStart: _nextWeekStart,
  thisWeekLessons,
  nextWeekLessons,
  loadError = false,
}: {
  child: ParentChild;
  thisWeekStart: string;
  nextWeekStart: string;
  thisWeekLessons: LessonWithSubject[];
  nextWeekLessons: LessonWithSubject[];
  loadError?: boolean;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.parentUi;
  const tag = LOCALE_TAG[locale] ?? "ru-RU";

  const [mode, setMode] = useState<"this" | "next">("this");
  const lessons = mode === "this" ? thisWeekLessons : nextWeekLessons;
  const days = groupByDay(lessons);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t.scheduleTitle}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {child.full_name}
          {child.className ? ` · ${child.className}` : ""}
        </p>
      </div>

      <div className="inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/5">
        <button
          onClick={() => setMode("this")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            mode === "this" ? "bg-pink-600 text-white" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {t.thisWeek}
        </button>
        <button
          onClick={() => setMode("next")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            mode === "next" ? "bg-pink-600 text-white" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {t.nextWeek}
        </button>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        {loadError ? (
          <ErrorState>{d.common.error}</ErrorState>
        ) : days.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">{t.noLessonsWeek}</p>
        ) : (
          <div className="space-y-6">
            {days.map(([day, dayLessons]) => (
              <div key={day}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                  {new Date(`${day}T00:00:00+05:00`).toLocaleDateString(tag, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </h3>
                <ul className="divide-y divide-gray-100">
                  {dayLessons
                    .slice()
                    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                    .map((l) => {
                      const color = l.subject?.color || FALLBACK_SUBJECT_COLOR;
                      return (
                        <li key={l.id} className="flex items-center gap-3 py-3">
                          <LessonSubjectIcon icon={l.subject?.icon} color={color} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-800">
                              {l.subject?.name ?? l.group.name}
                            </p>
                            <p className="truncate text-xs text-gray-400">
                              {formatTime(l.starts_at)} · {l.group.teacher?.full_name ?? "—"}
                              {l.room ? ` · ${l.room}` : ""}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
