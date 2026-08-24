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
    preview: "Напоминаю: домашнее задание сдаём до конца недели",
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
  // 23.08.2026: подпись собирает экран на языке интерфейса — было «Сегодня, 23 июля»
  // готовой русской строкой, и на узбекском с английским она такой и оставалась.
  day_divider_date: "2026-07-23",
} as const;

export const TEACHER_CHAT: ChatMessageRow[] = [
  // 23.08.2026. Было: переписка называла ребёнка по имени и поздравляла с
  // оценкой. В демо это читается как настоящий разговор про настоящего
  // ребёнка, поэтому по требованию заказчика текст только школьный и
  // безличный: ни имени, ни оценок, ни ничего личного.
  { from: "t", time_label: "08:45", text: "Добрый день! Напоминаю: домашнее задание сдаём до конца недели." },
  { from: "p", time_label: "08:46", text: "Добрый день! Спасибо, посмотрим сегодня." },
  { from: "t", time_label: "08:47", text: "Если будут вопросы по заданию — пишите, я на связи." },
  { from: "p", time_label: "08:52", text: "Хорошо. Нужно ли приносить тетрадь на следующий урок?" },
  { from: "t", time_label: "08:57", text: "Да, тетрадь понадобится. Остальное выдам на уроке." },
  { from: "p", time_label: "08:58", text: "Спасибо!" },
];

/** Чат поддержки d28 (C10). */
export const SUPPORT_CHAT_HEADER = {
  title: "Поддержка",
  subtitle: "Бухгалтерия",
  status_label: "Онлайн",
  card_name: "Поддержка SNR EduOS",
  card_note: "Мы отвечаем быстро",
  avg_reply_label: "5 мин",
  day_divider_today: true,
} as const;

export const SUPPORT_CHAT: ChatMessageRow[] = [
  { from: "p", time_label: "10:15", text: "Здравствуйте! Вопрос по оплате за август: почему сумма больше, чем в прошлом месяце?" },
  { from: "t", time_label: "10:16", text: "Здравствуйте! Давайте проверим счёт. Уточните, пожалуйста, класс ребёнка." },
  // {class} подставляет экран из настоящего ребёнка — фикстурное имя убрано.
  { from: "p", time_label: "10:17", text: "{class}" },
  {
    from: "t",
    time_label: "10:19",
    // {sum} — из тех же BILLS, что и раздел оплат: расходиться нечему.
    text: "К оплате за август: {sum}. Дополнительных начислений нет. Если остались вопросы — напишите нам.",
    is_info_card: true,
    info_card_title: "Информация по счёту",
  },
  { from: "p", time_label: "10:20", text: "Спасибо, всё понятно." },
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
