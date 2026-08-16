/**
 * Сообщения: список тредов msgList (строки 3586–3595 макета), чат с
 * Гульнорой d25 (C9), чат поддержки d28 (C10), чипы саппорта (B11).
 * Все значения — ДОСЛОВНО из макета (включая эмодзи).
 */
import type { ChatMessageRow, MessagesStoryRow, MessageThreadRow } from "../types";

export const MESSAGE_THREADS: MessageThreadRow[] = [
  {
    category: "chats",
    name: "Гульнора Юсупова",
    role_label: "Учитель",
    preview: "И поздравляю Малику с пятёркой за контрольную 🎉",
    time_label: "09:00",
    badge: 2,
    go: "d25",
    avatar_gradient: ["#8b5cf6", "#6366f1"],
    avatar_initials: "ГЮ",
    is_online: true,
  },
  {
    category: "ann",
    name: "Объявления школы",
    role_label: null,
    preview: "24 июля состоится школьная ярмарка. Будем рады видеть вас!",
    time_label: "вчера",
    badge: 3,
    go: "d26",
    avatar_gradient: ["#a78bfa", "#7c3aed"],
    avatar_icon_key: "mega",
  },
  {
    category: "chats",
    name: "Севара Умарова",
    role_label: "Куратор 7-А",
    preview: "Уважаемые родители! Напоминаю о родительском собрании 30 июля",
    time_label: "вчера",
    badge: 1,
    go: "d25",
    avatar_gradient: ["#f472b6", "#8b5cf6"],
    avatar_initials: "СУ",
    is_online: true,
  },
  {
    category: "chats",
    name: "Администрация",
    role_label: null,
    preview: "Ваше заявление на справку принято. Готовность: 26 июля",
    time_label: "19 июля",
    badge: null,
    go: "d27",
    avatar_gradient: ["#60a5fa", "#2563eb"],
    avatar_icon_key: "grid",
  },
  {
    category: "svc",
    name: "Бухгалтерия",
    role_label: null,
    preview: "Поступил платёж на сумму 4 500 000 сум за июль. Спасибо!",
    time_label: "18 июля",
    badge: null,
    go: "d28",
    avatar_gradient: ["#34d399", "#059669"],
    avatar_icon_key: "card",
  },
  {
    category: "svc",
    name: "Питание",
    role_label: null,
    preview: "Меню на следующую неделю уже доступно в разделе «Питание»",
    time_label: "18 июля",
    badge: null,
    // Заход 8: dmeals — реальный экран (MealsScreen), stub:meals устарел.
    go: "dmeals",
    avatar_gradient: ["#f472b6", "#db2777"],
    avatar_icon_key: "food",
  },
  {
    category: "svc",
    name: "Транспорт",
    role_label: null,
    preview: "Изменение маршрута №3 с 28 июля. Проверьте расписание",
    time_label: "17 июля",
    badge: null,
    // Заход 8: dtrans — реальный экран (TransportScreen), stub:transport устарел.
    go: "dtrans",
    avatar_gradient: ["#fbbf24", "#f97316"],
    avatar_icon_key: "clock",
  },
  {
    category: "svc",
    name: "Медкабинет",
    role_label: null,
    preview: "Плановый медосмотр 30 июля. Подробнее в объявлении",
    time_label: "17 июля",
    badge: null,
    // Заход 8: dmed — реальный экран (MedicalCardScreen), stub:med устарел.
    go: "dmed",
    avatar_gradient: ["#fb7185", "#e11d48"],
    avatar_icon_key: "plus",
  },
];







/** Меню вложений чата d25. */
export const CHAT_ATTACH_OPTIONS = ["Фото", "Файл"] as const;
