/**
 * Доступ к данным — чистые функции, принимающие типизированный клиент `Db`.
 * Web и mobile создают свой клиент (с платформенным хранилищем) и передают сюда.
 * RLS гарантирует, что ученик получает только свои строки.
 */
import type { Db } from "../supabase/factory";
import type { AttendanceWithLesson, ContentType, Homework, HomeworkAttachment, HomeworkSource, HomeworkSubmission, HomeworkWithSubmission, TestAnswer, TestQuestion, TestQuestionOption, TestSubmission } from "../types";
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

// --- Материалы ---
export const getMaterials = (db: Db) =>
  db.from("course_materials").select("*").order("created_at", { ascending: false }).then(unwrap);

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
export const gradeSubmission = (
  db: Db,
  {
    submissionId,
    grade,
    comment,
  }: { submissionId: string; grade: number; comment: string },
) =>
  db
    .from("homework_submissions")
    .update({ grade, teacher_comment: comment, status: "graded" })
    .eq("id", submissionId)
    .then(unwrap);

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
