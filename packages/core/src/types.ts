/**
 * Доменные типы (snake_case — как возвращает Supabase). Совпадают со схемой
 * миграций в supabase/migrations. Используются в queries и в UI обоих приложений.
 *
 * Важно: это `type`-алиасы, а не `interface` — иначе postgrest-js не принимает
 * их как Row/Insert (interface не удовлетворяет ограничению Record<string, unknown>).
 */

export type StudentStatus = "active" | "debtor" | "frozen";
export type LessonStatus = "scheduled" | "in_progress" | "completed";
export type AttendanceStatus = "present" | "absent_excused" | "absent_unexcused";
export type SubmissionStatus = "in_progress" | "submitted" | "checking" | "graded";
export type PaymentStatus = "completed" | "pending" | "canceled";
export type PaymentKind = "subscription" | "one_time";

export type Teacher = {
  id: string;
  user_id: string | null;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
};

export type Student = {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  grade: string | null;
  avatar_url: string | null;
  status: StudentStatus;
  balance: number;
  curator_id: string | null;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  subject: string;
  teacher_id: string | null;
  created_at: string;
};

export type Subject = {
  id: string;
  name: string;
  group_id: string;
  teacher_id: string | null;
  icon: string;
  color: string;
  created_at: string;
  updated_at: string;
};

export type SubjectWithGroup = Subject & {
  group: { id: string; name: string };
  teacher: { id: string; full_name: string } | null;
};

/** Урок с join'ами на subject и teacher (для экрана расписания). */
export type LessonWithSubject = {
  id: string;
  group_id: string;
  title: string | null;
  topic: string | null;
  starts_at: string;
  ends_at: string | null;
  duration_minutes: number | null;
  room: string | null;
  status: LessonStatus;
  subject: { id: string; name: string; icon: string; color: string } | null;
  group: {
    id: string;
    name: string;
    teacher: { id: string; full_name: string; avatar_url: string | null } | null;
  };
};

export type StudentGroup = {
  student_id: string;
  group_id: string;
};

export type Lesson = {
  id: string;
  group_id: string;
  subject_id?: string | null;   // added in migration 53
  lesson_no: number | null;
  topic: string | null;
  title?: string | null;        // added in migration 24
  description?: string | null;  // added in migration 24
  starts_at: string;
  ends_at: string | null;
  started_at?: string | null;   // added in migration 26
  ended_at?: string | null;     // added in migration 26
  room: string | null;
  online_url: string | null;
  materials_link: string | null;
  status: LessonStatus;
  created_at: string;
};

// ── Lesson stages v2 (migration 35) ──────────────────────────────────────────
export type LessonStageRole = 'start' | 'middle' | 'summary';
export type LessonStageType = 'theory' | 'task';
export type LessonContentType =
  | 'presentation' | 'code'
  | 'wokwi' | 'codesandbox'
  | 'geogebra' | 'phet' | 'desmos' | 'blockly_games' | 'visualgo'
  | 'p5js' | 'excalidraw' | 'learningapps' | 'sqlonline' | 'h5p'
  | 'quiz_qia' | 'quiz_kahoot';

// Сложность этапа (migration 55) — задаётся учителем или ИИ-генератором.
export type StageDifficulty = 'easy' | 'medium' | 'hard';

export type LessonStage = {
  id: string;
  lesson_id: string;
  position: number;
  stage_role: LessonStageRole;
  stage_type: LessonStageType | null;
  content_type: LessonContentType | null;
  title: string;
  description: string | null;
  config: Record<string, unknown>;
  // migration 55
  difficulty: StageDifficulty;
  duration_min: number | null;   // длительность в минутах; видна только учителю
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  // migration 59 — только для учителя, никогда не показывать ученику
  teacher_notes?: string | null;
  // migration 60 — слайды презентации для этапа теории
  slides?: LessonSlide[] | null;
  // migration 61 — синхронный показ: какой слайд сейчас открыт (управляет учитель)
  current_slide_index?: number;
  // migration 62 — code-этапы: раньше жили только в config, теперь top-level
  // (видны ученику, включая demo-этапы с stage_type='theory')
  starter_code?: string | null;
  programming_language?: string | null;
  expected_output?: string | null;
  // migration 64 — live coding: учитель транслирует код в реальном времени
  live_code?: string | null;
  is_live_active?: boolean | null;
  // migration 110 — демо-сессия не может редактировать реальные (is_demo=false) этапы
  is_demo: boolean;
};

export type LessonSlideLayout = "title" | "split" | "quote" | "code" | "default";

export type LessonSlideCode = {
  language: "python" | "javascript" | "typescript" | "cpp" | "html" | "css";
  content: string;
};

export type LessonSlideQuote = {
  text: string;
  author?: string;
};

/** Слайд презентации (этап теории). Хранится в lesson_stages.slides (jsonb). */
export type LessonSlide = {
  layout?: LessonSlideLayout;
  title: string;
  content: string;
  image_url?: string;
  image_prompt?: string;
  code?: LessonSlideCode;
  quote?: LessonSlideQuote;
};

export type LessonStageProgress = {
  id: string;
  stage_id: string;
  student_id: string;
  is_completed: boolean;
  completed_at: string | null;
  submission_data: unknown | null;
  grade: number | null;
  teacher_comment: string | null;
  graded_at: string | null;
  graded_by: string | null;
};

export type LessonStageWithProgress = LessonStage & {
  progress: LessonStageProgress | null;
};

// Execution: python → Pyodide, javascript → sandboxed iframe, cpp → JSCPP
// (all client-side, see apps/web/lib/code-runner.ts — Piston/emkc.org went
// whitelist-only 2026-02-15 and is no longer used anywhere). 'java' has no
// browser runtime commissioned; code-runner.ts returns a clear "not
// supported" result for it. 'html' (УЧ.11 Part 4) never reaches code-runner
// at all — it renders as a live srcdoc iframe preview instead. Kept in the
// same union so the language selector, Monaco editor, and default-snippet
// lookups stay a single exhaustive list.
export type CodeLanguage = 'python' | 'javascript' | 'cpp' | 'java' | 'html';

/** Stored in lesson_stages.config for content_type='code' (Prompt 4). */
export type CodeStageConfig = {
  language: CodeLanguage;
  starter_code: string;
  expected_output?: string;
};

/** Stored in lesson_stage_progress.submission_data for code task stages. */
export type CodeSubmission = {
  code: string;
  stdin: string;
  last_output: string;
  language: CodeLanguage;
};

export type ExternalServiceType =
  | 'wokwi' | 'codesandbox'
  | 'geogebra' | 'phet' | 'desmos' | 'blockly_games' | 'visualgo'
  | 'p5js' | 'excalidraw' | 'learningapps' | 'sqlonline' | 'h5p';

/** Stored in lesson_stages.config for external-service stages. */
export interface ExternalServiceConfig {
  url: string;                   // original project link the teacher entered
  embed_url?: string | null;     // computed embed URL
  requires_link?: boolean;
  requires_screenshot?: boolean;
}

/** Stored in lesson_stage_progress.submission_data for external-service stages. */
export interface ExternalServiceSubmission {
  link?: string;                 // student's link to their own project (optional)
  screenshot_path?: string;      // storage path of an uploaded screenshot
  last_opened_at?: string;       // when the student opened the external service
}

// ── Quizzes: QIA test + Kahoot game (migration 39, Prompt 6) ─────────────────
export type KahootStatus = 'lobby' | 'question_active' | 'question_revealed' | 'finished';

export type QuizQuestion = {
  id: string;
  stage_id: string;
  position: number;
  question_text: string;
  options: string[];
  correct_option_index: number;
  points: number;
  time_per_question_seconds: number;
};

export type QuizAttempt = {
  id: string;
  stage_id: string;
  student_id: string;
  started_at: string;
  finished_at: string | null;
  total_questions: number;
  correct_count: number;
  total_score: number;
  is_finalized: boolean;
};

export type QuizAnswer = {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option_index: number | null;
  is_correct: boolean | null;
  answered_at: string;
  response_time_ms: number | null;
  score: number;
};

export type KahootSession = {
  id: string;
  stage_id: string;
  started_at: string | null;
  finished_at: string | null;
  current_question_index: number;
  question_started_at: string | null;
  status: KahootStatus;
};

/** Stored in lesson_stages.config for content_type='quiz_qia' / 'quiz_kahoot'. */
export type QuizConfigForStage = {
  time_limit_minutes?: number;     // QIA optional countdown
  questions_per_attempt?: number;  // QIA: all or N random (not used in MVP)
  points_per_question?: number;    // QIA: points multiplier (default 1)
};

export type QuizLeaderboardEntry = {
  student_id: string;
  full_name: string;
  total_score: number;
  correct_count: number;
};

/** Input for a single quiz question in the teacher builder. */
export type QuizQuestionInput = {
  question_text: string;
  options: string[];
  correct_option_index: number;
  points?: number;
  time_per_question_seconds?: number;
};

export type LessonMaterial = {
  id: string;
  lesson_id: string;
  title: string;
  file_storage_path: string;
  file_size_bytes: number | null;
  file_original_name: string | null;
  uploaded_by: string | null;
  created_at: string;
  visibility: 'all' | 'teacher_only';
  // migration 110 — демо-сессия не может удалить реальный (is_demo=false) материал
  is_demo: boolean;
  // migration 115 — файл линкован из Базы знаний (course_materials/books),
  // не загружен заново; kb_bucket — какой Storage-бакет резолвить/НЕ трогать при удалении.
  from_knowledge_base: boolean;
  kb_bucket: 'materials' | 'books' | null;
};

// migration 116 — Промт 4: учебные планы. teacher_id/group_id/subject_id
// как в БД; UNIQUE(group_id, subject_id) на стороне БД, не в типе.
export type CurriculumPlan = {
  id: string;
  group_id: string;
  subject_id: string;
  teacher_id: string;
  school_id: string;
  title: string;
  source_file_url: string | null;
  source_file_type: 'pdf' | 'docx' | null;
  created_at: string;
};

export type CurriculumPlanTopic = {
  id: string;
  plan_id: string;
  order_index: number;
  title: string;
  description: string | null;
  estimated_lessons: number;
};

/** curriculum_plans + вложенные topics (order_index asc) + производные поля
 *  для UI (group/subject имена, счётчик уроков на группу+предмет). */
export type CurriculumPlanWithTopics = CurriculumPlan & {
  topics: CurriculumPlanTopic[];
  group_name?: string;
  subject_name?: string;
};

/** Тема плана + сколько существующих (будущих) уроков уже используют её —
 *  для селектора темы в форме создания урока ("использована в N уроках"). */
export type CurriculumTopicWithUsage = CurriculumPlanTopic & {
  used_in_lessons: number;
};

// migration 118 — Промт 5Б: сохранённые проекты песочницы. service_id —
// 'python'|'cpp' (языки CodeSandbox) сейчас; 12 iframe-id из SANDBOX_TOOLS
// зарезервированы в БД на будущее, UI в этом промте их не пишет.
export type SandboxProject = {
  id: string;
  student_id: string;
  school_id: string;
  name: string;
  service_id: string;
  code: string | null;
  external_url: string | null;
  is_autosave: boolean;
  created_at: string;
  updated_at: string;
};


export type TeacherLessonView = {
  id: string;
  group_id: string;
  lesson_no: number | null;
  topic: string | null;
  title: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: LessonStatus;
  room: string | null;
  active_stage_id: string | null;
  demo_material_id: string | null;
  subjectName: string | null;
  subjectIcon: string | null;
  subjectColor: string | null;
  group: { id: string; name: string; subject: string };
  teacher: { id: string; full_name: string } | null;
  materials: LessonMaterial[];
  stages: LessonStage[];
};

export type StudentLessonView = {
  id: string;
  group_id: string;
  lesson_no: number | null;
  topic: string | null;
  title: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  subjectName: string | null;
  subjectIcon: string | null;
  subjectColor: string | null;
  status: LessonStatus;
  room: string | null;
  active_stage_id: string | null;
  demo_material_id: string | null;
  group: { id: string; name: string; subject: string };
  teacher: { id: string; full_name: string } | null;
  materials: LessonMaterial[];
  stages: LessonStageWithProgress[];
};

export type Attendance = {
  id: string;
  student_id: string;
  lesson_id: string;
  status: AttendanceStatus;
  recorded_at: string;
};

/** Joined тип для экрана посещаемости (attendance + lessons + groups). */
export type AttendanceWithLesson = {
  id: string;
  student_id: string;
  lesson_id: string;
  status: AttendanceStatus;
  recorded_at: string;
  lesson: {
    starts_at: string;
    ends_at: string | null;
    group_id: string;
    topic: string | null;
    group: {
      id: string;
      subject: string;
    };
  };
};

/** Строка переклички для экрана учителя — студент + его статус посещаемости. */
export type AttendanceRollCallRow = {
  student_id: string;
  full_name: string;
  status: AttendanceStatus | null; // null = ещё не отмечен
  marked_at: string | null;
  is_finalized: boolean;
  // migration 110 — null = записи ещё нет (демо-отметка разрешена — создание);
  // false = реальная запись, демо-сессии её перезаписывать нельзя.
  is_demo: boolean | null;
};

export type HomeworkAttachment = {
  name: string;
  url: string;
};

export type Homework = {
  id: string;
  group_id: string;
  lesson_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  attachments: HomeworkAttachment[];
  created_at: string;
};

export type HomeworkSubmission = {
  id: string;
  homework_id: string;
  student_id: string;
  submitted_at: string;
  file_url: string | null;
  file_storage_path: string | null;
  file_size_bytes: number | null;
  file_original_name: string | null;
  answer_text: string | null;
  code_text: string | null;       // migration 32 (programming submissions)
  grade: number | null;
  teacher_comment: string | null;
  status: SubmissionStatus;
};

/** Homework с join'ом группы и опциональной сдачей студента. */
// content_type: the 4 "native" homework kinds plus the 12 SERVICE_CONFIG
// external services (migration 95, УЧ.10) — each rendered as an iframe using
// homework.external_url, the same SERVICE_CONFIG the lesson stages use.
export type ContentType = 'file' | 'test' | 'programming' | 'bundle' | ExternalServiceType;
export type ProgrammingLanguage = CodeLanguage;
export type HomeworkSource = 'curriculum' | 'teacher';

// ─── BUNDLE HOMEWORK (migration 87) ────────────────────────────────────────
// content_type='bundle': 1+ subtasks of mixed types, solved independently,
// graded as one whole via the existing gradeSubmission() (grade+comment live
// on homework_submissions, same as file/programming — no per-subtask grade).

// 'scratch' was removed (migration 95, УЧ.10) in favor of the 12
// SERVICE_CONFIG external services, so a bundle subtask can embed the same
// iframe services a top-level homework or lesson stage can.
export type HomeworkSubtaskType = 'file' | 'test' | 'code' | ExternalServiceType;

export type HomeworkSubtask = {
  id: string;
  homework_id: string;
  order_index: number;
  type: HomeworkSubtaskType;
  title: string;
  description: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type HomeworkSubtaskSubmission = {
  id: string;
  submission_id: string;
  subtask_id: string;
  content: Record<string, unknown>;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

export type TestQuestionOption = {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  order_index: number;
};

export type TestQuestion = {
  id: string;
  homework_id: string;
  question_text: string;
  question_type: 'single_choice' | 'open';
  order_index: number;
  options: TestQuestionOption[];
};

export type TestSubmission = {
  id: string;
  homework_id: string;
  student_id: string;
  submitted_at: string;
  score: number | null;
  max_score: number | null;
  started_at: string | null;   // migration 31: set when the student begins
  grade: number | null;        // migration 31: discrete auto-grade 2..5
};

export type TestAnswer = {
  id: string;
  submission_id: string;
  question_id: string;
  selected_option_id: string | null;
  open_text: string | null;
  is_correct: boolean | null;
};

export type HomeworkWithSubmission = {
  id: string;
  group_id: string;
  lesson_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  attachments: HomeworkAttachment[];
  created_at: string;
  content_type: ContentType;
  source: HomeworkSource;
  teacher_id: string | null;
  attachment_storage_path: string | null;
  attachment_size_bytes: number | null;
  attachment_filename: string | null;
  external_url: string | null; // migration 95 (external-service homework types)
  test_duration_seconds: number | null; // migration 31 (test type)
  test_auto_grade: boolean;             // migration 31 (test type)
  programming_language: ProgrammingLanguage | null; // migration 32
  starter_code: string | null;
  expected_output: string | null;
  tests_attachment_path: string | null;
  tests_attachment_filename: string | null;
  tests_attachment_size_bytes: number | null;
  hint_storage_path: string | null;   // БОЛЬШОЕ ОБНОВЛЕНИЕ §8 — image/PDF hint, migration 104
  hint_filename: string | null;
  hint_mime_type: string | null;
  subject_id: string | null;          // migration 107 — real subject, group.subject is a placeholder
  subjectName: string | null;         // resolved via subject_id → subjects.name, migration 107
  subjectIcon: string | null;         // resolved via subject_id → subjects.icon
  subjectColor: string | null;        // resolved via subject_id → subjects.color
  group: { subject: string; name: string };
  submission: HomeworkSubmission | null;
  test_submission: TestSubmission | null;
  subtasks?: HomeworkSubtask[];               // bundle only, populated by getHomeworkById
};

// ── Projects (migration 33) ─────────────────────────────────────────
export type Project = {
  id: string;
  group_id: string;
  subject: string;
  title: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  deadline: string | null;
  cover_image_path: string | null;
};
export type ProjectStage = {
  id: string;
  project_id: string;
  position: number;
  title: string;
  description: string | null;
};
export type ProjectSubmission = {
  id: string;
  project_id: string;
  student_id: string;
  is_submitted: boolean;
  submitted_at: string | null;
  grade: number | null;
  teacher_comment: string | null;
  graded_at: string | null;
  graded_by: string | null;
};
export type ProjectStageProgress = {
  id: string;
  submission_id: string;
  stage_id: string;
  is_completed: boolean;
  completed_at: string | null;
  student_notes: string | null;
};
export type ProjectAttachment = {
  id: string;
  submission_id: string;
  stage_id: string | null;
  storage_path: string;
  original_filename: string;
  size_bytes: number | null;
  uploaded_at: string;
};
export type ProjectWithStages = Project & { stages: ProjectStage[] };
export type TeacherProjectListItem = Project & {
  group: { name: string; subject: string };
  stageCount: number;
  totalStudents: number;
  submittedCount: number;
};
export type StudentProjectListItem = Project & {
  stageCount: number;
  completedCount: number;
  submission: ProjectSubmission | null;
  teacherName: string | null;
};
export type ProjectSubmissionWithStudent = ProjectSubmission & {
  student: { id: string; full_name: string; avatar_url: string | null };
  progress: ProjectStageProgress[];
  attachments: ProjectAttachment[];
};

// ── Announcements + Notifications (migrations 34 + 44) ───────────────
export type AnnouncementScope = "group" | "all_my_groups" | "student";
export type AnnouncementCategory = "general" | "academic" | "event" | "urgent" | "reminder";
export type Announcement = {
  id: string;
  created_by: string | null;
  admin_id: string | null;    // migration 121 — exactly one of created_by/admin_id is set
  title: string;
  body: string;
  scope: AnnouncementScope;
  group_id: string | null;
  target_student_id: string | null;
  is_pinned: boolean;
  category: AnnouncementCategory;
  is_ticker: boolean;
  valid_until: string | null;
  created_at: string;
};
export type TeacherAnnouncement = Announcement & {
  groupName: string | null;
  targetStudentName: string | null;
  readCount: number;
  totalRecipients: number;
};
export type StudentAnnouncement = Announcement & {
  teacherName: string | null;
  isRead: boolean;
};
export type NotificationKind =
  | "announcement" | "new_homework" | "new_grade" | "homework_graded"
  | "lesson_material" | "student_excused" | "student_submitted"
  | "leave_request" | "leave_decision" | "lesson_starting_soon";
export type AppNotification = {
  id: string;
  recipient_user_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  source_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};


export type Grade = {
  id: string;
  student_id: string;
  group_id: string | null;
  lesson_id: string | null;
  subject: string | null;
  score: number;
  work_type: string | null;
  comment: string | null;
  graded_at: string;
};

export type CourseMaterial = {
  id: string;
  group_id: string;
  lesson_id: string | null;
  stage_id: string | null;        // FK → lesson_stages, migration 119 (AI-presentation content lives there, not in Storage)
  title: string;
  type: string | null;            // legacy: 'pdf' | 'video' | 'presentation' | ...
  file_url: string | null;
  link_url: string | null;
  description: string | null;
  subject: string | null;
  file_type: string | null;       // MIME type from Storage uploads
  storage_path: string | null;    // path inside the 'materials' bucket
  file_size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export type MaterialWithGroup = CourseMaterial & {
  group: { name: string; subject: string };
};

export type LessonDetail = {
  id: string;
  group_id: string;
  lesson_no: number | null;
  topic: string | null;
  starts_at: string;
  ends_at: string | null;
  room: string | null;
  group: { id: string; name: string; subject: string };
  teacher: { id: string; full_name: string } | null;
  materials: CourseMaterial[];
  homework: {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    content_type: ContentType;
    submission: { status: SubmissionStatus; grade: number | null } | null;
  } | null;
  attendance: { status: AttendanceStatus } | null;
};

export type Message = {
  id: string;
  sender_id: string | null;
  recipient_student_id: string | null;
  group_id: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
};


export type NotificationSettings = {
  student_id: string;
  push_homework: boolean;
  push_schedule: boolean;
  push_grades: boolean;
  push_attendance: boolean;
  updated_at: string;
};

export type Payment = {
  id: string;
  student_id: string;
  amount: number;
  kind: PaymentKind;
  status: PaymentStatus;
  paid_at: string;
  note: string | null;
};

export type Charge = {
  id: string;
  student_id: string;
  lesson_id: string | null;
  amount: number;
  charged_at: string;
  note: string | null;
};

export type BookType = 'Учебник' | 'Конспект' | 'Сборник' | 'Справочник';

export type Book = {
  id: string;
  title: string;
  author: string | null;
  subject: string;
  book_type: BookType;
  description: string | null;
  cover_storage_path: string | null;
  file_storage_path: string;
  file_size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export type BookFavorite = {
  id: string;
  student_id: string;
  book_id: string;
  created_at: string;
};

// ─── Classwork ────────────────────────────────────────────────────────────────

export type ClassworkType = "file" | "test" | "learning" | "programming";

export type ClassworkQuestion = {
  id: string;
  classwork_id: string;
  position: number;
  question_text: string;
  options: string[];         // array of option strings
  correct_index: number;
};

export type ClassworkSubmission = {
  id: string;
  classwork_id: string;
  student_id: string;
  text_answer: string | null;
  file_storage_path: string | null;
  file_original_name: string | null;
  file_size_bytes: number | null;
  test_answers: number[] | null;
  test_score: number | null;
  test_max: number | null;
  submitted_at: string;
  grade: number | null;
  teacher_comment: string | null;
  graded_at: string | null;
  graded_by: string | null;
  // migration 110 — демо-сессия не может перегрузить уже проставленную реальную оценку
  is_demo: boolean;
};

export type Classwork = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  work_type: ClassworkType;
  created_by: string | null;
  created_at: string;
  attachment_storage_path: string | null;
  attachment_filename: string | null;
  attachment_size_bytes: number | null;
  duration_seconds: number | null;
  questions: ClassworkQuestion[];
};

export type ClassworkSubmissionWithStudent = ClassworkSubmission & {
  student: { id: string; full_name: string; avatar_url: string | null };
};

// ── Lesson features (migration 30): excuse requests + raised hands ──
export type ExcuseRequest = {
  id: string;
  lesson_id: string;
  student_id: string;
  reason: string;
  created_at: string;
};

export type ExcuseRequestWithStudent = ExcuseRequest & {
  student: { id: string; full_name: string; avatar_url: string | null };
};

export type RaisedHand = {
  id: string;
  lesson_id: string;
  student_id: string;
  raised_at: string;
  lowered_at: string | null;
  lowered_by: string | null;
};

export type RaisedHandWithStudent = RaisedHand & {
  student: { id: string; full_name: string; avatar_url: string | null };
};

// ── Leave requests (migration 47): student requests to leave in-progress lesson ──
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected';

export type LeaveRequest = {
  id: string;
  lesson_id: string;
  student_id: string;
  reason: string;
  status: LeaveRequestStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type LeaveRequestWithStudent = LeaveRequest & {
  student: { id: string; full_name: string; avatar_url: string | null };
};

/** Оценка за урок (migration 40), выставляется учителем через перекличку. */
export type LessonGrade = {
  id: string;
  lesson_id: string;
  student_id: string;
  grade: number;
  comment: string | null;
  graded_by: string;
  graded_at: string;
  updated_at: string;
  // migration 110 — демо-сессия не может перезаписать реальную (is_demo=false) оценку
  is_demo: boolean;
};
