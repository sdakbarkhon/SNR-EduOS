import { homeworkSubmissionStatusKind, type Dictionary, type SubmissionStatus } from "@snr/core";

/**
 * Заход 2, шаг 5 — статус сдачи ДЗ для родителя. Переиспользует
 * packages/core homeworkSubmissionStatusKind() — тот же 3-состояньевый
 * паттерн («Не сдано»/«На проверке»/«Оценено»), что уже согласован и
 * отгружен на вебе (задача "Задания"), не изобретаем свой более дробный
 * вариант поверх сырого SubmissionStatus.
 *
 * Долги, проход 1: лейблы больше не хардкожены здесь — kind→текст переведён
 * в homeworkStatusLabel(kind, t.status), т.к. чистая lib-функция не имеет
 * доступа к useAppLocale(); вызывающий экран передаёт свой d.parentApp.status.
 */
export type RealHomeworkStatusKind = "not_submitted" | "pending_review" | "graded";

export function realSubmissionStatusKind(status: SubmissionStatus | null | undefined): RealHomeworkStatusKind {
  return homeworkSubmissionStatusKind(status);
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

/** kind → локализованный лейбл. status — d.parentApp.status (underReview
 *  переиспользуется как есть — уже существующий ключ для "pending_review"). */
export function homeworkStatusLabel(kind: RealHomeworkStatusKind, status: Dictionary["parentApp"]["status"]): string {
  if (kind === "graded") return status.graded;
  if (kind === "pending_review") return status.underReview;
  return status.notSubmitted;
}

/** Заход 2, шаг 6 — числовая оценка для отображения рядом со статусом (была
 *  намеренно скрыта в Шаге 5). /5-шкала для файла/программирования (тот же
 *  homework_submissions.grade, что видит getStudentGrades); для теста —
 *  дискретная auto-grade (migration 31), если есть, иначе raw score/max_score.
 *  null — оценки ещё нет показать нечего (вызывающий экран решает, показывать
 *  ли суффикс вовсе). */
export function realGradeDisplay(
  contentType: string,
  submission: { grade: number | null } | null | undefined,
  testSubmission: { grade: number | null; score: number | null; max_score: number | null } | null | undefined,
): string | null {
  if (contentType === "test") {
    if (!testSubmission) return null;
    if (testSubmission.grade != null) return `${testSubmission.grade}/5`;
    if (testSubmission.score != null && testSubmission.max_score != null) {
      return `${testSubmission.score}/${testSubmission.max_score}`;
    }
    return null;
  }
  const grade = submission?.grade;
  return grade != null ? `${grade}/5` : null;
}
