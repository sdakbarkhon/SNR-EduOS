import { createClient } from "@/lib/supabase/server";
import {
  getTeacherGroups, getTeacherHomework,
  getTeacherTodayLessons, getTeacherRecentSubmissions,
  getTeacherAnnouncementsFeed,
} from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { safeQuery } from "@/lib/safe-query";
import { getMySchoolNowMs } from "@/lib/school-time-server";
import { TeacherDashboardView } from "./TeacherDashboardView";

export default async function TeacherDashboardPage() {
  const supabase = await createClient();

  // Z.3, заход 2 — «сегодня» для карточки уроков от времени школы учителя.
  // Считаем до Promise.all: значение нужно одним из запросов, а сам вызов
  // дедуплицирован на запрос (см. school-time-server.ts).
  const nowMs = await getMySchoolNowMs(supabase);

  const [teacherRes, groupsRes, homeworkRes, todayLessonsRes, recentSubmissionsRes, announcementsRes] = await Promise.all([
    safeQuery(getMyTeacher(supabase), null, "TeacherDashboardPage.teacher"),
    safeQuery(getTeacherGroups(supabase), [], "TeacherDashboardPage.groups"),
    safeQuery(getTeacherHomework(supabase), [], "TeacherDashboardPage.homework"),
    // 07.08.2026: «сегодня» — замороженная дата, а не реальные часы сервера.
    safeQuery(getTeacherTodayLessons(supabase, nowMs), [], "TeacherDashboardPage.todayLessons"),
    safeQuery(getTeacherRecentSubmissions(supabase, 8), [], "TeacherDashboardPage.recentSubmissions"),
    safeQuery(getTeacherAnnouncementsFeed(supabase, 8), [], "TeacherDashboardPage.announcements"),
  ]);

  return (
    <TeacherDashboardView
      teacher={teacherRes.data}
      groups={groupsRes.data as never[]}
      homework={homeworkRes.data as never[]}
      todayLessons={todayLessonsRes.data as never[]}
      recentSubmissions={recentSubmissionsRes.data as never[]}
      todayLessonsError={todayLessonsRes.failed}
      announcements={announcementsRes.data as never[]}
    />
  );
}
