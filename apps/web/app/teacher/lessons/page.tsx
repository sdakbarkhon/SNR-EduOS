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

  // Промт «учителя/уроки», ЧАСТЬ В: в селекторе формы создания урока —
  // ТОЛЬКО предметы, которыми учитель владеет (subjects.teacher_id = он,
  // без стабов). Раньше грузились все предметы всех доступных групп
  // («co-teacher parity», Этап 4.7) — и предметник мог создать урок чужого
  // предмета; RLS 131 такой INSERT теперь всё равно отклонит, селектор
  // просто перестаёт предлагать невозможное. Куратору список не нужен:
  // создание уроков ему заблокировано (isCurator скрывает кнопку, RLS —
  // INSERT), пустой массив дополнительно включает no-subjects заглушку модалки.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacherSubjects, error: subjectsErr } = groups.length > 0 && !isCurator
    ? await (db as any)
        .from("subjects")
        .select("*, group:groups(id, name), teacher:teachers(id, full_name)")
        .in("group_id", groups.map(g => g.id))
        .eq("teacher_id", teacher.id)
        .eq("is_stub", false)
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
