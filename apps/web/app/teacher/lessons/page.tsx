import { createClient } from "@/lib/supabase/server";
import { getTeacherLessonsByMonth, getTeacherGroups } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { safeQuery } from "@/lib/safe-query";
import { TeacherLessonsView } from "./TeacherLessonsView";
import { redirect } from "next/navigation";

export default async function TeacherLessonsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  // Куратор (subject_slug=NULL, teacher_karim) — наблюдательная роль: без
  // создания/редактирования уроков (RLS 131 это же enforce'ит на БД).
  // getMyTeacher request-scoped (layout уже дёргал) — доп. запроса нет.
  const teacher = await getMyTeacher(db);
  const isCurator = !teacher?.subject_slug;

  // Промт "презентации/skeleton" — TeacherLessonsView only ever uses the
  // initial `lessons` prop to seed the CURRENT month's view (see its
  // useState initializer); every other month is fetched on demand via
  // loadMonth()/getTeacherLessonsByMonth. Fetching every lesson the teacher
  // can see (396+ rows and growing) just to filter down to ~30 client-side
  // was the single slowest query on this page (413ms measured at 396 rows,
  // scales with total lesson count, unbounded) — fetch only the current
  // month up front instead, matching what's actually shown on first paint.
  const now = new Date();
  const [lessonsRes, groupsRes] = await Promise.all([
    safeQuery(getTeacherLessonsByMonth(db, now.getFullYear(), now.getMonth() + 1), [], "TeacherLessonsPage.lessons"),
    safeQuery(Promise.resolve(getTeacherGroups(db)), [], "TeacherLessonsPage.groups"),
  ]);
  const lessons = lessonsRes.data;
  const groups = (groupsRes.data as unknown as Array<{ id: string; name: string; subject: string }>);

  // Subjects of every group this teacher can access (curator OR co-teacher via
  // group_teachers — see is_my_teacher_group()), NOT just subjects.teacher_id
  // ownership. A strict teacher_id filter would leave co-teachers with an
  // empty subject list and unable to create lessons at all (БОЛЬШОЕ
  // ОБНОВЛЕНИЕ Этап 4.7 — demo teachers must have full functional parity).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacherSubjects, error: subjectsErr } = groups.length > 0
    ? await (db as any)
        .from("subjects")
        .select("*, group:groups(id, name), teacher:teachers(id, full_name)")
        .in("group_id", groups.map(g => g.id))
        .order("name")
    : { data: [], error: null };
  if (subjectsErr) console.error("[TeacherLessonsPage.subjects] failed:", subjectsErr.message);

  return (
    <TeacherLessonsView
      lessons={lessons}
      groups={groups}
      teacherSubjects={teacherSubjects ?? []}
      loadError={lessonsRes.failed}
      isCurator={isCurator}
    />
  );
}
