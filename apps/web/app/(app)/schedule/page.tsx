import { createClient } from "@/lib/supabase/server";
import {
  getStudentLessonsForDate,
  getStudentLessonsForWeek,
  getNextStudentLessonDate,
} from "@snr/core";
import { ScheduleView } from "./ScheduleView";

// ── Tashkent date helpers (UTC+5) ─────────────────────────────────────────────

function getTashkentToday(): string {
  const tashkentMs = Date.now() + 5 * 60 * 60 * 1000;
  return new Date(tashkentMs).toISOString().slice(0, 10);
}

function getTashkentWeekMonday(dateStr?: string): string {
  const base = dateStr
    ? new Date(`${dateStr}T12:00:00+05:00`)
    : new Date(Date.now() + 5 * 60 * 60 * 1000);
  const dow = base.getDay(); // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(base);
  monday.setDate(base.getDate() + offset);
  return monday.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; week?: string }>;
}) {
  const { tab = "today", week } = await searchParams;
  const db = await createClient();

  const today     = getTashkentToday();
  const weekStart = week ? getTashkentWeekMonday(week) : getTashkentWeekMonday();

  // Always fetch both views so switching tabs is instant (no refetch on client)
  const [todayLessons, weekLessons] = await Promise.all([
    getStudentLessonsForDate(db, today).catch(() => []),
    getStudentLessonsForWeek(db, weekStart).catch(() => []),
  ]);

  // Empty-state: find next day with lessons and prefetch its cards
  let nextDayDate: string | null = null;
  let nextDayLessons: Awaited<ReturnType<typeof getStudentLessonsForDate>> = [];
  if (todayLessons.length === 0) {
    nextDayDate = await getNextStudentLessonDate(db, today).catch(() => null);
    if (nextDayDate) {
      nextDayLessons = await getStudentLessonsForDate(db, nextDayDate).catch(() => []);
    }
  }

  return (
    <ScheduleView
      initialTab={tab === "week" ? "week" : "today"}
      today={today}
      weekStart={weekStart}
      todayLessons={todayLessons}
      weekLessons={weekLessons}
      nextDayDate={nextDayDate}
      nextDayLessons={nextDayLessons}
    />
  );
}
