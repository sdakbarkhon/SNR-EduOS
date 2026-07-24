/**
 * Предметы (SUBJ, строки 3373–3380 макета), освоение тем (TOPICS, 3267–3273),
 * учителя (TEACHERS, 3256), отзывы (REVS, 3258–3266), «Все предметы»
 * (allSubjRows, 4307–4313), детали предмета d11 (C5).
 * Значения — ДОСЛОВНО из макета; градиенты извлечены из CSS-строк
 * `linear-gradient(135deg, from, to)` как пары [from, to].
 */
import type {
  SubjectDetail,
  SubjectKey,
  SubjectRow,
  SubjectStatRow,
  TeacherProfileRow,
  TeacherReviewRow,
  TopicMasteryRow,
} from "../types";

export const SUBJECTS: Record<SubjectKey, SubjectRow> = {
  rus: {
    id: "rus",
    name: "Русский язык",
    color: "#a21caf",
    gradient: ["#e879f9", "#a21caf"],
    text_color: "#86198f",
    chip_bg: "rgba(162,28,175,.13)",
    chip_border: "rgba(162,28,175,.33)",
    current_topic: "Части речи",
    teacher_name: "Дилдора Касымова",
  },
  eng: {
    id: "eng",
    name: "Английский язык",
    color: "#db2777",
    gradient: ["#f472b6", "#db2777"],
    text_color: "#be185d",
    chip_bg: "rgba(236,72,153,.13)",
    chip_border: "rgba(236,72,153,.32)",
    current_topic: "Past Simple: практика",
    teacher_name: "Нилуфар Ахмедова",
  },
  math: {
    id: "math",
    name: "Математика",
    color: "#ca8a04",
    gradient: ["#facc15", "#ca8a04"],
    text_color: "#a16207",
    chip_bg: "rgba(202,138,4,.15)",
    chip_border: "rgba(202,138,4,.35)",
    current_topic: "Дроби и проценты",
    teacher_name: "Гульнора Юсупова",
  },
  prog: {
    id: "prog",
    name: "Программирование",
    color: "#0284c7",
    gradient: ["#38bdf8", "#0284c7"],
    text_color: "#0369a1",
    chip_bg: "rgba(2,132,199,.13)",
    chip_border: "rgba(2,132,199,.32)",
    current_topic: "Циклы в Python",
    teacher_name: "Александр Петров",
  },
  robo: {
    id: "robo",
    name: "Робототехника",
    color: "#0d9488",
    gradient: ["#2dd4bf", "#0d9488"],
    text_color: "#0f766e",
    chip_bg: "rgba(13,148,136,.13)",
    chip_border: "rgba(13,148,136,.33)",
    current_topic: "Сборка манипулятора",
    teacher_name: "Сергей Волков",
  },
  rusF: {
    id: "rusF",
    name: "Русский язык · факультатив",
    color: "#a21caf",
    gradient: ["#e879f9", "#a21caf"],
    text_color: "#86198f",
    chip_bg: "rgba(162,28,175,.13)",
    chip_border: "rgba(162,28,175,.33)",
    current_topic: "Сочинение-рассуждение",
    teacher_name: "Дилдора Касымова",
  },
};

/** TOPICS — освоение тем. Правило макета: <70% → чип «Требует внимания». */
export const TOPICS: TopicMasteryRow[] = [
  { subject_id: "math", title: "Дроби и проценты", mastery_pct: 90, meta_label: "8 уроков · 6 заданий" },
  { subject_id: "math", title: "Уравнения", mastery_pct: 85, meta_label: "7 уроков · 5 заданий" },
  { subject_id: "math", title: "Геометрия: углы", mastery_pct: 62, meta_label: "5 уроков · 4 задания" },
  { subject_id: "math", title: "Текстовые задачи", mastery_pct: 80, meta_label: "6 уроков · 5 заданий" },
  { subject_id: "prog", title: "Циклы в Python", mastery_pct: 95, meta_label: "6 уроков · 4 задания" },
  { subject_id: "prog", title: "Функции", mastery_pct: 92, meta_label: "5 уроков · 4 задания" },
  { subject_id: "prog", title: "Списки и словари", mastery_pct: 88, meta_label: "4 урока · 3 задания" },
  { subject_id: "prog", title: "Проект: калькулятор", mastery_pct: 100, meta_label: "3 урока · 1 задание" },
  { subject_id: "robo", title: "Механика манипулятора", mastery_pct: 84, meta_label: "5 уроков · 3 задания" },
  { subject_id: "robo", title: "Датчики", mastery_pct: 78, meta_label: "4 урока · 3 задания" },
  { subject_id: "robo", title: "Сборка шасси", mastery_pct: 91, meta_label: "4 урока · 2 задания" },
  { subject_id: "robo", title: "Программирование движения", mastery_pct: 66, meta_label: "3 урока · 3 задания" },
  { subject_id: "eng", title: "Past Simple", mastery_pct: 64, meta_label: "6 уроков · 5 заданий" },
  { subject_id: "eng", title: "Vocabulary: Travel", mastery_pct: 82, meta_label: "4 урока · 3 задания" },
  { subject_id: "eng", title: "Reading comprehension", mastery_pct: 76, meta_label: "5 уроков · 4 задания" },
  { subject_id: "eng", title: "Essay writing", mastery_pct: 58, meta_label: "4 урока · 4 задания" },
  { subject_id: "rus", title: "Части речи", mastery_pct: 88, meta_label: "6 уроков · 4 задания" },
  { subject_id: "rus", title: "Сочинение-рассуждение", mastery_pct: 61, meta_label: "5 уроков · 5 заданий" },
  { subject_id: "rus", title: "Пунктуация", mastery_pct: 74, meta_label: "5 уроков · 4 задания" },
  { subject_id: "rus", title: "Диктанты", mastery_pct: 86, meta_label: "4 урока · 3 задания" },
];

/** TEACHERS — в макете заполнен только math (аномалия №6: профиль учителя
 *  всегда показывает Гульнору Юсупову). */
export const TEACHER_PROFILE: TeacherProfileRow = {
  full_name: "Гульнора Юсупова",
  subject_id: "math",
  subject_name: "Математика",
  experience_label: "12 лет",
  education_label: "ТГПУ им. Низами",
  classes_label: "3-А, 5-Б, 7-А, 10-А",
  schedule: [
    ["Пн", "10:20 – 11:05"],
    ["Ср", "10:20 – 11:05"],
    ["Пт", "09:25 – 10:10"],
  ],
};

/** REVS — отзывы учителей (grp: t сегодня, w на этой неделе, e ранее). */
export const TEACHER_REVIEWS: TeacherReviewRow[] = [
  {
    group: "t",
    teacher_name: "Гульнора Юсупова",
    subject_id: "math",
    time_label: "2 ч назад",
    likes: 3,
    text: "Отлично написала контрольную по дробям — одна из лучших работ в классе. Так держать!",
  },
  {
    group: "t",
    teacher_name: "Нилуфар Ахмедова",
    subject_id: "eng",
    time_label: "4 ч назад",
    likes: 1,
    text: "Эссе «My Summer» ещё не сдано — напоминаю, срок завтра в 18:00. Нужна помощь — пусть подойдёт после урока.",
  },
  {
    group: "w",
    teacher_name: "Александр Петров",
    subject_id: "prog",
    time_label: "Пн",
    likes: 5,
    text: "Проект «Калькулятор» на Python принят с первого раза. Чистый код и продуманная структура — очень достойно.",
  },
  {
    group: "w",
    teacher_name: "Дилдора Касымова",
    subject_id: "rus",
    time_label: "Пн",
    likes: 0,
    text: "Сочинение сдано в последний момент и без плана. Прошу выделять время на подготовку заранее.",
  },
  {
    group: "e",
    teacher_name: "Сергей Волков",
    subject_id: "robo",
    time_label: "14 июля",
    likes: 2,
    text: "Уверенно собирает механику манипулятора и помогает одноклассникам. Жду отчёт по сборке.",
  },
  {
    group: "e",
    teacher_name: "Гульнора Юсупова",
    subject_id: "math",
    time_label: "10 июля",
    likes: 1,
    text: "По уравнениям стабильные пятёрки. На следующей неделе начнём геометрию — повторите углы.",
  },
];

/** allSubjRows — экран «Все предметы» и бары П10. */
export const SUBJECT_STATS: SubjectStatRow[] = [
  { subject_id: "prog", grade_label: "4.9", pct: 98, delta_label: "↑ 0.2", is_up: true, meta_label: "24 урока · 18 заданий за месяц" },
  { subject_id: "robo", grade_label: "4.7", pct: 94, delta_label: "↑ 0.1", is_up: true, meta_label: "18 уроков · 12 заданий за месяц" },
  { subject_id: "math", grade_label: "4.8", pct: 96, delta_label: "↑ 0.3", is_up: true, meta_label: "26 уроков · 20 заданий за месяц" },
  { subject_id: "eng", grade_label: "4.4", pct: 88, delta_label: "↓ 0.2", is_up: false, meta_label: "22 урока · 16 заданий за месяц" },
  { subject_id: "rus", grade_label: "4.2", pct: 84, delta_label: "↑ 0.2", is_up: true, meta_label: "20 уроков · 15 заданий за месяц" },
];

/** Детали предмета d11 — Математика (C5). Темы — хардкод экрана макета
 *  (аномалия №3: «Геометрия 75» против TOPICS «Геометрия: углы 62»). */
export const SUBJECT_DETAIL_MATH: SubjectDetail = {
  subject_id: "math",
  teacher_name: "Гульнора Юсупова",
  teacher_online: true,
  current_grade_label: "4.8",
  grade_note: "Отлично!",
  gauge_pct: 96,
  topics: [
    { title: "Дроби и проценты", pct: 90 },
    { title: "Геометрия", pct: 75 },
    { title: "Уравнения", pct: 85 },
    { title: "Текстовые задачи", pct: 80 },
  ],
  last_work: { title: "Контрольная «Дроби и проценты»", date_label: "сегодня, 10:42", grade: 5 },
  upcoming_test: { title: "Тест «Геометрия. Углы»", date_label: "26 июля, 10:00", countdown_label: "Через 3 дня" },
  teacher_comment:
    "Малика отлично написала контрольную по дробям — одна из лучших работ в классе.",
  teacher_comment_extra:
    "Рекомендую больше практики по геометрии для уверенности в решении задач.",
  teacher_comment_time_label: "2 часа назад",
  assistant_note:
    "Поработайте над задачами по геометрии: углы и треугольники. Мы подобрали 5 заданий для практики.",
};
