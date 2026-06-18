import type { Attendance, AttendanceWithLesson, ContentType, Homework, HomeworkSubmission, HomeworkWithSubmission, Lesson, TestSubmission } from "../types";

const DEFAULT_LESSON_MS = 45 * 60 * 1000;

/** % посещаемости: (присутствовал + опоздал) / всего, округлённый. */
export function attendancePercent(records: Pick<Attendance, "status">[]): number {
  if (records.length === 0) return 0;
  const attended = records.filter(
    (r) => r.status === "present" || r.status === "late",
  ).length;
  return Math.round((attended / records.length) * 100);
}

/** Ближайший будущий или идущий сейчас урок. */
export function nextLesson<T extends Pick<Lesson, "starts_at" | "ends_at" | "status">>(
  lessons: T[],
  now: number = Date.now(),
): T | null {
  const upcoming = lessons
    .filter((l) => l.status !== "completed")
    .filter((l) => {
      const end = l.ends_at
        ? new Date(l.ends_at).getTime()
        : new Date(l.starts_at).getTime() + DEFAULT_LESSON_MS;
      return end >= now;
    })
    .sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  return upcoming[0] ?? null;
}

// ─── Посещаемость ─────────────────────────────────────────────────────────────

export const ATTENDANCE_LOW_THRESHOLD = 75; // TODO: вынести в настройки школы

export type SubjectAttendanceStat = {
  subject: string;
  pct: number;
  attended: number;
  total: number;
};

export type AttendanceStats = {
  overall: number;
  bySubject: SubjectAttendanceStat[];
  daysWithoutAbsence: number;
  missed: number;
};

/** Полная статистика посещаемости по записям с join-данными. */
export function attendanceCalcAll(rows: AttendanceWithLesson[]): AttendanceStats {
  if (rows.length === 0) {
    return { overall: 0, bySubject: [], daysWithoutAbsence: 0, missed: 0 };
  }

  // overall
  const attended = rows.filter((r) => r.status === "present" || r.status === "late").length;
  const overall = Math.round((attended / rows.length) * 100);

  // missed (absent записей)
  const missed = rows.filter((r) => r.status === "absent").length;

  // days without absence: дни, в которые были занятия, без ни одного absent
  const byDay = new Map<string, { hasAbsent: boolean }>();
  for (const r of rows) {
    const d = r.lesson.starts_at.slice(0, 10); // "YYYY-MM-DD"
    const cur = byDay.get(d) ?? { hasAbsent: false };
    if (r.status === "absent") cur.hasAbsent = true;
    byDay.set(d, cur);
  }
  const daysWithoutAbsence = [...byDay.values()].filter((d) => !d.hasAbsent).length;

  // by subject
  const subjectMap = new Map<string, { attended: number; total: number }>();
  for (const r of rows) {
    const subj = r.lesson.group.subject;
    const cur = subjectMap.get(subj) ?? { attended: 0, total: 0 };
    cur.total += 1;
    if (r.status === "present" || r.status === "late") cur.attended += 1;
    subjectMap.set(subj, cur);
  }
  const bySubject: SubjectAttendanceStat[] = [...subjectMap.entries()]
    .map(([subject, { attended, total }]) => ({
      subject,
      pct: Math.round((attended / total) * 100),
      attended,
      total,
    }))
    .sort((a, b) => b.pct - a.pct);

  return { overall, bySubject, daysWithoutAbsence, missed };
}

/** Записи посещаемости за конкретный день — для точки в календаре. */
export function attendanceForDay(
  rows: AttendanceWithLesson[],
  day: Date,
): AttendanceWithLesson[] {
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();
  return rows.filter((r) => {
    const dt = new Date(r.lesson.starts_at);
    return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
  });
}

/** Цвет точки для дня: absent → warning, present/late → success, нет записей → null */
export type DotColor = "success" | "warning" | "neutral" | null;
export function dayDotColor(dayRows: AttendanceWithLesson[]): DotColor {
  if (dayRows.length === 0) return null;
  if (dayRows.some((r) => r.status === "absent")) return "warning";
  return "success";
}

// ─── Расписание ───────────────────────────────────────────────────────────────

/** Уроки на конкретный день (по локальной дате), отсортированы по времени. */
export function lessonsOnDay<T extends Pick<Lesson, "starts_at">>(
  lessons: T[],
  day: Date,
): T[] {
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();
  return lessons
    .filter((l) => {
      const dt = new Date(l.starts_at);
      return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
    })
    .sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
}

// ─── Домашние задания ─────────────────────────────────────────────────────────

export type HomeworkTab = "active" | "review" | "completed" | "overdue";

/** Категория ДЗ для табов (единая логика, не путать с homeworkState-StatusBadge). */
export function homeworkCategory(
  hw: Pick<Homework, "due_date"> & { content_type?: ContentType; test_submission?: TestSubmission | null },
  submission?: Pick<HomeworkSubmission, "status"> | null,
): HomeworkTab {
  if (hw.content_type === "test") {
    if (hw.test_submission) return "completed";
    const due = hw.due_date ? new Date(hw.due_date).setHours(23, 59, 59, 999) : null;
    if (due !== null && due < Date.now()) return "overdue";
    return "active";
  }
  if (submission) {
    return submission.status === "graded" ? "completed" : "review";
  }
  const due = hw.due_date ? new Date(hw.due_date).setHours(23, 59, 59, 999) : null;
  if (due !== null && due < Date.now()) return "overdue";
  return "active";
}

export type DeadlineUrgency = "normal" | "soon" | "overdue";

/** Срочность дедлайна: просрочено / < 2 дней / нормально. */
export function deadlineUrgency(dueDate: string | null): DeadlineUrgency {
  if (!dueDate) return "normal";
  const due = new Date(dueDate).setHours(23, 59, 59, 999);
  if (due < Date.now()) return "overdue";
  if (due - Date.now() < 2 * 86_400_000) return "soon";
  return "normal";
}

export type HomeworkCounts = {
  active: number;
  review: number;
  completed: number;
  overdue: number;
  total: number;
};

/** Счётчики по всем табам за один проход. */
export function homeworkCounts(rows: HomeworkWithSubmission[]): HomeworkCounts {
  let active = 0, review = 0, completed = 0, overdue = 0;
  for (const r of rows) {
    const tab = homeworkCategory(r, r.submission);
    if (tab === "active") active++;
    else if (tab === "review") review++;
    else if (tab === "completed") completed++;
    else if (tab === "overdue") overdue++;
  }
  return { active, review, completed, overdue, total: rows.length };
}
