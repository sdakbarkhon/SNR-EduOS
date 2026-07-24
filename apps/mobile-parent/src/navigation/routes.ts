/**
 * Реестр маршрутов v2 — все 64 экрана прототипа (scratchpad/zahod1/screens-map.md).
 * Имена маршрутов = ключи навигации макета (state.cur / layer('<key>')).
 *
 * ICONS и STUBS перенесены ДОСЛОВНО из макета «SNR EduOS v2 Light.dc.html»
 * (ICONS — строки 3060–3080, STUBS — строки 3081–3157).
 */

/* ===== ICONS (SVG-пути 24×24, дословно из макета) ===== */

export const ICONS: Record<string, string[]> = {
  bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  user: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"],
  cal: ["M8 2v4", "M16 2v4", "M3 8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z", "M3 10h18"],
  chat: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
  check: ["M3 8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z", "m8.5 12 2.5 2.5 5-5"],
  food: ["M4 2v7a3 3 0 0 0 6 0V2", "M7 12v10", "M20 2a4 4 0 0 0-4 4v7h4", "M20 13v9"],
  robot: ["M4 12a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z", "M12 8V4", "M9 14v1", "M15 14v1"],
  spark: ["M12 2l2.2 7.2L22 12l-7.8 2.8L12 22l-2.2-7.2L2 12l7.8-2.8L12 2z"],
  doc: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z", "M14 3v5h5", "M9 13h6", "M9 17h4"],
  card: ["M2 8a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z", "M2 10h20"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
  wallet: ["M20 12V8H6a2 2 0 0 1 0-4h12v4", "M4 6v12a2 2 0 0 0 2 2h14v-6", "M18 12a2 2 0 0 0 0 4h4v-4Z"],
  plus: ["M12 5v14", "M5 12h14"],
  star: ["M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2z"],
  book: ["M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z", "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"],
  grid: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"],
  mega: ["m3 11 18-7v16L3 13v-2Z", "M11.6 16.8a3 3 0 1 1-5.8-1.6"],
  img: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z", "m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21", "M9 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"],
  search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "m20 20-3.5-3.5"],
};

/* ===== Конфиг заглушки ===== */

export interface StubInfo {
  /** Заголовок (дословный из макета, ru) — фолбэк, если нет tKey. */
  t: string;
  /**
   * Путь в словаре d.parentApp («scr.notifications», «svc.meals»…) — задан
   * только там, где ru-значение словаря ДОСЛОВНО совпадает с t; остальные
   * заголовки в словаре макета отсутствуют и остаются строкой t (1:1).
   */
  tKey?: string;
  /** Номер экрана / фаза-подпись. */
  n: string;
  /** Градиент плитки [from, to]. */
  g: [string, string];
  /** Ключ иконки из ICONS (фолбэк — doc). */
  i: string;
}

/* ===== STUBS (дословно, строки 3081–3157 макета, 75 записей) ===== */

export const STUBS: Record<string, StubInfo> = {
  notif: { t: "Уведомления", tKey: "scr.notifications", n: "Экран #8", g: ["#fbbf24", "#f97316"], i: "bell" },
  child: { t: "Профиль ребёнка", tKey: "scr.childProfile", n: "Экран #29", g: ["#34d399", "#059669"], i: "user" },
  prof: { t: "Профиль", tKey: "nav.profile", n: "Экраны #29–34", g: ["#8b5cf6", "#22d3ee"], i: "user" },
  sched: { t: "Расписание", tKey: "scr.schedule", n: "Экран #15", g: ["#a78bfa", "#7c3aed"], i: "cal" },
  msgs: { t: "Сообщения", tKey: "nav.messages", n: "Экран #24", g: ["#22d3ee", "#0891b2"], i: "chat" },
  hw: { t: "Домашние задания", tKey: "scr.homeworks", n: "Экран #12", g: ["#60a5fa", "#2563eb"], i: "check" },
  meals: { t: "Питание", tKey: "svc.meals", n: "Сервис-раздел", g: ["#f472b6", "#db2777"], i: "food" },
  clubs: { t: "Кружки", n: "Сервис-раздел", g: ["#818cf8", "#4f46e5"], i: "robot" },
  subj: { t: "Детали предмета", n: "Экран #11", g: ["#facc15", "#ca8a04"], i: "book" },
  assistant: { t: "EduOS Assistant", n: "Экран #7", g: ["#8b5cf6", "#6366f1"], i: "spark" },
  allsubj: { t: "Все предметы", tKey: "scr.allSubjects", n: "Раздел «Успехи»", g: ["#38bdf8", "#0284c7"], i: "book" },
  reviews: { t: "Отзывы учителей", tKey: "scr.teacherReviews", n: "Раздел «Успехи»", g: ["#f472b6", "#db2777"], i: "star" },
  bills: { t: "Счета к оплате", tKey: "scr.bills", n: "Экран #18", g: ["#fb923c", "#ef4444"], i: "doc" },
  checkout: { t: "Checkout", n: "Экран #19", g: ["#7c3aed", "#4f6df5"], i: "card" },
  history: { t: "История оплат", tKey: "scr.payHistory", n: "Экран #20", g: ["#60a5fa", "#2563eb"], i: "clock" },
  receipts: { t: "Счета и чеки", n: "Экран #21", g: ["#fbbf24", "#f97316"], i: "doc" },
  wallet: { t: "Кошелёк ребёнка", tKey: "scr.childWallet", n: "Экран #22", g: ["#7c3aed", "#a855f7"], i: "wallet" },
  paymeth: { t: "Способы оплаты", tKey: "scr.payMethods", n: "Экран #33", g: ["#a78bfa", "#7c3aed"], i: "card" },
  topup: { t: "Пополнение баланса", tKey: "scr.topup", n: "Раздел «Оплаты»", g: ["#34d399", "#059669"], i: "plus" },
  topics: { t: "Освоение тем", tKey: "scr.topics", n: "Раздел «Предмет»", g: ["#facc15", "#ca8a04"], i: "book" },
  upload: { t: "Отправка работы", n: "Действие", g: ["#60a5fa", "#2563eb"], i: "plus" },
  file: { t: "Просмотр файла", n: "Действие", g: ["#f87171", "#dc2626"], i: "doc" },
  day: { t: "Детальный статус дня", n: "Экран #6", g: ["#34d399", "#0ea5e9"], i: "clock" },
  services: { t: "Все сервисы", tKey: "scr.services", n: "Экран #9", g: ["#8b5cf6", "#22d3ee"], i: "grid" },
  attend: { t: "Посещаемость", tKey: "scr.attendance", n: "Экран #14", g: ["#34d399", "#059669"], i: "cal" },
  skills16: { t: "Навыки и развитие", tKey: "scr.skills", n: "Экран #16", g: ["#22d3ee", "#3b82f6"], i: "spark" },
  datepick: { t: "Выбор даты", n: "Действие", g: ["#a78bfa", "#7c3aed"], i: "cal" },
  schedopts: { t: "Действия с расписанием", n: "Действие", g: ["#94a3b8", "#64748b"], i: "grid" },
  search: { t: "Поиск по сервисам", n: "Действие", g: ["#60a5fa", "#2563eb"], i: "search" },
  diary: { t: "Дневник", tKey: "svc.diary", n: "Сервис-раздел", g: ["#22d3ee", "#0891b2"], i: "book" },
  tests: { t: "Тесты", tKey: "svc.tests", n: "Сервис-раздел", g: ["#f472b6", "#db2777"], i: "doc" },
  library: { t: "Библиотека", tKey: "svc.library", n: "Сервис-раздел", g: ["#818cf8", "#4f46e5"], i: "book" },
  portfolio: { t: "Портфолио", tKey: "svc.portfolio", n: "Сервис-раздел", g: ["#2dd4bf", "#0d9488"], i: "star" },
  apps: { t: "Заявления", tKey: "svc.applications", n: "Сервис-раздел", g: ["#34d399", "#059669"], i: "doc" },
  med: { t: "Медкарта", tKey: "svc.medcard", n: "Сервис-раздел", g: ["#fb7185", "#e11d48"], i: "plus" },
  transport: { t: "Транспорт", tKey: "svc.transport", n: "Сервис-раздел", g: ["#fbbf24", "#f97316"], i: "clock" },
  settings: { t: "Настройки", tKey: "prof.settings", n: "Экраны #32–34", g: ["#94a3b8", "#64748b"], i: "grid" },
  announce: { t: "Объявления школы", tKey: "scr.announcements", n: "Экран #26", g: ["#a78bfa", "#7c3aed"], i: "mega" },
  docs31: { t: "Документы", tKey: "scr.documents", n: "Экран #31", g: ["#60a5fa", "#2563eb"], i: "doc" },
  whatsnew: { t: "Что нового в SNR EduOS", n: "Промо-раздел", g: ["#7c3aed", "#22d3ee"], i: "spark" },
  teacherprof: { t: "Профиль учителя", tKey: "scr.teacherProfile", n: "Раздел «Сообщения»", g: ["#8b5cf6", "#6366f1"], i: "user" },
  compose: { t: "Новое сообщение", n: "Действие", g: ["#8b5cf6", "#22d3ee"], i: "chat" },
  actions: { t: "Действия", n: "Действие", g: ["#94a3b8", "#64748b"], i: "grid" },
  aphoto: { t: "Отправка фото", n: "Действие", g: ["#60a5fa", "#2563eb"], i: "img" },
  afile: { t: "Отправка файла", n: "Действие", g: ["#fbbf24", "#f97316"], i: "doc" },
  help: { t: "Справка", n: "Действие", g: ["#60a5fa", "#2563eb"], i: "doc" },
  transfer: { t: "Перевод средств", n: "Раздел «Кошелёк»", g: ["#60a5fa", "#2563eb"], i: "card" },
  limits: { t: "Лимиты трат", n: "Раздел «Кошелёк»", g: ["#a78bfa", "#7c3aed"], i: "grid" },
  walletops: { t: "Операции кошелька", tKey: "scr.walletOps", n: "Раздел «Кошелёк»", g: ["#fbbf24", "#f97316"], i: "clock" },
  walletmenu: { t: "Действия с кошельком", n: "Действие", g: ["#94a3b8", "#64748b"], i: "grid" },
  carddet: { t: "Детали карты", n: "Раздел «Способы оплаты»", g: ["#7c3aed", "#4f6df5"], i: "card" },
  addcard: { t: "Добавление карты", n: "Раздел «Способы оплаты»", g: ["#34d399", "#059669"], i: "plus" },
  about: { t: "О приложении", tKey: "scr.about", n: "Раздел «Профиль»", g: ["#94a3b8", "#64748b"], i: "doc" },
  achieve: { t: "Достижения", n: "Раздел «Профиль ребёнка»", g: ["#fbbf24", "#f97316"], i: "star" },
  docview: { t: "Просмотр документа", n: "Раздел «Документы»", g: ["#60a5fa", "#2563eb"], i: "doc" },
  adddoc: { t: "Добавление документа", n: "Действие", g: ["#7c3aed", "#4f6df5"], i: "plus" },
  chpass: { t: "Изменение пароля", n: "Раздел «Безопасность»", g: ["#a78bfa", "#7c3aed"], i: "grid" },
  sessions: { t: "Активные сессии", tKey: "scr.sessions", n: "Раздел «Безопасность»", g: ["#60a5fa", "#2563eb"], i: "clock" },
  autoexit: { t: "Автоматический выход", tKey: "prof.autoExit", n: "Раздел «Конфиденциальность»", g: ["#fbbf24", "#f97316"], i: "clock" },
  terms: { t: "Условия использования", tKey: "prof.terms", n: "Документ", g: ["#94a3b8", "#64748b"], i: "doc" },
  privacy: { t: "Политика конфиденциальности", tKey: "prof.privacy", n: "Документ", g: ["#94a3b8", "#64748b"], i: "doc" },
  profmenu: { t: "Действия", n: "Действие", g: ["#94a3b8", "#64748b"], i: "grid" },
  authGoogle: { t: "Вход через Google", n: "Сервис появится позже", g: ["#60a5fa", "#2563eb"], i: "user" },
  authApple: { t: "Вход через Apple", n: "Сервис появится позже", g: ["#334155", "#0f172a"], i: "user" },
  call: { t: "Звонок в школу", n: "Действие", g: ["#34d399", "#059669"], i: "chat" },
  testreview: { t: "Разбор ответов", tKey: "scr.testReview", n: "Раздел «Тесты»", g: ["#38bdf8", "#0284c7"], i: "doc" },
  matview: { t: "Просмотр материала", n: "Раздел «Библиотека»", g: ["#818cf8", "#4f46e5"], i: "book" },
  workdet: { t: "Детали работы", n: "Раздел «Портфолио»", g: ["#2dd4bf", "#0d9488"], i: "star" },
  appdet: { t: "Детали заявления", n: "Раздел «Заявления»", g: ["#34d399", "#059669"], i: "doc" },
  newapp: { t: "Новое заявление", n: "Действие", g: ["#7c3aed", "#4f6df5"], i: "plus" },
  dl: { t: "Скачивание файла", n: "Действие", g: ["#60a5fa", "#2563eb"], i: "doc" },
  rate: { t: "Оценка в App Store", n: "Действие", g: ["#fbbf24", "#f97316"], i: "star" },
  share: { t: "Поделиться", n: "Действие", g: ["#22d3ee", "#0891b2"], i: "chat" },
  getdoc: { t: "Получение документа", n: "Действие", g: ["#34d399", "#059669"], i: "check" },
  dial: { t: "Системный звонок", n: "Действие", g: ["#34d399", "#059669"], i: "chat" },
};

export type StubKey = keyof typeof STUBS;

/* ===== Реестр 64 экранов ===== */

/** Табы (5 корневых веток, лейблы подключит к словарю следующий агент). */
export const TAB_ROUTES = ["p5", "p10", "p17", "d24", "dhub"] as const;
export type TabRouteName = (typeof TAB_ROUTES)[0] | (typeof TAB_ROUTES)[1] | (typeof TAB_ROUTES)[2] | (typeof TAB_ROUTES)[3] | (typeof TAB_ROUTES)[4];

/**
 * SCREEN_INFO: маршрут → конфиг заглушки Захода 1.
 * Где для экрана есть родная запись STUBS — берём её дословно; для экранов,
 * у которых записи в STUBS нет (p5/p10/p17, d13, d25, d27, d28, d30, d32,
 * d34, a1–a4, ddoc), конфиг синтезирован из карты экранов (data-screen-label
 * → t, номер → n) с нейтральным градиентом accent-grad и иконкой doc
 * (фолбэк макета ICONS.doc).
 */
export const SCREEN_INFO: Record<string, StubInfo> = {
  // Табы
  p5: { t: "Dashboard", n: "Экран П5", g: ["#7c3aed", "#4f6df5"], i: "grid" },
  p10: { t: "Успехи", tKey: "nav.grades", n: "Экран П10", g: ["#7c3aed", "#4f6df5"], i: "star" },
  p17: { t: "Оплаты", tKey: "nav.payments", n: "Экран П17", g: ["#7c3aed", "#4f6df5"], i: "card" },
  d24: STUBS.msgs,
  dhub: STUBS.prof,
  // Учёба
  d6: STUBS.day,
  d11: STUBS.subj,
  d12: STUBS.hw,
  d13: { t: "Детали задания", n: "Экран #13", g: ["#60a5fa", "#2563eb"], i: "check" },
  d14: STUBS.attend,
  d15: STUBS.sched,
  d16: STUBS.skills16,
  d7: STUBS.assistant,
  dallsubj: STUBS.allsubj,
  drev: STUBS.reviews,
  dtopics: STUBS.topics,
  // Служебные / сервисы
  d8: STUBS.notif,
  d9: STUBS.services,
  // Сообщения
  d25: { t: "Чат", n: "Экран #25", g: ["#22d3ee", "#0891b2"], i: "chat" },
  d26: STUBS.announce,
  d27: { t: "От администрации", tKey: "scr.adminNews", n: "Экран #27", g: ["#a78bfa", "#7c3aed"], i: "mega" },
  d28: { t: "Поддержка", tKey: "scr.support", n: "Экран #28", g: ["#60a5fa", "#2563eb"], i: "chat" },
  dteach: STUBS.teacherprof,
  // Оплаты
  d18: STUBS.bills,
  d19: STUBS.checkout,
  d20: STUBS.history,
  d21: STUBS.receipts,
  d22: STUBS.wallet,
  d33: STUBS.paymeth,
  dtop: STUBS.topup,
  dwops: STUBS.walletops,
  dtransfer: STUBS.transfer,
  dlimits: STUBS.limits,
  dcarddet: STUBS.carddet,
  daddcard: STUBS.addcard,
  // Профиль
  d29: STUBS.child,
  d30: { t: "Данные родителя", tKey: "scr.parentData", n: "Экран #30", g: ["#8b5cf6", "#22d3ee"], i: "user" },
  d31: STUBS.docs31,
  d32: { t: "Настройки уведомлений", tKey: "scr.notifSettings", n: "Экран #32", g: ["#94a3b8", "#64748b"], i: "bell" },
  d34: { t: "Язык и безопасность", tKey: "scr.langSec", n: "Экран #34", g: ["#94a3b8", "#64748b"], i: "grid" },
  dchpass: STUBS.chpass,
  dsessions: STUBS.sessions,
  // Сервисы
  dmeals: STUBS.meals,
  ddiary: STUBS.diary,
  dtests: STUBS.tests,
  dlib: STUBS.library,
  dport: STUBS.portfolio,
  dapps: STUBS.apps,
  dmed: STUBS.med,
  dtrans: STUBS.transport,
  // Вход (реальные экраны входа — этап auth, Заход 10)
  a1: { t: "Онбординг", n: "Вход 1", g: ["#7c3aed", "#4f6df5"], i: "spark" },
  a2: { t: "Телефон", n: "Вход 2", g: ["#7c3aed", "#4f6df5"], i: "user" },
  a3: { t: "SMS-код", n: "Вход 3", g: ["#7c3aed", "#4f6df5"], i: "chat" },
  a4: { t: "Выбор ребёнка", n: "Вход 4", g: ["#7c3aed", "#4f6df5"], i: "user" },
  // А-серия
  da1: STUBS.testreview,
  da2: STUBS.matview,
  da3: STUBS.workdet,
  da4: STUBS.appdet,
  da5: STUBS.newapp,
  da6: STUBS.search,
  da7: STUBS.about,
  da8: STUBS.whatsnew,
  // Документ (terms/privacy/lic по state.docType — контент придёт в Заходе 8)
  ddoc: { t: "Документ", n: "Документ", g: ["#94a3b8", "#64748b"], i: "doc" },
  // Универсальная заглушка (goStub): дефолт макета — STUBS.notif
  stub: STUBS.notif,
};

/** Маршруты стека (все экраны, кроме пяти табов) — 59 шт. */
export const STACK_ROUTES = [
  "d6", "d11", "d12", "d13", "d14", "d15", "d16", "d7", "dallsubj", "drev", "dtopics",
  "d8", "d9",
  "d25", "d26", "d27", "d28", "dteach",
  "d18", "d19", "d20", "d21", "d22", "d33", "dtop", "dwops", "dtransfer", "dlimits", "dcarddet", "daddcard",
  "d29", "d30", "d31", "d32", "d34", "dchpass", "dsessions",
  "dmeals", "ddiary", "dtests", "dlib", "dport", "dapps", "dmed", "dtrans",
  "a1", "a2", "a3", "a4",
  "da1", "da2", "da3", "da4", "da5", "da6", "da7", "da8",
  "ddoc", "stub",
] as const;

export type StackRouteName = (typeof STACK_ROUTES)[number];

/** Типизированный ParamList стека: Tabs + 59 маршрутов. */
export type MainStackParamList = {
  Tabs: undefined;
  /** Универсальная заглушка: goStub(k) → navigate('stub', { stubKey: k }). */
  stub: { stubKey?: StubKey } | undefined;
} & {
  [K in Exclude<StackRouteName, "stub">]: undefined;
};

/** ParamList таб-навигатора. */
export type TabParamList = {
  [K in TabRouteName]: undefined;
};
