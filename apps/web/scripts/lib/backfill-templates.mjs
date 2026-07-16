// Пачка 2.5 — шаблоны и распределения для apps/web/scripts/backfill-historical.mjs.
// Никаких внешних API — только хардкод-шаблоны и локальный рандом (тот же принцип,
// что в apps/web/scripts/_backfill-shared.mjs).

// ── Комментарии учителя, по 10 фраз на категорию ──────────────────────────

export const COMMENTS_GOOD = [
  "Отличная работа",
  "Задача решена правильно",
  "Хорошо освоена тема",
  "Прекрасное понимание материала",
  "Молодец, всё верно",
  "Уверенное владение материалом",
  "Аккуратное и правильное решение",
  "Видна хорошая подготовка",
  "Тема усвоена на отлично",
  "Так держать, отличный результат",
];

export const COMMENTS_AVERAGE = [
  "Тема освоена частично",
  "Есть неточности в решении",
  "Нужно повторить материал",
  "Работа выполнена, но с ошибками",
  "В целом верно, но есть недочёты",
  "Стоит внимательнее проверять решение",
  "Основная идея понята, детали хромают",
  "Средний результат, есть куда расти",
  "Не все пункты выполнены до конца",
  "Требуется дополнительная практика",
];

export const COMMENTS_POOR = [
  "Задача не решена",
  "Тема не понята",
  "Требуется повторное изучение",
  "Много ошибок в базовых концепциях",
  "Решение не соответствует заданию",
  "Нужно разобрать тему заново",
  "Слабое понимание материала",
  "Задание выполнено с серьёзными ошибками",
  "Не хватает базовых знаний по теме",
  "Обязательно подойди на консультацию",
];

/** По оценке 2-5 выбирает соответствующий массив комментариев (5-4=good, 3=average, 2=poor). */
function commentsForGrade(grade) {
  if (grade >= 4) return COMMENTS_GOOD;
  if (grade === 3) return COMMENTS_AVERAGE;
  return COMMENTS_POOR;
}

// ── Шаблоны ответов на ДЗ ──────────────────────────────────────────────────

export const HOMEWORK_ANSWERS = {
  // Для не-programming типов (file/test/wokwi/geogebra/phet/...) — короткий
  // текстовый ответ в answer_text.
  TEXT: [
    "Выполнено",
    "Готово, прикрепил решение",
    "Изучил тему, выполнил задание",
    "Решение прикреплено",
    "Сделал все пункты задания",
    "Прошёл все шаги, готово",
    "Выполнил, есть вопрос по последнему пункту",
    "Готово, проверьте пожалуйста",
    "Разобрался с темой, задание выполнено",
    "Сдаю на проверку",
    "Всё сделал по инструкции",
    "Закончил, было интересно",
    "Выполнено полностью",
    "Прикладываю выполненную работу",
    "Готово к проверке",
  ],
  // Для content_type='programming' — валидные короткие сниппеты (не привязаны
  // к конкретному заданию — реализм важнее точного соответствия условию).
  CODE: {
    python: [
      "n = 7\nfor i in range(1, 11):\n    print(f\"{n} x {i} = {n*i}\")",
      "total = 0\nfor i in range(1, 51):\n    if i % 2 == 0:\n        total += i\nprint(total)",
      "def area(a, b):\n    return a * b\n\nprint(area(5, 3))",
      "numbers = [3, 1, 4, 1, 5, 9]\nprint(sorted(numbers))",
      "name = input(\"Введите имя: \")\nprint(f\"Привет, {name}!\")",
    ],
    javascript: [
      "for (let i = 1; i <= 5; i++) {\n  console.log(\"*\".repeat(i));\n}",
      "function area(a, b) {\n  return a * b;\n}\nconsole.log(area(5, 3));",
      "const numbers = [3, 1, 4, 1, 5, 9];\nconsole.log(numbers.sort((a, b) => a - b));",
      "let total = 0;\nfor (let i = 1; i <= 10; i++) total += i;\nconsole.log(total);",
    ],
    cpp: [
      "#include <iostream>\nusing namespace std;\nint main() {\n    cout << \"Hello, World!\" << endl;\n    return 0;\n}",
      "#include <iostream>\nusing namespace std;\nint main() {\n    int a = 5, b = 3;\n    cout << a * b << endl;\n    return 0;\n}",
    ],
    java: [
      "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}",
    ],
    // Фолбэк, если homework.programming_language не заполнен.
    default: [
      "print(\"Готово\")",
    ],
  },
};

/** Случайный сниппет кода под конкретный язык (или default, если язык не задан/не найден). */
export function pickHomeworkContent(programmingLanguage) {
  const bucket = HOMEWORK_ANSWERS.CODE[programmingLanguage] ?? HOMEWORK_ANSWERS.CODE.default;
  return pick(bucket);
}

// ── Базовые примитивы рандома ──────────────────────────────────────────────

/** weights — объект { key: вес (0..1, сумма ~1) }. Возвращает ключ. */
export function weightedRandom(weights) {
  const r = Math.random();
  let acc = 0;
  const entries = Object.entries(weights);
  for (const [key, w] of entries) {
    acc += w;
    if (r <= acc) return key;
  }
  return entries[entries.length - 1][0];
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

// ── Attendance ────────────────────────────────────────────────────────────
// Схема (CHECK constraint, живая): 'present' | 'absent_excused' | 'absent_unexcused'
// — НЕТ статуса 'sick'. Маппинг на ТЗ (present/absent/sick):
//   present            → present            90%
//   absent_unexcused   → "absent" из ТЗ      8%
//   absent_excused     → "sick" из ТЗ (справка/уважительная причина) 2%
const ATTENDANCE_WEIGHTS = { present: 0.90, absent_unexcused: 0.08, absent_excused: 0.02 };

export function pickAttendance() {
  return weightedRandom(ATTENDANCE_WEIGHTS);
}

// ── Оценки (уроки и ДЗ используют одно распределение) ───────────────────────
const GRADE_WEIGHTS = { 5: 0.30, 4: 0.40, 3: 0.25, 2: 0.05 };

export function pickGrade() {
  return Number(weightedRandom(GRADE_WEIGHTS));
}

export function pickCommentByGrade(grade) {
  return pick(commentsForGrade(grade));
}

// ── Домашние задания: состояние сдачи ────────────────────────────────────
const HOMEWORK_STATE_WEIGHTS = { onTime: 0.75, late: 0.15, notSubmitted: 0.10 };

export function pickHomeworkSubmissionState() {
  return weightedRandom(HOMEWORK_STATE_WEIGHTS);
}

// ── Quiz: процент правильных ответов, mean≈85, диапазон 60-100 ─────────────
// Реализовано как взвешенный выбор по 5-процентным корзинам (60,65,...,100),
// вес каждой корзины — по нормальному распределению (mean=85, sd=12), затем
// нормализация. Не точная гауссиана, но форма распределения совпадает:
// пик около 85, редкие значения на краях 60/100.
function gaussianWeight(x, mean, sd) {
  return Math.exp(-((x - mean) ** 2) / (2 * sd * sd));
}
const QUIZ_BUCKETS = Array.from({ length: 9 }, (_, i) => 60 + i * 5); // 60..100 step 5
const QUIZ_WEIGHTS_RAW = QUIZ_BUCKETS.map((b) => gaussianWeight(b, 85, 12));
const QUIZ_WEIGHTS_SUM = QUIZ_WEIGHTS_RAW.reduce((a, b) => a + b, 0);
const QUIZ_WEIGHTS = Object.fromEntries(
  QUIZ_BUCKETS.map((b, i) => [String(b), QUIZ_WEIGHTS_RAW[i] / QUIZ_WEIGHTS_SUM]),
);

/** Возвращает целый процент правильных ответов в [60,100], с пиком плотности у 85. */
export function pickQuizPercentage() {
  const bucket = Number(weightedRandom(QUIZ_WEIGHTS));
  // Небольшой джиттер внутри 5%-корзины, чтобы не было видимой "ступенчатости".
  return Math.max(60, Math.min(100, bucket + randomInt(-2, 2)));
}

// ── Временные метки ──────────────────────────────────────────────────────

/** ISO timestamp = baseTime + случайный сдвиг вперёд на [minMinutes, maxMinutes]. */
export function randomTimestampAfter(baseTime, minMinutes, maxMinutes) {
  const base = new Date(baseTime).getTime();
  const offsetMs = randomInt(minMinutes, maxMinutes) * 60000;
  return new Date(base + offsetMs).toISOString();
}

/** ISO timestamp равномерно между fromIso и toIso (toIso капается снизу на fromIso). */
export function randomTimeBetween(fromIso, toIso) {
  const from = new Date(fromIso).getTime();
  const to = Math.max(new Date(toIso).getTime(), from);
  return new Date(from + Math.random() * (to - from)).toISOString();
}
