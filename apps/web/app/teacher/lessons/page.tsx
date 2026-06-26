import { createClient } from "@/lib/supabase/server";
import { getTeacherAllLessons, getTeacherGroups, getMyTeacher } from "@snr/core";
import { TeacherLessonsView } from "./TeacherLessonsView";
import { redirect } from "next/navigation";

export default async function TeacherLessonsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  const [lessons, groupsRaw, teacherRow] = await Promise.all([
    getTeacherAllLessons(db).catch(() => []),
    Promise.resolve(getTeacherGroups(db)).catch(() => []),
    getMyTeacher(db).catch(() => null),
  ]);

  const groups = (groupsRaw as unknown as Array<{ id: string; name: string; subject: string }>);

  // Fetch subjects for this teacher
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacherSubjects } = teacherRow
    ? await (db as any)
        .from("subjects")
        .select("*, group:groups(id, name), teacher:teachers(id, full_name)")
        .eq("teacher_id", teacherRow.id)
        .order("name")
    : { data: [] };

  return (
    <TeacherLessonsView
      lessons={lessons}
      groups={groups}
      teacherSubjects={teacherSubjects ?? []}
    />
  );
}
