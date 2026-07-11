import { createClient } from "@/lib/supabase/server";
import { getTeacherLessonsByMonth, getTeacherGroups } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { TeacherLessonsView } from "./TeacherLessonsView";
import { redirect } from "next/navigation";

export default async function TeacherLessonsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  // Промт "презентации/skeleton" — TeacherLessonsView only ever uses the
  // initial `lessons` prop to seed the CURRENT month's view (see its
  // useState initializer); every other month is fetched on demand via
  // loadMonth()/getTeacherLessonsByMonth. Fetching every lesson the teacher
  // can see (396+ rows and growing) just to filter down to ~30 client-side
  // was the single slowest query on this page (413ms measured at 396 rows,
  // scales with total lesson count, unbounded) — fetch only the current
  // month up front instead, matching what's actually shown on first paint.
  const now = new Date();
  const [lessons, groupsRaw, teacherRow] = await Promise.all([
    getTeacherLessonsByMonth(db, now.getFullYear(), now.getMonth() + 1).catch(() => []),
    Promise.resolve(getTeacherGroups(db)).catch(() => []),
    getMyTeacher(db).catch(() => null),
  ]);

  const groups = (groupsRaw as unknown as Array<{ id: string; name: string; subject: string }>);

  // Subjects of every group this teacher can access (curator OR co-teacher via
  // group_teachers — see is_my_teacher_group()), NOT just subjects.teacher_id
  // ownership. A strict teacher_id filter would leave co-teachers with an
  // empty subject list and unable to create lessons at all (БОЛЬШОЕ
  // ОБНОВЛЕНИЕ Этап 4.7 — demo teachers must have full functional parity).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacherSubjects } = groups.length > 0
    ? await (db as any)
        .from("subjects")
        .select("*, group:groups(id, name), teacher:teachers(id, full_name)")
        .in("group_id", groups.map(g => g.id))
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
