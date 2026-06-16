import { getLessons, getMyGroups, getTeachers, getHomework, getMySubmissions } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { ScheduleView } from "./ScheduleView";

export default async function SchedulePage() {
  const db = await createClient();

  const [lessons, groups, teachers, homework, submissions] = await Promise.all([
    getLessons(db),
    getMyGroups(db),
    getTeachers(db),
    getHomework(db),
    getMySubmissions(db),
  ]);

  return (
    <ScheduleView
      initialLessons={lessons}
      groups={groups}
      teachers={teachers}
      homework={homework}
      submissions={submissions}
    />
  );
}
