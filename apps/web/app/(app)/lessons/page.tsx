import { createClient } from "@/lib/supabase/server";
import {
  getStudentLessonsForDate,
  getStudentLessonsForWeek,
} from "@snr/core";
import { getMyStudent } from "@/lib/cached-queries";
import { safeQuery } from "@/lib/safe-query";
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

  const [student, todayRes, weekRes] = await Promise.all([
    getMyStudent(db),
    safeQuery(getStudentLessonsForDate(db, today), [], "LessonsPage.today"),
    safeQuery(getStudentLessonsForWeek(db, weekStart), [], "LessonsPage.week"),
  ]);

  return (
    <LessonsView
      studentName={student.full_name}
      today={today}
      initialWeekStart={weekStart}
      todayLessons={todayRes.data}
      initialWeekLessons={weekRes.data}
      loadError={todayRes.failed || weekRes.failed}
    />
  );
}
