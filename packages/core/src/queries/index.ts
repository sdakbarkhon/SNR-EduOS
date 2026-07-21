/**
 * Доступ к данным — чистые функции, принимающие типизированный клиент `Db`.
 * Web и mobile создают свой клиент (с платформенным хранилищем) и передают сюда.
 * RLS гарантирует, что ученик получает только свои строки.
 */
import type { Db } from "../supabase/factory";
import type { AttendanceRollCallRow, AttendanceWithLesson, AttendanceStatus, StudentStatus, Book, BookFavorite, Classwork, ClassworkQuestion, ClassworkSubmission, ClassworkSubmissionWithStudent, ClassworkType, ContentType, CourseMaterial, ExcuseRequest, ExcuseRequestWithStudent, Homework, HomeworkAttachment, HomeworkSource, HomeworkSubmission, HomeworkSubtask, HomeworkSubtaskSubmission, HomeworkSubtaskType, HomeworkWithSubmission, LeaveRequest, LeaveRequestWithStudent, Lesson, LessonContentType, LessonDetail, LessonMaterial, LessonSlide, LessonStage, LessonStageProgress, LessonStageType, LessonStageWithProgress, LessonGrade, StageDifficulty, LessonWithSubject, ProgrammingLanguage, RaisedHand, RaisedHandWithStudent, StudentLessonView, SubmissionStatus, TeacherLessonView, TestAnswer, TestQuestion, TestQuestionOption, TestSubmission, QuizQuestion, QuizAttempt, QuizAnswer, KahootSession, QuizQuestionInput, QuizLeaderboardEntry } from "../types";
import type { SubmissionInput, NotificationSettingsInput } from "../schemas";
import { unwrap } from "./helpers";

export * from "./projects";
export * from "./announcements";
export * from "./subjects";
export * from "./chat";
export * from "./curriculum";
export * from "./sandbox";
export * from "./parent";

// --- Профиль / группы ---
// Explicit user_id filter + limit(1) prevents PGRST116 if RLS returns >1 row
// (mirrors the pattern used in getMyTeacher).
export const getMyStudent = async (db: Db) => {
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return db.from("students").select("*").eq("user_id", user.id).limit(1).single().then(unwrap);
};

export const getMyGroups = (db: Db) =>
  db.from("groups").select("*").order("name").then(unwrap);

// --- Расписание / уроки / преподаватели ---
export const getLessons = (db: Db) =>
  db.from("lessons").select("*").order("starts_at", { ascending: true }).returns<Lesson[]>().then(unwrap);

export const getLesson = (db: Db, id: string) =>
  db.from("lessons").select("*").eq("id", id).single().then(unwrap);

export const getTeachers = (db: Db) =>
  db.from("teachers").select("id, full_name").then(unwrap);

// --- Посещаемость ---
export const getAttendance = (db: Db) =>
  db.from("attendance").select("*").order("recorded_at", { ascending: false }).then(unwrap);

/** Посещаемость с join-данными урока и группы; фильтрация по диапазону дат клиентская. */
export const getAttendanceWithLesson = (
  db: Db,
  { from, to }: { from?: string; to?: string } = {},
) =>
  db
    .from("attendance")
    .select(
      "id, student_id, lesson_id, status, recorded_at, lesson:lessons!inner(starts_at, ends_at, group_id, topic, group:groups!inner(id, subject))",
    )
    .order("recorded_at", { ascending: true })
    .then(unwrap)
    .then((rows) => {
      let result = rows as unknown as AttendanceWithLesson[];
      if (from) result = result.filter((r) => r.lesson.starts_at >= from);
      if (to) result = result.filter((r) => r.lesson.starts_at < to);
      return result.sort((a, b) =>
        a.lesson.starts_at.localeCompare(b.lesson.starts_at),
      );
    });

/** Посещаемость ученика с join урока/группы; фильтрация по предмету и месяцу (YYYY-MM).
 *  studentId — опционально: parent-контекст сужает до ОДНОГО выбранного ребёнка. */
export const getStudentAttendance = async (
  db: Db,
  filters?: { subject?: string; month?: string },
  studentId?: string,
): Promise<{
  records: Array<{
    id: string;
    lesson_id: string;
    lesson_title: string;
    lesson_topic: string;
    subject: string;
    lesson_date: string;
    status: AttendanceStatus;
    marked_at: string | null;
  }>;
  stats: { total: number; present: number; excused: number; unexcused: number; percentage: number };
}> => {
  let attQuery = db
    .from("attendance")
    .select(
      "id, lesson_id, status, marked_at, lesson:lessons!inner(topic, starts_at, group:groups!inner(subject, name))",
    )
    .order("marked_at", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (studentId) attQuery = (attQuery as any).eq("student_id", studentId);
  const raw = await attQuery.then(unwrap);

  let rows = (raw as unknown as Array<{
    id: string;
    lesson_id: string;
    status: AttendanceStatus;
    marked_at: string | null;
    lesson: { topic: string | null; starts_at: string; group: { subject: string; name: string } };
  }>);

  if (filters?.subject) rows = rows.filter((r) => r.lesson.group.subject === filters.subject);
  if (filters?.month) {
    rows = rows.filter((r) => r.lesson.starts_at.slice(0, 7) === filters.month);
  }

  const total = rows.length;
  const present = rows.filter((r) => r.status === "present").length;
  const excused = rows.filter((r) => r.status === "absent_excused").length;
  const unexcused = rows.filter((r) => r.status === "absent_unexcused").length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  return {
    records: rows.map((r) => ({
      id: r.id,
      lesson_id: r.lesson_id,
      lesson_title: r.lesson.group.name,
      lesson_topic: r.lesson.topic ?? "",
      subject: r.lesson.group.subject,
      lesson_date: r.lesson.starts_at,
      status: r.status,
      marked_at: r.marked_at,
    })),
    stats: { total, present, excused, unexcused, percentage },
  };
};

/** Посещаемость группы для учителя: матрица студент × урок. */
export const getGroupAttendance = async (
  db: Db,
  groupId: string,
  month?: string,
): Promise<{
  lessons: Array<{ id: string; topic: string | null; starts_at: string }>;
  students: Array<{ id: string; full_name: string }>;
  matrix: Record<string, Record<string, AttendanceStatus | null>>;
  groupAvgPct: number;
}> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;

  const lessonsRes = await db2
    .from("lessons")
    .select("id, topic, starts_at")
    .eq("group_id", groupId)
    .order("starts_at", { ascending: true });
  if (lessonsRes.error) console.error("[getGroupAttendance] lessons query failed:", lessonsRes.error.message);

  let lessons = (lessonsRes.data ?? []) as Array<{ id: string; topic: string | null; starts_at: string }>;
  if (month) lessons = lessons.filter((l) => l.starts_at.slice(0, 7) === month);

  const studentsRes = await db2
    .from("students")
    .select("id, full_name")
    .in("id", db2.from("student_groups").select("student_id").eq("group_id", groupId));
  if (studentsRes.error) console.error("[getGroupAttendance] students query failed:", studentsRes.error.message);

  const students = (studentsRes.data ?? []) as Array<{ id: string; full_name: string }>;

  if (lessons.length === 0 || students.length === 0) {
    return { lessons, students, matrix: {}, groupAvgPct: 0 };
  }

  const lessonIds = lessons.map((l) => l.id);
  const attRes = await db2
    .from("attendance")
    .select("student_id, lesson_id, status")
    .in("lesson_id", lessonIds);
  if (attRes.error) console.error("[getGroupAttendance] attendance query failed:", attRes.error.message);

  const matrix: Record<string, Record<string, AttendanceStatus | null>> = {};
  for (const s of students) {
    matrix[s.id] = {};
    for (const l of lessons) { const m = matrix[s.id]; if (m) m[l.id] = null; }
  }
  for (const row of (attRes.data ?? []) as Array<{ student_id: string; lesson_id: string; status: AttendanceStatus }>) {
    const rowMatrix = matrix[row.student_id];
    if (rowMatrix) rowMatrix[row.lesson_id] = row.status;
  }

  const totalCells = students.length * lessons.length;
  const presentCells = Object.values(matrix).flatMap((row) => Object.values(row))
    .filter((s) => s === "present").length;
  const groupAvgPct = totalCells > 0 ? Math.round((presentCells / totalCells) * 100) : 0;

  return { lessons, students, matrix, groupAvgPct };
};

// --- Домашние задания ---

/** ID групп, в которых состоит ученик (для parent-контекста: сузить group-level выборки до одного ребёнка). */
export const getStudentGroupIds = async (db: Db, studentId: string): Promise<string[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("student_groups")
    .select("group_id")
    .eq("student_id", studentId);
  if (error) throw error;
  return ((data ?? []) as Array<{ group_id: string }>).map((r) => r.group_id);
};

/** Все ДЗ для групп ученика + join группы + LEFT JOIN собственной сдачи (RLS).
 *  studentId — опционально: для parent-контекста сужает ДЗ до групп ОДНОГО
 *  выбранного ребёнка (без него RLS отдало бы объединение по всем детям). */
export const getHomeworkWithSubmissions = async (db: Db, studentId?: string) => {
  let query = db
    .from("homework")
    .select("*, content_type, external_url, source, group:groups!inner(subject, name), subject:subjects(name, icon, color), submissions:homework_submissions(*), test_subs:test_submissions(*)")
    .order("due_date", { ascending: true });

  if (studentId) {
    const groupIds = await getStudentGroupIds(db, studentId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any)
      .in("group_id", groupIds.length > 0 ? groupIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("submissions.student_id", studentId)
      .eq("test_subs.student_id", studentId);
  }

  return query
    .then(unwrap)
    .then((rows) =>
      (rows as unknown as Array<{
        id: string; group_id: string; lesson_id: string | null; title: string;
        description: string | null; due_date: string | null; attachments: unknown;
        content_type: ContentType; external_url: string | null; source: HomeworkSource;
        teacher_id: string | null;
        attachment_storage_path: string | null;
        attachment_size_bytes: number | null;
        attachment_filename: string | null;
        test_duration_seconds: number | null;
        test_auto_grade: boolean;
        programming_language: ProgrammingLanguage | null;
        starter_code: string | null;
        expected_output: string | null;
        tests_attachment_path: string | null;
        tests_attachment_filename: string | null;
        tests_attachment_size_bytes: number | null;
        hint_storage_path: string | null;
        hint_filename: string | null;
        hint_mime_type: string | null;
        subject_id: string | null;
        subject: { name: string; icon: string; color: string } | null;
        created_at: string;
        group: { subject: string; name: string };
        submissions: HomeworkSubmission[];
        test_subs: TestSubmission[];
      }>).map((r) => ({
        ...r,
        attachments: (r.attachments ?? []) as HomeworkAttachment[],
        content_type: r.content_type ?? 'file',
        source: r.source ?? 'curriculum',
        subjectName: r.subject?.name ?? null,
        subjectIcon: r.subject?.icon ?? null,
        subjectColor: r.subject?.color ?? null,
        submission: r.submissions?.[0] ?? null,
        test_submission: r.test_subs?.[0] ?? null,
        submissions: undefined,
        test_subs: undefined,
        subject: undefined,
      } as HomeworkWithSubmission)),
    );
};

/** Одна запись ДЗ с join'ом и сдачей (для детальной страницы).
 *  Для content_type='bundle' дополнительно подгружает subtasks (order_index asc). */
export const getHomeworkById = async (db: Db, id: string): Promise<HomeworkWithSubmission> => {
  const r = await db
    .from("homework")
    .select("*, content_type, external_url, source, group:groups!inner(subject, name), subject:subjects(name, icon, color), submissions:homework_submissions(*), test_subs:test_submissions(*)")
    .eq("id", id)
    .single()
    .then(unwrap);
  const raw = r as unknown as {
    id: string; group_id: string; lesson_id: string | null; title: string;
    description: string | null; due_date: string | null; attachments: unknown;
    content_type: ContentType; external_url: string | null; source: HomeworkSource;
    teacher_id: string | null;
    attachment_storage_path: string | null;
    attachment_size_bytes: number | null;
    attachment_filename: string | null;
    test_duration_seconds: number | null;
    test_auto_grade: boolean;
    programming_language: ProgrammingLanguage | null;
    starter_code: string | null;
    expected_output: string | null;
    tests_attachment_path: string | null;
    tests_attachment_filename: string | null;
    tests_attachment_size_bytes: number | null;
    hint_storage_path: string | null;
    hint_filename: string | null;
    hint_mime_type: string | null;
    subject_id: string | null;
    subject: { name: string; icon: string; color: string } | null;
    created_at: string;
    group: { subject: string; name: string };
    submissions: HomeworkSubmission[];
    test_subs: TestSubmission[];
  };
  const hw = {
    ...raw,
    attachments: (raw.attachments ?? []) as HomeworkAttachment[],
    content_type: raw.content_type ?? 'file',
    source: raw.source ?? 'curriculum',
    subjectName: raw.subject?.name ?? null,
    subjectIcon: raw.subject?.icon ?? null,
    subjectColor: raw.subject?.color ?? null,
    submission: raw.submissions?.[0] ?? null,
    test_submission: raw.test_subs?.[0] ?? null,
    submissions: undefined,
    test_subs: undefined,
    subject: undefined,
  } as HomeworkWithSubmission;
  if (hw.content_type === 'bundle') {
    hw.subtasks = await getHomeworkSubtasks(db, id);
  }
  return hw;
};

// ── Промт МОБ-3 — детальные родительские экраны (Успехи/Предмет/ДЗ/
// Посещаемость). Переиспользуют getStudentGroupIds/getHomeworkWithSubmissions/
// getStudentAttendance выше, поэтому живут здесь, а не в parent.ts (там
// циклическая зависимость с index.ts недопустима, см. комментарий в
// parent.ts). Навыки (#16) — целиком mock в самом экране, для них таблицы
// нет (см. TODO(child-skills-schema) в ProgressScreen/SkillsScreen). ──

export type ChildAttendanceDay = { date: string; status: AttendanceStatus; markedAt: string | null };

export type ChildAttendanceDetail = {
  month: string;
  stats: { total: number; present: number; excused: number; unexcused: number; percentage: number };
  days: ChildAttendanceDay[];
};

/** Посещаемость ребёнка за месяц в форме, удобной для календарной сетки.
 *  Без опозданий — статус 'late' убран в Промте 7.5, только present/
 *  absent_excused/absent_unexcused. Строится поверх getStudentAttendance. */
export const getChildAttendanceDetail = async (db: Db, studentId: string, month: string): Promise<ChildAttendanceDetail> => {
  const { records, stats } = await getStudentAttendance(db, { month }, studentId);
  const days: ChildAttendanceDay[] = records
    .map((r) => ({ date: r.lesson_date.slice(0, 10), status: r.status, markedAt: r.marked_at }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { month, stats, days };
};

export type ChildWeekActivity = { thisWeek: number; lastWeek: number; deltaPct: number | null };

/** Число выставленных оценок за последние 7 дней vs предыдущие 7 — реальная
 *  метрика "изменения активности" для карточки #10 (design: "Прогресс за
 *  неделю", ↑12%), без придуманных чисел. deltaPct=null, если на прошлой
 *  неделе не было ни одной оценки (не с чем сравнивать). */
export const getChildWeekActivity = async (db: Db, studentId: string): Promise<ChildWeekActivity> => {
  const now = Date.now();
  const since14d = new Date(now - 14 * 86400000).toISOString();
  const { data, error } = await db
    .from("lesson_grades")
    .select("graded_at")
    .eq("student_id", studentId)
    .gte("graded_at", since14d);
  if (error) throw error;

  const since7dIso = new Date(now - 7 * 86400000).toISOString();
  const rows = (data ?? []) as Array<{ graded_at: string | null }>;
  const thisWeek = rows.filter((r) => r.graded_at && r.graded_at >= since7dIso).length;
  const lastWeek = rows.filter((r) => r.graded_at && r.graded_at < since7dIso).length;
  const deltaPct = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;
  return { thisWeek, lastWeek, deltaPct };
};

export type ChildSubjectTopic = { topic: string; average: number; count: number };

export type ChildSubjectDetail = {
  subjectId: string;
  subjectName: string;
  icon: string | null;
  color: string | null;
  teacherId: string | null;
  teacherName: string | null;
  teacherAvatarUrl: string | null;
  average: number | null;
  gradeCount: number;
  topics: ChildSubjectTopic[];
  lastGradedHomework: { id: string; title: string; grade: number | null; gradedAt: string | null } | null;
  upcomingQuizLesson: { lessonId: string; title: string; startsAt: string } | null;
  lastTeacherComment: { comment: string; gradedAt: string } | null;
};

/** Детали одного предмета для ребёнка: средний балл, "освоение тем" (по
 *  lessons.topic реально пройденных уроков, НЕ по curriculum-плану),
 *  последняя оценённая работа, ближайший урок с квиз-этапом (content_type=
 *  'quiz_qia' — ближайший аналог "теста" в текущей схеме; lessons/lesson_stages
 *  не имеют отдельного поля type, см. аудит), последний комментарий учителя. */
export const getChildSubjectDetail = async (db: Db, studentId: string, subjectId: string): Promise<ChildSubjectDetail | null> => {
  const { data: subject, error: subjErr } = await db
    .from("subjects")
    .select("id, name, icon, color, teacher_id")
    .eq("id", subjectId)
    .maybeSingle();
  if (subjErr) throw subjErr;
  if (!subject) return null;

  let teacherName: string | null = null;
  let teacherAvatarUrl: string | null = null;
  if (subject.teacher_id) {
    const { data: t, error: tErr } = await db.from("teachers").select("full_name, avatar_url").eq("id", subject.teacher_id).maybeSingle();
    if (tErr) throw tErr;
    teacherName = t?.full_name ?? null;
    teacherAvatarUrl = t?.avatar_url ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gradeRows, error: gradesErr } = await (db as any)
    .from("lesson_grades")
    .select("grade, comment, graded_at, lesson:lessons!inner(topic, subject_id)")
    .eq("student_id", studentId)
    .eq("lesson.subject_id", subjectId)
    .order("graded_at", { ascending: false });
  if (gradesErr) throw gradesErr;

  const rows = (gradeRows ?? []) as unknown as Array<{
    grade: number; comment: string | null; graded_at: string | null;
    lesson: { topic: string | null; subject_id: string } | null;
  }>;

  let sum = 0;
  const topicMap = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    sum += r.grade;
    const topic = r.lesson?.topic;
    if (topic) {
      const cur = topicMap.get(topic) ?? { sum: 0, count: 0 };
      cur.sum += r.grade;
      cur.count += 1;
      topicMap.set(topic, cur);
    }
  }
  const average = rows.length > 0 ? sum / rows.length : null;
  const topics = Array.from(topicMap.entries())
    .map(([topic, v]) => ({ topic, average: v.sum / v.count, count: v.count }))
    .sort((a, b) => b.average - a.average);
  const lastCommentRow = rows.find((r) => r.comment && r.comment.trim().length > 0);

  const hwList = await getHomeworkWithSubmissions(db, studentId);
  const subjectHw = hwList
    .filter((h) => h.subject_id === subjectId && (h.submission?.grade != null || h.test_submission?.grade != null))
    .sort((a, b) => (b.submission?.submitted_at ?? "").localeCompare(a.submission?.submitted_at ?? ""));
  const lastGradedHomework = subjectHw[0]
    ? {
        id: subjectHw[0].id,
        title: subjectHw[0].title,
        grade: subjectHw[0].submission?.grade ?? subjectHw[0].test_submission?.grade ?? null,
        gradedAt: subjectHw[0].submission?.submitted_at ?? null,
      }
    : null;

  const groupIds = await getStudentGroupIds(db, studentId);
  let upcomingQuizLesson: ChildSubjectDetail["upcomingQuizLesson"] = null;
  if (groupIds.length > 0) {
    const nowIso = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: futureLessons, error: flErr } = await (db as any)
      .from("lessons")
      .select("id, title, topic, starts_at, lesson_stages(content_type)")
      .eq("subject_id", subjectId)
      .in("group_id", groupIds)
      .gt("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(10);
    if (flErr) throw flErr;
    const withQuiz = ((futureLessons ?? []) as unknown as Array<{
      id: string; title: string | null; topic: string | null; starts_at: string;
      lesson_stages: { content_type: string | null }[];
    }>).find((l) => l.lesson_stages.some((s) => s.content_type === "quiz_qia"));
    if (withQuiz) upcomingQuizLesson = { lessonId: withQuiz.id, title: withQuiz.title ?? withQuiz.topic ?? "", startsAt: withQuiz.starts_at };
  }

  return {
    subjectId: subject.id,
    subjectName: subject.name,
    icon: subject.icon,
    color: subject.color,
    teacherId: subject.teacher_id,
    teacherName,
    teacherAvatarUrl,
    average,
    gradeCount: rows.length,
    topics,
    lastGradedHomework,
    upcomingQuizLesson,
    lastTeacherComment: lastCommentRow ? { comment: lastCommentRow.comment!, gradedAt: lastCommentRow.graded_at ?? "" } : null,
  };
};

export type ChildHomeworkDetail = HomeworkWithSubmission & {
  teacherName: string | null;
  teacherAvatarUrl: string | null;
};

/** Одна домашка ребёнка с оценкой/сдачей, безопасно ограниченной ОДНИМ
 *  ребёнком (переиспользует getHomeworkWithSubmissions вместо дублирования
 *  её сложного select — тот же studentId-скоуп, что и на списке ДЗ). */
export const getChildHomeworkDetail = async (db: Db, studentId: string, homeworkId: string): Promise<ChildHomeworkDetail | null> => {
  const list = await getHomeworkWithSubmissions(db, studentId);
  const hw = list.find((h) => h.id === homeworkId) ?? null;
  if (!hw) return null;
  let teacherName: string | null = null;
  let teacherAvatarUrl: string | null = null;
  if (hw.teacher_id) {
    const { data: t, error: tErr } = await db.from("teachers").select("full_name, avatar_url").eq("id", hw.teacher_id).maybeSingle();
    if (tErr) throw tErr;
    teacherName = t?.full_name ?? null;
    teacherAvatarUrl = t?.avatar_url ?? null;
  }
  return { ...hw, teacherName, teacherAvatarUrl };
};

export type ChildTeacherReview = {
  id: string;
  comment: string;
  gradedAt: string;
  grade: number;
  subjectName: string | null;
  subjectColor: string | null;
  teacherName: string | null;
};

/** Последние текстовые отзывы учителей (lesson_grades.comment) по ребёнку.
 *  opts.sinceDays сужает окно (используется на Успехах — "последние 2
 *  недели"); без него — полный список для экрана "Все отзывы". */
export const getChildTeacherReviews = async (
  db: Db,
  studentId: string,
  opts?: { sinceDays?: number; limit?: number },
): Promise<ChildTeacherReview[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (db as any)
    .from("lesson_grades")
    .select("id, grade, comment, graded_at, graded_by, lesson:lessons!inner(subject:subjects(name, color))")
    .eq("student_id", studentId)
    .not("comment", "is", null)
    .neq("comment", "")
    .order("graded_at", { ascending: false });

  if (opts?.sinceDays) {
    const since = new Date(Date.now() - opts.sinceDays * 86400000).toISOString();
    query = query.gte("graded_at", since);
  }
  if (opts?.limit) {
    query = query.limit(opts.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<{
    id: string; grade: number; comment: string; graded_at: string; graded_by: string | null;
    lesson: { subject: { name: string; color: string | null } | null } | null;
  }>;

  const teacherIds = Array.from(new Set(rows.map((r) => r.graded_by).filter((id): id is string => Boolean(id))));
  const nameByTeacherId = new Map<string, string>();
  if (teacherIds.length > 0) {
    const { data: teacherRows, error: tErr } = await db.from("teachers").select("id, full_name").in("id", teacherIds);
    if (tErr) throw tErr;
    for (const t of (teacherRows ?? []) as Array<{ id: string; full_name: string }>) nameByTeacherId.set(t.id, t.full_name);
  }

  return rows.map((r) => ({
    id: r.id,
    comment: r.comment,
    gradedAt: r.graded_at,
    grade: r.grade,
    subjectName: r.lesson?.subject?.name ?? null,
    subjectColor: r.lesson?.subject?.color ?? null,
    teacherName: r.graded_by ? nameByTeacherId.get(r.graded_by) ?? null : null,
  }));
};

/** Homework rows linked to a specific lesson (homework.lesson_id) — used on
 *  the completed-lesson review page so a student can jump straight to the
 *  assignment that came out of that lesson, if one was created. Returns []
 *  when nothing is linked (most current homework predates this linkage). */
export const getHomeworkByLessonId = async (
  db: Db,
  lessonId: string,
): Promise<Array<{ id: string; title: string; content_type: ContentType; due_date: string | null }>> =>
  db
    .from("homework")
    .select("id, title, content_type, due_date")
    .eq("lesson_id", lessonId)
    .then(unwrap)
    .then((rows) => rows as unknown as Array<{ id: string; title: string; content_type: ContentType; due_date: string | null }>);

/** Загружает аватар в бакет avatars/<studentId>/avatar.<ext>, возвращает signed URL. */
export const uploadAvatar = async (
  db: Db,
  { studentId, blob, fileName }: { studentId: string; blob: Blob; fileName: string },
): Promise<string> => {
  const ext = fileName.split(".").pop() ?? "jpg";
  const path = `${studentId}/avatar.${ext}`;
  const { error } = await db.storage
    .from("avatars")
    .upload(path, blob, { upsert: true, contentType: blob.type || undefined });
  if (error) throw error;
  const { data, error: urlErr } = await db.storage
    .from("avatars")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (urlErr) throw urlErr;
  return data!.signedUrl;
};

/** Сохраняет avatar_url в запись ученика. */
export const updateStudentAvatar = async (
  db: Db,
  { studentId, avatarUrl }: { studentId: string; avatarUrl: string },
) => {
  const { error } = await db
    .from("students")
    .update({ avatar_url: avatarUrl })
    .eq("id", studentId);
  if (error) throw error;
};

/** Загружает файл в бакет homework-submissions, возвращает путь (не URL). */
export const uploadHomeworkFile = async (
  db: Db,
  { studentId, homeworkId, fileName, blob }: {
    studentId: string;
    homeworkId: string;
    fileName: string;
    blob: Blob;
  },
): Promise<string> => {
  const ext = fileName.split(".").pop() ?? "bin";
  const path = `${studentId}/${homeworkId}/${Date.now()}.${ext}`;
  const { error } = await db.storage
    .from("homework-submissions")
    .upload(path, blob, { upsert: true, contentType: blob.type || undefined });
  if (error) throw error;
  return path;
};

// --- Материалы --------------------------------------------------------

/** Материалы, доступные текущему пользователю (RLS фильтрует по группам). */
export const getMaterials = (db: Db) =>
  db
    .from("course_materials")
    .select("*, group:groups!inner(name, subject)")
    .order("created_at", { ascending: false })
    .then(unwrap)
    .then((rows) => rows as unknown as import("../types").MaterialWithGroup[]);

/** Signed URL на 1 час. Без downloadAs открывается инлайн (просмотр в
 *  браузере); передайте downloadAs только если действительно нужно
 *  принудительное скачивание (Content-Disposition: attachment).
 *  bucket по умолчанию "materials" — миграция 124 добавила
 *  course_materials.bucket для строк, автопубликованных из lesson_materials
 *  (физически лежат в бакете "lesson-materials"), передавайте её сюда. */
export const getMaterialDownloadUrl = (
  db: Db,
  storagePath: string,
  downloadAs?: string,
  bucket: string = "materials",
) =>
  db.storage
    .from(bucket)
    .createSignedUrl(storagePath, 3600, downloadAs ? { download: downloadAs } : undefined)
    .then(({ data, error }) => {
      if (error) throw error;
      return data!.signedUrl;
    });

/** Вставляет запись в course_materials после загрузки файла в Storage. */
export const insertMaterial = async (
  db: Db,
  input: {
    group_id: string;
    title: string;
    description: string | null;
    subject: string;
    lesson_id: string | null;
    file_type: string;
    storage_path: string;
    file_size_bytes: number;
    uploaded_by: string;
    type: string;
  },
) => {
  const { error } = await db.from("course_materials").insert(input);
  if (error) throw error;
};

// БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 3.5/3.6 — teacher uploads a .pptx file directly for
// a "Презентация" stage (alternative to AI-generating one — that existing
// SlideViewer path is untouched). Strictly .pptx; PDF must go to Материалы
// group Materials instead. Auto-added to course_materials for the lesson's
// group, deduped by (group_id, title) so re-saving the same stage/file never
// creates a second row.
export const PPTX_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export function isPptxFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".pptx") || PPTX_MIME_TYPES.includes(file.type);
}

export async function uploadPresentationFile(
  db: Db,
  input: { groupId: string; subject: string; teacherId: string; file: File },
): Promise<{ storagePath: string; filename: string; sizeBytes: number; materialId: string }> {
  if (!isPptxFile(input.file)) {
    throw new Error("Для презентаций используйте формат PPTX. PDF можно загрузить в Материалы группы.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (db as any)
    .from("course_materials")
    .select("id, storage_path, file_size_bytes")
    .eq("group_id", input.groupId)
    .eq("title", input.file.name)
    .eq("type", "presentation")
    .maybeSingle();
  if (existing?.storage_path) {
    return {
      storagePath: existing.storage_path as string,
      filename: input.file.name,
      sizeBytes: (existing.file_size_bytes as number | null) ?? input.file.size,
      materialId: existing.id as string,
    };
  }

  const materialId = crypto.randomUUID();
  const path = `${input.teacherId}/${materialId}.pptx`;
  const { error: uploadErr } = await db.storage
    .from("materials")
    .upload(path, input.file, { contentType: PPTX_MIME_TYPES[0] });
  if (uploadErr) throw uploadErr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (db as any).from("course_materials").insert({
    id: materialId,
    group_id: input.groupId,
    title: input.file.name,
    type: "presentation",
    file_type: PPTX_MIME_TYPES[0],
    storage_path: path,
    file_size_bytes: input.file.size,
    uploaded_by: input.teacherId,
    subject: input.subject,
    description: null,
    lesson_id: null,
  });
  if (insertErr) throw insertErr;

  return { storagePath: path, filename: input.file.name, sizeBytes: input.file.size, materialId };
}

/** Удаляет материал из БД и Storage. */
export const deleteMaterial = async (
  db: Db,
  materialId: string,
  storagePath: string | null,
) => {
  if (storagePath) {
    await db.storage.from("materials").remove([storagePath]);
  }
  const { error } = await db.from("course_materials").delete().eq("id", materialId);
  if (error) throw error;
};

/** Signed URL на 1 час для скачивания файла из homework-submissions. */
export const getHomeworkFileUrl = (db: Db, path: string) =>
  db.storage
    .from("homework-submissions")
    .createSignedUrl(path, 3600)
    .then(({ data, error }) => {
      if (error) throw error;
      return data!.signedUrl;
    });

export const getHomework = (db: Db) =>
  db
    .from("homework")
    .select("*")
    .order("due_date", { ascending: true })
    .then(unwrap)
    .then((rows) => rows as unknown as Homework[]);

export const getMySubmissions = (db: Db) =>
  db
    .from("homework_submissions")
    .select("*")
    .then(unwrap)
    .then((rows) => rows as unknown as HomeworkSubmission[]);

export const submitHomework = (db: Db, input: SubmissionInput) =>
  db.from("homework_submissions").insert(input).select().single().then(unwrap);

// --- Оценки ---
export const getGrades = (db: Db) =>
  db.from("grades").select("*").order("graded_at", { ascending: false }).then(unwrap);

// --- Оплаты / списания ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getPayments = (db: Db, studentId?: string) => {
  let query = db.from("payments").select("*").order("paid_at", { ascending: false });
  if (studentId) query = (query as any).eq("student_id", studentId);
  return query.then(unwrap);
};

export const getCharges = (db: Db, studentId?: string) => {
  let query = db.from("charges").select("*").order("charged_at", { ascending: false });
  if (studentId) query = (query as any).eq("student_id", studentId);
  return query.then(unwrap);
};

/** Профиль одного ребёнка для parent-контекста: ФИО, ДР, куратор, группы+учителя. */
export const getStudentById = async (db: Db, studentId: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("students")
    .select(
      "id, full_name, birth_date, avatar_url, balance, status, created_at, " +
      "curator:teachers!curator_id(id, full_name, phone), " +
      "student_groups(groups(id, name, subject, teacher:teachers!groups_teacher_id_fkey(id, full_name, phone)))",
    )
    .eq("id", studentId)
    .single();
  if (error) throw error;
  return data as {
    id: string; full_name: string; birth_date: string | null; avatar_url: string | null;
    balance: number; status: StudentStatus; created_at: string;
    curator: { id: string; full_name: string; phone: string | null } | null;
    student_groups: Array<{ groups: { id: string; name: string; subject: string; teacher: { id: string; full_name: string; phone: string | null } | null } | null }>;
  };
};

// --- Объявления ---
export const getAnnouncements = (db: Db) =>
  db.from("announcements").select("*").order("created_at", { ascending: false }).then(unwrap);

// --- Настройки уведомлений ---
export const getNotificationSettings = (db: Db) =>
  db.from("notification_settings").select("*").single().then(unwrap);

export const upsertNotificationSettings = (
  db: Db,
  input: NotificationSettingsInput,
) =>
  db.from("notification_settings").upsert(input).select().single().then(unwrap);

/** Вопросы теста с вариантами ответов. */
export const getTestQuestions = async (db: Db, homeworkId: string): Promise<TestQuestion[]> => {
  const { data, error } = await db
    .from("test_questions")
    .select("*, options:test_question_options(*)")
    .eq("homework_id", homeworkId)
    .order("order_index");
  if (error) throw error;
  return (data as unknown as TestQuestion[]) ?? [];
};

/** Сдача теста ученика (null если ещё не сдавал). */
export const getTestSubmission = async (db: Db, homeworkId: string): Promise<TestSubmission | null> => {
  const { data, error } = await db
    .from("test_submissions")
    .select("*")
    .eq("homework_id", homeworkId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as TestSubmission | null);
};

// ─── TEACHER QUERIES ─────────────────────────────────────────────────────────

/** Профиль учителя (текущего). Фильтрует по user_id сессии, чтобы .single()
 *  не ломался когда "auth reads teachers" USING(true) делает все строки видимыми. */
export const getMyTeacher = async (db: Db) => {
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return db.from("teachers").select("*").eq("user_id", user.id).single().then(unwrap);
};

/** Группы учителя (текущего) с количеством зачисленных учеников. */
export const getTeacherGroups = (db: Db) =>
  db
    .from("groups")
    .select("*, enrolled:student_groups(student_id)")
    .order("name")
    .then(unwrap);

/** Оценки в группах учителя (RLS ограничивает своими), для карточки "Средний
 *  балл" на дашборде. Ночной прогон, ЧАСТЬ 7 — раньше читал из `grades`
 *  (общая, ни разу не заполняемая таблица — 0 строк во всей БД), поэтому
 *  карточка всегда показывала "—". Реальные оценки лежат в `lesson_grades`
 *  (шкала 1-5, привязана к lesson_id/student_id, не к group_id напрямую —
 *  group_id берём через join на lessons); RLS "teacher reads lesson grades
 *  in own groups" уже ограничивает видимость своими группами, как и раньше
 *  с `grades`. grade переименован в score здесь же — вызывающий код
 *  (TeacherDashboardView.tsx) уже ожидает именно это имя поля. */
export const getTeacherGrades = (db: Db) =>
  db
    .from("lesson_grades")
    .select("grade, lesson:lessons!inner(group_id)")
    .then(unwrap)
    .then((rows) =>
      (rows as unknown as Array<{ grade: number; lesson: { group_id: string | null } }>).map((r) => ({
        group_id: r.lesson.group_id,
        score: r.grade,
      })),
    );

/** Посещаемость в группах учителя — статус + group_id урока (для % по группе). */
export const getTeacherAttendance = (db: Db) =>
  db
    .from("attendance")
    .select("status, lesson:lessons!inner(group_id)")
    .then(unwrap);

// --- Этап 2: Оценки и прогресс ---

/** Одна оценка ученика (файл, тест, классная, этап урока), нормализованная для журнала. */
export type StudentGradeItem = {
  id: string;
  kind: "file" | "test" | "classwork" | "programming" | "project" | "quiz" | "kahoot" | "external" | "lesson";
  title: string;
  subject: string;
  groupName: string;
  date: string; // submitted_at / graded_at (дата работы)
  grade5: number | null; // нормировано к /5 для средних
  display: string; // "4/5" или "85/100"
  comment: string | null;
};

type HwJoin = { title: string; content_type: string; group: { subject: string; name: string } | null };

/** Все оценённые работы текущего ученика (RLS отдаёт только свои).
 *  studentId — опционально: parent-контекст сужает до ОДНОГО выбранного
 *  ребёнка (без него RLS для parent отдало бы объединение по всем детям). */
export const getStudentGrades = async (db: Db, studentId?: string): Promise<StudentGradeItem[]> => {
  // NB: не выбираем graded_at — экран ученика не должен зависеть от миграции 19
  // на hosted. Дата работы = submitted_at (для seed практически совпадает).
  const fileSel =
    "id, grade, teacher_comment, submitted_at, homework:homework!inner(title, content_type, group:groups!inner(subject, name))";
  const testSel =
    "id, score, max_score, grade, submitted_at, homework:homework!inner(title, content_type, group:groups!inner(subject, name))";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fileQuery: any = db.from("homework_submissions").select(fileSel).not("grade", "is", null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testQuery: any = db.from("test_submissions").select(testSel).not("score", "is", null);
  if (studentId) {
    fileQuery = fileQuery.eq("student_id", studentId);
    testQuery = testQuery.eq("student_id", studentId);
  }
  const [fileRes, testRes] = await Promise.all([fileQuery, testQuery]);
  if (fileRes.error) console.error("[getStudentGrades] homework_submissions error:", fileRes.error.message);
  if (testRes.error) console.error("[getStudentGrades] test_submissions error:", testRes.error.message);

  const items: StudentGradeItem[] = [];
  for (const r of (fileRes.data ?? []) as unknown as Array<{
    id: string; grade: number; teacher_comment: string | null; submitted_at: string; homework: HwJoin | null;
  }>) {
    items.push({
      id: r.id,
      kind: r.homework?.content_type === "programming" ? "programming" : "file",
      title: r.homework?.title ?? "",
      subject: r.homework?.group?.subject ?? "",
      groupName: r.homework?.group?.name ?? "",
      date: r.submitted_at,
      grade5: r.grade,
      display: `${r.grade}/5`,
      comment: r.teacher_comment,
    });
  }
  for (const r of (testRes.data ?? []) as unknown as Array<{
    id: string; score: number; max_score: number | null; grade: number | null; submitted_at: string; homework: HwJoin | null;
  }>) {
    const max = r.max_score ?? 0;
    // Migration 31: prefer the discrete auto-grade when present.
    const hasGrade = r.grade != null;
    items.push({
      id: r.id, kind: "test",
      title: r.homework?.title ?? "",
      subject: r.homework?.group?.subject ?? "",
      groupName: r.homework?.group?.name ?? "",
      date: r.submitted_at,
      grade5: hasGrade ? r.grade : (max > 0 ? (r.score / max) * 5 : null),
      display: hasGrade ? `${r.grade}/5` : `${r.score}/${max || "?"}`,
      comment: null,
    });
  }
  // Classwork submissions with grades
  try {
    const cwSel =
      "id, grade, teacher_comment, submitted_at, classwork:classwork!inner(title, lesson:lessons!inner(group:groups!inner(subject, name)))";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cwQuery: any = (db as any).from("classwork_submissions").select(cwSel).not("grade", "is", null);
    if (studentId) cwQuery = cwQuery.eq("student_id", studentId);
    const cwRes = await cwQuery;
    if (cwRes.error) console.error("[getStudentGrades] classwork_submissions error:", cwRes.error.message);
    for (const r of (cwRes.data ?? []) as unknown as Array<{
      id: string; grade: number; teacher_comment: string | null; submitted_at: string;
      classwork: { title: string; lesson: { group: { subject: string; name: string } | null } | null } | null;
    }>) {
      items.push({
        id: r.id, kind: "classwork",
        title: r.classwork?.title ?? "Классная работа",
        subject: r.classwork?.lesson?.group?.subject ?? "",
        groupName: r.classwork?.lesson?.group?.name ?? "",
        date: r.submitted_at,
        grade5: r.grade,
        display: `${r.grade}/5`,
        comment: r.teacher_comment,
      });
    }
  } catch (e) { console.error("[getStudentGrades] classwork_submissions threw:", (e as Error)?.message); }

  // Project submissions with grades (migration 33)
  try {
    const projSel =
      "id, grade, teacher_comment, submitted_at, graded_at, project:projects!inner(title, group:groups!inner(subject, name))";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let projQuery: any = (db as any).from("project_submissions").select(projSel).not("grade", "is", null);
    if (studentId) projQuery = projQuery.eq("student_id", studentId);
    const projRes = await projQuery;
    if (projRes.error) console.error("[getStudentGrades] project_submissions error:", projRes.error.message);
    for (const r of (projRes.data ?? []) as unknown as Array<{
      id: string; grade: number; teacher_comment: string | null; submitted_at: string | null; graded_at: string | null;
      project: { title: string; group: { subject: string; name: string } | null } | null;
    }>) {
      items.push({
        id: r.id, kind: "project",
        title: r.project?.title ?? "Проект",
        subject: r.project?.group?.subject ?? "",
        groupName: r.project?.group?.name ?? "",
        date: r.submitted_at ?? r.graded_at ?? "",
        grade5: r.grade,
        display: `${r.grade}/5`,
        comment: r.teacher_comment,
      });
    }
  } catch (e) { console.error("[getStudentGrades] project_submissions threw:", (e as Error)?.message); }

  // Lesson stage task grades (quiz_qia, quiz_kahoot, code, external — migration 39)
  try {
    // lesson:lessons!lesson_id — explicit FK hint. lesson_stages<->lessons has
    // TWO relationships (lesson_stages.lesson_id -> lessons.id, AND the
    // reverse lessons.active_stage_id -> lesson_stages.id from migration 54),
    // so PostgREST can't auto-resolve the embed and errors with "more than
    // one relationship was found" — confirmed live in production logs.
    const stageSel =
      "id, grade, teacher_comment, completed_at, graded_at, submission_data, " +
      "stage:lesson_stages!inner(title, content_type, lesson:lessons!lesson_id(group:groups!inner(subject, name)))";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stageQuery: any = (db as any).from("lesson_stage_progress").select(stageSel).not("grade", "is", null);
    if (studentId) stageQuery = stageQuery.eq("student_id", studentId);
    const stageRes = await stageQuery;
    if (stageRes.error) console.error("[getStudentGrades] lesson_stage_progress error:", stageRes.error.message);
    for (const r of (stageRes.data ?? []) as unknown as Array<{
      id: string; grade: number; teacher_comment: string | null;
      completed_at: string | null; graded_at: string | null;
      submission_data: { kind?: string } | null;
      stage: { title: string; content_type: string; lesson: { group: { subject: string; name: string } | null } | null } | null;
    }>) {
      const ct = r.stage?.content_type ?? "";
      const kind: StudentGradeItem["kind"] =
        ct === "quiz_qia" ? "quiz" :
        ct === "quiz_kahoot" ? "kahoot" :
        ct === "code" ? "programming" :
        "external";
      items.push({
        id: r.id,
        kind,
        title: r.stage?.title ?? "Задание урока",
        subject: r.stage?.lesson?.group?.subject ?? "",
        groupName: r.stage?.lesson?.group?.name ?? "",
        date: r.graded_at ?? r.completed_at ?? "",
        grade5: r.grade,
        display: `${r.grade}/5`,
        comment: r.teacher_comment,
      });
    }
  } catch (e) { console.error("[getStudentGrades] lesson_stage_progress threw:", (e as Error)?.message); }

  // Lesson grades (migration 40)
  try {
    const lgSel =
      "id, grade, comment, graded_at, lesson:lessons!inner(title, group:groups!inner(subject, name))";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lgQuery: any = (db as any).from("lesson_grades").select(lgSel);
    if (studentId) lgQuery = lgQuery.eq("student_id", studentId);
    const lgRes = await lgQuery;
    if (lgRes.error) console.error("[getStudentGrades] lesson_grades error:", lgRes.error.message);
    for (const r of (lgRes.data ?? []) as unknown as Array<{
      id: string; grade: number; comment: string | null; graded_at: string;
      lesson: { title: string | null; group: { subject: string; name: string } | null } | null;
    }>) {
      items.push({
        id: r.id, kind: "lesson",
        title: r.lesson?.title ?? "Урок",
        subject: r.lesson?.group?.subject ?? "",
        groupName: r.lesson?.group?.name ?? "",
        date: r.graded_at,
        grade5: r.grade,
        display: `${r.grade}/5`,
        comment: r.comment,
      });
    }
  } catch (e) { console.error("[getStudentGrades] lesson_grades threw:", (e as Error)?.message); }

  items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return items;
};

/** Данные для матричного журнала учителя по одной группе. */
export type GradeMatrixFileSub = {
  id: string; homework_id: string; student_id: string; status: string;
  grade: number | null; teacher_comment: string | null; answer_text: string | null; submitted_at: string | null;
};
export type GradeMatrixTestSub = {
  id: string; homework_id: string; student_id: string;
  score: number | null; max_score: number | null; submitted_at: string;
};
export type GradeMatrixData = {
  students: Array<{ id: string; full_name: string; avatar_url: string | null }>;
  homework: Array<{ id: string; title: string; content_type: string; due_date: string | null }>;
  fileSubs: GradeMatrixFileSub[];
  testSubs: GradeMatrixTestSub[];
};

export const getTeacherGradeMatrix = async (db: Db, groupId: string): Promise<GradeMatrixData> => {
  const students = (await getGroupStudents(db, groupId)) as GradeMatrixData["students"];
  const hwRes = await db
    .from("homework")
    .select("id, title, content_type, due_date")
    .eq("group_id", groupId)
    .order("due_date", { ascending: false });
  if (hwRes.error) console.error("[getTeacherGradeMatrix] homework query failed:", hwRes.error.message);
  const homework = (hwRes.data ?? []) as GradeMatrixData["homework"];
  const hwIds = homework.map((h) => h.id);
  if (hwIds.length === 0) return { students, homework, fileSubs: [], testSubs: [] };

  const [fileRes, testRes] = await Promise.all([
    db.from("homework_submissions")
      .select("id, homework_id, student_id, status, grade, teacher_comment, answer_text, submitted_at")
      .in("homework_id", hwIds),
    db.from("test_submissions")
      .select("id, homework_id, student_id, score, max_score, submitted_at")
      .in("homework_id", hwIds),
  ]);
  if (fileRes.error) console.error("[getTeacherGradeMatrix] homework_submissions query failed:", fileRes.error.message);
  if (testRes.error) console.error("[getTeacherGradeMatrix] test_submissions query failed:", testRes.error.message);
  return {
    students,
    homework,
    fileSubs: (fileRes.data ?? []) as GradeMatrixData["fileSubs"],
    testSubs: (testRes.data ?? []) as GradeMatrixData["testSubs"],
  };
};

/** KPI учителя для журнала: всего оценил, средний балл, оценено за неделю.
 *  totalGraded + avgGrade считаются БЕЗ graded_at → работают и без миграции 19.
 *  Нормализация: оценки файлов 1–5 как есть; тесты score/max_score → к шкале /5.
 *  RLS ограничивает выборку группами учителя — отдельный teacher_id не нужен. */
export const getTeacherGradeStats = async (db: Db): Promise<{ totalGraded: number; avgGrade: number; weeklyGraded: number }> => {
  const [fileRes, testRes] = await Promise.all([
    db.from("homework_submissions").select("grade").not("grade", "is", null),
    db.from("test_submissions").select("score, max_score").not("score", "is", null),
  ]);
  if (fileRes.error) console.error("[getTeacherGradeStats] homework_submissions query failed:", fileRes.error.message);
  if (testRes.error) console.error("[getTeacherGradeStats] test_submissions query failed:", testRes.error.message);
  const files = (fileRes.data ?? []) as Array<{ grade: number }>;
  const tests = (testRes.data ?? []) as Array<{ score: number; max_score: number | null }>;

  const normalized: number[] = [];
  for (const f of files) normalized.push(f.grade);
  for (const t of tests) { const m = t.max_score ?? 0; if (m > 0) normalized.push((t.score / m) * 5); }

  // «Оценено за неделю» требует graded_at (миграция 19). Изолировано:
  // если колонки на hosted ещё нет — запрос вернёт error, оставляем 0.
  let weeklyGraded = 0;
  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const [f2, t2] = await Promise.all([
      db.from("homework_submissions").select("id").not("grade", "is", null).gte("graded_at", weekAgo),
      db.from("test_submissions").select("id").not("score", "is", null).gte("graded_at", weekAgo),
    ]);
    if (!f2.error && !t2.error) weeklyGraded = (f2.data?.length ?? 0) + (t2.data?.length ?? 0);
  } catch { weeklyGraded = 0; }

  return {
    totalGraded: files.length + tests.length,
    avgGrade: normalized.length ? normalized.reduce((a, b) => a + b, 0) / normalized.length : 0,
    weeklyGraded,
  };
};

/** ДЗ учителя — с join группы, enrolled-студентов, file-сдач и тест-сдач. */
export const getTeacherHomework = (db: Db) =>
  db
    .from("homework")
    .select(
      "*, " +
      "group:groups!inner(id, name, subject, enrolled:student_groups(student_id)), " +
      "submissions:homework_submissions(id, status), " +
      "test_subs:test_submissions(id, student_id)",
    )
    .order("due_date", { ascending: false })
    .then(unwrap);

/** Одна запись ДЗ учителя со сдачами, вопросами теста. */
export const getTeacherHomeworkDetail = (db: Db, id: string) =>
  db
    .from("homework")
    .select("*, group:groups!inner(id, name, subject)")
    .eq("id", id)
    .single()
    .then(unwrap);

/** Все сдачи конкретного ДЗ (включая student join). */
export const getHomeworkSubmissions = (db: Db, homeworkId: string) =>
  db
    .from("homework_submissions")
    .select("*, student:students!inner(id, full_name, avatar_url)")
    .eq("homework_id", homeworkId)
    .order("submitted_at", { ascending: false })
    .then(unwrap);

/** Все сдачи теста для конкретного ДЗ (teacher view). */
export const getTestSubmissionsForHomework = (db: Db, homeworkId: string) =>
  db
    .from("test_submissions")
    .select("*, student:students!inner(id, full_name, avatar_url)")
    .eq("homework_id", homeworkId)
    .order("submitted_at", { ascending: false })
    .then(unwrap);

/** Ответы на конкретную сдачу теста (teacher review). */
export const getTestAnswersForSubmission = (db: Db, submissionId: string) =>
  db
    .from("test_answers")
    .select("*, question:test_questions!inner(question_text, question_type, order_index)")
    .eq("submission_id", submissionId)
    .order("question(order_index)")
    .then(unwrap);

/** Ученики в конкретной группе. */
export const getGroupStudents = (db: Db, groupId: string) =>
  db
    .from("student_groups")
    .select("student:students!inner(id, full_name, avatar_url, status)")
    .eq("group_id", groupId)
    .order("student(full_name)")
    .then(unwrap)
    .then((rows) => (rows as unknown as { student: { id: string; full_name: string; avatar_url: string | null; status: string } }[]).map((r) => r.student));

/** Выставить оценку / комментарий за сдачу ДЗ. */
export const gradeSubmission = async (
  db: Db,
  {
    submissionId,
    grade,
    comment,
  }: { submissionId: string; grade: number; comment: string },
): Promise<void> => {
  const { error } = await db
    .from("homework_submissions")
    .update({ grade, teacher_comment: comment, status: "graded" })
    .eq("id", submissionId);
  if (error) throw error;
};

// ─── Пачка 5.3: AI-проверка ДЗ (migration 140) ─────────────────────────

export type TeacherAiPendingReview = {
  id: string;
  homework_id: string;
  answer_text: string | null;
  code_text: string | null;
  submitted_at: string;
  ai_grade: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ai_feedback: any;
  student: { id: string; full_name: string; avatar_url: string | null };
  homework: { id: string; title: string; content_type: string; group: { name: string; subject: string } };
};

/** Все сдачи, для которых AI уже дал оценку/feedback и ждёт подтверждения
 *  учителя (ai_review_status='ai_reviewed_pending_teacher'), по ВСЕМ
 *  домашним заданиям учителя (не по одному ДЗ — кросс-ДЗ очередь "На
 *  проверке ИИ"). RLS ("teacher reads submissions in own groups",
 *  is_my_teacher_group) уже сужает выборку без явного фильтра по teacher_id. */
export const getTeacherAiPendingReviews = (db: Db) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any)
    .from("homework_submissions")
    .select(
      "id, homework_id, answer_text, code_text, submitted_at, ai_grade, ai_feedback, " +
      "student:students!inner(id, full_name, avatar_url), " +
      "homework:homework!inner(id, title, content_type, group:groups!inner(name, subject))",
    )
    .eq("ai_review_status", "ai_reviewed_pending_teacher")
    .order("submitted_at", { ascending: true })
    .then(unwrap) as Promise<TeacherAiPendingReview[]>;

async function finalizeAiHomeworkReview(
  db: Db,
  { submissionId, grade, comment, aiReviewStatus }: {
    submissionId: string; grade: number; comment: string;
    aiReviewStatus: "teacher_approved" | "teacher_declined_manual_grade";
  },
): Promise<void> {
  const { data: teacherId } = await db.rpc("current_teacher_id");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from("homework_submissions")
    .update({
      grade,
      teacher_comment: comment,
      status: "graded",
      ai_review_status: aiReviewStatus,
      teacher_approved_at: new Date().toISOString(),
      teacher_approved_by: teacherId ?? null,
    })
    .eq("id", submissionId);
  if (error) throw error;
}

/** Подтвердить (как есть или изменив) AI-оценку сдачи ДЗ — финализирует
 *  grade/teacher_comment (те же колонки, что ручная gradeSubmission) и
 *  закрывает AI-review как teacher_approved. Один и тот же вызов что для
 *  "Подтвердить" (grade/comment = значения AI без изменений), что для
 *  "Изменить и подтвердить" (grade/comment = отредактированные учителем) —
 *  разницы для БД нет, поля и так редактируемые. */
export const approveAiHomeworkReview = (
  db: Db,
  input: { submissionId: string; grade: number; comment: string },
): Promise<void> => finalizeAiHomeworkReview(db, { ...input, aiReviewStatus: "teacher_approved" });

/** "Проверить вручную без ИИ" — учитель игнорирует AI-оценку и ставит
 *  свою с нуля. Тоже закрывает запись как проверенную (иначе она навсегда
 *  осталась бы в списке "На проверке ИИ", т.к. только gradeSubmission()
 *  ai_review_status не трогает). */
export const declineAiHomeworkReview = (
  db: Db,
  input: { submissionId: string; grade: number; comment: string },
): Promise<void> => finalizeAiHomeworkReview(db, { ...input, aiReviewStatus: "teacher_declined_manual_grade" });

const NATIVE_CONTENT_TYPES = ["file", "test", "programming", "bundle"] as const;

/** Создать ДЗ (file/test/programming/bundle или один из 12 внешних сервисов). Returns created homework record. */
export const createTeacherHomework = async (
  db: Db,
  input: {
    groupId: string;
    title: string;
    description: string;
    dueDate: string;
    contentType: ContentType;
    teacherId: string;
    lessonId?: string | null;
    subjectId?: string | null;
    status?: "draft" | "published";
    testDurationSeconds?: number | null;
    testAutoGrade?: boolean;
    programmingLanguage?: ProgrammingLanguage | null;
    starterCode?: string | null;
    expectedOutput?: string | null;
    testsAttachmentPath?: string | null;
    testsAttachmentFilename?: string | null;
    testsAttachmentSizeBytes?: number | null;
    externalUrl?: string | null;
  },
) => {
  const isProg = input.contentType === "programming";
  const isExternal = !(NATIVE_CONTENT_TYPES as readonly string[]).includes(input.contentType);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("homework")
    .insert({
      group_id: input.groupId,
      title: input.title,
      description: input.description,
      due_date: input.dueDate,
      content_type: input.contentType,
      source: "teacher",
      teacher_id: input.teacherId,
      lesson_id: input.lessonId ?? null,
      subject_id: input.subjectId ?? null,
      test_duration_seconds: input.contentType === "test" ? (input.testDurationSeconds ?? null) : null,
      test_auto_grade: input.contentType === "test" ? (input.testAutoGrade ?? true) : true,
      programming_language: isProg ? (input.programmingLanguage ?? null) : null,
      starter_code: isProg ? (input.starterCode ?? null) : null,
      expected_output: isProg ? (input.expectedOutput ?? null) : null,
      tests_attachment_path: isProg ? (input.testsAttachmentPath ?? null) : null,
      tests_attachment_filename: isProg ? (input.testsAttachmentFilename ?? null) : null,
      tests_attachment_size_bytes: isProg ? (input.testsAttachmentSizeBytes ?? null) : null,
      external_url: isExternal ? (input.externalUrl ?? null) : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as { id: string; [key: string]: unknown };
};

/** Создать вопросы теста с вариантами. */
export const createTestQuestions = async (
  db: Db,
  homeworkId: string,
  questions: Array<{
    questionText: string;
    questionType: "single_choice" | "open";
    orderIndex: number;
    options?: Array<{ optionText: string; isCorrect: boolean; orderIndex: number }>;
  }>,
) => {
  if (questions.length === 0) return;
  // Bulk insert instead of one INSERT per question (+ one per question's
  // options) — was N+1, now 2 round trips regardless of question count.
  // A single INSERT...VALUES statement returns rows in input order, so the
  // returned ids line up with `questions` by index.
  const { data: qRows, error: qErr } = await db
    .from("test_questions")
    .insert(questions.map((q) => ({
      homework_id: homeworkId,
      question_text: q.questionText,
      question_type: q.questionType,
      order_index: q.orderIndex,
    })))
    .select("id");
  if (qErr) throw qErr;
  const ids = (qRows as unknown as Array<{ id: string }>).map((r) => r.id);
  if (ids.length !== questions.length) throw new Error("test_questions insert returned unexpected row count");

  const allOptions = questions.flatMap((q, i) =>
    q.questionType === "single_choice" && q.options?.length
      ? q.options.map((o) => ({
          question_id: ids[i] as string,
          option_text: o.optionText,
          is_correct: o.isCorrect,
          order_index: o.orderIndex,
        }))
      : [],
  );
  if (allOptions.length > 0) {
    const { error: oErr } = await db.from("test_question_options").insert(allOptions);
    if (oErr) throw oErr;
  }
};

// PROMT 3 (rework) — с миграции 109 все 5 предметных учителей состоят в
// group_teachers всех 3 групп (нужно для RLS-доступа к самим группам), но
// каждый должен видеть в расписании ТОЛЬКО СВОЙ предмет — teacher_karim
// (subject_slug=NULL, куратор) продолжает видеть всё. RLS остаётся
// group-based (не меняем — иначе сломается доступ karim), фильтр по
// предмету — здесь, в query-слое.
type TeacherSubjectFilter = { teacherId: string; subjectIds: string[] | null };

/** null subjectIds = куратор (subject_slug=NULL) — фильтр не нужен.
 *
 * Промт «скорость», Задача 3: раньше — 2 последовательных round trip'а
 * (teachers, затем subjects по teacher_id). subjects.teacher_id → teachers.id
 * — настоящий FK, поэтому embedded-select забирает оба одним запросом. */
async function getTeacherSubjectFilter(db: Db): Promise<TeacherSubjectFilter | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { data: userRes } = await db.auth.getUser();
  const userId = userRes?.user?.id;
  if (!userId) return null;
  const { data: teacher, error: teacherErr } = await db2
    .from("teachers")
    .select("id, subject_slug, my_subjects:subjects!teacher_id(id)")
    .eq("user_id", userId)
    .maybeSingle();
  // Fail closed (5222b73): раньше сбой этого запроса молча возвращал null →
  // фильтр отключался и ПРЕДМЕТНИК ВИДЕЛ ВСЕ УРОКИ. Ошибку бросаем — пустой
  // список с ошибкой в логах лучше тихой утечки чужого расписания.
  if (teacherErr) throw teacherErr;
  if (!teacher) return null;
  if (!teacher.subject_slug) return { teacherId: teacher.id, subjectIds: null };
  return {
    teacherId: teacher.id,
    subjectIds: ((teacher.my_subjects ?? []) as Array<{ id: string }>).map((s) => s.id),
  };
}

function filterBySubject<T extends { subject_id?: string | null }>(
  rows: T[],
  filter: TeacherSubjectFilter | null,
): T[] {
  if (!filter || filter.subjectIds === null) return rows;
  const ids = new Set(filter.subjectIds);
  return rows.filter((r) => r.subject_id != null && ids.has(r.subject_id));
}

/** Уроки учителя на сегодня (локальная дата). */
export const getTeacherTodayLessons = async (db: Db) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const { data, error } = await db
    .from("lessons")
    .select("*, group:groups!inner(id, name, subject)")
    .gte("starts_at", todayStart.toISOString())
    .lte("starts_at", todayEnd.toISOString())
    .order("starts_at");
  if (error) throw error;
  const filter = await getTeacherSubjectFilter(db);
  return filterBySubject((data ?? []) as Array<{ subject_id?: string | null }>, filter);
};

/** Последние сдачи ДЗ в группах учителя (для activity feed). */
export const getTeacherRecentSubmissions = async (db: Db, limit = 10) => {
  const { data, error } = await db
    .from("homework_submissions")
    .select(
      "id, homework_id, student_id, status, submitted_at, grade, homework:homework!inner(title, teacher_id), student:students!inner(full_name)",
    )
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
};

/** Загружает аватар учителя в avatars/teachers/<teacherId>/avatar.<ext>, возвращает signed URL. */
export const uploadTeacherAvatar = async (
  db: Db,
  { teacherId, blob, fileName }: { teacherId: string; blob: Blob; fileName: string },
): Promise<string> => {
  const ext = fileName.split(".").pop() ?? "jpg";
  const path = `teachers/${teacherId}/avatar.${ext}`;
  const { error } = await db.storage
    .from("avatars")
    .upload(path, blob, { upsert: true, contentType: blob.type || undefined });
  if (error) throw error;
  const { data, error: urlErr } = await db.storage
    .from("avatars")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (urlErr) throw urlErr;
  return data!.signedUrl;
};

/** Обновить профиль учителя (имя, телефон, био). */
export const updateTeacherProfile = (
  db: Db,
  { teacherId, fullName, phone, bio }: { teacherId: string; fullName: string; phone?: string; bio?: string },
) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).from("teachers").update({ full_name: fullName, phone: phone ?? null, bio: bio ?? null }).eq("id", teacherId).then(unwrap);

/** Обновить аватар учителя (avatar_url). */
export const updateTeacherAvatar = (
  db: Db,
  { teacherId, avatarUrl }: { teacherId: string; avatarUrl: string | null },
) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).from("teachers").update({ avatar_url: avatarUrl }).eq("id", teacherId).then(unwrap);

/** Обновить настройки уведомлений учителя. */
export const updateTeacherNotificationPrefs = (
  db: Db,
  { teacherId, prefs }: { teacherId: string; prefs: Record<string, boolean> },
) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).from("teachers").update({ notification_preferences: prefs }).eq("id", teacherId).then(unwrap);

/** Тип ответа для submitTest. */
export type TestAnswerInput = {
  questionId: string;
  selectedOptionId?: string;
  openText?: string;
};

/** Discrete auto-grade from a test ratio (migration 31 formula). null if no
 *  auto-gradable (single_choice) questions. */
export const autoGradeFromRatio = (score: number, max: number): number | null => {
  if (max <= 0) return null;
  const r = score / max;
  if (r >= 0.85) return 5;
  if (r >= 0.70) return 4;
  if (r >= 0.50) return 3;
  return 2;
};

/** Ученик начинает тест: создаёт/возвращает submission с started_at.
 *  Нельзя начать дважды — если started_at уже стоит, возвращаем существующую. */
export const startHomeworkTest = async (
  db: Db,
  homeworkId: string,
  studentId: string,
): Promise<TestSubmission> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const existing = await db2
    .from("test_submissions")
    .select("*")
    .eq("homework_id", homeworkId)
    .eq("student_id", studentId)
    .maybeSingle()
    .then(({ data }: { data: TestSubmission | null }) => data);
  if (existing) {
    if (existing.started_at) return existing;
    // Row exists without started_at (legacy) → set it
    const { data, error } = await db2
      .from("test_submissions")
      .update({ started_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as TestSubmission;
  }
  const { data, error } = await db2
    .from("test_submissions")
    .insert({ homework_id: homeworkId, student_id: studentId, started_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw error;
  return data as TestSubmission;
};

/** Сдача теста: auto-score single_choice, finalise the started submission,
 *  write answers, and (if homework.test_auto_grade) the discrete grade. */
export const submitTest = async (
  db: Db,
  input: { homeworkId: string; studentId: string; answers: TestAnswerInput[] },
): Promise<TestSubmission> => {
  const { homeworkId, studentId, answers } = input;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;

  // homework auto-grade flag
  const { data: hwRow } = await db2
    .from("homework")
    .select("test_auto_grade")
    .eq("id", homeworkId)
    .maybeSingle();
  const autoGrade = (hwRow as { test_auto_grade?: boolean } | null)?.test_auto_grade ?? true;

  // Получить вопросы с правильными ответами
  const { data: questions, error: qErr } = await db
    .from("test_questions")
    .select("id, question_type, options:test_question_options(id, is_correct)")
    .eq("homework_id", homeworkId);
  if (qErr) throw qErr;

  const qMap = new Map<string, { question_type: string; options: { id: string; is_correct: boolean }[] }>();
  for (const q of (questions as unknown as Array<{ id: string; question_type: string; options: { id: string; is_correct: boolean }[] }>)) {
    qMap.set(q.id, q);
  }

  // Подсчёт score для single_choice
  const singleChoiceCount = [...qMap.values()].filter(q => q.question_type === "single_choice").length;
  let score = 0;
  const answerRows: Array<{ question_id: string; selected_option_id?: string; open_text?: string; is_correct: boolean | null }> = [];

  for (const ans of answers) {
    const q = qMap.get(ans.questionId);
    if (!q) continue;
    if (q.question_type === "single_choice" && ans.selectedOptionId) {
      const option = q.options.find(o => o.id === ans.selectedOptionId);
      const correct = option?.is_correct ?? false;
      if (correct) score++;
      answerRows.push({ question_id: ans.questionId, selected_option_id: ans.selectedOptionId, is_correct: correct });
    } else if (q.question_type === "open") {
      answerRows.push({ question_id: ans.questionId, open_text: ans.openText ?? "", is_correct: null });
    }
  }

  const hasOpen = [...qMap.values()].some(q => q.question_type === "open");
  // Auto-grade only when enabled AND there are no manually-graded (open) questions.
  const grade = autoGrade && !hasOpen ? autoGradeFromRatio(score, singleChoiceCount) : null;

  const payload = {
    score,
    max_score: singleChoiceCount,
    grade,
    submitted_at: new Date().toISOString(),
  };

  // Finalise the started submission (start-gate flow) or insert if missing (legacy).
  const existing = await db2
    .from("test_submissions")
    .select("id")
    .eq("homework_id", homeworkId)
    .eq("student_id", studentId)
    .maybeSingle()
    .then(({ data }: { data: { id: string } | null }) => data);

  let sub: unknown;
  if (existing) {
    const { data, error } = await db2
      .from("test_submissions")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    sub = data;
  } else {
    const { data, error } = await db2
      .from("test_submissions")
      .insert({ homework_id: homeworkId, student_id: studentId, started_at: new Date().toISOString(), ...payload })
      .select("*")
      .single();
    if (error) throw error;
    sub = data;
  }
  const submissionId = (sub as { id: string }).id;

  // Replace answers (delete any prior, then insert) — students can re-finalise
  // only while ungraded; for the normal flow there are no prior answers.
  if (answerRows.length > 0) {
    const { error: ansErr } = await db
      .from("test_answers")
      .insert(answerRows.map(a => ({ ...a, submission_id: submissionId })));
    if (ansErr) throw ansErr;
  }

  return sub as TestSubmission;
};

// ─── PROGRAMMING HOMEWORK (migration 32) ───────────────────────────────────────

/** Загрузить файл с тестами учителя в bucket homework-tests. */
export const uploadHomeworkTestsFile = async (
  db: Db,
  { teacherId, homeworkId, fileName, blob }: { teacherId: string; homeworkId: string; fileName: string; blob: Blob },
): Promise<{ path: string; sizeByte: number }> => {
  const path = `${teacherId}/${homeworkId}/tests/${fileName}`;
  const { error } = await db.storage
    .from("homework-tests")
    .upload(path, blob, { upsert: true, contentType: blob.type || undefined });
  if (error) throw error;
  return { path, sizeByte: (blob as File).size ?? 0 };
};

/** Signed URL для скачивания файла с тестами. */
export const getHomeworkTestsUrl = async (db: Db, storagePath: string, downloadName?: string): Promise<string> => {
  const { data, error } = await db.storage
    .from("homework-tests")
    .createSignedUrl(storagePath, 3600, downloadName ? { download: downloadName } : undefined);
  if (error) throw error;
  return data!.signedUrl;
};

/** Ученик отправляет код (UPSERT homework_submissions.code_text). */
export const submitProgrammingHomework = async (
  db: Db,
  homeworkId: string,
  studentId: string,
  codeText: string,
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const existing = await db2
    .from("homework_submissions")
    .select("id")
    .eq("homework_id", homeworkId)
    .eq("student_id", studentId)
    .maybeSingle()
    .then(({ data }: { data: { id: string } | null }) => data);
  const payload = { code_text: codeText, status: "submitted", submitted_at: new Date().toISOString() };
  if (existing) {
    const { error } = await db2.from("homework_submissions").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await db2
      .from("homework_submissions")
      .insert({ homework_id: homeworkId, student_id: studentId, ...payload });
    if (error) throw error;
  }
};

/** Последняя отправка кода ученика (для восстановления редактора). */
export const getProgrammingSubmission = async (
  db: Db,
  homeworkId: string,
  studentId: string,
): Promise<HomeworkSubmission | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from("homework_submissions")
    .select("*")
    .eq("homework_id", homeworkId)
    .eq("student_id", studentId)
    .maybeSingle();
  return (data as HomeworkSubmission | null) ?? null;
};

// ─── BUNDLE HOMEWORK (migration 87/88) ─────────────────────────────────────

/** Создать подзадачи для homework типа 'bundle' (в порядке orderIndex). */
export const createHomeworkSubtasks = async (
  db: Db,
  homeworkId: string,
  subtasks: Array<{
    type: HomeworkSubtaskType;
    title: string;
    description?: string | null;
    config?: Record<string, unknown>;
    orderIndex: number;
  }>,
): Promise<HomeworkSubtask[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("homework_subtasks")
    .insert(
      subtasks.map((s) => ({
        homework_id: homeworkId,
        order_index: s.orderIndex,
        type: s.type,
        title: s.title,
        description: s.description ?? null,
        config: s.config ?? {},
      })),
    )
    .select("*");
  if (error) throw error;
  return data as HomeworkSubtask[];
};

/** Подзадачи ДЗ-набора, по порядку. */
export const getHomeworkSubtasks = (db: Db, homeworkId: string) =>
  db
    .from("homework_subtasks")
    .select("*")
    .eq("homework_id", homeworkId)
    .order("order_index", { ascending: true })
    .then(unwrap) as Promise<HomeworkSubtask[]>;

/** Найти или лениво создать homework_submissions для bundle-ДЗ ученика.
 *  status='in_progress' — ещё не финальная сдача, поэтому не попадает в
 *  "ожидает проверки" у учителя (см. миграцию 88). */
export const getOrCreateBundleSubmission = async (
  db: Db,
  { homeworkId, studentId }: { homeworkId: string; studentId: string },
): Promise<HomeworkSubmission> => {
  const { data: existing } = await db
    .from("homework_submissions")
    .select("*")
    .eq("homework_id", homeworkId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (existing) return existing as unknown as HomeworkSubmission;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("homework_submissions")
    .insert({ homework_id: homeworkId, student_id: studentId, status: "in_progress" })
    .select("*")
    .single();
  if (error) throw error;
  return data as HomeworkSubmission;
};

/** Сохранить прогресс по одной подзадаче (upsert по submission_id+subtask_id).
 *  Вызывается при каждом изменении — реальное сохранение, не черновик в памяти. */
export const saveHomeworkSubtaskProgress = async (
  db: Db,
  { submissionId, subtaskId, content, completed }: {
    submissionId: string;
    subtaskId: string;
    content: Record<string, unknown>;
    completed: boolean;
  },
): Promise<HomeworkSubtaskSubmission> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("homework_subtask_submissions")
    .upsert(
      {
        submission_id: submissionId,
        subtask_id: subtaskId,
        content,
        completed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "submission_id,subtask_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as HomeworkSubtaskSubmission;
};

/** Прогресс по всем подзадачам одной сдачи (ученик или учитель на проверке). */
export const getHomeworkSubtaskSubmissions = (db: Db, submissionId: string) =>
  db
    .from("homework_subtask_submissions")
    .select("*")
    .eq("submission_id", submissionId)
    .then(unwrap) as Promise<HomeworkSubtaskSubmission[]>;

/** Финальная сдача bundle-ДЗ целиком ("Отправить всё") — переводит
 *  status 'in_progress' -> 'submitted', попадает в очередь учителя. */
export const submitHomeworkBundle = async (db: Db, submissionId: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from("homework_submissions")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", submissionId);
  if (error) throw error;
};

// ─── LESSON DETAIL ───────────────────────────────────────────────────────────

/** Один урок со всеми связанными данными для страницы /lessons/[id].
 *  Возвращает null, если урок недоступен текущему пользователю (RLS). */
export const getLessonById = async (db: Db, lessonId: string): Promise<LessonDetail | null> => {
  const { data: lessonRaw, error: lessonErr } = await db
    .from("lessons")
    .select("id, group_id, lesson_no, topic, starts_at, ends_at, room, group:groups!inner(id, name, subject, teacher_id)")
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonErr) throw lessonErr;
  if (!lessonRaw) return null;

  const lesson = lessonRaw as unknown as {
    id: string; group_id: string; lesson_no: number | null; topic: string | null;
    starts_at: string; ends_at: string | null; room: string | null;
    group: { id: string; name: string; subject: string; teacher_id: string | null };
  };

  const teacherId = lesson.group.teacher_id;
  const [teacherRes, materialsRes, hwRes, attRes] = await Promise.all([
    teacherId
      ? db.from("teachers").select("id, full_name").eq("id", teacherId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from("course_materials").select("*").eq("lesson_id", lessonId).order("created_at"),
    db.from("homework")
      .select("id, title, description, due_date, content_type, submissions:homework_submissions(status, grade)")
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: false })
      .limit(1),
    db.from("attendance").select("status").eq("lesson_id", lessonId).maybeSingle(),
  ]);

  if (materialsRes.error) throw materialsRes.error;

  const hwList = (hwRes.data ?? []) as unknown as Array<{
    id: string; title: string; description: string | null; due_date: string | null;
    content_type: string; submissions: Array<{ status: string; grade: number | null }>;
  }>;
  const hw0 = hwList[0] ?? null;
  const homeworkResult: LessonDetail["homework"] = hw0
    ? {
        id: hw0.id, title: hw0.title, description: hw0.description, due_date: hw0.due_date,
        content_type: (hw0.content_type ?? "file") as ContentType,
        submission: hw0.submissions?.[0]
          ? { status: hw0.submissions[0].status as SubmissionStatus, grade: hw0.submissions[0].grade }
          : null,
      }
    : null;

  const { teacher_id: _tid, ...groupData } = lesson.group;
  return {
    id: lesson.id, group_id: lesson.group_id, lesson_no: lesson.lesson_no,
    topic: lesson.topic, starts_at: lesson.starts_at, ends_at: lesson.ends_at, room: lesson.room,
    group: groupData,
    teacher: (teacherRes.data as { id: string; full_name: string } | null),
    materials: (materialsRes.data ?? []) as unknown as CourseMaterial[],
    homework: homeworkResult,
    attendance: attRes.data ? { status: (attRes.data as { status: string }).status as AttendanceStatus } : null,
  };
};

/** Уроки группы для дропдауна в форме создания ДЗ (учитель). */
export const getTeacherLessonsForGroup = async (
  db: Db,
  groupId: string,
): Promise<Array<{ id: string; starts_at: string; topic: string | null; title: string | null; lesson_no: number | null; subjectId: string | null; subjectName: string | null }>> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("lessons")
    .select("id, starts_at, topic, title, lesson_no, subject_id, subject:subjects(name)")
    .eq("group_id", groupId)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  const filter = await getTeacherSubjectFilter(db);
  const rows = filterBySubject(
    (data ?? []) as Array<{ id: string; starts_at: string; topic: string | null; title: string | null; lesson_no: number | null; subject_id: string | null; subject: { name: string } | null }>,
    filter,
  );
  return rows.map((r) => ({ id: r.id, starts_at: r.starts_at, topic: r.topic, title: r.title, lesson_no: r.lesson_no, subjectId: r.subject_id, subjectName: r.subject?.name ?? null }));
};

// ─── LESSON MODULE (migration 24 → 35) ───────────────────────────────────────

/** Полное представление урока для учителя — включает teacher_notes в stages. */
export const getTeacherLessonView = async (
  db: Db,
  lessonId: string,
): Promise<TeacherLessonView | null> => {
  const { data: lessonRaw, error: lessonErr } = await (db as never as { from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> } } } })
    .from("lessons")
    .select("id, group_id, subject_id, lesson_no, topic, title, description, starts_at, ends_at, started_at, ended_at, status, room, active_stage_id, demo_material_id, group:groups!inner(id, name, subject, teacher_id)")
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonErr) throw lessonErr;
  if (!lessonRaw) return null;

  const lesson = lessonRaw as unknown as {
    id: string; group_id: string; subject_id: string | null; lesson_no: number | null; topic: string | null;
    title: string | null; description: string | null;
    starts_at: string; ends_at: string | null;
    started_at: string | null; ended_at: string | null; status: string;
    room: string | null; active_stage_id: string | null; demo_material_id: string | null;
    group: { id: string; name: string; subject: string; teacher_id: string | null };
  };

  // Учитель урока — РЕАЛЬНЫЙ ПРЕДМЕТНИК (subjects.teacher_id, перепривязан
  // миграцией 109); groups.teacher_id — куратор группы (teacher_karim), он
  // используется только как fallback для legacy-уроков, у которых предмет
  // не назначен или у предмета нет учителя. Тот же паттерн, что в parent.ts
  // (DAILY_STATUS_LESSON_SELECT).
  const curatorId = lesson.group.teacher_id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const SUBJECT_WITH_TEACHER = "name, icon, color, teacher:teachers!subjects_teacher_id_fkey(id, full_name)";
  const subjectQuery = lesson.subject_id
    ? db2.from("subjects").select(SUBJECT_WITH_TEACHER).eq("id", lesson.subject_id).maybeSingle()
    : db2.from("subjects").select(SUBJECT_WITH_TEACHER).eq("group_id", lesson.group_id).limit(1).maybeSingle();
  const [curatorRes, materialsRes, stagesRes, subjectRes] = await Promise.all([
    curatorId
      ? db.from("teachers").select("id, full_name").eq("id", curatorId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db2.from("lesson_materials").select("*").eq("lesson_id", lessonId).order("created_at"),
    db2.from("lesson_stages").select("*").eq("lesson_id", lessonId).order("position"),
    subjectQuery,
  ]);

  const { teacher_id: _tid, ...groupData } = lesson.group;
  const materialsTyped = materialsRes as { data: unknown[] | null; error: { message: string } | null };
  const stagesTyped = stagesRes as { data: unknown[] | null; error: { message: string } | null };
  const subjectTyped = subjectRes as {
    data: { name: string; icon: string | null; color: string | null; teacher: { id: string; full_name: string } | null } | null;
    error: { message: string } | null;
  };
  const curatorTyped = curatorRes as { data: { id: string; full_name: string } | null; error: { message: string } | null };
  if (materialsTyped.error) console.error("[getTeacherLessonView] lesson_materials query failed:", materialsTyped.error.message);
  if (stagesTyped.error) console.error("[getTeacherLessonView] lesson_stages query failed:", stagesTyped.error.message);
  // Сбой любого из этих двух рендерится как "урок без учителя/предмета" —
  // неотличимо от урока, где они правда не назначены (паттерн 5222b73).
  if (subjectTyped.error) console.error("[getTeacherLessonView] subjects query failed:", subjectTyped.error.message);
  if (curatorTyped.error) console.error("[getTeacherLessonView] teachers (curator fallback) query failed:", curatorTyped.error.message);
  return {
    id: lesson.id, group_id: lesson.group_id, lesson_no: lesson.lesson_no,
    topic: lesson.topic, title: lesson.title, description: lesson.description,
    starts_at: lesson.starts_at, ends_at: lesson.ends_at,
    started_at: lesson.started_at, ended_at: lesson.ended_at,
    status: lesson.status as TeacherLessonView["status"],
    room: lesson.room,
    active_stage_id: lesson.active_stage_id,
    demo_material_id: lesson.demo_material_id,
    subjectName: subjectTyped.data?.name ?? null,
    subjectIcon: subjectTyped.data?.icon ?? null,
    subjectColor: subjectTyped.data?.color ?? null,
    group: groupData,
    teacher: subjectTyped.data?.teacher ?? curatorTyped.data,
    materials: (materialsTyped.data ?? []) as LessonMaterial[],
    stages: (stagesTyped.data ?? []) as LessonStage[],
  };
};

/** Представление урока для ученика — без поля teacher_notes в stages. */
export const getStudentLessonView = async (
  db: Db,
  lessonId: string,
): Promise<StudentLessonView | null> => {
  const { data: lessonRaw, error: lessonErr } = await (db as never as { from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> } } } })
    .from("lessons")
    .select("id, group_id, subject_id, lesson_no, topic, title, description, starts_at, ends_at, started_at, ended_at, status, room, active_stage_id, demo_material_id, group:groups!inner(id, name, subject, teacher_id)")
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonErr) throw lessonErr;
  if (!lessonRaw) return null;

  const lesson = lessonRaw as unknown as {
    id: string; group_id: string; subject_id: string | null; lesson_no: number | null; topic: string | null;
    title: string | null; description: string | null;
    starts_at: string; ends_at: string | null;
    started_at: string | null; ended_at: string | null; status: string;
    room: string | null; active_stage_id: string | null; demo_material_id: string | null;
    group: { id: string; name: string; subject: string; teacher_id: string | null };
  };

  // Учитель урока — РЕАЛЬНЫЙ ПРЕДМЕТНИК (subjects.teacher_id); куратор группы
  // (groups.teacher_id, teacher_karim) — только fallback, если у урока нет
  // предмета или у предмета не назначен учитель. См. getTeacherLessonView.
  const curatorId = lesson.group.teacher_id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db3 = db as any;
  // Subject name: prefer the lesson's actual subject_id FK; fall back to the
  // group's (legacy lessons without subject_id may have NULL).
  const SUBJECT_WITH_TEACHER = "name, icon, color, teacher:teachers!subjects_teacher_id_fkey(id, full_name)";
  const subjectQuery = lesson.subject_id
    ? db3.from("subjects").select(SUBJECT_WITH_TEACHER).eq("id", lesson.subject_id).maybeSingle()
    : db3.from("subjects").select(SUBJECT_WITH_TEACHER).eq("group_id", lesson.group_id).limit(1).maybeSingle();
  const [curatorRes, materialsRes, stagesRaw, subjectRes] = await Promise.all([
    curatorId
      ? db.from("teachers").select("id, full_name").eq("id", curatorId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    // Промт "презентации/skeleton" — Задача Б: select("*") instead of an
    // explicit column list specifically so this stays deploy-order-agnostic
    // relative to migration 115 (from_knowledge_base/kb_bucket). An explicit
    // list naming those columns would 400 this query — and break every
    // student lesson page — for however long the code is live before the
    // migration is applied; "*" just returns whatever columns actually
    // exist. Matches the teacher-side materials query (line ~1654), which
    // already used "*" for the same reason (unrelated to this migration).
    db3.from("lesson_materials").select("*").eq("lesson_id", lessonId).neq("visibility", "teacher_only").order("created_at"),
    db3.from("lesson_stages").select("id, lesson_id, position, stage_role, stage_type, content_type, title, description, config, difficulty, duration_min, is_completed, completed_at, created_at, slides, current_slide_index, starter_code, programming_language, expected_output, live_code, is_live_active, progress:lesson_stage_progress(*)").eq("lesson_id", lessonId).order("position"),
    subjectQuery,
  ]);

  const { teacher_id: _tid, ...groupData } = lesson.group;
  const materialsTyped = materialsRes as { data: unknown[] | null; error: { message: string } | null };
  const stagesTyped = stagesRaw as { data: unknown[] | null; error: { message: string } | null };
  const subjectTyped = subjectRes as {
    data: { name: string; icon: string | null; color: string | null; teacher: { id: string; full_name: string } | null } | null;
    error: { message: string } | null;
  };
  const curatorTyped = curatorRes as { data: { id: string; full_name: string } | null; error: { message: string } | null };
  if (materialsTyped.error) console.error("[getStudentLessonView] lesson_materials query failed:", materialsTyped.error.message);
  // lesson_stages — самое важное здесь: сбой рендерится как "0 этапов",
  // неотличимо от урока, где этапы правда ещё не созданы (тот же паттерн,
  // что "Выходной"/пустые оценки).
  if (stagesTyped.error) console.error("[getStudentLessonView] lesson_stages query failed:", stagesTyped.error.message);
  if (subjectTyped.error) console.error("[getStudentLessonView] subjects query failed:", subjectTyped.error.message);
  if (curatorTyped.error) console.error("[getStudentLessonView] teachers (curator fallback) query failed:", curatorTyped.error.message);

  // Flatten progress array → single object | null per stage
  const stagesWithProgress = (stagesTyped.data ?? []).map((s) => {
    const stage = s as Record<string, unknown>;
    const progressArr = (stage.progress as unknown[]) ?? [];
    return { ...stage, progress: progressArr.length > 0 ? progressArr[0] : null };
  });

  return {
    id: lesson.id, group_id: lesson.group_id, lesson_no: lesson.lesson_no,
    topic: lesson.topic, title: lesson.title, description: lesson.description,
    starts_at: lesson.starts_at, ends_at: lesson.ends_at,
    started_at: lesson.started_at, ended_at: lesson.ended_at,
    status: lesson.status as StudentLessonView["status"],
    room: lesson.room,
    active_stage_id: lesson.active_stage_id,
    demo_material_id: lesson.demo_material_id,
    subjectName: subjectTyped.data?.name ?? null,
    subjectIcon: subjectTyped.data?.icon ?? null,
    subjectColor: subjectTyped.data?.color ?? null,
    group: groupData,
    teacher: subjectTyped.data?.teacher ?? curatorTyped.data,
    materials: (materialsTyped.data ?? []) as LessonMaterial[],
    stages: stagesWithProgress as LessonStageWithProgress[],
  };
};

/** Безопасный превью-список этапов для экрана ожидания (scheduled) — только
 * заголовок/тип/позиция/длительность, без config/slides/starter_code/quiz —
 * чтобы не спойлерить содержимое квизов и задач до начала урока. */
export type LessonStagePreview = {
  id: string;
  title: string;
  content_type: LessonContentType | null;
  position: number;
  duration_min: number | null;
};

export const getLessonStagesPreview = async (
  db: Db,
  lessonId: string,
): Promise<LessonStagePreview[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("lesson_stages")
    .select("id, title, content_type, position, duration_min")
    .eq("lesson_id", lessonId)
    .eq("stage_role", "middle")
    .order("position");
  if (error) throw error;
  return (data ?? []) as LessonStagePreview[];
};

/** Учитель устанавливает активный этап урока (ученики видят синхронно). */
export async function setActiveStage(
  db: Db,
  lessonId: string,
  stageId: string | null,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from("lessons")
    .update({ active_stage_id: stageId })
    .eq("id", lessonId);
  if (error) throw error;
}

/**
 * Учитель переключает слайд презентации (этап теории). Realtime на lesson_stages
 * доставляет изменение current_slide_index ученикам — они синхронно следуют.
 */
export async function setCurrentSlide(
  db: Db,
  stageId: string,
  slideIndex: number,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from("lesson_stages")
    .update({ current_slide_index: slideIndex })
    .eq("id", stageId);
  if (error) throw error;
}

/**
 * Учитель показывает классу материал (или останавливает показ при null).
 * Realtime на lessons доставляет изменение demo_material_id ученикам урока.
 */
export async function setDemoMaterial(
  db: Db,
  lessonId: string,
  materialId: string | null,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from("lessons")
    .update({ demo_material_id: materialId })
    .eq("id", lessonId);
  if (error) throw error;
}

/**
 * Учитель обновляет код live-демонстрации (throttled на вызывающей стороне).
 * Realtime на lesson_stages доставляет изменение ученикам, следящим за этапом.
 */
export async function setLiveCode(
  db: Db,
  stageId: string,
  code: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from("lesson_stages")
    .update({ live_code: code })
    .eq("id", stageId);
  if (error) throw error;
}

/** Учитель включает live-демонстрацию кода для этапа. */
export async function startLive(
  db: Db,
  stageId: string,
  initialCode: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from("lesson_stages")
    .update({ is_live_active: true, live_code: initialCode })
    .eq("id", stageId);
  if (error) throw error;
}

/** Учитель выключает live-демонстрацию кода для этапа. */
export async function stopLive(
  db: Db,
  stageId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from("lesson_stages")
    .update({ is_live_active: false })
    .eq("id", stageId);
  if (error) throw error;
}


/** Обновляет поля урока (учитель): title, description, starts_at, duration_minutes, room. */
export const updateLesson = async (
  db: Db,
  lessonId: string,
  patch: {
    title?: string | null;
    description?: string | null;
    starts_at?: string;
    duration_minutes?: number;
    ends_at?: string | null;
    room?: string | null;
    group_id?: string;
  },
): Promise<void> => {
  if (patch.starts_at && new Date(patch.starts_at) < new Date()) {
    throw new Error("Нельзя создать урок в прошедшее время");
  }
  if (patch.duration_minutes !== undefined && (patch.duration_minutes < 5 || patch.duration_minutes > 240)) {
    throw new Error("Некорректная длительность");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("lessons").update(patch).eq("id", lessonId);
  if (error) throw error;
};

/** Создаёт новый урок в группе учителя. ends_at вычисляется триггером.
 *  curriculumTopicId (Промт 4) — опциональная привязка к теме учебного
 *  плана; caller уже знает title темы (из списка в форме), передаёт его
 *  через тот же существующий `title`, лишнего похода в БД не нужно.
 *  ТОЛЬКО для новых уроков — updateLesson НЕ принимает этот параметр,
 *  чтобы существующие уроки нельзя было случайно перепривязать. */
export const createLesson = async (
  db: Db,
  input: {
    groupId: string;
    startsAt: string;
    durationMinutes?: number;
    room: string | null;
    title: string | null;
    description: string | null;
    subjectId?: string | null;
    curriculumTopicId?: string | null;
  },
): Promise<{ id: string }> => {
  const dur = input.durationMinutes ?? 45;
  if (new Date(input.startsAt) < new Date()) throw new Error("Нельзя создать урок в прошедшее время");
  if (dur < 5 || dur > 240) throw new Error("Некорректная длительность");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { data, error } = await db2
    .from("lessons")
    .insert({
      group_id: input.groupId,
      starts_at: input.startsAt,
      duration_minutes: dur,
      room: input.room,
      title: input.title,
      description: input.description,
      topic: null,
      status: "scheduled",
      subject_id: input.subjectId ?? null,
      curriculum_topic_id: input.curriculumTopicId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  const created = data as { id: string };
  // Trigger trg_lesson_default_stages auto-creates start + summary stages.
  // Trigger trg_compute_lesson_end auto-sets ends_at = starts_at + duration_minutes.
  return created;
};

/** Удаляет урок: очищает Storage-файлы, затем DELETE (CASCADE на materials/stages). */
export const deleteLesson = async (db: Db, lessonId: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { data: materials } = await db2
    .from("lesson_materials")
    .select("file_storage_path")
    .eq("lesson_id", lessonId);
  if (materials?.length) {
    await db.storage.from("lesson-materials").remove(
      (materials as Array<{ file_storage_path: string }>).map((m) => m.file_storage_path),
    );
  }
  const { error } = await db.from("lessons").delete().eq("id", lessonId);
  if (error) throw error;
};

/** Загружает файл в бакет lesson-materials и вставляет запись в lesson_materials. */
export const uploadLessonMaterial = async (
  db: Db,
  input: {
    lessonId: string;
    teacherId: string;
    file: File;
    title: string;
    visibility?: 'all' | 'teacher_only';
  },
): Promise<LessonMaterial> => {
  const materialId = crypto.randomUUID();
  // Supabase Storage object keys reject non-ASCII characters (e.g. Cyrillic file
  // names) and many symbols with a 400 "Invalid key". Never put the raw filename
  // in the key — derive an ASCII-safe extension and keep the original name only in
  // the `file_original_name` column (used for display + download `downloadAs`).
  const rawExt = input.file.name.includes(".") ? input.file.name.split(".").pop()! : "";
  const safeExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const path = safeExt
    ? `${input.teacherId}/${input.lessonId}/${materialId}.${safeExt}`
    : `${input.teacherId}/${input.lessonId}/${materialId}`;
  const { error: uploadErr } = await db.storage
    .from("lesson-materials")
    .upload(path, input.file, { contentType: input.file.type || undefined });
  if (uploadErr) throw uploadErr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: insertErr } = await (db as any)
    .from("lesson_materials")
    .insert({
      id: materialId,
      lesson_id: input.lessonId,
      title: input.title,
      file_storage_path: path,
      file_size_bytes: input.file.size,
      file_original_name: input.file.name,
      uploaded_by: input.teacherId,
      visibility: input.visibility ?? 'all',
    })
    .select("*")
    .single();
  if (insertErr) throw insertErr;
  return data as LessonMaterial;
};

/** Пачка 4 — материал урока как ссылка на видео (YouTube/RuTube), без
 *  загрузки в Storage. embedUrl — уже нормализованный (см. lib/video-url.ts
 *  parseVideoUrl/toEmbedUrl на стороне apps/web — это packages/core, сюда
 *  парсинг URL не тащим, вызывающий код передаёт готовые значения). */
export const addLessonMaterialVideo = async (
  db: Db,
  input: {
    lessonId: string;
    teacherId: string;
    title: string;
    platform: 'youtube' | 'rutube';
    sourceUrl: string;
    embedUrl: string;
    visibility?: 'all' | 'teacher_only';
  },
): Promise<LessonMaterial> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("lesson_materials")
    .insert({
      lesson_id: input.lessonId,
      title: input.title,
      content_type: `video_${input.platform}`,
      external_url: input.embedUrl,
      source_url: input.sourceUrl,
      uploaded_by: input.teacherId,
      visibility: input.visibility ?? 'all',
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as LessonMaterial;
};

/** Удаляет материал из Storage и БД. Файл из Storage НЕ удаляется, если это
 *  линк на Базу знаний (from_knowledge_base) — тот же файл used ещё
 *  course_materials/books записью, удаление сломало бы её — ИЛИ если это
 *  video-материал (storagePath пуст, нечего удалять в Storage). */
export const deleteLessonMaterial = async (
  db: Db,
  materialId: string,
  storagePath: string | null,
  fromKnowledgeBase = false,
): Promise<void> => {
  if (!fromKnowledgeBase && storagePath) {
    await db.storage.from("lesson-materials").remove([storagePath]);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("lesson_materials").delete().eq("id", materialId);
  if (error) throw error;
};

/** Signed URL (1 час) для скачивания материала урока. bucket по умолчанию
 *  "lesson-materials"; для линков из Базы знаний передавать kb_bucket
 *  ("materials"/"books" — см. миграцию 115). */
export const getLessonMaterialUrl = async (
  db: Db,
  storagePath: string,
  downloadAs?: string,
  bucket: string = "lesson-materials",
): Promise<string> => {
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUrl(storagePath, 3600, downloadAs ? { download: downloadAs } : undefined);
  if (error) throw error;
  return data!.signedUrl;
};

/** Линкует существующий файл из Базы знаний (course_materials/books) как
 *  материал урока — БЕЗ повторной загрузки (тот же storage_path, тот же
 *  файл). Этап 3.4-для-уроков: тот же принцип, что уже есть у homework. */
export const linkLessonMaterialFromKnowledgeBase = async (
  db: Db,
  input: {
    lessonId: string;
    teacherId: string;
    title: string;
    storagePath: string;
    kbBucket: "materials" | "books";
    fileSizeBytes: number | null;
    visibility?: "all" | "teacher_only";
  },
): Promise<LessonMaterial> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("lesson_materials")
    .insert({
      lesson_id: input.lessonId,
      title: input.title,
      file_storage_path: input.storagePath,
      file_size_bytes: input.fileSizeBytes,
      file_original_name: input.title,
      uploaded_by: input.teacherId,
      visibility: input.visibility ?? "all",
      from_knowledge_base: true,
      kb_bucket: input.kbBucket,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as LessonMaterial;
};

// ─── LESSON STAGES v2 (migration 35) ─────────────────────────────────────────

/** Все этапы урока по порядку (для учителя). */
export const getLessonStages = async (db: Db, lessonId: string): Promise<LessonStage[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("lesson_stages")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("position");
  if (error) throw error;
  return (data ?? []) as LessonStage[];
};

/** Этап 3 BOLSHOE_OBNOVLENIE: PPTX-загрузка автодобавляет файл в "Материалы
 *  группы" (uploadPresentationFile → course_materials) — но AI-генерация
 *  (slides jsonb, не config.presentation_file) этот шаг никогда не делала.
 *  Дедуп по (group_id, title, type='presentation'), как у uploadPresentationFile.
 *  stage_id (миграция 119) — точная ссылка на исходный этап: этой карточки
 *  собственного файла никогда не будет (контент — lesson_stages.slides), без
 *  FK открыть её было нечем ("У этого материала нет файла" на любую попытку). */
async function addAiPresentationToGroupMaterials(
  db: Db,
  lessonId: string,
  stageId: string,
  stageTitle: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { data: lesson } = await db2
    .from("lessons")
    .select("group_id, subject:subjects(name)")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson?.group_id) return;

  const { data: existing } = await db2
    .from("course_materials")
    .select("id")
    .eq("group_id", lesson.group_id)
    .eq("title", stageTitle)
    .eq("type", "presentation")
    .maybeSingle();
  if (existing) return;

  const { data: userRes } = await db.auth.getUser();
  const userId = userRes?.user?.id;
  if (!userId) return;
  const { data: teacher } = await db2.from("teachers").select("id").eq("user_id", userId).maybeSingle();

  await db2.from("course_materials").insert({
    group_id: lesson.group_id,
    lesson_id: lessonId,
    stage_id: stageId,
    title: stageTitle,
    type: "presentation",
    subject: lesson.subject?.name ?? null,
    uploaded_by: teacher?.id ?? null,
  });
  // Best-effort: если insert упал (RLS/нет teacher-строки для этой сессии —
  // напр. миграционный контекст), addLessonStage не должен падать из-за этого.
}

/** Добавляет middle-этап в урок. position = max(middle positions)+1 (между 1 и 9998). */
export const addLessonStage = async (
  db: Db,
  lessonId: string,
  input: {
    stageType: LessonStageType;
    contentType: LessonContentType | null;
    title: string;
    description: string | null;
    teacherNotes?: string | null;
    slides?: LessonSlide[] | null;
    starterCode?: string | null;
    programmingLanguage?: string | null;
    expectedOutput?: string | null;
    config?: Record<string, unknown>;
    difficulty?: StageDifficulty;
    durationMin?: number | null;
  },
): Promise<LessonStage> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  // Найти максимальную позицию среди middle-этапов
  const { data: existing } = await db2
    .from("lesson_stages")
    .select("position")
    .eq("lesson_id", lessonId)
    .eq("stage_role", "middle")
    .order("position", { ascending: false })
    .limit(1);
  const maxPos = ((existing ?? []) as Array<{ position: number }>)[0]?.position ?? 0;
  const newPos = Math.max(1, maxPos + 1);

  const { data, error } = await db2
    .from("lesson_stages")
    .insert({
      lesson_id: lessonId,
      position: newPos,
      stage_role: "middle",
      stage_type: input.stageType,
      content_type: input.contentType ?? null,
      title: input.title,
      description: input.description ?? null,
      ...(input.teacherNotes !== undefined ? { teacher_notes: input.teacherNotes } : {}),
      ...(input.slides !== undefined ? { slides: input.slides } : {}),
      ...(input.starterCode !== undefined ? { starter_code: input.starterCode } : {}),
      ...(input.programmingLanguage !== undefined ? { programming_language: input.programmingLanguage } : {}),
      ...(input.expectedOutput !== undefined ? { expected_output: input.expectedOutput } : {}),
      config: input.config ?? {},
      ...(input.difficulty ? { difficulty: input.difficulty } : {}),
      ...(input.durationMin !== undefined ? { duration_min: input.durationMin } : {}),
    })
    .select("*")
    .single();
  if (error) throw error;

  // AI-презентация (slides jsonb) — не ручная загрузка (config.presentation_file,
  // уже добавляется через uploadPresentationFile отдельно) — см. addAiPresentationToGroupMaterials.
  if (input.contentType === "presentation" && input.slides && input.slides.length > 0) {
    try {
      await addAiPresentationToGroupMaterials(db, lessonId, (data as LessonStage).id, input.title);
    } catch {
      // Best-effort — не должно ломать сохранение этапа.
    }
  }

  return data as LessonStage;
};

/** Обновляет middle-этап (нельзя менять start/summary). */
export const updateLessonStage = async (
  db: Db,
  stageId: string,
  data: {
    title?: string;
    description?: string | null;
    teacher_notes?: string | null;
    slides?: LessonSlide[] | null;
    starter_code?: string | null;
    programming_language?: string | null;
    expected_output?: string | null;
    stage_type?: LessonStageType;
    content_type?: LessonContentType | null;
    config?: Record<string, unknown>;
    difficulty?: StageDifficulty;
    duration_min?: number | null;
  },
): Promise<LessonStage> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (db as any)
    .from("lesson_stages")
    .update(data)
    .eq("id", stageId)
    .neq("stage_role", "start")
    .neq("stage_role", "summary")
    .select("*")
    .single();
  if (error) throw error;
  return updated as LessonStage;
};

/** Удаляет middle-этап. start/summary удалить нельзя (защита через .neq). */
export const deleteLessonStage = async (db: Db, stageId: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from("lesson_stages")
    .delete()
    .eq("id", stageId)
    .neq("stage_role", "start")
    .neq("stage_role", "summary");
  if (error) throw error;
};

/** Переупорядочивает middle-этапы — массив ID в нужном порядке. */
export const reorderLessonStages = async (
  db: Db,
  lessonId: string,
  orderedStageIds: string[],
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;

  // BUMP-стратегия против 409 от UNIQUE(lesson_id, position):
  // если ставить финальные позиции напрямую (параллельно), PATCH этапа А на
  // position, всё ещё занятый этапом Б, ловит конфликт. Поэтому в два прохода,
  // строго последовательно.

  // Шаг 1: всем переупорядочиваемым — временные большие позиции (10000 + i).
  // Диапазон 10000+ гарантированно вне start(0) / middle(1..N) / summary(9999).
  for (let i = 0; i < orderedStageIds.length; i++) {
    const id = orderedStageIds[i];
    if (!id) continue;
    await db2
      .from("lesson_stages")
      .update({ position: 10000 + i })
      .eq("id", id)
      .eq("lesson_id", lessonId);
  }

  // Шаг 2: финальные позиции middle-этапов 1..N (start=0 / summary=9999 не трогаем).
  for (let i = 0; i < orderedStageIds.length; i++) {
    const id = orderedStageIds[i];
    if (!id) continue;
    await db2
      .from("lesson_stages")
      .update({ position: i + 1 })
      .eq("id", id)
      .eq("lesson_id", lessonId);
  }
};

/** Отмечает start/summary этап выполненным (или нет). */
export const markStageCompleted = async (
  db: Db,
  stageId: string,
  isCompleted: boolean,
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from("lesson_stages")
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq("id", stageId);
  if (error) throw error;
};

// ─── STUDENT STAGE PROGRESS ───────────────────────────────────────────────────

/** Этапы урока + прогресс ученика по каждому. */
export const getLessonStagesForStudent = async (
  db: Db,
  lessonId: string,
): Promise<LessonStageWithProgress[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("lesson_stages")
    .select("*, progress:lesson_stage_progress(*)")
    .eq("lesson_id", lessonId)
    .order("position");
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((s) => {
    const arr = (s.progress as unknown[]) ?? [];
    return { ...s, progress: arr.length > 0 ? arr[0] : null } as LessonStageWithProgress;
  });
};

export interface WeeklyStageProgress {
  done: number;
  total: number;
  percent: number;
}

/**
 * "Мой прогресс" ring on the dashboard: done/total middle-stage count for
 * lessons within `lessonIds` (caller passes lessons from the last 7 days
 * that have already started — see DashboardView).
 *
 * Counts from lesson_stages (LEFT JOIN-equivalent via embedded progress),
 * NOT from lesson_stage_progress — a stage the student never opened has no
 * progress row at all, so joining the other way around would silently drop
 * it from "total" and inflate the percentage.
 */
export async function getWeeklyStageProgress(db: Db, lessonIds: string[]): Promise<WeeklyStageProgress> {
  if (lessonIds.length === 0) return { done: 0, total: 0, percent: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("lesson_stages")
    .select("id, progress:lesson_stage_progress(is_completed)")
    .eq("stage_role", "middle")
    .in("lesson_id", lessonIds);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: string; progress: { is_completed: boolean }[] | null }>;
  const total = rows.length;
  const done = rows.filter((r) => (r.progress ?? []).some((p) => p.is_completed)).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, percent };
}

/** Ученик отмечает теорию "Изучил". */
export const markTheoryStudied = async (
  db: Db,
  stageId: string,
  studentId: string,
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("lesson_stage_progress").upsert(
    {
      stage_id: stageId,
      student_id: studentId,
      is_completed: true,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "stage_id,student_id", ignoreDuplicates: false },
  );
  if (error) throw error;
};

/** Ученик сдаёт задачу-этап (данные зависят от content_type). */
export const submitStageTask = async (
  db: Db,
  stageId: string,
  studentId: string,
  submissionData: Record<string, unknown>,
): Promise<LessonStageProgress> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).from("lesson_stage_progress").upsert(
    {
      stage_id: stageId,
      student_id: studentId,
      is_completed: true,
      completed_at: new Date().toISOString(),
      submission_data: submissionData,
    },
    { onConflict: "stage_id,student_id", ignoreDuplicates: false },
  ).select("*").single();
  if (error) throw error;
  return data as LessonStageProgress;
};

/** Загрузить скриншот/файл к этапу (внешние сервисы, Prompt 5).
 *  Путь: <studentId>/<stageId>/<timestamp>.<ext> в бакете stage-attachments.
 *  foldername[1]=studentId (RLS ученика), foldername[2]=stageId (RLS учителя). */
export const uploadStageAttachment = async (
  db: Db,
  { studentId, stageId, file }: { studentId: string; stageId: string; file: File },
): Promise<{ path: string }> => {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${studentId}/${stageId}/${Date.now()}.${ext}`;
  const { error } = await db.storage.from("stage-attachments").upload(path, file, { upsert: true });
  if (error) throw error;
  return { path };
};

/** Signed URL для просмотра вложения этапа. */
export const getStageAttachmentUrl = async (db: Db, storagePath: string): Promise<string> => {
  const { data, error } = await db.storage.from("stage-attachments").createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data!.signedUrl;
};

// ─── TEACHER GRADING OF STAGE TASKS ──────────────────────────────────────────

/** Учитель выставляет оценку за задачу-этап. */
export const gradeStageTask = async (
  db: Db,
  stageId: string,
  studentId: string,
  teacherId: string,
  grade: number,
  comment: string | null,
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from("lesson_stage_progress")
    .update({
      grade,
      teacher_comment: comment ?? null,
      graded_at: new Date().toISOString(),
      graded_by: teacherId,
    })
    .eq("stage_id", stageId)
    .eq("student_id", studentId);
  if (error) throw error;
};

/** Все сдачи задачи-этапа с данными ученика (для учителя). */
export const getStageSubmissions = async (
  db: Db,
  stageId: string,
): Promise<Array<LessonStageProgress & { student: { id: string; full_name: string; avatar_url: string | null } }>> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("lesson_stage_progress")
    .select("*, student:students(id, full_name, avatar_url)")
    .eq("stage_id", stageId)
    .order("completed_at");
  if (error) throw error;
  return (data ?? []) as Array<LessonStageProgress & { student: { id: string; full_name: string; avatar_url: string | null } }>;
};

// ─── QUIZZES: QIA test + Kahoot game (migration 39, Prompt 6) ────────────────

/** % правильных → оценка 1–5 (общая шкала для QIA и Kahoot). */
export function gradeFromPercent(pct: number): number {
  if (pct >= 90) return 5;
  if (pct >= 75) return 4;
  if (pct >= 60) return 3;
  if (pct >= 40) return 2;
  return 1;
}

/** Kahoot: баллы за ответ. Верно мгновенно → 1000, на последней секунде → ~500, неверно → 0. */
export function kahootScore(isCorrect: boolean, responseTimeMs: number, timeLimitSeconds: number): number {
  if (!isCorrect) return 0;
  const limitMs = Math.max(1, timeLimitSeconds) * 1000;
  const frac = Math.min(1, Math.max(0, responseTimeMs / limitMs));
  return Math.round(1000 * (1 - frac / 2));
}

// ── Teacher: question CRUD (RLS enforces stage ownership) ──

export const getQuizQuestions = async (db: Db, stageId: string): Promise<QuizQuestion[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("quiz_questions").select("*").eq("stage_id", stageId).order("position");
  if (error) throw error;
  return (data ?? []) as QuizQuestion[];
};

export const createQuizQuestion = async (
  db: Db, stageId: string, position: number, input: QuizQuestionInput,
): Promise<QuizQuestion> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).from("quiz_questions").insert({
    stage_id: stageId,
    position,
    question_text: input.question_text,
    options: input.options,
    correct_option_index: input.correct_option_index,
    points: input.points ?? 1,
    time_per_question_seconds: input.time_per_question_seconds ?? 20,
  }).select("*").single();
  if (error) throw error;
  return data as QuizQuestion;
};

export const updateQuizQuestion = async (
  db: Db, questionId: string, patch: Partial<QuizQuestionInput> & { position?: number },
): Promise<QuizQuestion> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("quiz_questions").update(patch).eq("id", questionId).select("*").single();
  if (error) throw error;
  return data as QuizQuestion;
};

export const deleteQuizQuestion = async (db: Db, questionId: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("quiz_questions").delete().eq("id", questionId);
  if (error) throw error;
};

/** Полностью заменяет вопросы этапа (delete-all + insert) — для сохранения из StageModal. */
export const replaceQuizQuestions = async (
  db: Db, stageId: string, questions: QuizQuestionInput[],
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  await db2.from("quiz_questions").delete().eq("stage_id", stageId);
  if (questions.length === 0) return;
  const rows = questions.map((q, i) => ({
    stage_id: stageId,
    position: i,
    question_text: q.question_text,
    options: q.options,
    correct_option_index: q.correct_option_index,
    points: q.points ?? 1,
    time_per_question_seconds: q.time_per_question_seconds ?? 20,
  }));
  const { error } = await db2.from("quiz_questions").insert(rows);
  if (error) throw error;
};

// ── QIA: student self-paced attempt ──

export const getStudentQuizAttempt = async (
  db: Db, stageId: string, studentId: string,
): Promise<QuizAttempt | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from("quiz_attempts").select("*").eq("stage_id", stageId).eq("student_id", studentId).maybeSingle();
  return (data ?? null) as QuizAttempt | null;
};

/** Создаёт (или возвращает существующую) попытку прохождения. */
export const startQuizAttempt = async (
  db: Db, stageId: string, studentId: string, totalQuestions: number,
): Promise<QuizAttempt> => {
  const existing = await getStudentQuizAttempt(db, stageId, studentId);
  if (existing) return existing;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).from("quiz_attempts").insert({
    stage_id: stageId, student_id: studentId, total_questions: totalQuestions,
  }).select("*").single();
  if (error) throw error;
  return data as QuizAttempt;
};

/** Сохраняет выбранный вариант (мгновенно, чтобы не потерять при обрыве связи). */
export const submitQuizAnswer = async (
  db: Db, attemptId: string, questionId: string, selectedIndex: number | null,
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("quiz_answers").upsert({
    attempt_id: attemptId,
    question_id: questionId,
    selected_option_index: selectedIndex,
    answered_at: new Date().toISOString(),
  }, { onConflict: "attempt_id,question_id", ignoreDuplicates: false });
  if (error) throw error;
};

/** Финализация QIA: считает is_correct по каждому ответу, оценку по % и пишет в lesson_stage_progress. */
export const finalizeQuizAttempt = async (
  db: Db, attemptId: string, studentId: string,
): Promise<{ correct: number; total: number; grade: number }> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { data: attempt } = await db2.from("quiz_attempts").select("*").eq("id", attemptId).single();
  const stageId = attempt.stage_id as string;
  const questions = await getQuizQuestions(db, stageId);
  const { data: answers } = await db2.from("quiz_answers").select("*").eq("attempt_id", attemptId);
  const answerMap = new Map<string, QuizAnswer>(((answers ?? []) as QuizAnswer[]).map((a) => [a.question_id, a]));

  let correct = 0;
  let totalScore = 0;
  for (const q of questions) {
    const a = answerMap.get(q.id);
    const isCorrect = !!a && a.selected_option_index === q.correct_option_index;
    if (isCorrect) { correct += 1; totalScore += q.points; }
    if (a) {
      await db2.from("quiz_answers").update({ is_correct: isCorrect, score: isCorrect ? q.points : 0 }).eq("id", a.id);
    }
  }
  const total = questions.length;
  const grade = gradeFromPercent(total > 0 ? (correct / total) * 100 : 0);

  await db2.from("quiz_attempts").update({
    finished_at: new Date().toISOString(),
    correct_count: correct,
    total_score: totalScore,
    total_questions: total,
    is_finalized: true,
  }).eq("id", attemptId);

  const nowIso = new Date().toISOString();
  await db2.from("lesson_stage_progress").upsert({
    stage_id: stageId,
    student_id: studentId,
    is_completed: true,
    completed_at: nowIso,
    grade,
    graded_at: nowIso,
    graded_by: null,
    submission_data: { kind: "quiz", correct, total, total_score: totalScore },
  }, { onConflict: "stage_id,student_id", ignoreDuplicates: false });

  return { correct, total, grade };
};

/** Детали попытки: вопросы + ответы ученика (для экрана результата / read-only). */
export const getQuizAttemptResults = async (
  db: Db, attemptId: string,
): Promise<{ questions: QuizQuestion[]; answers: QuizAnswer[] }> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { data: attempt } = await db2.from("quiz_attempts").select("stage_id").eq("id", attemptId).single();
  const questions = await getQuizQuestions(db, attempt.stage_id);
  const { data: answers } = await db2.from("quiz_answers").select("*").eq("attempt_id", attemptId);
  return { questions, answers: (answers ?? []) as QuizAnswer[] };
};

// ── Kahoot: live game (teacher-driven) ──

export const getKahootSession = async (db: Db, stageId: string): Promise<KahootSession | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any).from("kahoot_sessions").select("*").eq("stage_id", stageId).maybeSingle();
  return (data ?? null) as KahootSession | null;
};

/** Учитель открывает игру: если сессия завершена — возвращает её (read-only просмотр).
 *  Иначе удаляет старую и создаёт новое лобби. */
export const createKahootSession = async (db: Db, stageId: string): Promise<KahootSession> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { data: existing } = await db2.from("kahoot_sessions").select("*").eq("stage_id", stageId).maybeSingle();
  // Finished session is read-only — preserve it, don't reset
  if ((existing as KahootSession | null)?.status === "finished") return existing as KahootSession;
  await db2.from("kahoot_sessions").delete().eq("stage_id", stageId);
  const { data, error } = await db2.from("kahoot_sessions").insert({
    stage_id: stageId, status: "lobby", current_question_index: -1,
  }).select("*").single();
  if (error) throw error;
  return data as KahootSession;
};

export const startKahootGame = async (db: Db, sessionId: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("kahoot_sessions").update({
    status: "question_active", current_question_index: 0,
    started_at: new Date().toISOString(), question_started_at: new Date().toISOString(),
  }).eq("id", sessionId);
  if (error) throw error;
};

export const showNextKahootQuestion = async (db: Db, sessionId: string, nextIndex: number): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("kahoot_sessions").update({
    status: "question_active", current_question_index: nextIndex,
    question_started_at: new Date().toISOString(),
  }).eq("id", sessionId);
  if (error) throw error;
};

export const revealKahootAnswer = async (db: Db, sessionId: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("kahoot_sessions").update({ status: "question_revealed" }).eq("id", sessionId);
  if (error) throw error;
};

/** Ученик отвечает: считает is_correct + баллы по формуле скорости, пишет ответ и обновляет попытку. */
export const submitKahootAnswer = async (
  db: Db,
  { stageId, attemptId, questionId, selectedIndex, isCorrect, responseTimeMs, timeLimitSeconds }: {
    stageId: string; attemptId: string; questionId: string;
    selectedIndex: number; isCorrect: boolean; responseTimeMs: number; timeLimitSeconds: number;
  },
): Promise<number> => {
  void stageId;
  const score = kahootScore(isCorrect, responseTimeMs, timeLimitSeconds);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { error } = await db2.from("quiz_answers").upsert({
    attempt_id: attemptId,
    question_id: questionId,
    selected_option_index: selectedIndex,
    is_correct: isCorrect,
    response_time_ms: responseTimeMs,
    score,
    answered_at: new Date().toISOString(),
  }, { onConflict: "attempt_id,question_id", ignoreDuplicates: false });
  if (error) throw error;
  return score;
};

/** Участники игры (ученики, у которых есть попытка на этапе) — для лобби. */
export const getKahootParticipants = async (
  db: Db, stageId: string,
): Promise<Array<{ student_id: string; full_name: string }>> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from("quiz_attempts").select("student_id, student:students(full_name)").eq("stage_id", stageId);
  type Raw = { student_id: string; student: { full_name: string } | null };
  return ((data ?? []) as Raw[]).map((r) => ({ student_id: r.student_id, full_name: r.student?.full_name ?? "—" }));
};

/** Сколько ответов уже есть на конкретный вопрос (для счётчика «Ответили»). */
export const getKahootAnswerCount = async (db: Db, questionId: string): Promise<number> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (db as any)
    .from("quiz_answers").select("id", { count: "exact", head: true }).eq("question_id", questionId);
  return count ?? 0;
};

/** Лидерборд: сумма баллов по каждому ученику в этапе (по убыванию). */
export const getKahootLeaderboard = async (db: Db, stageId: string): Promise<QuizLeaderboardEntry[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from("quiz_attempts")
    .select("student_id, student:students(full_name), answers:quiz_answers(score, is_correct)")
    .eq("stage_id", stageId);
  type Raw = { student_id: string; student: { full_name: string } | null; answers: Array<{ score: number; is_correct: boolean | null }> };
  const rows = ((data ?? []) as Raw[]).map((r) => ({
    student_id: r.student_id,
    full_name: r.student?.full_name ?? "—",
    total_score: r.answers.reduce((s, a) => s + (a.score ?? 0), 0),
    correct_count: r.answers.filter((a) => a.is_correct).length,
  }));
  rows.sort((a, b) => b.total_score - a.total_score);
  return rows;
};

/** Учитель завершает игру: статус finished + оценка каждому ученику по % правильных. */
export const finishKahootGame = async (db: Db, sessionId: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { data: session } = await db2.from("kahoot_sessions").select("stage_id").eq("id", sessionId).single();
  const stageId = session.stage_id as string;

  await db2.from("kahoot_sessions").update({ status: "finished", finished_at: new Date().toISOString() }).eq("id", sessionId);

  const total = (await getQuizQuestions(db, stageId)).length;
  const { data: attempts } = await db2.from("quiz_attempts")
    .select("id, student_id, answers:quiz_answers(score, is_correct)").eq("stage_id", stageId);

  type Raw = { id: string; student_id: string; answers: Array<{ score: number; is_correct: boolean | null }> };
  const nowIso = new Date().toISOString();
  for (const a of (attempts ?? []) as Raw[]) {
    const correct = a.answers.filter((x) => x.is_correct).length;
    const totalScore = a.answers.reduce((s, x) => s + (x.score ?? 0), 0);
    const grade = gradeFromPercent(total > 0 ? (correct / total) * 100 : 0);
    await db2.from("quiz_attempts").update({
      correct_count: correct, total_score: totalScore, total_questions: total,
      is_finalized: true, finished_at: nowIso,
    }).eq("id", a.id);
    await db2.from("lesson_stage_progress").upsert({
      stage_id: stageId,
      student_id: a.student_id,
      is_completed: true,
      completed_at: nowIso,
      grade,
      graded_at: nowIso,
      graded_by: null,
      submission_data: { kind: "kahoot", correct, total, total_score: totalScore },
    }, { onConflict: "stage_id,student_id", ignoreDuplicates: false });
  }
};

// --- Оценки за урок (migration 40) ---

/** Все оценки урока (для перекличкu: учитель видит оценки всех своих учеников). */
export const getLessonGrades = async (db: Db, lessonId: string): Promise<LessonGrade[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any).from("lesson_grades").select("*").eq("lesson_id", lessonId);
  return (data ?? []) as LessonGrade[];
};

/** Одна оценка ученика за урок (для student view). */
export const getStudentLessonGrade = async (db: Db, lessonId: string, studentId: string): Promise<LessonGrade | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any).from("lesson_grades").select("*")
    .eq("lesson_id", lessonId).eq("student_id", studentId).maybeSingle();
  return (data as LessonGrade | null) ?? null;
};

/** Upsert: создаёт или обновляет оценку ученика за урок. */
export const gradeStudentForLesson = async (
  db: Db, lessonId: string, teacherId: string, studentId: string, grade: number, comment: string | null,
): Promise<LessonGrade> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).from("lesson_grades").upsert({
    lesson_id: lessonId, student_id: studentId, grade, comment: comment ?? null,
    graded_by: teacherId, graded_at: new Date().toISOString(),
  }, { onConflict: "lesson_id,student_id", ignoreDuplicates: false }).select("*").single();
  if (error) throw error;
  return data as LessonGrade;
};

/** Удалить оценку (на случай ошибки). */
export const deleteLessonGrade = async (db: Db, lessonId: string, studentId: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).from("lesson_grades").delete()
    .eq("lesson_id", lessonId).eq("student_id", studentId);
};

export type LessonGradeRow = {
  id: string; lesson_id: string; student_id: string; grade: number; comment: string | null;
  graded_at: string;
  student_name: string;
  lesson_no: number | null;
  lesson_topic: string | null;
  lesson_starts_at: string;
};

/** Все оценки за уроки по группе (для матрицы учителя). */
export const getLessonGradesForGroup = async (db: Db, groupId: string): Promise<LessonGradeRow[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any).from("lesson_grades")
    .select("id, lesson_id, student_id, grade, comment, graded_at, lesson:lessons!inner(lesson_no, topic, starts_at, group_id), student:students!inner(full_name)")
    .eq("lesson.group_id", groupId)
    .order("graded_at", { ascending: false });
  type Raw = {
    id: string; lesson_id: string; student_id: string; grade: number; comment: string | null; graded_at: string;
    lesson: { lesson_no: number | null; topic: string | null; starts_at: string } | null;
    student: { full_name: string } | null;
  };
  return ((data ?? []) as Raw[]).map((r) => ({
    id: r.id, lesson_id: r.lesson_id, student_id: r.student_id,
    grade: r.grade, comment: r.comment, graded_at: r.graded_at,
    student_name: r.student?.full_name ?? "—",
    lesson_no: r.lesson?.lesson_no ?? null,
    lesson_topic: r.lesson?.topic ?? null,
    lesson_starts_at: r.lesson?.starts_at ?? "",
  }));
};

type TeacherLessonListItem = {
  id: string; group_id: string; lesson_no: number | null; topic: string | null;
  title: string | null; starts_at: string; ends_at: string | null; room: string | null;
  status: string; started_at: string | null; ended_at: string | null;
  // P2: is_demo дропнут в 132. Оставляем поле как optional для BC callers
  // (useDemoEditBlocked всегда false).
  is_demo?: boolean;
  subject_id: string | null;
  group: { id: string; name: string; subject: string };
};

/** Все уроки в группах учителя — для страницы /teacher/lessons. */
export const getTeacherAllLessons = async (db: Db): Promise<TeacherLessonListItem[]> => {
  const { data, error } = await db
    .from("lessons")
    .select("id, group_id, lesson_no, topic, title, starts_at, ends_at, started_at, ended_at, status, room, subject_id, group:groups!inner(id, name, subject)")
    .order("starts_at", { ascending: false });
  if (error) throw error;
  const filter = await getTeacherSubjectFilter(db);
  return filterBySubject((data ?? []) as unknown as TeacherLessonListItem[], filter);
};

/** Уроки в группах учителя за конкретный месяц (year/month — 1-based). */
export const getTeacherLessonsByMonth = async (
  db: Db,
  year: number,
  month: number,
): Promise<TeacherLessonListItem[]> => {
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
  const { data, error } = await db
    .from("lessons")
    .select("id, group_id, lesson_no, topic, title, starts_at, ends_at, started_at, ended_at, status, room, subject_id, group:groups!inner(id, name, subject)")
    .gte("starts_at", start)
    .lte("starts_at", end)
    .order("starts_at");
  if (error) throw error;
  const filter = await getTeacherSubjectFilter(db);
  return filterBySubject((data ?? []) as unknown as TeacherLessonListItem[], filter);
};

/** Уроки конкретной группы в диапазоне дат (Asia/Tashkent, [fromDate, toDate]
 *  включительно, формат YYYY-MM-DD) — для проверки занятости слотов при
 *  авто-раскладке уроков из учебного плана (Промт: "Учебные планы", Часть 2А). */
export const getGroupLessonsInDateRange = async (
  db: Db,
  groupId: string,
  fromDate: string,
  toDate: string,
): Promise<Array<{ starts_at: string; ends_at: string | null }>> => {
  const { data, error } = await db
    .from("lessons")
    .select("starts_at, ends_at")
    .eq("group_id", groupId)
    .gte("starts_at", `${fromDate}T00:00:00+05:00`)
    .lte("starts_at", `${toDate}T23:59:59+05:00`);
  if (error) throw error;
  return (data ?? []) as Array<{ starts_at: string; ends_at: string | null }>;
};

/** Переводит урок в статус 'in_progress', отмечает этап Старт выполненным. */
export const startLesson = async (db: Db, lessonId: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { error } = await db2.from("lessons")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) throw error;
  // Отмечаем этап Старт (stage_role='start') выполненным
  await db2.from("lesson_stages")
    .update({ is_completed: true, completed_at: new Date().toISOString() })
    .eq("lesson_id", lessonId)
    .eq("stage_role", "start");
};

/** Ручное завершение урока (кнопка "Закончить урок" — учитель или ученик, БОЛЬШОЕ ОБНОВЛЕНИЕ §7.6).
 *  Симметрична fn_auto_end_lessons(): помечает этап "Итог" выполненным. */
export const endLesson = async (db: Db, lessonId: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { error } = await db2.from("lessons")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) throw error;
  await db2.from("lesson_stages")
    .update({ is_completed: true, completed_at: new Date().toISOString() })
    .eq("lesson_id", lessonId)
    .eq("stage_role", "summary");
};

// ─── ATTENDANCE ROLL-CALL ─────────────────────────────────────────────────────

/** Список всех учеников группы с их статусом на конкретном уроке (для переклички). */
export const getTeacherLessonAttendance = async (
  db: Db,
  lessonId: string,
): Promise<AttendanceRollCallRow[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;

  const { data: lesson } = await db2.from("lessons").select("group_id").eq("id", lessonId).single();
  if (!lesson) return [];

  const { data: enrollments } = await db2
    .from("student_groups")
    .select("student_id, students!inner(id, full_name)")
    .eq("group_id", lesson.group_id);

  const { data: records } = await db2
    .from("attendance")
    .select("student_id, status, marked_at, is_finalized")
    .eq("lesson_id", lessonId);

  const attMap = new Map<string, { status: string; marked_at: string; is_finalized: boolean }>(
    ((records ?? []) as Array<{ student_id: string; status: string; marked_at: string; is_finalized: boolean }>)
      .map((r) => [r.student_id, r]),
  );

  return ((enrollments ?? []) as Array<{ student_id: string; students: { id: string; full_name: string } }>)
    .map((e) => {
      const att = attMap.get(e.student_id);
      return {
        student_id: e.student_id,
        full_name: e.students.full_name,
        status: (att?.status ?? null) as AttendanceStatus | null,
        marked_at: att?.marked_at ?? null,
        is_finalized: att?.is_finalized ?? false,
        // P2: is_demo убран из attendance миграцией 132. Оставляем null
        // для BC callers (AttendanceRollCall передаёт в useDemoEditBlocked,
        // который всегда false).
        is_demo: null as boolean | null,
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "ru"));
};

/** UPSERT одной записи посещаемости (optimistic, вызывается при клике кнопки). */
export const markStudentAttendance = async (
  db: Db,
  lessonId: string,
  studentId: string,
  status: AttendanceStatus,
  teacherId: string,
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { error } = await db2.from("attendance").upsert(
    {
      lesson_id: lessonId,
      student_id: studentId,
      status,
      marked_at: new Date().toISOString(),
      marked_by: teacherId,
      is_finalized: false,
    },
    { onConflict: "lesson_id,student_id", ignoreDuplicates: false },
  );
  if (error) throw error;
};

// NOTE: `endLesson` and `finalizeLessonAttendance` were removed (Prompt-4 audit, Bug 2).
// A lesson must NEVER be closed by marking attendance ("перекличка не закрывает урок").
// Closing + attendance finalization is now exclusively server-side and TIME-BASED via
// the pg_cron function `fn_auto_end_lessons` (migration 36): it flips a lesson to
// 'completed' only when `ends_at <= now()`, regardless of how many students are marked.
// These client helpers (which set lessons.status='completed' and finalized attendance)
// had no callers after Prompt 3 removed the Start/End buttons; they are deleted so the
// bug cannot be re-introduced by accidentally wiring them to the roll-call UI.

// ─── BOOKS ───────────────────────────────────────────────────────────────────

/** Все книги библиотеки (видны всем authenticated — RLS using(true)). */
export const getAllBooks = async (db: Db): Promise<Book[]> => {
  const { data, error } = await db
    .from("books")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Book[];
};

/** ID книг в избранном текущего ученика. */
export const getMyFavoriteBookIds = async (db: Db): Promise<string[]> => {
  const { data, error } = await db.from("book_favorites").select("book_id");
  if (error) throw error;
  return (data ?? []).map((r: { book_id: string }) => r.book_id);
};

/** Добавить книгу в избранное (student_id = current_student_id() через RLS). */
export const addBookFavorite = async (db: Db, bookId: string, studentId: string): Promise<void> => {
  const { error } = await db
    .from("book_favorites")
    .insert({ book_id: bookId, student_id: studentId });
  if (error) throw error;
};

/** Удалить книгу из избранного. */
export const removeBookFavorite = async (db: Db, bookId: string, studentId: string): Promise<void> => {
  const { error } = await db
    .from("book_favorites")
    .delete()
    .eq("book_id", bookId)
    .eq("student_id", studentId);
  if (error) throw error;
};

/** Вставить книгу в БД. */
export const insertBook = async (
  db: Db,
  input: {
    title: string;
    author: string | null;
    subject: string;
    book_type: string;
    description: string | null;
    cover_storage_path: string | null;
    file_storage_path: string;
    file_size_bytes: number;
    uploaded_by: string;
  },
): Promise<Book> => {
  const { data, error } = await db
    .from("books")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as Book;
};

/** Signed URL для книги (1 час). Без downloadAs открывается инлайн. */
export const getBookSignedUrl = async (
  db: Db,
  storagePath: string,
  downloadAs?: string,
): Promise<string> => {
  const { data, error } = await db.storage
    .from("books")
    .createSignedUrl(storagePath, 3600, downloadAs ? { download: downloadAs } : undefined);
  if (error) throw error;
  return data!.signedUrl;
};

// ─── HOMEWORK FILES (Step E) ──────────────────────────────────────────────────

/** Upload teacher attachment to homework-files bucket.
 *  Returns storage path and size. */
export const uploadHomeworkAttachment = async (
  db: Db,
  { teacherId, homeworkId, fileName, blob }: {
    teacherId: string; homeworkId: string; fileName: string; blob: Blob;
  },
): Promise<{ path: string; sizeByte: number }> => {
  const ext = fileName.split(".").pop() ?? "bin";
  const path = `${teacherId}/${homeworkId}/attachment/${Date.now()}.${ext}`;
  const { error } = await db.storage
    .from("homework-files")
    .upload(path, blob, { upsert: true, contentType: (blob as File).type || undefined });
  if (error) throw error;
  return { path, sizeByte: blob.size };
};

/** Update homework's attachment columns after uploading (or null to clear). */
export const setHomeworkAttachment = async (
  db: Db,
  homeworkId: string,
  attachment: { path: string; sizeByte: number; fileName: string } | null,
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db.from("homework") as any)
    .update({
      attachment_storage_path: attachment?.path ?? null,
      attachment_size_bytes: attachment?.sizeByte ?? null,
      attachment_filename: attachment?.fileName ?? null,
    })
    .eq("id", homeworkId);
  if (error) throw error;
};

/** Signed URL for teacher attachment (accessible to both student and teacher). */
// БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 3.4 — attaching an existing Knowledge Base file
// (course_materials/books) to homework must NOT copy it: the homework row's
// existing plain-text attachment_storage_path column is reused, prefixed to
// record which bucket the file actually lives in. Bare paths (no recognized
// prefix) keep resolving against "homework-files" exactly as before — fully
// backward-compatible with every pre-existing homework row.
const KB_MATERIAL_PREFIX = "kb:materials:";
const KB_BOOK_PREFIX = "kb:books:";

export function linkedMaterialAttachmentPath(storagePath: string): string {
  return `${KB_MATERIAL_PREFIX}${storagePath}`;
}
export function linkedBookAttachmentPath(storagePath: string): string {
  return `${KB_BOOK_PREFIX}${storagePath}`;
}

function resolveAttachmentBucket(storagePath: string): { bucket: string; path: string; isLinked: boolean } {
  if (storagePath.startsWith(KB_MATERIAL_PREFIX)) {
    return { bucket: "materials", path: storagePath.slice(KB_MATERIAL_PREFIX.length), isLinked: true };
  }
  if (storagePath.startsWith(KB_BOOK_PREFIX)) {
    return { bucket: "books", path: storagePath.slice(KB_BOOK_PREFIX.length), isLinked: true };
  }
  return { bucket: "homework-files", path: storagePath, isLinked: false };
}

export const getHomeworkAttachmentUrl = async (
  db: Db,
  storagePath: string,
  downloadAs?: string,
): Promise<string> => {
  const { bucket, path } = resolveAttachmentBucket(storagePath);
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUrl(path, 3600, downloadAs ? { download: downloadAs } : undefined);
  if (error) throw error;
  return data!.signedUrl;
};

/** Delete teacher attachment from Storage + clear homework columns.
 *  A Knowledge Base-linked file (Этап 3.4) is shared with its Materials/
 *  Library entry — only the link is removed, the underlying file survives. */
export const deleteHomeworkAttachment = async (
  db: Db,
  homeworkId: string,
  storagePath: string,
) => {
  const { bucket, path, isLinked } = resolveAttachmentBucket(storagePath);
  if (!isLinked) {
    await db.storage.from(bucket).remove([path]);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db.from("homework") as any)
    .update({ attachment_storage_path: null, attachment_size_bytes: null, attachment_filename: null })
    .eq("id", homeworkId);
  if (error) throw error;
};

/** Signed URL for student submission file (teacher or the submitting student). */
export const getSubmissionFileUrl = async (
  db: Db,
  storagePath: string,
  downloadAs?: string,
): Promise<string> => {
  const { data, error } = await db.storage
    .from("homework-files")
    .createSignedUrl(storagePath, 3600, downloadAs ? { download: downloadAs } : undefined);
  if (error) throw error;
  return data!.signedUrl;
};

// ─── HOMEWORK HINT (БОЛЬШОЕ ОБНОВЛЕНИЕ §8 — image/PDF, shown to the student
// as an always-visible side panel, distinct from the general teacher
// attachment above which is a downloadable resource card). ─────────────────

/** Upload teacher hint image/PDF to homework-files bucket (separate path
 *  prefix from the general attachment, same bucket/policies). */
export const uploadHomeworkHint = async (
  db: Db,
  { teacherId, homeworkId, fileName, blob }: {
    teacherId: string; homeworkId: string; fileName: string; blob: Blob;
  },
): Promise<{ path: string; sizeByte: number }> => {
  const ext = fileName.split(".").pop() ?? "bin";
  const path = `${teacherId}/${homeworkId}/hint/${Date.now()}.${ext}`;
  const { error } = await db.storage
    .from("homework-files")
    .upload(path, blob, { upsert: true, contentType: (blob as File).type || undefined });
  if (error) throw error;
  return { path, sizeByte: blob.size };
};

export const setHomeworkHint = async (
  db: Db,
  homeworkId: string,
  hint: { path: string; fileName: string; mimeType: string } | null,
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db.from("homework") as any)
    .update({
      hint_storage_path: hint?.path ?? null,
      hint_filename: hint?.fileName ?? null,
      hint_mime_type: hint?.mimeType ?? null,
    })
    .eq("id", homeworkId);
  if (error) throw error;
};

export const getHomeworkHintUrl = async (db: Db, storagePath: string): Promise<string> => {
  const { data, error } = await db.storage
    .from("homework-files")
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data!.signedUrl;
};

export const deleteHomeworkHint = async (db: Db, homeworkId: string, storagePath: string) => {
  await db.storage.from("homework-files").remove([storagePath]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db.from("homework") as any)
    .update({ hint_storage_path: null, hint_filename: null, hint_mime_type: null })
    .eq("id", homeworkId);
  if (error) throw error;
};

/** Submit homework with optional file — handles both first submit and resubmit.
 *  Deletes old storage file when resubmitting with a new file. */
export const submitHomeworkWithFile = async (
  db: Db,
  {
    homeworkId, studentId, teacherId, textAnswer, file, fileName,
  }: {
    homeworkId: string;
    studentId: string;
    teacherId: string | null;
    textAnswer?: string;
    file?: File | Blob | null;
    fileName?: string;
  },
): Promise<HomeworkSubmission> => {
  const { data: existing } = await db
    .from("homework_submissions")
    .select("id, file_storage_path")
    .eq("homework_id", homeworkId)
    .eq("student_id", studentId)
    .maybeSingle();

  const existingRow = existing as { id: string; file_storage_path: string | null } | null;

  if (file && existingRow?.file_storage_path) {
    await db.storage.from("homework-files").remove([existingRow.file_storage_path]);
  }

  let fileStoragePath: string | null = null;
  let fileSizeBytes: number | null = null;
  let fileOriginalName: string | null = null;

  if (file && fileName && teacherId) {
    const ext = fileName.split(".").pop() ?? "bin";
    fileStoragePath = `${teacherId}/${homeworkId}/submissions/${studentId}/${Date.now()}.${ext}`;
    fileSizeBytes = file.size;
    fileOriginalName = fileName;
    const { error } = await db.storage
      .from("homework-files")
      .upload(fileStoragePath, file, { upsert: true, contentType: (file as File).type || undefined });
    if (error) throw error;
  }

  const payload = {
    homework_id: homeworkId,
    student_id: studentId,
    answer_text: textAnswer?.trim() || null,
    file_storage_path: fileStoragePath,
    file_size_bytes: fileSizeBytes,
    file_original_name: fileOriginalName,
    status: "submitted" as const,
    submitted_at: new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissionsTable = db.from("homework_submissions") as any;
  if (existingRow) {
    const { data, error } = await submissionsTable
      .update(payload)
      .eq("id", existingRow.id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as HomeworkSubmission;
  } else {
    const { data, error } = await submissionsTable
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as HomeworkSubmission;
  }
};

/** Delete homework record + all associated Storage files (attachment + student submissions). */
export const deleteHomework = async (db: Db, homeworkId: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [hwRes, subsRes] = await Promise.all([
    (db.from("homework") as any).select("attachment_storage_path").eq("id", homeworkId).single(),
    (db.from("homework_submissions") as any).select("file_storage_path").eq("homework_id", homeworkId),
  ]);

  const paths: string[] = [];
  const attachPath = (hwRes.data as { attachment_storage_path: string | null } | null)?.attachment_storage_path;
  if (attachPath) paths.push(attachPath);
  for (const sub of (subsRes.data ?? [])) {
    const fp = (sub as { file_storage_path: string | null }).file_storage_path;
    if (fp) paths.push(fp);
  }
  if (paths.length > 0) {
    await db.storage.from("homework-files").remove(paths);
  }

  const { error } = await db.from("homework").delete().eq("id", homeworkId);
  if (error) throw error;
};

/** Книги текущего учителя (для /teacher/books). */
export const getTeacherBooks = async (db: Db, teacherId: string): Promise<Book[]> => {
  const { data, error } = await db
    .from("books")
    .select("*")
    .eq("uploaded_by", teacherId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Book[];
};

// ─── CLASSWORK ────────────────────────────────────────────────────────────────

/** Получить classwork для урока (+ вопросы для теста). */
export const getClasswork = async (db: Db, lessonId: string): Promise<Classwork | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { data, error } = await db2.from("classwork").select("*").eq("lesson_id", lessonId).maybeSingle();
  if (error || !data) return null;
  const cw = data as Classwork;
  const { data: qs } = await db2.from("classwork_questions").select("*").eq("classwork_id", cw.id).order("position");
  return {
    ...cw,
    questions: ((qs ?? []) as ClassworkQuestion[]).map((q) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : [],
    })),
  };
};

/** Создать classwork (без вопросов). */
export const createClasswork = async (
  db: Db,
  { lessonId, teacherId, title, description, workType, durationSeconds }: {
    lessonId: string; teacherId: string; title: string;
    description?: string; workType: ClassworkType; durationSeconds?: number;
  },
): Promise<string> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).from("classwork").insert({
    lesson_id: lessonId,
    title,
    description: description ?? null,
    work_type: workType,
    created_by: teacherId,
    duration_seconds: durationSeconds ?? null,
  }).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
};

/** Создать вопросы теста для classwork. */
export const createClassworkQuestions = async (
  db: Db,
  classworkId: string,
  questions: Array<{ questionText: string; options: string[]; correctIndex: number; position: number }>,
): Promise<void> => {
  if (questions.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("classwork_questions").insert(
    questions.map((q) => ({
      classwork_id: classworkId,
      position: q.position,
      question_text: q.questionText,
      options: q.options,
      correct_index: q.correctIndex,
    })),
  );
  if (error) throw error;
};

/** Загрузить attachment учителя к classwork. */
export const uploadClassworkAttachment = async (
  db: Db,
  { teacherId, classworkId, file }: { teacherId: string; classworkId: string; file: File },
): Promise<{ path: string; sizeByte: number }> => {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${teacherId}/${classworkId}/attachment/${Date.now()}.${ext}`;
  const { error } = await db.storage.from("classwork-files").upload(path, file, { upsert: true });
  if (error) throw error;
  return { path, sizeByte: file.size };
};

/** Получить signed URL для attachment classwork. */
export const getClassworkAttachmentUrl = async (db: Db, storagePath: string): Promise<string> => {
  const { data, error } = await db.storage.from("classwork-files").createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data!.signedUrl;
};

/** Удалить classwork (каскадно удаляет вопросы и сдачи через ON DELETE CASCADE). */
export const deleteClasswork = async (db: Db, classworkId: string, teacherId: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("classwork").delete()
    .eq("id", classworkId).eq("created_by", teacherId);
  if (error) throw error;
};

/** Сдать classwork (ученик). UPSERT — можно переотправить если не оценено. */
export const submitClasswork = async (
  db: Db,
  {
    classworkId, studentId,
    textAnswer, file, testAnswers, questions,
  }: {
    classworkId: string; studentId: string;
    textAnswer?: string | null;
    file?: File | null;
    testAnswers?: number[] | null;
    questions?: ClassworkQuestion[];
  },
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  let filePath: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;

  if (file) {
    const ext = file.name.split(".").pop() ?? "bin";
    filePath = `submissions/${classworkId}/${studentId}/${Date.now()}.${ext}`;
    const { error } = await db.storage.from("classwork-files").upload(filePath, file, { upsert: true });
    if (error) throw error;
    fileName = file.name;
    fileSize = file.size;
  }

  // Auto-score test
  let testScore: number | null = null;
  let testMax: number | null = null;
  if (testAnswers && questions && questions.length > 0) {
    testMax = questions.length;
    testScore = questions.reduce((sum, q, i) => sum + (testAnswers[i] === q.correct_index ? 1 : 0), 0);
  }

  const { error } = await db2.from("classwork_submissions").upsert(
    {
      classwork_id: classworkId,
      student_id: studentId,
      text_answer: textAnswer ?? null,
      file_storage_path: filePath,
      file_original_name: fileName,
      file_size_bytes: fileSize,
      test_answers: testAnswers ?? null,
      test_score: testScore,
      test_max: testMax,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "classwork_id,student_id" },
  );
  if (error) throw error;
};

/** Получить свою сдачу classwork (ученик). */
export const getMyClassworkSubmission = async (
  db: Db, classworkId: string,
): Promise<ClassworkSubmission | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any).from("classwork_submissions")
    .select("*").eq("classwork_id", classworkId).maybeSingle();
  return (data as ClassworkSubmission | null) ?? null;
};

/** Все сдачи classwork для учителя. */
export const getClassworkSubmissions = async (
  db: Db, classworkId: string, groupStudents: Array<{ id: string; full_name: string; avatar_url: string | null }>,
): Promise<ClassworkSubmissionWithStudent[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any).from("classwork_submissions")
    .select("*").eq("classwork_id", classworkId);
  const submissionsByStudent = new Map<string, ClassworkSubmission>();
  for (const s of ((data ?? []) as ClassworkSubmission[])) submissionsByStudent.set(s.student_id, s);
  return groupStudents.map((s) => ({
    ...(submissionsByStudent.get(s.id) ?? {
      id: "", classwork_id: classworkId, student_id: s.id,
      text_answer: null, file_storage_path: null, file_original_name: null, file_size_bytes: null,
      test_answers: null, test_score: null, test_max: null,
      submitted_at: "", grade: null, teacher_comment: null, graded_at: null, graded_by: null,
      is_demo: false,
    }),
    student: s,
  }));
};

/** Signed URL для файла из classwork-files bucket. */
export const getClassworkFileUrl = async (db: Db, storagePath: string): Promise<string> => {
  const { data, error } = await db.storage.from("classwork-files").createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data!.signedUrl;
};

/** Выставить оценку за классную работу (учитель). */
export const gradeClasswork = async (
  db: Db,
  { submissionId, teacherId, grade, comment }: {
    submissionId: string; teacherId: string; grade: number; comment: string;
  },
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("classwork_submissions").update({
    grade,
    teacher_comment: comment || null,
    graded_at: new Date().toISOString(),
    graded_by: teacherId,
  }).eq("id", submissionId);
  if (error) throw error;
};

// ─── LESSON EXCUSE REQUESTS (migration 30) ──────────────────────────────────────

/** Ученик отпрашивается с урока (только пока урок scheduled). */
export const createExcuseRequest = async (
  db: Db,
  lessonId: string,
  studentId: string,
  reason: string,
): Promise<{ id: string; created_at: string }> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  // Server-side guard in case RLS is bypassed: lesson must still be scheduled.
  const { data: lessonRow } = await db2.from("lessons").select("status").eq("id", lessonId).single();
  if (lessonRow && lessonRow.status !== "scheduled") {
    throw new Error("Урок уже начался — отпроситься нельзя");
  }
  const { data, error } = await db2.from("lesson_excuse_requests")
    .insert({ lesson_id: lessonId, student_id: studentId, reason: reason.trim() })
    .select("id, created_at").single();
  if (error) throw error;
  return data as { id: string; created_at: string };
};

/** Ученик отменяет свою заявку. */
export const deleteExcuseRequest = async (
  db: Db,
  lessonId: string,
  studentId: string,
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("lesson_excuse_requests")
    .delete().eq("lesson_id", lessonId).eq("student_id", studentId);
  if (error) throw error;
};

/** Своя заявка на отпрашивание (или null). */
export const getMyExcuseRequest = async (
  db: Db,
  lessonId: string,
  studentId: string,
): Promise<ExcuseRequest | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any).from("lesson_excuse_requests")
    .select("*").eq("lesson_id", lessonId).eq("student_id", studentId).maybeSingle();
  return (data as ExcuseRequest | null) ?? null;
};

/** Все отпросившиеся на уроке (для учителя) с именами учеников. */
export const getLessonExcuseRequests = async (
  db: Db,
  lessonId: string,
): Promise<ExcuseRequestWithStudent[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).from("lesson_excuse_requests")
    .select("*, student:students(id, full_name, avatar_url)")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ExcuseRequestWithStudent[];
};

// ─── LESSON RAISED HANDS (migration 30) ─────────────────────────────────────────

/** Ученик поднимает руку (только во время идущего урока). */
export const raiseHand = async (
  db: Db,
  lessonId: string,
  studentId: string,
): Promise<{ id: string; raised_at: string }> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).from("lesson_raised_hands")
    .insert({ lesson_id: lessonId, student_id: studentId })
    .select("id, raised_at").single();
  if (error) throw error;
  return data as { id: string; raised_at: string };
};

/** Учитель опускает руку ученику. */
export const lowerHand = async (
  db: Db,
  handId: string,
  teacherId: string,
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("lesson_raised_hands")
    .update({ lowered_at: new Date().toISOString(), lowered_by: teacherId })
    .eq("id", handId);
  if (error) throw error;
};

/** Активные (не опущенные) поднятые руки на уроке — для учителя, FIFO. */
export const getActiveRaisedHands = async (
  db: Db,
  lessonId: string,
): Promise<RaisedHandWithStudent[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).from("lesson_raised_hands")
    .select("*, student:students(id, full_name, avatar_url)")
    .eq("lesson_id", lessonId)
    .is("lowered_at", null)
    .order("raised_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RaisedHandWithStudent[];
};

/** Активная поднятая рука самого ученика (или null). */
export const getMyRaisedHand = async (
  db: Db,
  lessonId: string,
  studentId: string,
): Promise<RaisedHand | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any).from("lesson_raised_hands")
    .select("*").eq("lesson_id", lessonId).eq("student_id", studentId)
    .is("lowered_at", null).maybeSingle();
  return (data as RaisedHand | null) ?? null;
};

// ── Leave Requests (migration 47) ────────────────────────────────────────────

export const createLeaveRequest = async (
  db: Db,
  { studentId, lessonId, reason }: { studentId: string; lessonId: string; reason: string },
): Promise<LeaveRequest> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).from("leave_requests")
    .insert({ student_id: studentId, lesson_id: lessonId, reason })
    .select("*")
    .single();
  if (error) throw error;
  return data as LeaveRequest;
};

export const getStudentLeaveRequestForLesson = async (
  db: Db,
  studentId: string,
  lessonId: string,
): Promise<LeaveRequest | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any).from("leave_requests")
    .select("*")
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  return (data as LeaveRequest | null) ?? null;
};

export const getLeaveRequestsForLesson = async (
  db: Db,
  lessonId: string,
): Promise<LeaveRequestWithStudent[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).from("leave_requests")
    .select("*, student:students(id, full_name, avatar_url)")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LeaveRequestWithStudent[];
};

export const decideLeaveRequest = async (
  db: Db,
  leaveRequestId: string,
  teacherId: string,
  status: "approved" | "rejected",
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("leave_requests")
    .update({ status, decided_by: teacherId, decided_at: new Date().toISOString() })
    .eq("id", leaveRequestId);
  if (error) throw error;
};

export const cancelLeaveRequest = async (
  db: Db,
  leaveRequestId: string,
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("leave_requests")
    .delete()
    .eq("id", leaveRequestId);
  if (error) throw error;
};

// ─── STUDENT SCHEDULE QUERIES (iter3-p2b) ────────────────────────────────────

// Учитель урока = предметник (subjects.teacher_id, миграция 109);
// group.teacher (groups_teacher_id_fkey) — куратор, в UI используется
// только как fallback: l.subject?.teacher ?? l.group.teacher.
const LESSON_SUBJECT_SELECT =
  "id, group_id, title, topic, starts_at, ends_at, duration_minutes, room, status, " +
  "subject:subjects(id, name, icon, color, teacher:teachers!subjects_teacher_id_fkey(id, full_name)), " +
  "group:groups!inner(id, name, teacher:teachers!groups_teacher_id_fkey(id, full_name, avatar_url))";

/** Уроки ученика на конкретную дату (в Asia/Tashkent UTC+5).
 *  RLS уже ограничивает выборку группами ученика. studentId — опционально:
 *  parent-контекст сужает до ОДНОГО выбранного ребёнка (без него parent-RLS
 *  отдало бы объединение по группам всех детей). */
export async function getStudentLessonsForDate(
  db: Db,
  date: string,
  studentId?: string,
): Promise<LessonWithSubject[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (db as any)
    .from("lessons")
    .select(LESSON_SUBJECT_SELECT)
    .gte("starts_at", `${date}T00:00:00+05:00`)
    .lte("starts_at", `${date}T23:59:59+05:00`)
    .order("starts_at");
  if (studentId) {
    const groupIds = await getStudentGroupIds(db, studentId);
    query = query.in("group_id", groupIds.length > 0 ? groupIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LessonWithSubject[];
}

/** Уроки ученика за 7-дневную неделю начиная с weekStart (понедельник, YYYY-MM-DD). */
export async function getStudentLessonsForWeek(
  db: Db,
  weekStart: string,
  studentId?: string,
): Promise<LessonWithSubject[]> {
  // weekEnd = weekStart + 7 дней (исключительно). Парсим/пишем строго в UTC —
  // раньше парсинг шёл с +05:00, а d.getDate()/toISOString() читают/пишут в
  // UTC, так что 00:00+05:00 (=19:00 предыдущего UTC-дня) после +7 дней и
  // toISOString() всегда терял ровно 1 календарный день. Это ловило ровно
  // последний день недели — воскресенье — под .lt(starts_at, weekEnd):
  // граница падала на 00:00 воскресенья вместо 00:00 следующего понедельника,
  // и все воскресные уроки отсекались (суббота при этом не задевалась).
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  const weekEnd = d.toISOString().slice(0, 10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (db as any)
    .from("lessons")
    .select(LESSON_SUBJECT_SELECT)
    .gte("starts_at", `${weekStart}T00:00:00+05:00`)
    .lt("starts_at",  `${weekEnd}T00:00:00+05:00`)
    .order("starts_at");
  if (studentId) {
    const groupIds = await getStudentGroupIds(db, studentId);
    query = query.in("group_id", groupIds.length > 0 ? groupIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LessonWithSubject[];
}

/** Дата (YYYY-MM-DD в Asia/Tashkent) ближайшего будущего урока ученика.
 *  Возвращает null, если будущих уроков нет. */
export async function getNextStudentLessonDate(
  db: Db,
  afterDate: string,
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("lessons")
    .select("starts_at")
    .gt("starts_at", `${afterDate}T23:59:59+05:00`)
    .order("starts_at")
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const first = (data as Array<{ starts_at: string }>)[0];
  if (!first) return null;
  const utcMs = new Date(first.starts_at).getTime();
  const tashkentMs = utcMs + 5 * 60 * 60 * 1000;
  return new Date(tashkentMs).toISOString().slice(0, 10);
}
