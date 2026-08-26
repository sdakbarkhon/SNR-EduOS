import { createClient } from "@/lib/supabase/server";
import {
  getStudentLessonsForDate,
  getStudentLessonsForWeek,
  tashkentDayKey,
  tashkentWeekMonday,
} from "@snr/core";
import { getMyStudent } from "@/lib/cached-queries";
import { safeQuery } from "@/lib/safe-query";
import { ensureMorningCycleRan } from "@/lib/ensureMorningCycleRan";
import { getMySchoolNowMs } from "@/lib/school-time-server";
import { LessonsView } from "./LessonsView";

// ── Tashkent date helpers (UTC+5) ─────────────────────────────────────────────

// Z.3, заход 2 — «сейчас» приходит параметром, а не берётся глобально: эти
// две функции лежат на уровне модуля и клиента базы не видят, а школа
// известна только внутри страницы.
// 26.08.2026: своя копия смещения снесена — счёт по Ташкенту живёт
// в одном месте, packages/core/src/utils/date.ts.
const getTashkentToday = tashkentDayKey;

const getTashkentWeekMonday = tashkentWeekMonday;

// ─────────────────────────────────────────────────────────────────────────────

export default async function LessonsPage() {
  const db = await createClient();

  // Фолбэк утреннего цикла — см. apps/web/app/(app)/lessons/[id]/page.tsx.
  // /schedule → редирект на /lessons (см. schedule/page.tsx), поэтому одной
  // точки здесь достаточно для расписания.
  try { await ensureMorningCycleRan(); } catch { /* noop */ }

  const nowMs = await getMySchoolNowMs(db);
  const today = getTashkentToday(nowMs);
  const weekStart = getTashkentWeekMonday(nowMs);

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
