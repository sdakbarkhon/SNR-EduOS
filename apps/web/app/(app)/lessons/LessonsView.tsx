"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Backpack,
  BookOpen,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Smile,
  Star,
} from "lucide-react";
import { getDictionary, getStudentLessonsForWeek } from "@snr/core";
import type { LessonWithSubject, Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { useLocale } from "@/components/LocaleProvider";
import { LUCIDE_ICONS } from "@/lib/subject-icons";

type ViewMode = "today" | "week";

const MODE_KEY = "lessons-view-mode";
const ACCENT = "#7C5CFC";
const FALLBACK_COLOR = "#64748b";
// Урок без ends_at и duration_minutes считаем стандартными 45 минутами
const DEFAULT_LESSON_MIN = 45;

// ── date helpers (fixed UTC+5, как в queries) ────────────────────────────────

const TZ_MS = 5 * 60 * 60 * 1000;
const LOCALE_MAP: Record<string, string> = { ru: "ru-RU", en: "en-US", uz: "uz-UZ" };

function tk(iso: string): Date {
  return new Date(new Date(iso).getTime() + TZ_MS);
}
function dateKey(iso: string): string {
  return tk(iso).toISOString().slice(0, 10);
}
function hm(iso: string): string {
  return tk(iso).toISOString().slice(11, 16);
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function fmtDayMonth(dateStr: string, locale: string): string {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString(LOCALE_MAP[locale] ?? "ru-RU", {
    day: "numeric", month: "long", timeZone: "UTC",
  });
}
function fmtWeekday(dateStr: string, locale: string, style: "long" | "short" = "long"): string {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString(LOCALE_MAP[locale] ?? "ru-RU", {
    weekday: style, timeZone: "UTC",
  });
}
function fmtWeekRange(monday: string, locale: string): string {
  const l = LOCALE_MAP[locale] ?? "ru-RU";
  const ws = new Date(`${monday}T12:00:00Z`);
  const we = new Date(`${addDays(monday, 6)}T12:00:00Z`);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", timeZone: "UTC" };
  if (ws.getUTCMonth() === we.getUTCMonth()) {
    return `${ws.getUTCDate()} — ${we.toLocaleDateString(l, opts)} ${ws.getUTCFullYear()}`;
  }
  return `${ws.toLocaleDateString(l, opts)} — ${we.toLocaleDateString(l, opts)} ${we.getUTCFullYear()}`;
}

// ── lesson helpers ────────────────────────────────────────────────────────────

function lessonStartMs(l: LessonWithSubject): number {
  return new Date(l.starts_at).getTime();
}
function lessonEndMs(l: LessonWithSubject): number {
  if (l.ends_at) return new Date(l.ends_at).getTime();
  return lessonStartMs(l) + (l.duration_minutes ?? DEFAULT_LESSON_MIN) * 60_000;
}
function lessonName(l: LessonWithSubject): string {
  return l.subject?.name ?? l.title ?? l.topic ?? "—";
}
function lessonColor(l: LessonWithSubject): string {
  return l.subject?.color || FALLBACK_COLOR;
}
function timeLabel(l: LessonWithSubject): string {
  const start = hm(l.starts_at);
  const endIso = l.ends_at
    ?? (l.duration_minutes ? new Date(lessonEndMs(l)).toISOString() : null);
  return endIso ? `${start} – ${hm(endIso)}` : start;
}

// ── clay-стиль иконка предмета (Часть 6) ─────────────────────────────────────

function ClayIcon({
  icon, color, size = "lg", tilt = false,
}: {
  icon: string | undefined;
  color: string;
  size?: "lg" | "sm";
  tilt?: boolean;
}) {
  const Icon = (icon && LUCIDE_ICONS[icon]) || BookOpen;
  const lg = size === "lg";
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        lg ? "h-14 w-14 rounded-2xl" : "h-8 w-8 rounded-lg",
        tilt && "rotate-3",
      )}
      style={{
        background: `linear-gradient(135deg, ${color}B3 0%, ${color} 100%)`,
        boxShadow: lg ? `0 8px 16px -4px ${color}66` : `0 3px 8px -2px ${color}59`,
      }}
    >
      <div className={cn("absolute inset-x-1 top-1 rounded-full bg-white/25", lg ? "h-4" : "h-2")} />
      <Icon
        className={cn("relative text-white drop-shadow-sm", lg ? "h-7 w-7" : "h-4 w-4")}
        strokeWidth={2.2}
      />
    </div>
  );
}

// ── иллюстрация "нет уроков" (нет пригодных растровых ассетов) ───────────────

function BackpackArt({ size = "lg" }: { size?: "lg" | "sm" }) {
  const lg = size === "lg";
  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full bg-violet-100",
        lg ? "h-24 w-24" : "h-14 w-14",
      )}
    >
      <Backpack className={cn("text-violet-500 drop-shadow-md", lg ? "h-11 w-11" : "h-7 w-7")} />
      {lg && (
        <>
          <BookOpen className="absolute -left-1 top-1 h-5 w-5 -rotate-12 text-amber-500 drop-shadow-sm" />
          <Clock className="absolute -right-1 bottom-1 h-5 w-5 rotate-12 text-sky-500 drop-shadow-sm" />
        </>
      )}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

export function LessonsView({
  studentName,
  today,
  initialWeekStart,
  todayLessons,
  initialWeekLessons,
}: {
  studentName: string;
  today: string;
  initialWeekStart: string;
  todayLessons: LessonWithSubject[];
  initialWeekLessons: LessonWithSubject[];
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const s = d.schedule;

  const [mode, setMode] = useState<ViewMode>("today");
  // null до маунта — сервер (UTC) и клиент считают "сейчас" одинаково (гидрация)
  const [now, setNow] = useState<Date | null>(null);
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [weekCache, setWeekCache] = useState<Record<string, LessonWithSubject[]>>({
    [initialWeekStart]: initialWeekLessons,
  });
  const [weekLoading, setWeekLoading] = useState(false);

  useEffect(() => {
    setNow(new Date());
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === "week" || saved === "today") setMode(saved);
    } catch { /* blocked */ }
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  function switchMode(m: ViewMode) {
    setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* blocked */ }
  }

  async function goWeek(delta: -1 | 1) {
    const next = addDays(weekStart, delta * 7);
    setWeekStart(next);
    if (!weekCache[next]) {
      setWeekLoading(true);
      try {
        const lessons = await getStudentLessonsForWeek(createClient(), next);
        setWeekCache((c) => ({ ...c, [next]: lessons }));
      } catch {
        setWeekCache((c) => ({ ...c, [next]: [] }));
      }
      setWeekLoading(false);
    }
  }

  const firstName = studentName.split(" ")[0] ?? studentName;
  const nowMs = now?.getTime() ?? null;

  // Сейчас / Далее (пересчитывается каждые 30 сек через setInterval выше)
  const currentId = nowMs !== null
    ? todayLessons.find((l) =>
        l.status === "in_progress" || (nowMs >= lessonStartMs(l) && nowMs <= lessonEndMs(l)),
      )?.id ?? null
    : null;
  const nextLesson = nowMs !== null
    ? todayLessons.find((l) => lessonStartMs(l) > nowMs) ?? null
    : null;

  // Баннер (режим "Сегодня")
  let todayBanner = s.planLearnAchieve;
  if (nowMs !== null && todayLessons.length > 0) {
    if (nextLesson) {
      const totalMin = Math.max(1, Math.ceil((lessonStartMs(nextLesson) - nowMs) / 60_000));
      const time = totalMin < 60
        ? `${totalMin} ${s.minShort}`
        : `${Math.floor(totalMin / 60)} ${s.hourShort}${totalMin % 60 ? ` ${totalMin % 60} ${s.minShort}` : ""}`;
      todayBanner = s.nextLessonIn.replace("{time}", time);
    } else {
      todayBanner = s.allDoneToday;
    }
  }

  const weekLessons = weekCache[weekStart] ?? [];

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden">
      {/* Приветствие + иллюстрация + переключатель */}
      <div className="flex shrink-0 items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
            {d.dashboard.greeting.replace("{name}", firstName)}
            <span className="inline-block animate-wave">👋</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500 md:text-base">{s.greetingSub}</p>
          <div className="mt-3 flex w-fit rounded-full bg-white p-1 shadow-sm">
            {(["today", "week"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-all",
                  mode === m ? "text-white shadow-md" : "text-slate-500 hover:text-slate-800",
                )}
                style={mode === m ? { backgroundColor: ACCENT } : undefined}
              >
                <Calendar className="h-4 w-4" />
                {m === "today" ? s.tabToday : s.tabWeek}
              </button>
            ))}
          </div>
        </div>
        <div className="hidden md:block">
          <BackpackArt />
        </div>
      </div>

      {/* ── Режим СЕГОДНЯ ─────────────────────────────────────────────────── */}
      {mode === "today" && (
        <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="mt-4 shrink-0">
            <h2 className="text-lg font-bold text-slate-800">
              {d.common.today}, {fmtDayMonth(today, locale)}
            </h2>
            <p className="text-sm text-slate-500">{cap(fmtWeekday(today, locale))}</p>
          </div>

          {todayLessons.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-stretch gap-4 pb-2">
              {todayLessons.map((l) => {
                const color = lessonColor(l);
                const isNow = l.id === currentId;
                const isNext = !isNow && l.id === nextLesson?.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => router.push(`/lessons/${l.id}`)}
                    className="group w-56 shrink-0 text-left lg:w-60"
                  >
                    <div className="mb-1.5 px-1">
                      <span className="text-xs font-bold text-slate-500">{timeLabel(l)}</span>
                      <div className="mt-1 h-1 w-12 rounded-full" style={{ backgroundColor: color }} />
                    </div>
                    <div
                      className={cn(
                        "flex h-40 flex-col rounded-3xl border p-4 transition-shadow group-hover:shadow-lg",
                        isNow ? "border-violet-200 shadow-[0_10px_30px_rgba(124,92,252,0.18)]" : "border-white shadow-sm",
                      )}
                      style={{
                        background: isNow
                          ? "linear-gradient(135deg, #EDE9FE 0%, #F5F3FF 60%, #FCF8FF 100%)"
                          : `linear-gradient(135deg, ${color}0F 0%, ${color}26 100%), #ffffff`,
                      }}
                    >
                      <h4 className="truncate text-base font-extrabold text-slate-800">{lessonName(l)}</h4>
                      <p className="mt-0.5 text-sm font-medium text-slate-500">
                        {l.room ? `${cap(d.dashboard.room)} ${l.room}` : " "}
                      </p>
                      <div className="mt-auto flex items-end justify-between gap-2">
                        {isNow ? (
                          <span className="rounded-full px-3 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: ACCENT }}>
                            {d.dashboard.now}
                          </span>
                        ) : isNext ? (
                          <span className="rounded-full border-2 border-orange-400 px-3 py-1 text-xs font-bold text-orange-500">
                            {s.next}
                          </span>
                        ) : (
                          <span />
                        )}
                        <ClayIcon icon={l.subject?.icon} color={color} tilt />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
              <BackpackArt />
              <p className="flex items-center gap-1.5 text-lg font-bold text-slate-700">{d.dashboard.noLessonsToday} <Smile className="h-5 w-5 text-violet-400" /></p>
              <button
                onClick={() => switchMode("week")}
                className="rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90"
                style={{ backgroundColor: ACCENT }}
              >
                {s.viewWeek}
              </button>
            </div>
          )}

          <div className="flex-1" />

          {/* Нижний баннер */}
          <div className="mt-3 flex shrink-0 items-center justify-between gap-4 rounded-3xl border border-violet-100 bg-violet-50 px-5 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm" style={{ color: ACCENT }}>
                <Star className="h-5 w-5" />
              </div>
              <span className="truncate text-sm font-bold text-violet-800">{todayBanner}</span>
            </div>
            <Link
              href="/homework"
              className="flex shrink-0 items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-bold shadow-sm transition hover:bg-slate-50"
              style={{ color: ACCENT }}
            >
              <ClipboardList className="h-4 w-4" />
              {s.myAssignments}
            </Link>
          </div>
        </div>
      )}

      {/* ── Режим НЕДЕЛЯ ──────────────────────────────────────────────────── */}
      {mode === "week" && (
        <WeekGrid
          weekStart={weekStart}
          lessons={weekLessons}
          today={today}
          loading={weekLoading}
          locale={locale}
          s={s}
          roomLabel={d.dashboard.room}
          onPrev={() => goWeek(-1)}
          onNext={() => goWeek(1)}
          onOpen={(id) => router.push(`/lessons/${id}`)}
        />
      )}
    </div>
  );
}

// ── Сетка недели ──────────────────────────────────────────────────────────────

function WeekGrid({
  weekStart, lessons, today, loading, locale, s, roomLabel, onPrev, onNext, onOpen,
}: {
  weekStart: string;
  lessons: LessonWithSubject[];
  today: string;
  loading: boolean;
  locale: string;
  s: ReturnType<typeof getDictionary>["schedule"];
  roomLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onOpen: (id: string) => void;
}) {
  const { days, times, cells, emptyDays } = useMemo(() => {
    const days = weekDates(weekStart);
    const byDay = new Map<string, LessonWithSubject[]>();
    for (const l of lessons) {
      const key = dateKey(l.starts_at);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(l);
    }
    const times = [...new Set(lessons.map((l) => hm(l.starts_at)))].sort();
    const timeIdx = new Map(times.map((t, i) => [t, i]));
    // (dayIdx, timeIdx) → уроки этой ячейки
    const cells = new Map<string, LessonWithSubject[]>();
    for (const [day, dayLessons] of byDay) {
      const di = days.indexOf(day);
      if (di < 0) continue;
      for (const l of dayLessons) {
        const key = `${di}-${timeIdx.get(hm(l.starts_at)) ?? 0}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key)!.push(l);
      }
    }
    const emptyDays = days.map((day) => !(byDay.get(day)?.length));
    return { days, times, cells, emptyDays };
  }, [lessons, weekStart]);

  const todayIdx = days.indexOf(today);

  const rowCount = Math.max(times.length, 1);
  const gridTemplate = {
    gridTemplateColumns: "44px repeat(7, minmax(0, 1fr))",
  } as const;

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      {/* Заголовок + навигация по неделям */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 md:text-xl">{s.weekHeading}</h2>
          <p className="text-sm font-medium text-slate-500">{s.weekSub}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            aria-label={s.prevWeek}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[180px] text-center text-sm font-bold text-slate-700">
            {fmtWeekRange(weekStart, locale)}
          </span>
          <button
            onClick={onNext}
            aria-label={s.nextWeek}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Сетка */}
      <div className="relative mt-3 flex min-h-0 flex-1 flex-col rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-white/70">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        )}

        {/* Шапка дней */}
        <div className="grid shrink-0 gap-x-2" style={gridTemplate}>
          <div />
          {days.map((day, i) => {
            const isToday = i === todayIdx;
            return (
              <div key={day} className="flex justify-center pb-2">
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold",
                    isToday ? "text-white shadow-md" : "text-slate-400",
                  )}
                  style={isToday ? { backgroundColor: ACCENT } : undefined}
                >
                  {cap(fmtWeekday(day, locale, "short").replace(".", ""))}{" "}
                  <span className={isToday ? "" : "text-slate-600"}>{Number(day.slice(8, 10))}</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Тело: время + чипы */}
        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
          <div
            className="relative grid min-h-full gap-2"
            style={{ ...gridTemplate, gridTemplateRows: `repeat(${rowCount}, minmax(52px, 1fr))` }}
          >
            {/* Подсветка сегодняшней колонки */}
            {todayIdx >= 0 && !emptyDays[todayIdx] && (
              <div
                className="pointer-events-none rounded-2xl border border-violet-100 bg-violet-50/70"
                style={{ gridColumn: todayIdx + 2, gridRow: `1 / ${rowCount + 1}`, margin: "-4px" }}
              />
            )}

            {/* Колонка времени */}
            {times.map((t, i) => (
              <div
                key={t}
                className="pr-1 pt-1 text-right text-[11px] font-semibold text-slate-400"
                style={{ gridColumn: 1, gridRow: i + 1 }}
              >
                {t}
              </div>
            ))}

            {/* Чипы уроков */}
            {days.map((day, di) =>
              times.map((_, ti) => {
                const cellLessons = cells.get(`${di}-${ti}`);
                if (!cellLessons) return null;
                return (
                  <div
                    key={`${day}-${ti}`}
                    className="relative z-[1] flex min-w-0 flex-col justify-center gap-1"
                    style={{ gridColumn: di + 2, gridRow: ti + 1 }}
                  >
                    {cellLessons.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => onOpen(l.id)}
                        className={cn(
                          "flex w-full min-w-0 items-center gap-2 rounded-xl border bg-white p-2 text-left shadow-sm transition hover:shadow-md",
                          di === todayIdx ? "border-violet-100" : "border-slate-100",
                        )}
                      >
                        <ClayIcon icon={l.subject?.icon} color={lessonColor(l)} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-slate-800">{lessonName(l)}</div>
                          {l.room && (
                            <div className="truncate text-[10px] text-slate-500">
                              {cap(roomLabel)} {l.room}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                );
              }),
            )}

            {/* Пустые дни (выходные) */}
            {days.map((day, di) =>
              emptyDays[di] ? (
                <div
                  key={day}
                  className="z-[1] flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 py-4"
                  style={{ gridColumn: di + 2, gridRow: `1 / ${rowCount + 1}` }}
                >
                  <Backpack className="h-8 w-8 text-violet-400 opacity-70" />
                  <span className="flex items-center gap-1 px-1 text-center text-xs font-bold text-slate-400">{s.weekend} <Smile className="h-3.5 w-3.5" /></span>
                </div>
              ) : null,
            )}
          </div>
        </div>
      </div>

      {/* Нижний баннер (режим "Неделя") */}
      <div className="mt-3 flex shrink-0 items-center gap-3 rounded-3xl border border-violet-100 bg-violet-50 px-5 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm" style={{ color: ACCENT }}>
          <CalendarDays className="h-5 w-5" />
        </div>
        <span className="truncate text-sm font-bold text-violet-800">{s.planLearnAchieve}</span>
      </div>
    </div>
  );
}
