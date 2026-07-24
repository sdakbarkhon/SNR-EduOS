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
    go: "stub:meals",
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
    go: "stub:transport",
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
    go: "stub:med",
    avatar_gradient: ["#fb7185", "#e11d48"],
    avatar_icon_key: "plus",
  },
];

/** Стория раздела «Сообщения» d24: 5 круглых элементов (см. recon-tabs). */
export const MESSAGES_STORIES: MessagesStoryRow[] = [
  {
    id: "important",
    label_key: "storyImportant",
    gradient: ["#a78bfa", "#7c3aed"],
    kind: "icon",
    icon_key: "mega",
    go: "d26",
  },
  {
    id: "curator",
    label_key: "storyCurator",
    gradient: ["#f472b6", "#8b5cf6"],
    kind: "chat",
    initials: "СУ",
    is_online: true,
    go: "d25",
  },
  {
    id: "math",
    label_key: "storyMath",
    gradient: ["#8b5cf6", "#6366f1"],
    kind: "chat",
    initials: "ГЮ",
    is_online: true,
    go: "d25",
  },
  {
    id: "eng",
    label_key: "storyEng",
    gradient: ["#f472b6", "#db2777"],
    kind: "chat",
    initials: "НА",
    is_online: true,
    go: "d25",
  },
  {
    id: "admin",
    label_key: "storyAdmin",
    gradient: ["#60a5fa", "#2563eb"],
    kind: "icon",
    icon_key: "grid",
    go: "d27",
  },
];

/** Чат с Гульнорой Юсуповой d25 (C9): разделитель «Сегодня, 23 июля». */
export const TEACHER_CHAT_HEADER = {
  name: "Гульнора Юсупова",
  subject_chip: "Математика",
  status_label: "Онлайн",
  day_divider: "Сегодня, 23 июля",
} as const;

export const TEACHER_CHAT: ChatMessageRow[] = [
  { from: "t", time_label: "08:45", text: "Добрый день! 👋 Напоминаю: завтра сдаём № 140–148 по дробям и уравнениям." },
  { from: "p", time_label: "08:46", text: "Добрый день! Спасибо за напоминание. Малика уже почти закончила ✍️" },
  { from: "t", time_label: "08:47", text: "Отлично! Если будут вопросы по уравнениям — пишите, я на связи." },
  { from: "p", time_label: "08:52", text: "Хорошо! Вопрос: № 145 обязательно решать двумя способами?" },
  { from: "t", time_label: "08:57", text: "Достаточно одного, но второй способ засчитаю как бонусное задание 🙂" },
  { from: "p", time_label: "08:58", text: "Поняла, спасибо большое! 🙏" },
  { from: "t", time_label: "09:00", text: "Хорошего дня! И поздравляю Малику с пятёркой за контрольную 🎉" },
];

/** Чат поддержки d28 (C10). */
export const SUPPORT_CHAT_HEADER = {
  title: "Поддержка",
  subtitle: "Бухгалтерия",
  status_label: "Онлайн",
  card_name: "Поддержка SNR EduOS",
  card_note: "Мы отвечаем быстро",
  avg_reply_label: "5 мин",
  day_divider: "Сегодня",
} as const;

export const SUPPORT_CHAT: ChatMessageRow[] = [
  { from: "p", time_label: "10:15", text: "Здравствуйте! Вопрос по оплате за август: почему сумма больше, чем в прошлом месяце?" },
  { from: "t", time_label: "10:16", text: "Здравствуйте! 👋 Давайте проверим ваш счёт. Уточните, пожалуйста, имя ребёнка и класс." },
  { from: "p", time_label: "10:17", text: "Малика Каримова, 7-А класс." },
  {
    from: "t",
    time_label: "10:19",
    text: "К оплате за август: обучение — 4 500 000 сум и питание — 450 000 сум, итого 4 950 000 сум. Дополнительных начислений нет. Если остались вопросы — напишите нам.",
    is_info_card: true,
    info_card_title: "Информация по счёту",
  },
  { from: "p", time_label: "10:20", text: "Спасибо за информацию! Всё понятно 🙏" },
];

/** Чипы поддержки (B11) — подставляемые тексты. */
export const SUPPORT_CHIPS = [
  { label: "Оплата обучения", text: "Здравствуйте! Вопрос по оплате обучения." },
  { label: "Питание", text: "Здравствуйте! Вопрос по питанию." },
  { label: "Чеки и документы", text: "Здравствуйте! Нужны чеки и документы об оплате." },
  { label: "Возврат средств", text: "Здравствуйте! Как оформить возврат средств?" },
] as const;

/** Меню вложений чата d25. */
export const CHAT_ATTACH_OPTIONS = ["Фото", "Файл"] as const;
