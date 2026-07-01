import {
  getHomework,
  getLessons,
  getMyGroups,
  getMyStudent,
  getMySubmissions,
  getWeeklyStageProgress,
} from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { DashboardView } from "./DashboardView";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [student, lessons, homework, submissions, groups] = await Promise.all([
    getMyStudent(supabase),
    getLessons(supabase),
    getHomework(supabase),
    getMySubmissions(supabase),
    getMyGroups(supabase),
  ]);

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const weekLessonIds = lessons
    .filter((l) => {
      const t = new Date(l.starts_at).getTime();
      return t >= weekAgo && t <= now;
    })
    .map((l) => l.id);
  const weeklyProgress = await getWeeklyStageProgress(supabase, weekLessonIds);

  return (
    <DashboardView
      student={student}
      lessons={lessons}
      homework={homework}
      submissions={submissions}
      groups={groups}
      weeklyProgress={weeklyProgress}
    />
  );
}
