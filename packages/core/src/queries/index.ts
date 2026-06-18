/**
 * Доступ к данным — чистые функции, принимающие типизированный клиент `Db`.
 * Web и mobile создают свой клиент (с платформенным хранилищем) и передают сюда.
 * RLS гарантирует, что ученик получает только свои строки.
 */
import type { Db } from "../supabase/factory";
import type { AttendanceWithLesson, AttendanceStatus, Book, BookFavorite, ContentType, CourseMaterial, Homework, HomeworkAttachment, HomeworkSource, HomeworkSubmission, HomeworkWithSubmission, LessonDetail, LessonMaterial, LessonStage, LessonStagePublic, StageKey, StudentLessonView, SubmissionStatus, TeacherLessonView, TestAnswer, TestQuestion, TestQuestionOption, TestSubmission } from "../types";
import type { SubmissionInput, NotificationSettingsInput } from "../schemas";
import { unwrap } from "./helpers";

// --- Профиль / группы ---
export const getMyStudent = (db: Db) =>
  db.from("students").select("*").single().then(unwrap);

export const getMyGroups = (db: Db) =>
  db.from("groups").select("*").order("name").then(unwrap);

// --- Расписание / уроки / преподаватели ---
export const getLessons = (db: Db) =>
  db.from("lessons").select("*").order("starts_at", { ascending: true }).then(unwrap);

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

// --- Домашние задания ---

/** Все ДЗ для групп ученика + join группы + LEFT JOIN собственной сдачи (RLS). */
export const getHomeworkWithSubmissions = (db: Db) =>
  db
    .from("homework")
    .select("*, content_type, source, group:groups!inner(subject, name), submissions:homework_submissions(*), test_subs:test_submissions(*)")
    .order("due_date", { ascending: true })
    .then(unwrap)
    .then((rows) =>
      (rows as unknown as Array<{
        id: string; group_id: string; lesson_id: string | null; title: string;
        description: string | null; due_date: string | null; attachments: unknown;
        content_type: ContentType; source: HomeworkSource;
        teacher_id: string | null;
        attachment_storage_path: string | null;
        attachment_size_bytes: number | null;
        attachment_filename: string | null;
        created_at: string;
        group: { subject: string; name: string };
        submissions: HomeworkSubmission[];
        test_subs: TestSubmission[];
      }>).map((r) => ({
        ...r,
        attachments: (r.attachments ?? []) as HomeworkAttachment[],
        content_type: r.content_type ?? 'file',
        source: r.source ?? 'curriculum',
        submission: r.submissions?.[0] ?? null,
        test_submission: r.test_subs?.[0] ?? null,
        submissions: undefined,
        test_subs: undefined,
      } as HomeworkWithSubmission)),
    );

/** Одна запись ДЗ с join'ом и сдачей (для детальной страницы). */
export const getHomeworkById = (db: Db, id: string) =>
  db
    .from("homework")
    .select("*, content_type, source, group:groups!inner(subject, name), submissions:homework_submissions(*), test_subs:test_submissions(*)")
    .eq("id", id)
    .single()
    .then(unwrap)
    .then((r) => {
      const raw = r as unknown as {
        id: string; group_id: string; lesson_id: string | null; title: string;
        description: string | null; due_date: string | null; attachments: unknown;
        content_type: ContentType; source: HomeworkSource;
        teacher_id: string | null;
        attachment_storage_path: string | null;
        attachment_size_bytes: number | null;
        attachment_filename: string | null;
        created_at: string;
        group: { subject: string; name: string };
        submissions: HomeworkSubmission[];
        test_subs: TestSubmission[];
      };
      return {
        ...raw,
        attachments: (raw.attachments ?? []) as HomeworkAttachment[],
        content_type: raw.content_type ?? 'file',
        source: raw.source ?? 'curriculum',
        submission: raw.submissions?.[0] ?? null,
        test_submission: raw.test_subs?.[0] ?? null,
        submissions: undefined,
        test_subs: undefined,
      } as HomeworkWithSubmission;
    });

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

/** Signed URL на 1 час. Если передан downloadAs — URL принудительно скачивает
 *  файл (Supabase ставит Content-Disposition: attachment с этим именем). */
export const getMaterialDownloadUrl = (
  db: Db,
  storagePath: string,
  downloadAs?: string,
) =>
  db.storage
    .from("materials")
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
export const getPayments = (db: Db) =>
  db.from("payments").select("*").order("paid_at", { ascending: false }).then(unwrap);

export const getCharges = (db: Db) =>
  db.from("charges").select("*").order("charged_at", { ascending: false }).then(unwrap);

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
  return (data as TestSubmission | null);
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

/** Оценки в группах учителя (RLS ограничивает своими). group_id + score для агрегации. */
export const getTeacherGrades = (db: Db) =>
  db.from("grades").select("group_id, score").then(unwrap);

/** Посещаемость в группах учителя — статус + group_id урока (для % по группе). */
export const getTeacherAttendance = (db: Db) =>
  db
    .from("attendance")
    .select("status, lesson:lessons!inner(group_id)")
    .then(unwrap);

// --- Этап 2: Оценки и прогресс ---

/** Одна оценка ученика (файл или тест), нормализованная для журнала. */
export type StudentGradeItem = {
  id: string;
  kind: "file" | "test";
  title: string;
  subject: string;
  groupName: string;
  date: string; // submitted_at (дата работы)
  grade5: number | null; // нормировано к /5 для средних
  display: string; // "4/5" или "85/100"
  comment: string | null;
};

type HwJoin = { title: string; content_type: string; group: { subject: string; name: string } | null };

/** Все оценённые работы текущего ученика (RLS отдаёт только свои). */
export const getStudentGrades = async (db: Db): Promise<StudentGradeItem[]> => {
  // NB: не выбираем graded_at — экран ученика не должен зависеть от миграции 19
  // на hosted. Дата работы = submitted_at (для seed практически совпадает).
  const fileSel =
    "id, grade, teacher_comment, submitted_at, homework:homework!inner(title, content_type, group:groups!inner(subject, name))";
  const testSel =
    "id, score, max_score, submitted_at, homework:homework!inner(title, content_type, group:groups!inner(subject, name))";
  const [fileRes, testRes] = await Promise.all([
    db.from("homework_submissions").select(fileSel).not("grade", "is", null),
    db.from("test_submissions").select(testSel).not("score", "is", null),
  ]);

  const items: StudentGradeItem[] = [];
  for (const r of (fileRes.data ?? []) as unknown as Array<{
    id: string; grade: number; teacher_comment: string | null; submitted_at: string; homework: HwJoin | null;
  }>) {
    items.push({
      id: r.id, kind: "file",
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
    id: string; score: number; max_score: number | null; submitted_at: string; homework: HwJoin | null;
  }>) {
    const max = r.max_score ?? 0;
    items.push({
      id: r.id, kind: "test",
      title: r.homework?.title ?? "",
      subject: r.homework?.group?.subject ?? "",
      groupName: r.homework?.group?.name ?? "",
      date: r.submitted_at,
      grade5: max > 0 ? (r.score / max) * 5 : null,
      display: `${r.score}/${max || "?"}`,
      comment: null,
    });
  }
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

/** Создать ДЗ (file или test). Returns created homework record. */
export const createTeacherHomework = async (
  db: Db,
  input: {
    groupId: string;
    title: string;
    description: string;
    dueDate: string;
    contentType: "file" | "test";
    teacherId: string;
    lessonId?: string | null;
    status?: "draft" | "published";
  },
) => {
  const { data, error } = await db
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
  for (const q of questions) {
    const { data: qRow, error: qErr } = await db
      .from("test_questions")
      .insert({
        homework_id: homeworkId,
        question_text: q.questionText,
        question_type: q.questionType,
        order_index: q.orderIndex,
      })
      .select("id")
      .single();
    if (qErr) throw qErr;
    const qId = (qRow as unknown as { id: string }).id;
    if (q.questionType === "single_choice" && q.options?.length) {
      const { error: oErr } = await db.from("test_question_options").insert(
        q.options.map((o) => ({
          question_id: qId,
          option_text: o.optionText,
          is_correct: o.isCorrect,
          order_index: o.orderIndex,
        })),
      );
      if (oErr) throw oErr;
    }
  }
};

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
  return data ?? [];
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

/** Обновить профиль учителя. */
export const updateTeacherProfile = (
  db: Db,
  { teacherId, fullName }: { teacherId: string; fullName: string },
) =>
  db.from("teachers").update({ full_name: fullName }).eq("id", teacherId).then(unwrap);

/** Тип ответа для submitTest. */
export type TestAnswerInput = {
  questionId: string;
  selectedOptionId?: string;
  openText?: string;
};

/** Сдача теста: auto-score single_choice, create submission + answers. */
export const submitTest = async (
  db: Db,
  input: { homeworkId: string; studentId: string; answers: TestAnswerInput[] },
): Promise<TestSubmission> => {
  const { homeworkId, studentId, answers } = input;

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

  // Создать test_submission
  const { data: sub, error: subErr } = await db
    .from("test_submissions")
    .insert({ homework_id: homeworkId, student_id: studentId, score, max_score: singleChoiceCount })
    .select("*")
    .single();
  if (subErr) throw subErr;
  const submissionId = (sub as unknown as { id: string }).id;

  // Создать test_answers
  if (answerRows.length > 0) {
    const { error: ansErr } = await db
      .from("test_answers")
      .insert(answerRows.map(a => ({ ...a, submission_id: submissionId })));
    if (ansErr) throw ansErr;
  }

  return sub as unknown as TestSubmission;
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
): Promise<Array<{ id: string; starts_at: string; topic: string | null; lesson_no: number | null }>> => {
  const { data, error } = await db
    .from("lessons")
    .select("id, starts_at, topic, lesson_no")
    .eq("group_id", groupId)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; starts_at: string; topic: string | null; lesson_no: number | null }>;
};

// ─── LESSON MODULE (migration 24) ────────────────────────────────────────────

const STAGE_ORDER: Record<StageKey, number> = {
  goal: 1, theory: 2, practice: 3, classwork: 4, review: 5, summary: 6,
};
const REQUIRED_STAGES: StageKey[] = ["goal", "summary"];

/** Полное представление урока для учителя — включает teacher_notes в stages. */
export const getTeacherLessonView = async (
  db: Db,
  lessonId: string,
): Promise<TeacherLessonView | null> => {
  const { data: lessonRaw, error: lessonErr } = await db
    .from("lessons")
    .select("id, group_id, lesson_no, topic, title, description, starts_at, ends_at, started_at, ended_at, status, room, group:groups!inner(id, name, subject, teacher_id)")
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonErr) throw lessonErr;
  if (!lessonRaw) return null;

  const lesson = lessonRaw as unknown as {
    id: string; group_id: string; lesson_no: number | null; topic: string | null;
    title: string | null; description: string | null;
    starts_at: string; ends_at: string | null;
    started_at: string | null; ended_at: string | null; status: string;
    room: string | null;
    group: { id: string; name: string; subject: string; teacher_id: string | null };
  };

  const teacherId = lesson.group.teacher_id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const [teacherRes, materialsRes, stagesRes] = await Promise.all([
    teacherId
      ? db.from("teachers").select("id, full_name").eq("id", teacherId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db2.from("lesson_materials").select("*").eq("lesson_id", lessonId).order("created_at"),
    db2.from("lesson_stages").select("*").eq("lesson_id", lessonId).order("order_index"),
  ]);

  const { teacher_id: _tid, ...groupData } = lesson.group;
  return {
    id: lesson.id, group_id: lesson.group_id, lesson_no: lesson.lesson_no,
    topic: lesson.topic, title: lesson.title, description: lesson.description,
    starts_at: lesson.starts_at, ends_at: lesson.ends_at,
    started_at: lesson.started_at, ended_at: lesson.ended_at,
    status: lesson.status as TeacherLessonView["status"],
    room: lesson.room,
    group: groupData,
    teacher: (teacherRes.data as { id: string; full_name: string } | null),
    materials: ((materialsRes as { data: unknown[] | null }).data ?? []) as LessonMaterial[],
    stages: ((stagesRes as { data: unknown[] | null }).data ?? []) as LessonStage[],
  };
};

/** Представление урока для ученика — без поля teacher_notes в stages. */
export const getStudentLessonView = async (
  db: Db,
  lessonId: string,
): Promise<StudentLessonView | null> => {
  const { data: lessonRaw, error: lessonErr } = await db
    .from("lessons")
    .select("id, group_id, lesson_no, topic, title, description, starts_at, ends_at, started_at, ended_at, status, room, group:groups!inner(id, name, subject, teacher_id)")
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonErr) throw lessonErr;
  if (!lessonRaw) return null;

  const lesson = lessonRaw as unknown as {
    id: string; group_id: string; lesson_no: number | null; topic: string | null;
    title: string | null; description: string | null;
    starts_at: string; ends_at: string | null;
    started_at: string | null; ended_at: string | null; status: string;
    room: string | null;
    group: { id: string; name: string; subject: string; teacher_id: string | null };
  };

  const teacherId = lesson.group.teacher_id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db3 = db as any;
  const [teacherRes, materialsRes, stagesRes] = await Promise.all([
    teacherId
      ? db.from("teachers").select("id, full_name").eq("id", teacherId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db3.from("lesson_materials").select("id, lesson_id, title, file_storage_path, file_size_bytes, file_original_name, uploaded_by, created_at").eq("lesson_id", lessonId).order("created_at"),
    db3.from("lesson_stages").select("id, lesson_id, stage_key, order_index, is_completed, completed_at").eq("lesson_id", lessonId).order("order_index"),
  ]);

  const { teacher_id: _tid, ...groupData } = lesson.group;
  return {
    id: lesson.id, group_id: lesson.group_id, lesson_no: lesson.lesson_no,
    topic: lesson.topic, title: lesson.title, description: lesson.description,
    starts_at: lesson.starts_at, ends_at: lesson.ends_at,
    started_at: lesson.started_at, ended_at: lesson.ended_at,
    status: lesson.status as StudentLessonView["status"],
    room: lesson.room,
    group: groupData,
    teacher: (teacherRes.data as { id: string; full_name: string } | null),
    materials: ((materialsRes as { data: unknown[] | null }).data ?? []) as LessonMaterial[],
    stages: ((stagesRes as { data: unknown[] | null }).data ?? []) as LessonStagePublic[],
  };
};

/** Обновляет поля урока (учитель): title, description, starts_at, ends_at, room. */
export const updateLesson = async (
  db: Db,
  lessonId: string,
  patch: {
    title?: string | null;
    description?: string | null;
    starts_at?: string;
    ends_at?: string | null;
    room?: string | null;
    group_id?: string;
  },
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("lessons").update(patch).eq("id", lessonId);
  if (error) throw error;
};

/** Создаёт новый урок в группе учителя. */
export const createLesson = async (
  db: Db,
  input: {
    groupId: string;
    startsAt: string;
    endsAt: string | null;
    room: string | null;
    title: string | null;
    description: string | null;
  },
): Promise<{ id: string }> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { data, error } = await db2
    .from("lessons")
    .insert({
      group_id: input.groupId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      room: input.room,
      title: input.title,
      description: input.description,
      topic: null,
      status: "scheduled",
    })
    .select("id")
    .single();
  if (error) throw error;
  const created = data as { id: string };
  // Goal stage created + pre-completed at lesson creation time
  await db2.from("lesson_stages").upsert(
    { lesson_id: created.id, stage_key: "goal", order_index: 1, is_completed: true, completed_at: new Date().toISOString() },
    { onConflict: "lesson_id,stage_key", ignoreDuplicates: true },
  );
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
  input: { lessonId: string; teacherId: string; file: File; title: string },
): Promise<LessonMaterial> => {
  const materialId = crypto.randomUUID();
  const ext = input.file.name.split(".").pop() ?? "bin";
  const path = `${input.teacherId}/${input.lessonId}/${materialId}/${input.file.name}`;
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
    })
    .select("*")
    .single();
  if (insertErr) throw insertErr;
  void ext; // suppress unused
  return data as LessonMaterial;
};

/** Удаляет материал из Storage и БД. */
export const deleteLessonMaterial = async (
  db: Db,
  materialId: string,
  storagePath: string,
): Promise<void> => {
  await db.storage.from("lesson-materials").remove([storagePath]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("lesson_materials").delete().eq("id", materialId);
  if (error) throw error;
};

/** Signed URL (1 час) для скачивания материала урока. */
export const getLessonMaterialUrl = async (
  db: Db,
  storagePath: string,
  downloadAs?: string,
): Promise<string> => {
  const { data, error } = await db.storage
    .from("lesson-materials")
    .createSignedUrl(storagePath, 3600, downloadAs ? { download: downloadAs } : undefined);
  if (error) throw error;
  return data!.signedUrl;
};

/** Включает или выключает опциональный этап урока. goal и summary нельзя убрать. */
export const setStageEnabled = async (
  db: Db,
  lessonId: string,
  stageKey: StageKey,
  enabled: boolean,
): Promise<void> => {
  if (REQUIRED_STAGES.includes(stageKey)) return; // guard

  if (enabled) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db as any).from("lesson_stages").insert({
      lesson_id: lessonId,
      stage_key: stageKey,
      order_index: STAGE_ORDER[stageKey],
      is_completed: false,
    });
    // Ignore unique violation (already exists)
    if (error && error.code !== "23505") throw error;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db as any)
      .from("lesson_stages")
      .delete()
      .eq("lesson_id", lessonId)
      .eq("stage_key", stageKey);
    if (error) throw error;
  }
};

/** Помечает этап выполненным / невыполненным. */
export const setStageCompleted = async (
  db: Db,
  lessonId: string,
  stageKey: StageKey,
  isCompleted: boolean,
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from("lesson_stages")
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq("lesson_id", lessonId)
    .eq("stage_key", stageKey);
  if (error) throw error;
};

/** Обновляет заметки учителя для этапа. */
export const setStageNotes = async (
  db: Db,
  lessonId: string,
  stageKey: StageKey,
  notes: string,
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any)
    .from("lesson_stages")
    .update({ teacher_notes: notes || null })
    .eq("lesson_id", lessonId)
    .eq("stage_key", stageKey);
  if (error) throw error;
};

/** Создаёт обязательные этапы (goal + summary), если их нет. Идемпотентно. */
export const initLessonStages = async (db: Db, lessonId: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("lesson_stages").upsert(
    REQUIRED_STAGES.map((key) => ({
      lesson_id: lessonId,
      stage_key: key,
      order_index: STAGE_ORDER[key],
      is_completed: false,
    })),
    { onConflict: "lesson_id,stage_key", ignoreDuplicates: true },
  );
  if (error) throw error;
};

type TeacherLessonListItem = {
  id: string; group_id: string; lesson_no: number | null; topic: string | null;
  title: string | null; starts_at: string; ends_at: string | null; room: string | null;
  status: string; started_at: string | null; ended_at: string | null;
  group: { id: string; name: string; subject: string };
};

/** Все уроки в группах учителя — для страницы /teacher/lessons. */
export const getTeacherAllLessons = async (db: Db): Promise<TeacherLessonListItem[]> => {
  const { data, error } = await db
    .from("lessons")
    .select("id, group_id, lesson_no, topic, title, starts_at, ends_at, started_at, ended_at, status, room, group:groups!inner(id, name, subject)")
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TeacherLessonListItem[];
};

/** Переводит урок в статус 'in_progress', автоматически завершает этап goal. */
export const startLesson = async (db: Db, lessonId: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { error } = await db2.from("lessons")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) throw error;
  await db2.from("lesson_stages").upsert(
    { lesson_id: lessonId, stage_key: "goal", order_index: 1, is_completed: true, completed_at: new Date().toISOString() },
    { onConflict: "lesson_id,stage_key", ignoreDuplicates: false },
  );
  await db2.from("lesson_stages").upsert(
    { lesson_id: lessonId, stage_key: "summary", order_index: 6, is_completed: false },
    { onConflict: "lesson_id,stage_key", ignoreDuplicates: true },
  );
};

/** Завершает урок: статус 'completed', итог-этап отмечается выполненным. */
export const endLesson = async (db: Db, lessonId: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db2 = db as any;
  const { error } = await db2.from("lessons")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) throw error;
  await db2.from("lesson_stages").upsert(
    { lesson_id: lessonId, stage_key: "summary", order_index: 6, is_completed: true, completed_at: new Date().toISOString() },
    { onConflict: "lesson_id,stage_key", ignoreDuplicates: false },
  );
};

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

/** Signed URL для скачивания книги (1 час). */
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
export const getHomeworkAttachmentUrl = async (
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

/** Delete teacher attachment from Storage + clear homework columns. */
export const deleteHomeworkAttachment = async (
  db: Db,
  homeworkId: string,
  storagePath: string,
) => {
  await db.storage.from("homework-files").remove([storagePath]);
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
