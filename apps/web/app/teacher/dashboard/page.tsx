import { createClient } from "@/lib/supabase/server";
import {
  getTeacherGroups, getTeacherHomework,
  getTeacherTodayLessons, getTeacherRecentSubmissions, getTeacherGrades,
} from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { safeQuery } from "@/lib/safe-query";
import { TeacherDashboardView } from "./TeacherDashboardView";

export default async function TeacherDashboardPage() {
  const supabase = await createClient();

  const [teacherRes, groupsRes, homeworkRes, todayLessonsRes, recentSubmissionsRes, gradesRes] = await Promise.all([
    safeQuery(getMyTeacher(supabase), null, "TeacherDashboardPage.teacher"),
    safeQuery(getTeacherGroups(supabase), [], "TeacherDashboardPage.groups"),
    safeQuery(getTeacherHomework(supabase), [], "TeacherDashboardPage.homework"),
    safeQuery(getTeacherTodayLessons(supabase), [], "TeacherDashboardPage.todayLessons"),
    safeQuery(getTeacherRecentSubmissions(supabase, 8), [], "TeacherDashboardPage.recentSubmissions"),
    safeQuery(getTeacherGrades(supabase), [], "TeacherDashboardPage.grades"),
  ]);

  return (
    <TeacherDashboardView
      teacher={teacherRes.data}
      groups={groupsRes.data as never[]}
      homework={homeworkRes.data as never[]}
      todayLessons={todayLessonsRes.data as never[]}
      recentSubmissions={recentSubmissionsRes.data as never[]}
      grades={gradesRes.data as never[]}
      todayLessonsError={todayLessonsRes.failed}
    />
  );
}
