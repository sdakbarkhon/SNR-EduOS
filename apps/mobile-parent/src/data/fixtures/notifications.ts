/**
 * Настройки уведомлений: категории NTF_DEFS (строки 3287–3297 макета) и
 * дефолты тумблеров. Значения — ДОСЛОВНО из макета.
 *
 * САМА ЛЕНТА уведомлений отсюда ушла 14.08.2026: экран «Уведомления» перешёл
 * на таблицу `notifications` (getMyNotifications), а бэйдж колокольчика — на
 * getUnreadCount. Остались только настройки — это отдельный экран (d32) и
 * отдельный заход.
 */
import type { NotificationCategoryRow } from "../types";
/** NTF_DEFS — категории настроек уведомлений; дефолты: все true, promo false. */
export const NOTIFICATION_CATEGORIES: NotificationCategoryRow[] = [
  {
    id: "grades",
    name: "Оценки и успехи",
    subtitle: "О новых оценках и достижениях",
    gradient: ["#34d399", "#059669"],
    icon_paths: ["M22 7l-8.5 8.5-5-5L2 17", "M16 7h6v6"],
    enabled_by_default: true,
  },
  {
    id: "hw",
    name: "Домашние задания",
    subtitle: "О новых ДЗ и сроках сдачи",
    gradient: ["#60a5fa", "#2563eb"],
    icon_paths: ["M3 8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z", "m8.5 12 2.5 2.5 5-5"],
    enabled_by_default: true,
  },
  {
    id: "sched",
    name: "Расписание",
    subtitle: "Изменения в расписании уроков",
    gradient: ["#a78bfa", "#7c3aed"],
    icon_paths: ["M8 2v4", "M16 2v4", "M3 8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z", "M3 10h18"],
    enabled_by_default: true,
  },
  {
    id: "att",
    name: "Посещаемость",
    subtitle: "Уведомления о пропусках уроков",
    gradient: ["#fb7185", "#e11d48"],
    icon_paths: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
    enabled_by_default: true,
  },
  {
    id: "ann",
    name: "Объявления школы",
    subtitle: "Важные новости и объявления",
    gradient: ["#fbbf24", "#f97316"],
    icon_paths: ["m3 11 18-7v16L3 13v-2Z", "M11.6 16.8a3 3 0 1 1-5.8-1.6"],
    enabled_by_default: true,
  },
  {
    id: "events",
    name: "Мероприятия",
    subtitle: "Школьные мероприятия и события",
    gradient: ["#f472b6", "#db2777"],
    icon_paths: ["M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2z"],
    enabled_by_default: true,
  },
  {
    id: "pay",
    name: "Оплаты",
    subtitle: "Счета, платежи и напоминания",
    gradient: ["#22d3ee", "#0891b2"],
    icon_paths: ["M2 8a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z", "M2 10h20"],
    enabled_by_default: true,
  },
  {
    id: "msg",
    name: "Сообщения",
    subtitle: "Новые сообщения от учителей и школы",
    gradient: ["#8b5cf6", "#6366f1"],
    icon_paths: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
    enabled_by_default: true,
  },
  {
    id: "promo",
    name: "Рекламные рассылки",
    subtitle: "Новости и предложения EduOS",
    gradient: ["#94a3b8", "#64748b"],
    icon_paths: ["m3 11 18-7v16L3 13v-2Z", "M11.6 16.8a3 3 0 1 1-5.8-1.6"],
    enabled_by_default: false,
  },
];

/** Мастер-тумблер уведомлений (initial state ntfMaster). */
export const NOTIFICATIONS_MASTER_DEFAULT = true;
