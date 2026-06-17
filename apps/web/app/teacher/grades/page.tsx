import { createClient } from "@/lib/supabase/server";
import { getTeacherGroups, getTeacherGradeStats } from "@snr/core";
import { TeacherGradesView } from "./TeacherGradesView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function TeacherGradesPage() {
  const supabase = await createClient();
  const [groups, stats] = await Promise.all([
    safe(getTeacherGroups(supabase), []),
    safe(getTeacherGradeStats(supabase), { totalGraded: 0, avgGrade: 0, weeklyGraded: 0 }),
  ]);

  return <TeacherGradesView groups={groups as never[]} stats={stats} />;
}
