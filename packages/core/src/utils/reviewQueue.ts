/**
 * ЕДИНОЕ ПРАВИЛО «ПРОВЕРЕНО / НА ПРОВЕРКЕ». 26.08.2026.
 *
 * ПРАВИЛО. Работа проверена, если у неё ЕСТЬ ОЦЕНКА. Ждёт проверки та, что
 * сдана и оценки не имеет. Черновик (`in_progress`) не сдан вовсе и в очередь
 * не попадает — иначе учитель видел бы «на проверке» то, чего ему ещё никто
 * не отдавал.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. На 26.08 одно и то же число «На проверке» считалось
 * ТРЕМЯ разными способами и давало три разных ответа на одних и тех же
 * данных:
 *
 *   • дашборд учителя — только файловые сдачи со статусом `submitted`,
 *     тесты не смотрел вовсе: 0;
 *   • пончик на экране «Задания» — файловые без оценки ПЛЮС все попытки
 *     тестов подряд, оценённые в том числе: 120;
 *   • экран одного задания — файловые `submitted` плюс тесты, у которых
 *     `max_score` не совпал с числом вопросов: своё третье число.
 *
 * В живой базе все 440 файловых сдач и все 120 попыток тестов уже с оценками,
 * открытых вопросов нет ни одного — верный ответ ноль, и его не показывало
 * ни одно из трёх мест.
 *
 * ПОЧЕМУ ОЦЕНКА, А НЕ СТАТУС. Статус `graded` и наличие оценки — два разных
 * признака, и разойтись они могут молча. Оценка — то, что видит ученик и что
 * идёт в средний балл (см. utils/gradeAverage), поэтому она и есть признак
 * проверки.
 *
 * ПОЧЕМУ ЗДЕСЬ НЕ ЗОВЁТСЯ testGrade5. Он у тестов подставляет долю
 * правильных ответов, когда оценки нет, — и это правильно для СРЕДНЕГО
 * БАЛЛА: у старых сдач grade пуст, и терять их молча нельзя. Но для очереди
 * проверки та же подстановка была бы бедой. Функция submit_test (миграция
 * 215) ставит grade = NULL, если в тесте есть хотя бы один ОТКРЫТЫЙ вопрос:
 * его должен прочитать учитель. При этом score и max_score у такой сдачи
 * заполнены, testGrade5 вернул бы по ним число — и тест с непрочитанным
 * ответом молча исчез бы из очереди. Та же миграция предупреждает об этом
 * прямым текстом (строки 263–270): «Это самая тихая из возможных поломок».
 *
 * Поэтому здесь признак один и буквальный: ЕСТЬ ЛИ grade. Старая сдача без
 * оценки останется висеть в очереди — это видно и это заметят, в отличие от
 * тихо опустевшей очереди.
 */

/** Файловая сдача в том виде, в каком её знает очередь проверки. */
export type ReviewableFileSubmission = {
  status?: string | null;
  grade?: number | null;
};

/** Попытка теста в том виде, в каком её знает очередь проверки. Ни score, ни
 *  max_score здесь нет намеренно: очередь смотрит только на оценку. */
export type ReviewableTestSubmission = {
  grade?: number | null;
};

/** Сдана ли работа вообще. Черновик ученика — ещё не сдан. */
export function isSubmissionHandedIn(s: ReviewableFileSubmission): boolean {
  return s.status !== "in_progress";
}

/** Проверена ли файловая сдача: есть оценка. */
export function isFileSubmissionChecked(s: ReviewableFileSubmission): boolean {
  return s.grade != null;
}

/** Проверена ли попытка теста: выставлена оценка. Доля правильных ответов
 *  оценкой не считается — см. заголовок файла. */
export function isTestSubmissionChecked(s: ReviewableTestSubmission): boolean {
  return s.grade != null;
}

/** Ждёт ли файловая сдача проверки: сдана и без оценки. */
export function isFileSubmissionPending(s: ReviewableFileSubmission): boolean {
  return isSubmissionHandedIn(s) && !isFileSubmissionChecked(s);
}

/** Ждёт ли попытка теста проверки: без оценки. */
export function isTestSubmissionPending(s: ReviewableTestSubmission): boolean {
  return !isTestSubmissionChecked(s);
}

/** Одно задание со своими сдачами — форма, в которой их отдаёт getTeacherHomework. */
export type ReviewableHomework = {
  submissions?: ReviewableFileSubmission[] | null;
  test_subs?: ReviewableTestSubmission[] | null;
};

/** Сколько работ этого задания ждут проверки. */
export function pendingReviewCountOf(hw: ReviewableHomework): number {
  return (hw.submissions ?? []).filter(isFileSubmissionPending).length
    + (hw.test_subs ?? []).filter(isTestSubmissionPending).length;
}

/** Сколько работ ждут проверки во всём списке заданий. */
export function pendingReviewCount(list: ReadonlyArray<ReviewableHomework>): number {
  return list.reduce((acc, hw) => acc + pendingReviewCountOf(hw), 0);
}

/** Сколько работ этого задания уже проверено. */
export function checkedCountOf(hw: ReviewableHomework): number {
  return (hw.submissions ?? []).filter(isFileSubmissionChecked).length
    + (hw.test_subs ?? []).filter(isTestSubmissionChecked).length;
}
