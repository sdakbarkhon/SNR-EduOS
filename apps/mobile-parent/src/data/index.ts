/**
 * Data-слой родительского приложения v2 — фикстуры Захода 1–10.
 *
 * Экраны читают данные ТОЛЬКО через функции этого файла. На этапе данных
 * (подключение Supabase) функции заменяются реальными запросами —
 * СИГНАТУРЫ СОХРАНЯЮТСЯ (станут async, добавится db-параметр по образцу
 * packages/core/src/queries/parent.ts).
 *
 * Демо-«сегодня» = среда 23 июля 2026 (DEMO_TODAY) — Date.now в фикстурах
 * не используется.
 *
 * Связанные числа считаются из ОДНОГО источника:
 *  - «К оплате» 4 950 000 = сумма отмеченных счетов основного списка (BILLS);
 *  - «2 счёта» = число отмеченных счетов основного списка;
 *  - кошелёк 185 000 (Dashboard/П17/d6) = WALLET_BALANCE (getWalletBalance);
 *  - итоги «Истории оплат» 10 250 000 / 10 190 000 / 60 000 = из PAYMENT_HISTORY.
 *
 * 14.08.2026 — семь разделов ушли отсюда на настоящие данные: дневник,
 * тесты, библиотека, профиль учителя, объявления, новости администрации,
 * уведомления. Их фикстуры и аксессоры удалены; бэйдж колокольчика тоже
 * больше не считается здесь (см. hooks/useUnreadNotifications.ts).
 */
import {
  BILLS,
  PAYMENTS_OVERVIEW,
  TOPUP_PRESETS,
  WALLET_BALANCE,
  historyTotals,
  walletOpsFor,
} from "./demoPayments";
import type { Locale } from "@snr/core";
import { trDeep } from "./i18n";
import type {
  ApplicationDetailRow,
  ApplicationRow,
  BillRow,
  ChildInfoRow,
  ParentProfileRow,
  ChildRow,
  HomeworkCardRow,
  LegalDocRow,
  MedicalCardRow,
  MessageThreadRow,
  PaymentHistoryRow,
  ReceiptRow,
  ScheduleDayRow,
  ScheduleLessonRow,
  SearchResultRow,
  SubjectKey,
  SubjectRow,
  TeacherReviewRow,
  WalletOpsDayGroup,
  WalletRow,
  WorkDetailRow,
} from "./types";
import {
  AUTH_FEATURES,
  AUTH_HELP,
  CHILDREN,
  CHILD_INFO,
  DEFAULT_CHILD_INDEX,
  DEMO_SHEET_TEXT,
  PARENT,
  PARENT_PROFILE,
  PHONE_COUNTRY_CODES,
} from "./fixtures/family";
import {
  SUBJECTS,
  SUBJECT_STATS,
  TEACHER_REVIEWS,
} from "./fixtures/subjects";
import {
  DATE_PICKER_MONTHS,
  DATE_PICKER_QUICK_CHIPS,
  DEMO_TODAY,
  SCHEDULE_DAYS,
  SCHEDULE_ROOM_LABEL,
  SETS_BY_CHILD,
  SLOT_ENDS,
  SLOT_STARTS,
  TODAY_DONE_LESSONS,
  TODAY_LIVE_LESSON_INDEX,
} from "./fixtures/schedule";
import {
  DEFAULT_GRADE_PERIOD,
  GRADES_ASSISTANT_NOTES,
  GRADES_SUMMARY,
  GRADE_PERIODS,
} from "./fixtures/grades";
import {
  HOMEWORK_DETAIL,
  HOMEWORK_FILTER_CHIPS,
  HOMEWORK_LIST,
  HOMEWORK_TOTALS,
  HOMEWORK_UPLOAD_FILES,
  HOMEWORK_UPLOAD_MAX_FILES,
} from "./fixtures/homework";
import {
  NOTIFICATIONS_MASTER_DEFAULT,
  NOTIFICATION_CATEGORIES,
} from "./fixtures/notifications";
import {
  CHAT_ATTACH_OPTIONS,
  MESSAGE_THREADS,
  SUPPORT_CHAT,
  SUPPORT_CHAT_HEADER,
  SUPPORT_CHIPS,
  TEACHER_CHAT,
  TEACHER_CHAT_HEADER,
} from "./fixtures/messages";
import {
  APPLICATIONS,
  DEFAULT_MEAL_DAY_INDEX,
  MEALS_DAY_PILLS,
  MEALS_WEEK,
  MEDICAL_CARDS,
  NO_ALLERGIES_TEXT,
  PORTFOLIO_ACHIEVEMENTS,
  PORTFOLIO_CERTIFICATES,
  PORTFOLIO_WORKS,
  TRANSPORT_NOTIFY_DEFAULTS,
  TRANSPORT_STOPS,
  VACCINATIONS,
} from "./fixtures/services";
import {
  AUTO_EXIT_OPTIONS,
  CONFIRM_DIALOGS,
  DEFAULT_AUTO_EXIT_VALUE,
  DOCUMENTS,
} from "./fixtures/profile";
import {
  ASSISTANT_TEXT_TEMPLATES,
  DASHBOARD_CHILD_STATUS,
  DUE_CARD,
  NEXT_LESSON_CARD,
  QUICK_ACTIONS,
} from "./fixtures/home";

// Реэкспорт констант, которые экраны используют напрямую (read-only).
export { DEMO_TODAY, DEFAULT_CHILD_INDEX };
export * from "./types";

// ─── Семья ───────────────────────────────────────────────────────────────────

/**
 * Настоящие дети родителя, положенные сюда после входа
 * (ParentDataContext → setRealChildren). Пока их нет — работают фикстуры.
 *
 * Зачем через реестр, а не пропсами. Имена детей читают 23 экрана, включая
 * все шесть экранов оплат, и почти все зовут getChildren()/getChildById()
 * напрямую. Одна точка подмены делает имена настоящими везде сразу; тащить
 * контекст в каждый экран ради одного поля значило бы переписать их все.
 *
 * Настоящими становятся ИМЯ, класс и id. Презентационные поля (градиент
 * аватара, статус «в школе/дома», род для падежей) в базе не хранятся —
 * их по-прежнему даёт toChildRow (lib/realChild.ts).
 */
let REAL_CHILDREN: ChildRow[] | null = null;

export function setRealChildren(rows: ChildRow[] | null): void {
  REAL_CHILDREN = rows && rows.length > 0 ? rows : null;
}

export function getChildren(): ChildRow[] {
  return REAL_CHILDREN ?? CHILDREN;
}

export function getChildById(childId: string): ChildRow | undefined {
  return getChildren().find((c) => c.id === childId);
}

/**
 * Ребёнок по умолчанию — тот, что выбран, когда экран открыли впервые.
 *
 * ПОЧЕМУ ОТДЕЛЬНАЯ ФУНКЦИЯ, А НЕ children[DEFAULT_CHILD_INDEX]. Ровно на этом
 * приложение падало белым экраном 16.08.2026: DEFAULT_CHILD_INDEX равен 1
 * (в фикстуре три ребёнка, по умолчанию брали второго), а у настоящего
 * родителя ребёнок ОДИН — children[1] возвращал undefined, и первое же
 * обращение к .id роняло экран целиком:
 *   TypeError: Cannot read property 'id' of undefined at HomeScreen
 * Пока данные были выдуманными, массив всегда был длиной три и промаха не
 * случалось; настоящие дети приехали заходом 2 — и индекс стал выходить за
 * границы у КАЖДОГО родителя с одним ребёнком.
 *
 * Здесь индекс прижимается к длине списка, а пустой список отдаёт первого
 * фикстурного — чтобы у вызывающего НИКОГДА не было undefined. Экраны зовут
 * только это; прямое индексирование по DEFAULT_CHILD_INDEX убрано отовсюду.
 */
export function getDefaultChild(): ChildRow {
  const rows = getChildren();
  if (rows.length === 0) return CHILDREN[0];
  return rows[Math.min(Math.max(0, DEFAULT_CHILD_INDEX), rows.length - 1)];
}

/** id ребёнка по умолчанию. Никогда не бросает — см. getDefaultChild. */
export function defaultChildId(): string {
  return getDefaultChild().id;
}

function resolveChild(childId?: string): ChildRow {
  return (childId ? getChildById(childId) : undefined) ?? CHILDREN[DEFAULT_CHILD_INDEX];
}

/**
 * Место ребёнка в фикстурном списке — или null, если такого там нет.
 *
 * ПОЧЕМУ null, А НЕ НОЛЬ. До 28.08.2026 здесь стояло
 * Math.max(0, CHILDREN.findIndex(...)). У настоящего ребёнка findIndex
 * возвращает −1, прижатие к нулю подставляло ПЕРВОГО ВЫДУМАННОГО, и
 * родитель видел его дату рождения и его классного руководителя как правду
 * о своём ребёнке. Теперь промах виден вызывающему, и экран сам решает, что
 * делать: настоящие поля берутся из базы, а выдуманные строки не рисуются
 * вовсе — пустая графа честнее подставного значения.
 */
function childIndex(childId?: string): number | null {
  const child = resolveChild(childId);
  const idx = CHILDREN.findIndex((c) => c.id === child.id);
  return idx >= 0 ? idx : null;
}

/** Фикстурный профиль по месту в списке. null там, где места нет. */
function childInfoAt(idx: number | null): ChildInfoRow | null {
  return idx === null ? null : (CHILD_INFO[idx] ?? null);
}

/**
 * Контекст выбранного ребёнка: ребёнок + профиль + баланс кошелька.
 *
 * info равен null у НАСТОЯЩЕГО ребёнка: выдуманного профиля для него нет и
 * подставлять чужой нельзя. Вызывающий обязан это разобрать.
 */
export function getSelectedChildContext(childId?: string): {
  child: ChildRow;
  info: ChildInfoRow | null;
  wallet_balance: number;
} {
  const child = resolveChild(childId);
  return {
    child,
    info: childInfoAt(childIndex(childId)),
    wallet_balance: getWalletBalance(child.id),
  };
}

/** Выдуманный профиль ребёнка. null у настоящего — см. childIndex. */
export function getChildInfo(childId?: string): ChildInfoRow | null {
  return childInfoAt(childIndex(childId));
}

export function getParent() {
  return PARENT;
}

/**
 * Выдуманный профиль родителя — дата рождения, пол, семейное положение,
 * адрес, место работы. НИ ОДНОГО из этих полей в public.parents нет:
 * таблица держит id, user_id, full_name, phone, school_id, created_at,
 * created_by, google_email, apple_email — и всё (проверено живым запросом
 * 28.08.2026).
 *
 * ПОЧЕМУ АРГУМЕНТ ОБЯЗАТЕЛЕН. До 28.08.2026 экран «Данные родителя» звал
 * эту функцию безусловно и показывал настоящему человеку выдуманный адрес
 * и место работы как его собственные. Теперь вызывающий обязан СКАЗАТЬ,
 * что он в демо; при настоящем входе возвращается null, и подстановка
 * становится невозможной по типам, а не запрещённой на словах.
 */
export function getParentProfile(demo: boolean): ParentProfileRow | null {
  return demo ? PARENT_PROFILE : null;
}

export function getAuthFixtures() {
  return {
    demo_sheet_text: DEMO_SHEET_TEXT,
    help: AUTH_HELP,
    features: AUTH_FEATURES,
    country_codes: PHONE_COUNTRY_CODES,
  };
}

// ─── Предметы ────────────────────────────────────────────────────────────────


export function getSubject(key: SubjectKey): SubjectRow {
  return SUBJECTS[key];
}


export function getTeacherReviews(): TeacherReviewRow[] {
  return TEACHER_REVIEWS;
}

export function getSubjectStats() {
  return SUBJECT_STATS;
}


// ─── Расписание ──────────────────────────────────────────────────────────────

export function getScheduleWeek(): ScheduleDayRow[] {
  return SCHEDULE_DAYS;
}


/**
 * Уроки дня для ребёнка (аналог schedRowsFor макета): сет по SETS_BY_CHILD,
 * времена SLOT_STARTS/ENDS, кабинет SCHEDULE_ROOM_LABEL, оценки из
 * SCHEDULE_DAYS.grades. Статусы: прошедшие дни — все done; сегодня — первые
 * TODAY_DONE_LESSONS done, TODAY_LIVE_LESSON_INDEX live, дальше next.
 */
export function getDaySchedule(dayIndex: number, childId?: string): ScheduleLessonRow[] {
  const day = SCHEDULE_DAYS[dayIndex];
  if (!day) return [];
  // Настоящего ребёнка в фикстурном списке нет (childIndex вернёт null).
  // Берём нулевой набор ЗАВЕДОМО ВЫДУМАННЫХ уроков: экран расписания при
  // настоящем входе рисует свои строки из базы, а этот ответ отбрасывает,
  // и падать здесь незачем. Профиль ребёнка так делать НЕЛЬЗЯ — там
  // подставленное значение уходит человеку на экран как правда.
  const set = SETS_BY_CHILD[childIndex(childId) ?? 0][day.set_id];
  return set.map((subject_id, i) => {
    let status: ScheduleLessonRow["status"];
    if (dayIndex < DEMO_TODAY.weekday_index) status = "done";
    else if (dayIndex > DEMO_TODAY.weekday_index) status = "next";
    else if (i < TODAY_DONE_LESSONS) status = "done";
    else if (i === TODAY_LIVE_LESSON_INDEX) status = "live";
    else status = "next";
    return {
      slot_index: i,
      subject_id,
      starts_at: SLOT_STARTS[i],
      ends_at: SLOT_ENDS[i],
      room_label: SCHEDULE_ROOM_LABEL,
      grade: day.grades[i] ?? null,
      status,
    };
  });
}


export function getDatePickerMonths() {
  return DATE_PICKER_MONTHS;
}

export function getDatePickerQuickChips() {
  return DATE_PICKER_QUICK_CHIPS;
}

// ─── Посещаемость ────────────────────────────────────────────────────────────

// ─── Оценки / дневник ────────────────────────────────────────────────────────

export function getGradesSummary() {
  return GRADES_SUMMARY;
}

export function getGradesAssistantNotes() {
  return GRADES_ASSISTANT_NOTES;
}

export function getGradePeriods() {
  return { periods: GRADE_PERIODS, default_period: DEFAULT_GRADE_PERIOD };
}

// ─── Домашние задания ────────────────────────────────────────────────────────

export function getHomeworkList(): HomeworkCardRow[] {
  return HOMEWORK_LIST;
}

export function getHomeworkFilterChips() {
  return HOMEWORK_FILTER_CHIPS;
}

export function getHomeworkTotals() {
  return HOMEWORK_TOTALS;
}

export function getHomeworkDetail() {
  return HOMEWORK_DETAIL;
}

export function getHomeworkUploadFixture() {
  return { files: HOMEWORK_UPLOAD_FILES, max_files: HOMEWORK_UPLOAD_MAX_FILES };
}

// ─── Оплаты ──────────────────────────────────────────────────────────────────
//
// 23.08.2026 — вернулись после 16.08. Тогда их убрали вместе с экранами оплат:
// платёжной системы нет, и выдуманный баланс у настоящего родителя честнее
// не показывать вовсе. Решение заказчика от 23.08 разделило два случая: у
// настоящего родителя по-прежнему «Скоро», а в демо разделы заполнены —
// иначе показывать нечего. Гейт стоит в навигаторе (demoOr), а не здесь:
// слой данных про демо ничего не знает и знать не должен.

export function getBills(locale: Locale): BillRow[] {
  return trDeep(BILLS, locale);
}

/** Счета основного списка «К оплате сейчас» (по умолчанию отмечены). */
export function getDueBills(locale: Locale): BillRow[] {
  return trDeep(BILLS.filter((b) => b.in_main_list), locale);
}

/** «2 счёта» на Dashboard/П17 — считается, не хардкодится. */
export function getDueBillsCount(): number {
  return BILLS.filter((b) => b.in_main_list && b.checked_by_default).length;
}

/** ЕДИНЫЙ источник суммы «К оплате» (4 950 000 = 4 500 000 + 450 000). */
export function getDueTotal(): number {
  return BILLS.filter((b) => b.in_main_list && b.checked_by_default).reduce((s, b) => s + b.amount, 0);
}

export function getPaymentsOverview(locale: Locale) {
  return trDeep(PAYMENTS_OVERVIEW, locale);
}

/**
 * Итоги «Истории оплат» — считаются из demoPayments.PAYMENT_HISTORY, а не
 * хардкодятся: правка одной строки не должна заставлять цифры внизу врать.
 */
export function getPaymentHistoryTotals(): { total: number; successful: number; refunds: number } {
  const t = historyTotals();
  return { total: t.total, successful: t.net, refunds: t.refunds };
}

// ─── Кошелёк ─────────────────────────────────────────────────────────────────

/**
 * ЕДИНЫЙ источник баланса кошелька. Раньше он брался из таблицы балансов ПО
 * ИНДЕКСУ выдуманного ребёнка — после перехода семьи на настоящие данные
 * индекс указывал не туда, и главная спорила с экраном кошелька. Теперь одно
 * число из demoPayments — то же, что показывает веб-родитель.
 */
export function getWalletBalance(_childId?: string): number {
  return WALLET_BALANCE;
}

export function getWalletOps(locale: Locale, _childId?: string): WalletOpsDayGroup[] {
  return walletOpsFor(locale);
}

export function getTopupPresets(): readonly number[] {
  return TOPUP_PRESETS;
}

// ─── Уведомления ─────────────────────────────────────────────────────────────
//
// getNotifications() и getUnreadNotificationsCount() удалены 14.08.2026:
// лента идёт из таблицы `notifications` (getMyNotifications), а бэйдж
// колокольчика — из useUnreadNotifications() поверх getUnreadCount(). Здесь
// остались только НАСТРОЙКИ уведомлений — это отдельный экран и отдельный
// заход.

export function getNotificationCategories() {
  return { categories: NOTIFICATION_CATEGORIES, master_default: NOTIFICATIONS_MASTER_DEFAULT };
}

// ─── Сообщения ───────────────────────────────────────────────────────────────
//
// 23.08.2026 — переписка с учителем и поддержка вернулись в демо (заход 2).
// Чата родителя с учителем в базе школы не заведено вовсе, поэтому заменить
// это настоящими данными пока нечем. Собеседники и содержание — школьные и
// нейтральные, ничего личного про ребёнка.

/** Список бесед вкладки «Сообщения». В демо строки собираются из настоящих
 *  учителей ребёнка, отсюда берётся только текст превью. */
export function getMessageThreads(locale: Locale): MessageThreadRow[] {
  return trDeep(MESSAGE_THREADS, locale);
}

export function getTeacherChat(locale: Locale) {
  return {
    header: trDeep(TEACHER_CHAT_HEADER, locale),
    messages: trDeep(TEACHER_CHAT, locale),
    attach_options: trDeep(CHAT_ATTACH_OPTIONS, locale),
  };
}

export function getSupportChat(locale: Locale) {
  return {
    header: trDeep(SUPPORT_CHAT_HEADER, locale),
    messages: trDeep(SUPPORT_CHAT, locale),
    chips: trDeep(SUPPORT_CHIPS, locale),
  };
}


/**
 * Бейдж таба «Сообщения» — «2» в макете (строка 2651): число непрочитанных
 * ЧАТОВ (тредов категории chats с badge) = Гульнора + Севара. Считается из
 * MESSAGE_THREADS, не хардкодится.
 */
export function getUnreadMessageThreadsCount(): number {
  return MESSAGE_THREADS.filter((t) => t.category === "chats" && (t.badge ?? 0) > 0).length;
}




// ─── Сервисы ─────────────────────────────────────────────────────────────────
//
// 23.08.2026 — вернулись вместе с разделами демо (заход 2). Как и оплаты,
// показываются только в демо: гейт стоит в навигаторе (demoOr), слой данных
// про демо не знает. Настоящих таблиц под питание, транспорт, медкарту,
// портфолио и заявления в базе школы нет вовсе — заменить эти фикстуры
// пока нечем.

export function getMealsWeek(locale: Locale) {
  return {
    week: trDeep(MEALS_WEEK, locale),
    day_pills: trDeep(MEALS_DAY_PILLS, locale),
    default_day_index: DEFAULT_MEAL_DAY_INDEX,
  };
}

export function getTransportRoute(locale: Locale) {
  return { stops: trDeep(TRANSPORT_STOPS, locale), notify_defaults: TRANSPORT_NOTIFY_DEFAULTS };
}

export function getVaccinations(locale: Locale) {
  return trDeep(VACCINATIONS, locale);
}

export function getNoAllergiesText(locale: Locale) {
  return trDeep(NO_ALLERGIES_TEXT, locale);
}

export function getPortfolio(locale: Locale) {
  return {
    works: trDeep(PORTFOLIO_WORKS, locale),
    achievements: trDeep(PORTFOLIO_ACHIEVEMENTS, locale),
    certificates: trDeep(PORTFOLIO_CERTIFICATES, locale),
  };
}

export function getApplications(locale: Locale): ApplicationRow[] {
  return trDeep(APPLICATIONS, locale);
}

/** Документы делятся по владельцу: карточка ребёнка и карточка родителя. */
export function getChildDocuments(locale: Locale) {
  return trDeep(DOCUMENTS.filter((doc) => doc.owner === "child"), locale);
}

export function getParentDocuments(locale: Locale) {
  return trDeep(DOCUMENTS.filter((doc) => doc.owner === "parent"), locale);
}








/** Медкарта — целиком выдуманный экран, он закрыт demoOr и настоящему
 *  родителю не показывается. Ноль здесь — заглушка от падения, не подстановка. */
export function getMedicalCard(locale: Locale, childId?: string): MedicalCardRow {
  return trDeep(MEDICAL_CARDS[childIndex(childId) ?? 0], locale);
}





// ─── Профиль / настройки ─────────────────────────────────────────────────────






export function getConfirmDialog(id: string) {
  return CONFIRM_DIALOGS.find((c) => c.id === id);
}

export function getAutoExitFixture() {
  return { options: AUTO_EXIT_OPTIONS, default_value: DEFAULT_AUTO_EXIT_VALUE };
}

// ─── Поиск ───────────────────────────────────────────────────────────────────



// ─── Dashboard / EduOS Assistant ─────────────────────────────────────────────

/** Тексты ассистента, генерируемые от ребёнка (шаблоны конкатенации B10). */
export function getAssistantTexts(childId?: string): {
  dashboard: string;
  overview7: string;
  review: string;
} {
  const k = resolveChild(childId);
  return {
    dashboard: k.first_name + ASSISTANT_TEXT_TEMPLATES.dashboard,
    overview7: k.first_name + ASSISTANT_TEXT_TEMPLATES.overview7,
    review:
      k.first_name +
      ASSISTANT_TEXT_TEMPLATES.review_prefix +
      (k.is_female ? "а" : "") +
      ASSISTANT_TEXT_TEMPLATES.review_suffix,
  };
}

/** Данные Dashboard П5: все связанные числа — из своих источников. */
export function getDashboard(childId?: string) {
  const child = resolveChild(childId);
  return {
    parent: PARENT,
    child,
    child_status: DASHBOARD_CHILD_STATUS,
    next_lesson: NEXT_LESSON_CARD,
    quick_actions: QUICK_ACTIONS,
    // Плитка «К оплате» и баланс кошелька: показываются ТОЛЬКО в демо
    // (гейт в HomeScreen). Сумма и число счетов считаются из тех же BILLS,
    // что и экран оплат, — второго источника нет и не заводится.
    due_card: {
      amount: getDueTotal(),
      bills_count: getDueBillsCount(),
      until_label: DUE_CARD.until_label,
      gradient: DUE_CARD.gradient,
    },
    wallet_balance: getWalletBalance(child.id),
  };
}


