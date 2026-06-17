import { createClient } from "@/lib/supabase/server";
import {
  getTeacherGroups, getTeacherHomework, getTeacherGrades, getTeacherAttendance,
} from "@snr/core";
import { TeacherGroupsView } from "./TeacherGroupsView";

async function safe<T>(p: PromiseLike<T>, fb: T): Promise<T> {
  try { return await (p as Promise<T>); } catch { return fb; }
}

export default async function TeacherGroupsPage() {
  const supabase = await createClient();
  const [groups, homework, grades, attendance] = await Promise.all([
    safe(getTeacherGroups(supabase), []),
    safe(getTeacherHomework(supabase), []),
    safe(getTeacherGrades(supabase), []),
    safe(getTeacherAttendance(supabase), []),
  ]);

  return (
    <TeacherGroupsView
      groups={groups as never[]}
      homework={homework as never[]}
      grades={grades as never[]}
      attendance={attendance as never[]}
    />
  );
}
