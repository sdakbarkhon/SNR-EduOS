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
export type SubmissionStatus = "submitted" | "checking" | "graded";
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

export type StudentGroup = {
  student_id: string;
  group_id: string;
};

export type Lesson = {
  id: string;
  group_id: string;
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
  | 'presentation' | 'code' | 'scratch' | 'tinkercad'
  | 'app_inventor' | 'code_monkey' | 'quiz_qia' | 'quiz_kahoot';

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
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
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

export type CodeLanguage = 'python' | 'cpp';

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
  status: LessonStatus;
  room: string | null;
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
export type ContentType = 'file' | 'test' | 'programming';
export type ProgrammingLanguage = 'python' | 'cpp';
export type HomeworkSource = 'curriculum' | 'teacher';

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
  test_duration_seconds: number | null; // migration 31 (test type)
  test_auto_grade: boolean;             // migration 31 (test type)
  programming_language: ProgrammingLanguage | null; // migration 32
  starter_code: string | null;
  expected_output: string | null;
  tests_attachment_path: string | null;
  tests_attachment_filename: string | null;
  tests_attachment_size_bytes: number | null;
  group: { subject: string; name: string };
  submission: HomeworkSubmission | null;
  test_submission: TestSubmission | null;
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

// ── Announcements + Notifications (migration 34) ─────────────────────
export type AnnouncementScope = "group" | "all_my_groups" | "student";
export type Announcement = {
  id: string;
  created_by: string | null;
  title: string;
  body: string;
  scope: AnnouncementScope;
  group_id: string | null;
  target_student_id: string | null;
  is_pinned: boolean;
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
  | "lesson_material" | "student_excused" | "student_submitted";
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
