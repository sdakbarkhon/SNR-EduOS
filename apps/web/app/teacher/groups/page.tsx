import { createClient } from "@/lib/supabase/server";
import {
  getTeacherGroups, getTeacherHomework, getTeacherGrades, getTeacherAttendance,
  getTeacherGroupSubjects,
} from "@snr/core";
import { TeacherGroupsView } from "./TeacherGroupsView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function TeacherGroupsPage() {
  const supabase = await createClient();
  // 26.08.2026: настоящий предмет группы приходит из subjects. Раньше
  // подпись карточки бралась из groups.subject, а там у всех групп стоит
  // 'programming' — учитель английского видел три «Программирования».
  const [groups, homework, grades, attendance, subjects] = await Promise.all([
    safe(getTeacherGroups(supabase), []),
    safe(getTeacherHomework(supabase), []),
    safe(getTeacherGrades(supabase), []),
    safe(getTeacherAttendance(supabase), []),
    safe(getTeacherGroupSubjects(supabase), []),
  ]);

  return (
    <TeacherGroupsView
      groups={groups as never[]}
      homework={homework as never[]}
      grades={grades as never[]}
      attendance={attendance as never[]}
      subjects={subjects}
    />
  );
}
