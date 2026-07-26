import { homeworkSubmissionStatusKind, type SubmissionStatus } from "@snr/core";

/**
 * Заход 2, шаг 5 — статус сдачи ДЗ для родителя. Переиспользует
 * packages/core homeworkSubmissionStatusKind() — тот же 3-состояньевый
 * паттерн («Не сдано»/«На проверке»/«Оценено»), что уже согласован и
 * отгружен на вебе (задача "Задания"), не изобретаем свой более дробный
 * вариант поверх сырого SubmissionStatus.
 */
export type RealHomeworkStatusKind = "not_submitted" | "pending_review" | "graded";

const KIND_LABEL: Record<RealHomeworkStatusKind, string> = {
  not_submitted: "Не сдано",
  pending_review: "На проверке",
  graded: "Оценено",
};

export function realSubmissionStatusKind(status: SubmissionStatus | null | undefined): RealHomeworkStatusKind {
  return homeworkSubmissionStatusKind(status);
}

export function realSubmissionStatusLabel(status: SubmissionStatus | null | undefined): string {
  return KIND_LABEL[realSubmissionStatusKind(status)];
}

// test_submissions не имеет поля status (только score/max_score/grade) —
// статус выводим отдельно. НЕ по grade: submitTest() ставит grade только
// для чисто авто-грейдящихся тестов (auto_grade=true И нет open-вопросов);
// как только в тесте есть открытый вопрос или учитель выключил автогрейд,
// grade остаётся null НАВСЕГДА — даже после того, как учитель проверил
// работу через TestReviewModal (тот трогает только score/max_score, не
// grade). Поэтому статус — по наличию score/max_score (submitTest всегда
// пишет их сразу при сдаче, включая ручную проверку открытых вопросов):
// нет строки → не сдано; есть строка без score → на проверке (крайний
// случай); есть score → оценено — тот же сигнал, что уже показывает
// прогресс-кольцо в списке (Math.round(score/max_score*100)), не расходится.
export function realTestStatusKind(
  testSubmission: { score: number | null; max_score: number | null } | null | undefined,
): RealHomeworkStatusKind {
  if (!testSubmission) return "not_submitted";
  return testSubmission.score != null && testSubmission.max_score != null ? "graded" : "pending_review";
}

export function realTestStatusLabel(
  testSubmission: { score: number | null; max_score: number | null } | null | undefined,
): string {
  return KIND_LABEL[realTestStatusKind(testSubmission)];
}
