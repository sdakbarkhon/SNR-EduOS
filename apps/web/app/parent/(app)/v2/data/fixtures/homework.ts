/**
 * Домашние задания: список d12 (C6), детали d13 (C7), файлы отправки (B11).
 * Все значения — ДОСЛОВНО из макета.
 */
import type { HomeworkCardRow, HomeworkDetail, HomeworkFilterChip, UploadFileFixture } from "../types";

/** Чипы-фильтры d12. */
export const HOMEWORK_FILTER_CHIPS: HomeworkFilterChip[] = [
  { label: "Все", count: 5 },
  { label: "Сегодня", count: 2 },
  { label: "Просрочено", count: 1 },
  { label: "Выполнено", count: 1 },
];

/** Карточки d12 — дословно (C6). */
export const HOMEWORK_LIST: HomeworkCardRow[] = [
  {
    id: "hw-math",
    subject_id: "math",
    status_label: "Выполнено",
    title: "№ 140–148, дроби и уравнения",
    due_label: "Сдано сегодня, 10:15",
    progress: 100,
  },
  {
    id: "hw-eng",
    subject_id: "eng",
    status_label: "В работе",
    title: "Эссе «My Summer», 150 слов",
    due_label: "Срок: завтра, 18:00",
    progress: 60,
  },
  {
    id: "hw-prog",
    subject_id: "prog",
    status_label: "На проверке",
    title: "Проект «Калькулятор» на Python",
    due_label: "Сдано вчера, 19:40",
    progress: "hourglass",
  },
  {
    id: "hw-robo",
    subject_id: "robo",
    status_label: "Просрочено",
    title: "Отчёт по сборке манипулятора",
    due_label: "Срок истёк: 20 июля, 18:00",
    progress: 0,
  },
  {
    id: "hw-rus",
    subject_id: "rus",
    status_label: "Не назначено",
    title: "Сочинение по теме «Моя школа»",
    due_label: "Срок: 27 июля, 18:00",
    progress: null,
  },
];

/** Итоговая строка d12: Всего 5 · Выполнено 1 · На проверке 1 · Просрочено 1. */
export const HOMEWORK_TOTALS = {
  total: HOMEWORK_LIST.length,
  done: HOMEWORK_LIST.filter((h) => h.status_label === "Выполнено").length,
  under_review: HOMEWORK_LIST.filter((h) => h.status_label === "На проверке").length,
  overdue: HOMEWORK_LIST.filter((h) => h.status_label === "Просрочено").length,
} as const;

/** Детали задания d13 (C7) — дословно. */
export const HOMEWORK_DETAIL: HomeworkDetail = {
  subject_id: "math",
  title: "№ 140–148, дроби и уравнения",
  status_chip: "На проверке",
  due_label: "Срок: 24 июля, 18:00",
  teacher_name: "Гульнора Юсупова",
  teacher_initials: "ГЮ",
  instruction:
    "Решите задания № 140–148 на уравнения и дроби. Оформите решения в тетради и отправьте фото или файл. Удачи!",
  attachment: { name: "Задания_Дроби_Уравнения.pdf", type_label: "PDF", size_label: "1.2 МБ" },
  timeline: [
    { label: "Выдано", date_label: "21 июля, 09:15" },
    { label: "В работе", date_label: "21 июля, 16:20" },
    { label: "Сдано", date_label: "22 июля, 19:45" },
    { label: "Проверка", date_label: "в процессе" },
  ],
  teacher_comment: "Хорошая работа! Всё верно, только в задаче 3 проверьте второй шаг решения.",
  teacher_comment_date_label: "22 июля, 21:10",
};

/** Файлы формы «Отправка работы» (B11), максимум 4. */
export const HOMEWORK_UPLOAD_FILES: UploadFileFixture[] = [
  { name: "Эссе_MySummer_v2.docx", size_label: "128 КБ" },
  { name: "Фото_страницы.jpg", size_label: "2.1 МБ" },
];
export const HOMEWORK_UPLOAD_MAX_FILES = 4;
