import {
  getHomework,
  getLessons,
  getMySubmissions,
  getMyTestSubmissions,
  getAttendanceWithLesson,
} from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent, getMyGroups } from "@/lib/cached-queries";
import { safeQuery } from "@/lib/safe-query";
import { DashboardView } from "./DashboardView";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Посещаемость за последние ~35 дней — для блока «Серия успехов» (ЧАСТЬ 3).
  // Через safeQuery, чтобы сбой посещаемости не рушил весь дашборд (реф 5222b73).
  const attendanceFrom = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();

  const [student, lessons, homework, submissions, testSubmissions, groups, attRes] = await Promise.all([
    getMyStudent(supabase),
    getLessons(supabase),
    getHomework(supabase),
    getMySubmissions(supabase),
    getMyTestSubmissions(supabase),
    getMyGroups(supabase),
    safeQuery(getAttendanceWithLesson(supabase, { from: attendanceFrom }), [], "DashboardPage.attendance"),
  ]);

  const attendance = attRes.data.map((a) => ({ status: a.status, startsAt: a.lesson.starts_at }));

  return (
    <DashboardView
      student={student}
      lessons={lessons}
      homework={homework}
      submissions={submissions}
      testSubmissions={testSubmissions}
      groups={groups}
      attendance={attendance}
    />
  );
}
