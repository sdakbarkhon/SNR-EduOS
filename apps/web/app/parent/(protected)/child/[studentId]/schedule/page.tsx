import { createClient } from "@/lib/supabase/server";
import { getStudentLessonsForWeek } from "@snr/core";
import { getParentContext, resolveSelectedChild } from "@/lib/parent-context";
import { ScheduleView } from "./ScheduleView";

function getTashkentWeekMonday(offsetWeeks = 0): string {
  const base = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const dow = base.getUTCDay(); // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow;
  base.setUTCDate(base.getUTCDate() + offset + offsetWeeks * 7);
  return base.toISOString().slice(0, 10);
}

export default async function ChildSchedulePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  // Ownership already validated by the parent [studentId]/layout.tsx guard.
  const ctx = await getParentContext();
  const child = ctx ? resolveSelectedChild(ctx.children, studentId) : null;
  if (!child) return null;

  const db = await createClient();
  const thisWeekStart = getTashkentWeekMonday(0);
  const nextWeekStart = getTashkentWeekMonday(1);

  const [thisWeekLessons, nextWeekLessons] = await Promise.all([
    getStudentLessonsForWeek(db, thisWeekStart, studentId).catch(() => []),
    getStudentLessonsForWeek(db, nextWeekStart, studentId).catch(() => []),
  ]);

  return (
    <ScheduleView
      child={child}
      thisWeekStart={thisWeekStart}
      nextWeekStart={nextWeekStart}
      thisWeekLessons={thisWeekLessons}
      nextWeekLessons={nextWeekLessons}
    />
  );
}
