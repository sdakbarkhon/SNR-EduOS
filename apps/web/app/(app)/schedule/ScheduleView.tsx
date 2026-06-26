"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { LessonWithSubject, Locale } from "@snr/core";
import { cn } from "@/lib/cn";
import { useLocale } from "@/components/LocaleProvider";
import { LessonCard, lessonWithSubjectToCard } from "@/components/LessonCard";

type Tab = "today" | "week";

// ── date helpers ──────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

function lessonDateKey(iso: string): string {
  // Convert UTC → Tashkent (UTC+5), extract YYYY-MM-DD
  const ms = new Date(iso).getTime() + 5 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function fmtWeekRange(monday: string, locale: string): string {
  const localeMap: Record<string, string> = { ru: "ru-RU", en: "en-US", uz: "uz-UZ" };
  const l = localeMap[locale] ?? "ru-RU";
  const ws = new Date(`${monday}T12:00:00`);
  const we = new Date(`${addDays(monday, 6)}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  if (ws.getMonth() === we.getMonth()) {
    const start = ws.getDate();
    const end = we.toLocaleDateString(l, opts);
    return `${start} — ${end} ${ws.getFullYear()}`;
  }
  return `${ws.toLocaleDateString(l, opts)} — ${we.toLocaleDateString(l, opts)} ${we.getFullYear()}`;
}

function fmtDayHeader(dateStr: string, locale: string): string {
  const localeMap: Record<string, string> = { ru: "ru-RU", en: "en-US", uz: "uz-UZ" };
  const l = localeMap[locale] ?? "ru-RU";
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(l, { weekday: "long", day: "numeric", month: "long" });
}

function fmtNextDate(dateStr: string, locale: string): string {
  const localeMap: Record<string, string> = { ru: "ru-RU", en: "en-US", uz: "uz-UZ" };
  const l = localeMap[locale] ?? "ru-RU";
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(l, { weekday: "long", day: "numeric", month: "long" });
}

// ── sub-components ────────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
  labelToday,
  labelWeek,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  labelToday: string;
  labelWeek: string;
}) {
  return (
    <div className="flex gap-1 rounded-2xl bg-zinc-100 p-1 w-fit">
      {(["today", "week"] as Tab[]).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={cn(
            "rounded-xl px-5 py-2 text-sm font-semibold transition-all",
            active === t
              ? "bg-violet-600 text-white shadow-sm"
              : "text-zinc-600 hover:text-violet-600",
          )}
        >
          {t === "today" ? labelToday : labelWeek}
        </button>
      ))}
    </div>
  );
}

function EmptyDay({ text }: { text: string }) {
  return (
    <p className="py-2 text-sm text-zinc-400 italic">{text}</p>
  );
}

// ── TODAY view ────────────────────────────────────────────────────────────────

function TodayView({
  todayLessons,
  nextDayDate,
  nextDayLessons,
  locale,
  d,
}: {
  todayLessons: LessonWithSubject[];
  nextDayDate: string | null;
  nextDayLessons: LessonWithSubject[];
  locale: string;
  d: ReturnType<typeof getDictionary>["schedule"];
}) {
  if (todayLessons.length > 0) {
    return (
      <div className="space-y-3">
        {todayLessons.map((l) => (
          <LessonCard key={l.id} lesson={lessonWithSubjectToCard(l)} />
        ))}
      </div>
    );
  }

  // Empty today
  return (
    <div className="space-y-6">
      {/* Empty state */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 py-12 text-center">
        <CalendarDays className="h-12 w-12 text-zinc-300" strokeWidth={1.5} />
        <p className="text-lg font-semibold text-zinc-700">{d.todayNoLessons}</p>
        {nextDayDate && (
          <p className="text-sm text-zinc-500">
            {d.nextLessons.replace("{date}", fmtNextDate(nextDayDate, locale))}
          </p>
        )}
        {!nextDayDate && (
          <>
            <p className="text-base font-semibold text-zinc-600">{d.scheduleEmpty}</p>
            <p className="text-sm text-zinc-400">{d.scheduleEmptyHint}</p>
          </>
        )}
      </div>

      {/* Next day's lessons */}
      {nextDayDate && nextDayLessons.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            {fmtDayHeader(nextDayDate, locale)}
          </h3>
          {nextDayLessons.map((l) => (
            <LessonCard key={l.id} lesson={lessonWithSubjectToCard(l)} />
          ))}
        </div>
      )}

      {/* Truly empty */}
      {!nextDayDate && (
        <div className="text-center">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-zinc-200" />
          <p className="text-sm text-zinc-400">{d.scheduleEmptyHint}</p>
        </div>
      )}
    </div>
  );
}

// ── WEEK view ─────────────────────────────────────────────────────────────────

function WeekView({
  weekStart,
  weekLessons,
  today,
  locale,
  d,
  onPrev,
  onNext,
}: {
  weekStart: string;
  weekLessons: LessonWithSubject[];
  today: string;
  locale: string;
  d: ReturnType<typeof getDictionary>["schedule"];
  onPrev: () => void;
  onNext: () => void;
}) {
  const days = weekDates(weekStart);

  // Group lessons by Tashkent date
  const byDay = new Map<string, LessonWithSubject[]>();
  for (const l of weekLessons) {
    const key = lessonDateKey(l.starts_at);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(l);
  }

  const rangeLabel = fmtWeekRange(weekStart, locale);

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white border border-zinc-100 px-4 py-3 shadow-sm">
        <button
          onClick={onPrev}
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {d.prevWeek}
        </button>
        <span className="text-sm font-semibold text-zinc-800 text-center">{rangeLabel}</span>
        <button
          onClick={onNext}
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          {d.nextWeek}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Days */}
      <div className="space-y-5">
        {days.map((dateStr) => {
          const lessons = byDay.get(dateStr) ?? [];
          const isToday = dateStr === today;

          return (
            <div key={dateStr}>
              <h3
                className={cn(
                  "mb-2.5 text-sm font-bold capitalize",
                  isToday ? "text-violet-600" : "text-zinc-500",
                )}
              >
                {isToday && (
                  <span className="mr-2 inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                    Сегодня
                  </span>
                )}
                {fmtDayHeader(dateStr, locale)}
              </h3>

              {lessons.length === 0 ? (
                <EmptyDay text={d.dayNoLessons} />
              ) : (
                <div className="space-y-2">
                  {lessons.map((l) => (
                    <LessonCard key={l.id} lesson={lessonWithSubjectToCard(l)} variant="compact" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

export function ScheduleView({
  initialTab,
  today,
  weekStart,
  todayLessons,
  weekLessons,
  nextDayDate,
  nextDayLessons,
}: {
  initialTab: Tab;
  today: string;
  weekStart: string;
  todayLessons: LessonWithSubject[];
  weekLessons: LessonWithSubject[];
  nextDayDate: string | null;
  nextDayLessons: LessonWithSubject[];
}) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { locale }   = useLocale();
  const d = getDictionary(locale as Locale).schedule;

  // Hydration guard: server renders in UTC, client knows local TZ
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const activeTab = (searchParams.get("tab") as Tab | null) ?? initialTab;

  function switchTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    if (tab === "week") params.set("week", weekStart);
    else params.delete("week");
    router.push(`/schedule?${params.toString()}`);
  }

  function prevWeek() {
    const prev = addDays(weekStart, -7);
    router.push(`/schedule?tab=week&week=${prev}`);
  }
  function nextWeek() {
    const next = addDays(weekStart, 7);
    router.push(`/schedule?tab=week&week=${next}`);
  }

  if (!mounted) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-zinc-900">{d.title}</h1>
        <TabBar
          active={activeTab}
          onChange={switchTab}
          labelToday={d.tabToday}
          labelWeek={d.tabWeek}
        />
      </div>

      {/* Content */}
      {activeTab === "today" ? (
        <TodayView
          todayLessons={todayLessons}
          nextDayDate={nextDayDate}
          nextDayLessons={nextDayLessons}
          locale={locale}
          d={d}
        />
      ) : (
        <WeekView
          weekStart={weekStart}
          weekLessons={weekLessons}
          today={today}
          locale={locale}
          d={d}
          onPrev={prevWeek}
          onNext={nextWeek}
        />
      )}
    </div>
  );
}
