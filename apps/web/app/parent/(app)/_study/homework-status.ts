/**
 * Блок 7.2 — статус домашнего задания глазами РОДИТЕЛЯ.
 *
 * Три состояния вместо четырёх «ученических»: в родительском приложении нет
 * «В работе» — это состояние УЧЕНИКА, а не факт для родителя. Решение
 * подтверждено заказчиком 03.09.2026 и остаётся в силе.
 *
 * Источники правды по типам заданий:
 *   content_type === 'test' → test_submissions (score / max_score),
 *   всё остальное           → homework_submissions.status + grade.
 *
 * ═══ 03.09.2026, пункт 122 — КОПИИ ПРАВИЛА БОЛЬШЕ НЕТ ═════════════════════
 *
 * Здесь лежала СВОЯ реализация «статус сдачи → одно из трёх состояний»,
 * слово в слово повторявшая `homeworkSubmissionStatusKind` из packages/core.
 * Две одинаковые функции об одном факте — ровно та беда, на которой в этом
 * проекте правила расходились семь раз: почини одну, забудь вторую.
 *
 * Теперь `submissionStatusKind` — тонкая обёртка над общей функцией. Тот же
 * приём, каким сводили три копии `verifyAdmin` в один `verifyStaff`.
 * Мобильное родительское приложение зовёт ту же общую функцию через
 * `realSubmissionStatusKind` — то есть три родительских поверхности
 * (веб, мобильное, общий слой) отвечают одной строкой кода.
 *
 * ПОДПИСИ ПЕРЕЕХАЛИ В СЛОВАРЬ. Здесь же были зашиты русские «Не сдано»,
 * «На проверке» и «Оценено» — экран не менялся с языком, хотя языка в
 * проекте три. Строка теперь собирается в клиенте по ключу состояния, как
 * рядом уже собирается подпись срока.
 */

import { homeworkSubmissionStatusKind } from "@snr/core";
import type { HomeworkSubmission, HomeworkWithSubmission, TestSubmission } from "@snr/core";
import type { StatusKey } from "../v2/tokens";

export type HomeworkStatusKind = "not_submitted" | "pending_review" | "graded";

export function testStatusKind(test: TestSubmission | null): HomeworkStatusKind {
  if (!test) return "not_submitted";
  return test.score != null ? "graded" : "pending_review";
}

export function submissionStatusKind(sub: HomeworkSubmission | null): HomeworkStatusKind {
  // Общая функция даёт ровно те же три состояния и так же считает
  // `in_progress` несданным: ученик ещё не отправил работу, и родителю про
  // его черновик знать нечего.
  return homeworkSubmissionStatusKind(sub?.status ?? null);
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

/**
 * Подпись состояния. Слова берутся из словаря — их три языка, а этот файл
 * серверный и локали не знает; поэтому сюда передаётся уже готовый набор
 * (`d.parentApp.status`), а собирает строку клиентский компонент.
 *
 * Оценка приклеивается через « · » только к «Оценено»: у двух других
 * состояний её нет по определению.
 */
export function statusLabel(
  kind: HomeworkStatusKind,
  grade: string | null,
  status: { notSubmitted: string; underReview: string; graded: string },
): string {
  if (kind === "graded") return grade ? `${status.graded} · ${grade}` : status.graded;
  if (kind === "pending_review") return status.underReview;
  return status.notSubmitted;
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
