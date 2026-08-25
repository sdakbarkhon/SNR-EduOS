import {
  getHomework,
  getLessons,
  getMySubmissions,
  getMyTestSubmissions,
  getAttendanceWithLesson,
  getStudentGrades,
} from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent, getMyGroups } from "@/lib/cached-queries";
import { safeQuery } from "@/lib/safe-query";
import { getMySchoolNowMs } from "@/lib/school-time-server";
import { DashboardView } from "./DashboardView";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Посещаемость за последние ~35 дней — для блока «Серия успехов» (ЧАСТЬ 3).
  // Через safeQuery, чтобы сбой посещаемости не рушил весь дашборд (реф 5222b73).
  // Z.3, заход 2 — окно «последние 35 дней» от времени школы ученика.
  // Неверное «сейчас» здесь не даёт ошибки: диапазон просто уезжает и экран
  // молча оказывается пустым.
  const attendanceFrom = new Date((await getMySchoolNowMs(supabase)) - 35 * 24 * 60 * 60 * 1000).toISOString();

  const [student, lessons, homework, submissions, testSubmissions, groups, attRes, gradesRes] = await Promise.all([
    getMyStudent(supabase),
    getLessons(supabase),
    getHomework(supabase),
    getMySubmissions(supabase),
    getMyTestSubmissions(supabase),
    getMyGroups(supabase),
    safeQuery(getAttendanceWithLesson(supabase, { from: attendanceFrom }), [], "DashboardPage.attendance"),
    // 25.08.2026, заход 2 — средний балл на дашборде считался по ДЗ и тестам,
    // а оценок за урок не видел вовсе: у sherzod_10 выходило ровно 5.00 при
    // 4.24 на экране «Оценки». Теперь дашборду подаётся тот же полный журнал,
    // что и экрану «Оценки», а лишнее отсекает общее правило.
    safeQuery(getStudentGrades(supabase), [], "DashboardPage.grades"),
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
      grades={gradesRes.data}
    />
  );
}
