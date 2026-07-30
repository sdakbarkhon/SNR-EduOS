/**
 * Блок 7.2 — статус домашнего задания глазами РОДИТЕЛЯ.
 *
 * Перенос логики apps/mobile-parent/src/lib/homeworkStatus.ts (ветка
 * feat/mobile-parent-redesign): три состояния вместо четырёх «ученических»
 * (в родительском приложении нет «В работе» — это состояние ученика, а не
 * факт для родителя), плюс числовая оценка отдельным полем.
 *
 * Источники правды по типам заданий:
 *   content_type === 'test' → test_submissions (score / max_score),
 *   всё остальное           → homework_submissions.status + grade.
 */

import type { HomeworkSubmission, HomeworkWithSubmission, TestSubmission } from "@snr/core";
import type { StatusKey } from "../v2/tokens";

export type HomeworkStatusKind = "not_submitted" | "pending_review" | "graded";

export function testStatusKind(test: TestSubmission | null): HomeworkStatusKind {
  if (!test) return "not_submitted";
  return test.score != null ? "graded" : "pending_review";
}

export function submissionStatusKind(sub: HomeworkSubmission | null): HomeworkStatusKind {
  if (!sub) return "not_submitted";
  if (sub.status === "graded") return "graded";
  if (sub.status === "submitted" || sub.status === "checking") return "pending_review";
  return "not_submitted"; // in_progress — ученик ещё не отправил
}

export function homeworkStatusKind(hw: HomeworkWithSubmission): HomeworkStatusKind {
  return hw.content_type === "test"
    ? testStatusKind(hw.test_submission)
    : submissionStatusKind(hw.submission);
}

/** Числовая оценка для показа, если она реально выставлена. */
export function homeworkGradeDisplay(hw: HomeworkWithSubmission): string | null {
  if (hw.content_type === "test") {
    const t = hw.test_submission;
    if (t?.score != null && t.max_score != null) return `${t.score}/${t.max_score}`;
    return t?.grade != null ? String(t.grade) : null;
  }
  return hw.submission?.grade != null ? String(hw.submission.grade) : null;
}

export function statusLabel(kind: HomeworkStatusKind, grade: string | null): string {
  if (kind === "graded") return grade ? `Оценено · ${grade}` : "Оценено";
  if (kind === "pending_review") return "На проверке";
  return "Не сдано";
}

export function statusFamily(kind: HomeworkStatusKind, overdue: boolean): StatusKey {
  if (kind === "graded") return "green";
  if (kind === "pending_review") return "violet";
  return overdue ? "red" : "gray";
}

/** Правый индикатор карточки списка: кольцо N%, песочные часы или прочерк. */
export function progressIndicator(hw: HomeworkWithSubmission): number | "hourglass" | null {
  const kind = homeworkStatusKind(hw);
  if (hw.content_type === "test") {
    const t = hw.test_submission;
    if (t?.score != null && t.max_score) return Math.round((t.score / t.max_score) * 100);
  }
  if (kind === "not_submitted") return null;
  if (kind === "pending_review") return "hourglass";
  return 100;
}
