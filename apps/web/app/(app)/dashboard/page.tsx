import {
  getHomework,
  getLessons,
  getMySubmissions,
  getMyTestSubmissions,
} from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent, getMyGroups } from "@/lib/cached-queries";
import { DashboardView } from "./DashboardView";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [student, lessons, homework, submissions, testSubmissions, groups] = await Promise.all([
    getMyStudent(supabase),
    getLessons(supabase),
    getHomework(supabase),
    getMySubmissions(supabase),
    getMyTestSubmissions(supabase),
    getMyGroups(supabase),
  ]);

  return (
    <DashboardView
      student={student}
      lessons={lessons}
      homework={homework}
      submissions={submissions}
      testSubmissions={testSubmissions}
      groups={groups}
    />
  );
}
