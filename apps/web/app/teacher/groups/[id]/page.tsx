import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getTeacherGroups, getGroupStudents, getTeacherGroupSubjects,
  getTeacherGradesFull, getTeacherAttendance, getTeacherLessonsForGroup,
} from "@snr/core";
import { safeQuery } from "@/lib/safe-query";
import { TeacherGroupDetailView } from "./TeacherGroupDetailView";

const RECENT_LESSONS = 5;

export default async function TeacherGroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Промт 6: getTeacherGroups больше НЕ глушится — сбой здесь раньше вёл
  // к notFound() (группа "не найдена"), неотличимо от реального 404.
  //
  // 26.08.2026: экран перестал быть одним списком учеников. Средний балл,
  // посещаемость и последние уроки берутся ТЕМИ ЖЕ запросами, что и карточка,
  // с которой сюда заходят, — иначе два экрана про одну группу снова начнут
  // показывать разные числа, как это уже было со средним баллом (заходы 1–3).
  const [groups, studentsRes, subjectsRes, gradesRes, attendanceRes, lessonsRes] = await Promise.all([
    getTeacherGroups(supabase),
    safeQuery(getGroupStudents(supabase, id), [], "TeacherGroupDetailPage.students"),
    safeQuery(getTeacherGroupSubjects(supabase), [], "TeacherGroupDetailPage.subjects"),
    safeQuery(getTeacherGradesFull(supabase), [], "TeacherGroupDetailPage.grades"),
    safeQuery(getTeacherAttendance(supabase), [], "TeacherGroupDetailPage.attendance"),
    safeQuery(getTeacherLessonsForGroup(supabase, id), [], "TeacherGroupDetailPage.lessons"),
  ]);

  const group = (groups as Array<{ id: string; name: string; subject: string }>).find((g) => g.id === id);
  if (!group) notFound();

  // Оценки уже сужены до предмета учителя внутри getTeacherGradesFull —
  // здесь остаётся выбрать группу и привести к форме, которую понимает
  // единое правило среднего балла (utils/gradeAverage).
  const grades = gradesRes.data
    .filter((g) => g.groupId === id)
    .map((g) => ({ sourceTable: g.source, grade5: g.grade5 }));

  const attendance = (attendanceRes.data as Array<{ status: string; lesson: { group_id: string } | null }>)
    .filter((a) => a.lesson?.group_id === id)
    .map((a) => a.status);

  return (
    <TeacherGroupDetailView
      group={group}
      students={studentsRes.data as never[]}
      subjects={subjectsRes.data.filter((s) => s.groupId === id)}
      grades={grades}
      attendance={attendance}
      lessons={lessonsRes.data.slice(0, RECENT_LESSONS)}
    />
  );
}
