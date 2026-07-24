/**
 * Семья: дети (KIDS, строки 3055–3059 макета), профили детей (CHILD_INFO,
 * 3282–3286), родитель (разметка C1/C11), демо-родители (B9).
 * Все значения — ДОСЛОВНО из макета.
 */
import type { ChildInfoRow, ChildRow, DemoParentRow, ParentRow, ParentProfileRow } from "../types";

/** Дети — KIDS. Активный ребёнок по умолчанию — индекс 1 (Малика). */
export const CHILDREN: ChildRow[] = [
  {
    id: "child-aziz",
    full_name: "Азиз Каримов",
    first_name: "Азиз",
    first_name_gen: "Азиза",
    is_female: false,
    class_name: "3-А",
    group_id: "group-3a",
    status_chip: "В школе",
    avatar_gradient: ["#22d3ee", "#3b82f6"],
    avatar_ring: "#0891b2",
  },
  {
    id: "child-malika",
    full_name: "Малика Каримова",
    first_name: "Малика",
    first_name_gen: "Малики",
    is_female: true,
    class_name: "7-А",
    group_id: "group-7a",
    status_chip: "В школе",
    avatar_gradient: ["#8b5cf6", "#ec4899"],
    avatar_ring: "#8b5cf6",
  },
  {
    id: "child-farrukh",
    full_name: "Фаррух Каримов",
    first_name: "Фаррух",
    first_name_gen: "Фарруха",
    is_female: false,
    class_name: "10-А",
    group_id: "group-10a",
    status_chip: "Дома",
    avatar_gradient: ["#34d399", "#0ea5e9"],
    avatar_ring: "#059669",
  },
];

/** Индекс активного ребёнка по умолчанию (initial state: child: 1). */
export const DEFAULT_CHILD_INDEX = 1;

/** Профили детей d29 — CHILD_INFO (индекс = ребёнок). */
export const CHILD_INFO: ChildInfoRow[] = [
  {
    student_id: "child-aziz",
    birth_date_label: "14 марта 2017",
    age_label: "9 лет",
    curator_name: "Дилдора Касымова",
    student_code: "SNR-2026-00312",
    file_no: "№ 03-0312",
    allergies_label: "Нет данных",
    med_note_label: "Нет особенностей",
  },
  {
    student_id: "child-malika",
    birth_date_label: "2 декабря 2012",
    age_label: "13 лет",
    curator_name: "Гульнора Юсупова",
    student_code: "SNR-2026-00847",
    file_no: "№ 07-0847",
    allergies_label: "Пыльца (сезонная)",
    med_note_label: "Очки для чтения",
  },
  {
    student_id: "child-farrukh",
    birth_date_label: "21 мая 2010",
    age_label: "16 лет",
    curator_name: "Александр Петров",
    student_code: "SNR-2026-00291",
    file_no: "№ 10-0291",
    allergies_label: "Нет данных",
    med_note_label: "Нет особенностей",
  },
];

/** Родитель — Дилноза Каримова (шапка Dashboard C1, экран d30 C11). */
export const PARENT: ParentRow = {
  id: "parent-dilnoza",
  full_name: "Дилноза Каримова",
  first_name: "Дилноза",
  initials: "ДК",
  avatar_gradient: ["#8b5cf6", "#22d3ee"],
  phone: "+998 90 123-45-67",
  email: "dilnoza.karimova@gmail.com",
  role_label: "Мать",
};

/** Данные родителя d30 (C11) — дословно. */
export const PARENT_PROFILE: ParentProfileRow = {
  parent_id: "parent-dilnoza",
  full_name_official: "Каримова Дилноза Рустамовна",
  birth_date_label: "8 апреля 1988",
  gender_label: "Женский",
  marital_status_label: "Замужем",
  city: "Ташкент",
  address: "Юнусабад, ул. Амира Темура 12, кв. 34",
  postal_code: "100084",
  workplace: "Artel Group",
  job_title: "Финансовый менеджер",
  work_phone: "+998 71 233-12-90",
  backup_phone: "+998 93 555-21-77",
};

/** Демо-родители шторки входа (B9). */
export const DEMO_PARENTS: DemoParentRow[] = [
  { name: "Бахтиёр Исмаилов", phone: "+998 91 234 56 78", kids_count: 1, kids_initials: ["А"] },
  { name: "Шерзод Рахимов", phone: "+998 93 456 78 90", kids_count: 2, kids_initials: ["А", "М"] },
  { name: "Дилноза Каримова", phone: "+998 90 123 45 67", kids_count: 3, kids_initials: ["А", "М", "Ф"] },
];

/** Текст демо-шторки — дословно (B9). */
export const DEMO_SHEET_TEXT =
  "Выберите аккаунт родителя. Вы увидите реальные данные школы, все действия влияют на настоящую базу.";

/** Шторка помощи экрана входа (B9). */
export const AUTH_HELP = {
  title: "Нужна помощь?",
  body: "Доступ в приложение выдаёт школа. Если у вас нет аккаунта — свяжитесь с администрацией.",
  school_phone_label: "Телефон школы +998 71 200-40-40",
  school_email_label: "Email info@snr-school.uz",
} as const;

/** Шторка «Возможности приложения» (B9). */
export const AUTH_FEATURES = {
  intro: "Всё о школьной жизни ребёнка в одном месте.",
  items: ["Успеваемость и оценки", "Домашние задания", "Оплаты школы", "Связь со школой"],
} as const;

/** Коды стран телефона (B9). */
export const PHONE_COUNTRY_CODES: [string, string][] = [
  ["Узбекистан", "+998"],
  ["Казахстан", "+7"],
  ["Кыргызстан", "+996"],
];
