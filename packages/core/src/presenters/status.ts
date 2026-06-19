import type { StatusVariant } from "@snr/ui-tokens";
import type {
  AttendanceStatus,
  Homework,
  HomeworkSubmission,
  Lesson,
  StudentStatus,
  SubmissionStatus,
} from "../types";

/**
 * Чистые «презентеры» статусов — общие для web и mobile. Возвращают вариант
 * чипа (цвет из дизайн-системы) + ключ для i18n (`Dictionary.status[key]`).
 * Компонент сам переводит ключ и красит чип по variant.
 */
export type StatusKey =
  | "now"
  | "soon"
  | "passed"
  | "scheduled"
  | "cancelled"
  | "active"
  | "debtor"
  | "frozen"
  | "submitted"
  | "checking"
  | "graded"
  | "overdue"
  | "todo"
  | "present"
  | "absent"
  | "late";

export interface StatusBadge {
  variant: StatusVariant;
  key: StatusKey;
}

const SOON_WINDOW_MS = 60 * 60 * 1000; // «Скоро» — в пределах часа
const DEFAULT_LESSON_MS = 45 * 60 * 1000;

export function lessonStatus(
  lesson: Pick<Lesson, "starts_at" | "ends_at" | "status">,
  now: number = Date.now(),
): StatusBadge {
  if (lesson.status === "completed") return { variant: "neutral", key: "passed" };
  if (lesson.status === "in_progress") return { variant: "success", key: "now" };
  const start = new Date(lesson.starts_at).getTime();
  const end = lesson.ends_at ? new Date(lesson.ends_at).getTime() : start + DEFAULT_LESSON_MS;
  if (end < now) return { variant: "neutral", key: "passed" };
  if (now >= start && now <= end) return { variant: "success", key: "now" };
  if (start - now <= SOON_WINDOW_MS) return { variant: "warning", key: "soon" };
  return { variant: "info", key: "scheduled" };
}

export function studentStatus(status: StudentStatus): StatusBadge {
  switch (status) {
    case "active":
      return { variant: "success", key: "active" };
    case "debtor":
      return { variant: "danger", key: "debtor" };
    case "frozen":
      return { variant: "warning", key: "frozen" };
  }
}

export function submissionStatus(status: SubmissionStatus): StatusBadge {
  switch (status) {
    case "submitted":
      return { variant: "info", key: "submitted" };
    case "checking":
      return { variant: "info", key: "checking" };
    case "graded":
      return { variant: "success", key: "graded" };
  }
}

export function attendanceStatus(status: AttendanceStatus): StatusBadge {
  switch (status) {
    case "present":
      return { variant: "success", key: "present" };
    case "absent_excused":
      return { variant: "warning", key: "late" };
    case "absent_unexcused":
      return { variant: "danger", key: "absent" };
    default:
      return { variant: "neutral", key: "absent" };
  }
}

/** Состояние ДЗ для ученика: учитывает его сдачу (если есть) и дедлайн. */
export function homeworkState(
  hw: Pick<Homework, "due_date">,
  submission?: Pick<HomeworkSubmission, "status"> | null,
): StatusBadge {
  if (submission) return submissionStatus(submission.status);
  if (hw.due_date && new Date(hw.due_date).getTime() < Date.now()) {
    return { variant: "danger", key: "overdue" };
  }
  return { variant: "warning", key: "todo" };
}
