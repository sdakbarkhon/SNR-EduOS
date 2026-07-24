/**
 * Dashboard П5 (C1) и EduOS Assistant d7 (C12).
 * Все значения — ДОСЛОВНО из макета.
 *
 * Связанные числа НЕ хардкодятся здесь:
 *  - «К ОПЛАТЕ 4 950 000 / 2 счёта» — считается из BILLS (../index.ts);
 *  - «КОШЕЛЁК 185 000» — из WALLETS[выбранный ребёнок];
 *  - бейдж колокольчика «3» — из NOTIFICATIONS (is_unread).
 */
import type { DashboardFeedItem, NextLessonCard } from "../types";

/** Приветствие Dashboard: «Доброе утро, Дилноза!» + подпись с genitive-именем. */
export const DASHBOARD_GREETING = {
  title_prefix: "Доброе утро, ",
  /** «Вот что происходит у {gen} сегодня» — gen подставляется из ребёнка. */
  subtitle_template: "Вот что происходит у {gen} сегодня",
} as const;

/** Статус-строка карточки ребёнка: «В ШКОЛЕ С 08:12 · УРОКОВ 6 · ПОСЕЩЕНО 2/6 · ДЗ 2». */
export const DASHBOARD_CHILD_STATUS = {
  at_school_since_label: "08:12",
  lessons_total: 6,
  lessons_attended: 2,
  homework_count: 2,
} as const;

/** «Следующий урок» (аномалия №4: здесь «Каб. 204», в расписании «Кабинет 101»). */
export const NEXT_LESSON_CARD: NextLessonCard = {
  subject_name: "Математика",
  time_room_teacher_label: "10:20–11:05 · Каб. 204 · Гульнора Юсупова",
  tile_label: "√x",
  gradient: ["#6366f1", "#38bdf8"],
};

/** Карточка «ПИТАНИЕ» Dashboard: «Оплачено / до 31 июля». */
export const MEALS_CARD = {
  status_label: "Оплачено",
  until_label: "до 31 июля",
  gradient: ["#34d399", "#0ea5e9"] as [string, string],
} as const;

/** Градиент карточки «К ОПЛАТЕ» + подпись срока (сумма и число счетов — из BILLS). */
export const DUE_CARD = {
  until_label: "до 5 авг",
  gradient: ["#f43f5e", "#fb923c"] as [string, string],
} as const;

/** Лента «Сегодня» Dashboard (C1, строки 266–268). */
export const DASHBOARD_FEED: DashboardFeedItem[] = [
  {
    title: "Математика — оценка за контрольную",
    subtitle: "Дроби и проценты · 10:42",
    badge: { kind: "grade", value: 5 },
    go: "d11",
  },
  {
    title: "Английский язык — эссе «My Summer»",
    subtitle: "Домашнее задание",
    badge: { kind: "chip", label: "Срок завтра" },
    go: "d12",
  },
  {
    title: "Питание оплачено",
    subtitle: "Обед получен в 12:40",
    badge: { kind: "chip", label: "Успешно" },
    go: "dmeals",
  },
];

/** Быстрые действия Dashboard (6). */
export const QUICK_ACTIONS = ["Оплатить", "Дом. задания", "Все сервисы", "Питание", "Профиль ребёнка", "Расписание"] as const;

/** Статус дня d6 (C4): баннер и питание.
 *  {suf} — гендерный суффикс ребёнка (макет: childSuf = k.f ? 'а' : '',
 *  строка 3853); подставляется через format() + is_female в аксессоре. */
export const DAY_STATUS = {
  banner_title_suffix: " в школе", // «Малика в школе»
  banner_sub: "Пришл{suf} в 08:12 · главный вход",
  ring_note: "3-й урок идёт сейчас, впереди ещё 3",
  meals_menu_label: "Меню: стандартное",
  meals_time_label: "Обед в 12:40 · столовая",
} as const;

/** Тексты EduOS Assistant, генерируемые от имени ребёнка (B10) — шаблоны
 *  конкатенации макета; собираются в аксессорах ../index.ts. */
export const ASSISTANT_TEXT_TEMPLATES = {
  dashboard: " показывает отличный прогресс по математике. За последние 7 дней снизилась активность по английскому языку.",
  overview7: " показывает уверенный рост по математике и программированию. По английскому языку заметно снижение активности — стоит поддержать практикой на этой неделе.",
  review_prefix: " отлично написал",
  review_suffix: " контрольную по дробям — одна из лучших работ в классе.",
} as const;

/** EduOS Assistant d7 (C12): рекомендации и прогресс. */
export const ASSISTANT_SCREEN = {
  overall_chip: "Хороший прогресс!",
  overall_period: "За последние 7 дней",
  actions: [
    {
      title: "Повторить Past Simple",
      text: "По английскому языку заметно снижение активности — 20 минут практики речи помогут вернуть темп.",
    },
    {
      title: "Задачи на углы и треугольники",
      text: "В пятницу тест по геометрии — 5 задач для тренировки закрепят тему до контрольной.",
    },
    {
      title: "План сочинения заранее",
      text: "По русскому языку сочинения сдаются в последний момент — 20 минут на план за день до сдачи снимут спешку.",
    },
  ],
  details_link_label: "Смотреть детальную статистику ›",
} as const;
