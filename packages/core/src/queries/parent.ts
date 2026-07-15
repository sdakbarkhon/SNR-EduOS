/* Промт МОБ-1 — родительские агрегаты, которых не было ни на вебе, ни в
 * мобилке (getMyChildren в apps/mobile-parent дублировал web'овский
 * parent-context; здесь — общая версия для обоих). RLS уже скоупит
 * parents/parent_students/students по auth.uid(), поэтому все функции
 * читают текущего пользователя сами (как getMyNotifications/getMyThreadSummaries),
 * без параметра parentId. */
import type { Db } from "../supabase/factory";
import type { AttendanceStatus, LessonWithSubject } from "../types";

// Тот же select, что LESSON_SUBJECT_SELECT в index.ts — не импортируем оттуда
// напрямую, чтобы не создавать циклическую зависимость index.ts <-> parent.ts
// (index.ts делает `export * from "./parent"`).
const DAILY_LESSON_SELECT =
  "id, group_id, title, topic, starts_at, ends_at, duration_minutes, room, status, " +
  "subject:subjects(id, name, icon, color), " +
  "group:groups!inner(id, name, teacher:teachers!groups_teacher_id_fkey(id, full_name, avatar_url))";

export type ParentChildSummary = {
  id: string;
  fullName: string;
  className: string | null;
  groupId: string | null;
};

export type ParentContext = {
  parentId: string;
  parentName: string;
  parentPhone: string | null;
  children: ParentChildSummary[];
};

type StudentGroupsRow = {
  id: string;
  full_name: string;
  student_groups: { group_id: string; groups: { name: string } | null }[] | null;
};

/** Родитель (текущая сессия) + его дети, в порядке привязки (parent_students.created_at ASC). */
export async function getParentContext(db: Db): Promise<ParentContext | null> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;

  const { data: parent, error: parentErr } = await db
    .from("parents")
    .select("id, full_name, phone")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (parentErr) throw parentErr;
  if (!parent) return null;

  const { data: links, error: linksErr } = await db
    .from("parent_students")
    .select("student_id, created_at")
    .eq("parent_id", parent.id)
    .order("created_at", { ascending: true });
  if (linksErr) throw linksErr;

  const studentIds = ((links ?? []) as { student_id: string }[]).map((l) => l.student_id);
  if (studentIds.length === 0) {
    return { parentId: parent.id, parentName: parent.full_name, parentPhone: parent.phone, children: [] };
  }

  const { data: students, error: studentsErr } = await db
    .from("students")
    .select("id, full_name, student_groups(group_id, groups(name))")
    .in("id", studentIds);
  if (studentsErr) throw studentsErr;

  const byId = new Map<string, ParentChildSummary>(
    ((students ?? []) as StudentGroupsRow[]).map((s) => {
      const sg = (s.student_groups ?? [])[0] ?? null;
      const className = sg?.groups?.name ?? null;
      return [s.id, { id: s.id, fullName: s.full_name, className, groupId: sg?.group_id ?? null }];
    }),
  );

  return {
    parentId: parent.id,
    parentName: parent.full_name,
    parentPhone: parent.phone,
    children: studentIds.map((id) => byId.get(id)).filter((c): c is ParentChildSummary => Boolean(c)),
  };
}

export type ChildDailyStats = {
  arrivalTime: string | null; // ISO marked_at первой отметки "присутствовал" за день
  lessonsTotal: number;
  lessonsAttended: number;
  nextLesson: { subjectName: string; startsAt: string } | null;
};

/** Статистика ребёнка "на сегодня" (главный экран): во сколько пришёл,
 *  сколько уроков всего/посещено, следующий урок. dateStr — YYYY-MM-DD. */
export async function getChildDailyStats(db: Db, studentId: string, dateStr: string): Promise<ChildDailyStats> {
  const { data: groupRows, error: groupErr } = await db
    .from("student_groups")
    .select("group_id")
    .eq("student_id", studentId);
  if (groupErr) throw groupErr;
  const groupIds = ((groupRows ?? []) as { group_id: string }[]).map((r) => r.group_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: lessonsErr } = await (db as any)
    .from("lessons")
    .select(DAILY_LESSON_SELECT)
    .gte("starts_at", `${dateStr}T00:00:00+05:00`)
    .lte("starts_at", `${dateStr}T23:59:59+05:00`)
    .in("group_id", groupIds.length > 0 ? groupIds : ["00000000-0000-0000-0000-000000000000"])
    .order("starts_at");
  if (lessonsErr) throw lessonsErr;
  const lessons = (data ?? []) as LessonWithSubject[];
  const lessonIds = lessons.map((l) => l.id);

  let attendanceRows: Array<{ lesson_id: string; status: AttendanceStatus; marked_at: string | null }> = [];
  if (lessonIds.length > 0) {
    const { data, error } = await db
      .from("attendance")
      .select("lesson_id, status, marked_at")
      .eq("student_id", studentId)
      .in("lesson_id", lessonIds);
    if (error) throw error;
    attendanceRows = (data ?? []) as typeof attendanceRows;
  }

  const attended = attendanceRows.filter((r) => r.status === "present");
  const arrivalTime = attended
    .filter((r) => r.marked_at)
    .sort((a, b) => (a.marked_at! < b.marked_at! ? -1 : 1))[0]?.marked_at ?? null;

  const nowIso = new Date().toISOString();
  const next = lessons.find((l) => l.starts_at > nowIso) ?? null;

  return {
    arrivalTime,
    lessonsTotal: lessons.length,
    lessonsAttended: attended.length,
    nextLesson: next ? { subjectName: next.subject?.name ?? next.title ?? "", startsAt: next.starts_at } : null,
  };
}

export type ChildSubjectGrade = {
  subjectId: string;
  subjectName: string;
  icon: string | null;
  color: string | null;
  average: number;
  count: number;
};

export type ChildGradesSummary = {
  average: number | null;
  subjects: ChildSubjectGrade[];
  strengths: string[];
  growthAreas: string[];
};

type LessonGradeRow = {
  grade: number;
  lesson: { subject: { id: string; name: string; icon: string | null; color: string | null } | null } | null;
};

/** Оценки ребёнка по предметам (lesson_grades, не submission-журнал —
 *  тот использует устаревшее groups.subject, см. миграцию 107; здесь
 *  subject разрешается через lessons.subject_id -> subjects, надёжно). */
export async function getChildGradesSummary(db: Db, studentId: string): Promise<ChildGradesSummary> {
  const { data, error } = await db
    .from("lesson_grades")
    .select("grade, lesson:lessons!inner(subject:subjects(id, name, icon, color))")
    .eq("student_id", studentId);
  if (error) throw error;

  const rows = (data ?? []) as unknown as LessonGradeRow[];
  const bySubject = new Map<string, { name: string; icon: string | null; color: string | null; sum: number; count: number }>();
  let overallSum = 0;
  let overallCount = 0;

  for (const r of rows) {
    const s = r.lesson?.subject;
    overallSum += r.grade;
    overallCount += 1;
    if (!s) continue;
    const cur = bySubject.get(s.id) ?? { name: s.name, icon: s.icon, color: s.color, sum: 0, count: 0 };
    cur.sum += r.grade;
    cur.count += 1;
    bySubject.set(s.id, cur);
  }

  const subjects: ChildSubjectGrade[] = Array.from(bySubject.entries())
    .map(([id, v]) => ({ subjectId: id, subjectName: v.name, icon: v.icon, color: v.color, average: v.sum / v.count, count: v.count }))
    .sort((a, b) => b.average - a.average);

  const average = overallCount > 0 ? overallSum / overallCount : null;
  const strengths = average != null ? subjects.filter((s) => s.average >= average).slice(0, 3).map((s) => s.subjectName) : [];
  const growthAreas = average != null ? subjects.filter((s) => s.average < average).slice(-3).map((s) => s.subjectName) : [];

  return { average, subjects, strengths, growthAreas };
}

export type GroupSubjectTeacher = {
  subjectId: string;
  subjectName: string;
  icon: string | null;
  color: string | null;
  teacherId: string | null;
  teacherName: string | null;
};

/** Промт МОБ-6 — все предметы группы ребёнка со своими учителями (для блока
 *  "Предметы и учителя" в полном профиле ребёнка). Один запрос на всю группу,
 *  а не по одному на предмет (в отличие от getChildSubjectDetail, который
 *  резолвит ровно один предмет для экрана деталей). */
export async function getGroupSubjectTeachers(db: Db, groupId: string): Promise<GroupSubjectTeacher[]> {
  const { data, error } = await db
    .from("subjects")
    .select("id, name, icon, color, is_active, teacher:teachers!subjects_teacher_id_fkey(id, full_name)")
    .eq("group_id", groupId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  type Row = { id: string; name: string; icon: string | null; color: string | null; teacher: { id: string; full_name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((s) => ({
    subjectId: s.id,
    subjectName: s.name,
    icon: s.icon,
    color: s.color,
    teacherId: s.teacher?.id ?? null,
    teacherName: s.teacher?.full_name ?? null,
  }));
}
