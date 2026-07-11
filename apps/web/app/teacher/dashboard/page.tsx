import { createClient } from "@/lib/supabase/server";
import {
  getTeacherGroups, getTeacherHomework,
  getTeacherTodayLessons, getTeacherRecentSubmissions, getTeacherGrades,
} from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { TeacherDashboardView } from "./TeacherDashboardView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function TeacherDashboardPage() {
  const supabase = await createClient();

  const [teacher, groups, homework, todayLessons, recentSubmissions, grades] = await Promise.all([
    safe(getMyTeacher(supabase), null),
    safe(getTeacherGroups(supabase), []),
    safe(getTeacherHomework(supabase), []),
    safe(getTeacherTodayLessons(supabase), []),
    safe(getTeacherRecentSubmissions(supabase, 8), []),
    safe(getTeacherGrades(supabase), []),
  ]);

  return (
    <TeacherDashboardView
      teacher={teacher}
      groups={groups as never[]}
      homework={homework as never[]}
      todayLessons={todayLessons as never[]}
      recentSubmissions={recentSubmissions as never[]}
      grades={grades as never[]}
    />
  );
}
