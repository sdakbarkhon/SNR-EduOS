/**
 * Доменные типы (snake_case — как возвращает Supabase). Совпадают со схемой
 * миграций в supabase/migrations. Используются в queries и в UI обоих приложений.
 *
 * Важно: это `type`-алиасы, а не `interface` — иначе postgrest-js не принимает
 * их как Row/Insert (interface не удовлетворяет ограничению Record<string, unknown>).
 */

export type StudentStatus = "active" | "debtor" | "frozen";
export type LessonStatus = "scheduled" | "ongoing" | "done" | "cancelled";
export type AttendanceStatus = "present" | "absent" | "late";
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
  starts_at: string;
  ends_at: string | null;
  room: string | null;
  online_url: string | null;
  materials_link: string | null;
  status: LessonStatus;
  created_at: string;
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
  answer_text: string | null;
  grade: number | null;
  teacher_comment: string | null;
  status: SubmissionStatus;
};

/** Homework с join'ом группы и опциональной сдачей студента. */
export type ContentType = 'file' | 'test';
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
  group: { subject: string; name: string };
  submission: HomeworkSubmission | null;
  test_submission: TestSubmission | null;
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

export type Message = {
  id: string;
  sender_id: string | null;
  recipient_student_id: string | null;
  group_id: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  target_group_id: string | null;
  created_at: string;
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
