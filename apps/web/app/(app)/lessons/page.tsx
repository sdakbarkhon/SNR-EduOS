import { createClient } from "@/lib/supabase/server";
import {
  getMyStudent,
  getStudentLessonsForDate,
  getStudentLessonsForWeek,
} from "@snr/core";
import { LessonsView } from "./LessonsView";

// ── Tashkent date helpers (UTC+5) ─────────────────────────────────────────────

function getTashkentToday(): string {
  const tashkentMs = Date.now() + 5 * 60 * 60 * 1000;
  return new Date(tashkentMs).toISOString().slice(0, 10);
}

function getTashkentWeekMonday(): string {
  const base = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const dow = base.getUTCDay(); // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow;
  base.setUTCDate(base.getUTCDate() + offset);
  return base.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function LessonsPage() {
  const db = await createClient();

  const today = getTashkentToday();
  const weekStart = getTashkentWeekMonday();

  const [student, todayLessons, weekLessons] = await Promise.all([
    getMyStudent(db),
    getStudentLessonsForDate(db, today).catch(() => []),
    getStudentLessonsForWeek(db, weekStart).catch(() => []),
  ]);

  return (
    <LessonsView
      studentName={student.full_name}
      today={today}
      initialWeekStart={weekStart}
      todayLessons={todayLessons}
      initialWeekLessons={weekLessons}
    />
  );
}
