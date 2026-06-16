import {
  getAttendance,
  getHomework,
  getLessons,
  getMaterials,
  getMyGroups,
  getMyStudent,
  getMySubmissions,
} from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { DashboardView } from "./DashboardView";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [student, lessons, homework, submissions, attendance, groups, materials] =
    await Promise.all([
      getMyStudent(supabase),
      getLessons(supabase),
      getHomework(supabase),
      getMySubmissions(supabase),
      getAttendance(supabase),
      getMyGroups(supabase),
      getMaterials(supabase),
    ]);

  return (
    <DashboardView
      student={student}
      lessons={lessons}
      homework={homework}
      submissions={submissions}
      attendance={attendance}
      groups={groups}
      materials={materials}
    />
  );
}
