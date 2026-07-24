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
 *  - кошелёк Малики 185 000 (Dashboard/П17/d6) = WALLETS[1] (getWalletBalance);
 *  - бейдж колокольчика «3» = непрочитанные NOTIFICATIONS;
 *  - итоги «Истории оплат» 10 250 000 / 10 100 000 / 150 000 = из PAYMENT_HISTORY.
 */
import type {
  ApplicationDetailRow,
  ApplicationRow,
  AttendanceMonthRow,
  BillRow,
  ChildInfoRow,
  ChildRow,
  DiaryWeekRow,
  HomeworkCardRow,
  LegalDocRow,
  MaterialDetailRow,
  MedicalCardRow,
  MessageThreadRow,
  NotificationRow,
  PaymentHistoryRow,
  ReceiptRow,
  ScheduleDayRow,
  ScheduleLessonRow,
  SearchResultRow,
  SubjectKey,
  SubjectRow,
  TeacherReviewRow,
  TestRow,
  TopicMasteryRow,
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
  DEMO_PARENTS,
  DEMO_SHEET_TEXT,
  PARENT,
  PARENT_PROFILE,
  PHONE_COUNTRY_CODES,
} from "./fixtures/family";
import {
  SUBJECTS,
  SUBJECT_DETAIL_MATH,
  SUBJECT_STATS,
  TEACHER_PROFILE,
  TEACHER_REVIEWS,
  TOPICS,
} from "./fixtures/subjects";
import {
  DATE_PICKER_MONTHS,
  DATE_PICKER_QUICK_CHIPS,
  DEMO_TODAY,
  LESSON_SETS,
  SCHEDULE_DAYS,
  SCHEDULE_ROOM_LABEL,
  SETS_BY_CHILD,
  SLOT_ENDS,
  SLOT_STARTS,
  TODAY_DONE_LESSONS,
  TODAY_LIVE_LESSON_INDEX,
} from "./fixtures/schedule";
import { ATTENDANCE_LAST_DAYS, ATTENDANCE_MONTHS, ATTENDANCE_STATS } from "./fixtures/attendance";
import {
  DEFAULT_GRADE_PERIOD,
  DIARY_WEEKS,
  GRADES_ASSISTANT_NOTES,
  GRADES_SUMMARY,
  GRADE_PERIODS,
  SKILLS_TAB,
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
  ADD_CARD_PLACEHOLDERS,
  BILLS,
  CARD_BIN_BRANDS,
  DEFAULT_PAY_METHOD_ID,
  MAIN_CARD_LABEL,
  PASSWORD_RULES,
  PASSWORD_STRENGTH_LABELS,
  PAYMENTS_FAQ,
  PAYMENTS_OVERVIEW,
  PAYMENT_HISTORY,
  PAY_METHODS,
  PAY_SHEET_TEXTS,
  RECEIPTS,
} from "./fixtures/payments";
import {
  TOPUP_PRESETS,
  TRANSFER_INSUFFICIENT_TEXT,
  TRANSFER_PRESETS,
  WALLETS,
  WALLET_LIMITS,
  WALLET_OPS,
} from "./fixtures/wallet";
import {
  NOTIFICATIONS,
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
  ABSENCE_REASONS,
  APPLICATIONS,
  APPLICATION_DETAILS,
  APPLICATION_TYPES,
  DEFAULT_MEAL_DAY_INDEX,
  LIBRARY,
  MATERIAL_DETAILS,
  MATERIAL_RELATED_LESSON_LABEL,
  MEALS_DAY_PILLS,
  MEALS_WEEK,
  MEDICAL_CARDS,
  NEW_APPLICATION_SUBMIT,
  NO_ALLERGIES_TEXT,
  PORTFOLIO_ACHIEVEMENTS,
  PORTFOLIO_CERTIFICATES,
  PORTFOLIO_WORKS,
  TESTS,
  TEST_REVIEW,
  TEST_REVIEW_TIME_SPENT_SUFFIX,
  TRANSPORT_NOTIFY_DEFAULTS,
  TRANSPORT_STOPS,
  VACCINATIONS,
  WORK_DETAILS,
} from "./fixtures/services";
import {
  AUTO_EXIT_OPTIONS,
  CONFIRM_DIALOGS,
  DEFAULT_AUTO_EXIT_VALUE,
  DOCUMENTS,
  LEGAL_DOCS,
  SESSIONS,
  WHATS_NEW,
} from "./fixtures/profile";
import { SEARCH_FILTERS, SEARCH_POPULAR, SEARCH_RECENT, SEARCH_RESULTS } from "./fixtures/search";
import {
  ASSISTANT_SCREEN,
  ASSISTANT_TEXT_TEMPLATES,
  DASHBOARD_CHILD_STATUS,
  DASHBOARD_FEED,
  DASHBOARD_GREETING,
  DAY_STATUS,
  DUE_CARD,
  MEALS_CARD,
  NEXT_LESSON_CARD,
  QUICK_ACTIONS,
} from "./fixtures/home";

// Реэкспорт констант, которые экраны используют напрямую (read-only).
export { DEMO_TODAY, DEFAULT_CHILD_INDEX };
export * from "./types";

// ─── Семья ───────────────────────────────────────────────────────────────────

export function getChildren(): ChildRow[] {
  return CHILDREN;
}

export function getChildById(childId: string): ChildRow | undefined {
  return CHILDREN.find((c) => c.id === childId);
}

function resolveChild(childId?: string): ChildRow {
  return (childId ? getChildById(childId) : undefined) ?? CHILDREN[DEFAULT_CHILD_INDEX];
}

function childIndex(childId?: string): number {
  const child = resolveChild(childId);
  return Math.max(0, CHILDREN.findIndex((c) => c.id === child.id));
}

/** Контекст выбранного ребёнка: ребёнок + профиль + баланс кошелька. */
export function getSelectedChildContext(childId?: string): {
  child: ChildRow;
  info: ChildInfoRow;
  wallet_balance: number;
} {
  const child = resolveChild(childId);
  const idx = childIndex(childId);
  return { child, info: CHILD_INFO[idx], wallet_balance: getWalletBalance(child.id) };
}

export function getChildInfo(childId?: string): ChildInfoRow {
  return CHILD_INFO[childIndex(childId)];
}

export function getParent() {
  return PARENT;
}

export function getParentProfile() {
  return PARENT_PROFILE;
}

export function getDemoParents() {
  return DEMO_PARENTS;
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

export function getSubjects(): Record<SubjectKey, SubjectRow> {
  return SUBJECTS;
}

export function getSubject(key: SubjectKey): SubjectRow {
  return SUBJECTS[key];
}

export function getTopics(subjectKey?: Exclude<SubjectKey, "rusF">): TopicMasteryRow[] {
  return subjectKey ? TOPICS.filter((t) => t.subject_id === subjectKey) : TOPICS;
}

export function getTeacherProfile() {
  return TEACHER_PROFILE;
}

export function getTeacherReviews(): TeacherReviewRow[] {
  return TEACHER_REVIEWS;
}

export function getSubjectStats() {
  return SUBJECT_STATS;
}

/** Детали предмета d11 (в макете реализована только математика);
 *  teacher_comment генерируется от имени ребёнка (B10). */
export function getSubjectDetail(childId?: string) {
  return { ...SUBJECT_DETAIL_MATH, teacher_comment: getAssistantTexts(childId).review };
}

// ─── Расписание ──────────────────────────────────────────────────────────────

export function getScheduleWeek(): ScheduleDayRow[] {
  return SCHEDULE_DAYS;
}

export function getLessonSets() {
  return LESSON_SETS;
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
  const set = SETS_BY_CHILD[childIndex(childId)][day.set_id];
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

export function getTodaySchedule(childId?: string): ScheduleLessonRow[] {
  return getDaySchedule(DEMO_TODAY.weekday_index, childId);
}

export function getDatePickerMonths() {
  return DATE_PICKER_MONTHS;
}

export function getDatePickerQuickChips() {
  return DATE_PICKER_QUICK_CHIPS;
}

// ─── Посещаемость ────────────────────────────────────────────────────────────

export function getAttendanceMonths(): AttendanceMonthRow[] {
  return ATTENDANCE_MONTHS;
}

export function getAttendanceStats() {
  return ATTENDANCE_STATS;
}

/** {suf} в статусах («Присутствовал{suf}») резолвится по is_female ребёнка —
 *  как childSuf в макете (строка 3853); экраны получают готовые строки. */
export function getAttendanceLastDays(childId?: string) {
  const suf = resolveChild(childId).is_female ? "а" : "";
  return ATTENDANCE_LAST_DAYS.map((row) => ({
    ...row,
    status_label: row.status_label.replace("{suf}", suf),
  }));
}

// ─── Оценки / дневник ────────────────────────────────────────────────────────

export function getDiaryWeeks(): DiaryWeekRow[] {
  return DIARY_WEEKS;
}

export function getGradesSummary() {
  return GRADES_SUMMARY;
}

export function getSkillsTab() {
  return SKILLS_TAB;
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

export function getBills(): BillRow[] {
  return BILLS;
}

/** Счета основного списка «К оплате сейчас» (по умолчанию отмечены). */
export function getDueBills(): BillRow[] {
  return BILLS.filter((b) => b.in_main_list);
}

/** ЕДИНЫЙ источник суммы «К оплате» (4 950 000 = 4 500 000 + 450 000). */
export function getDueTotal(): number {
  return BILLS.filter((b) => b.in_main_list && b.checked_by_default).reduce((s, b) => s + b.amount, 0);
}

/** «2 счёта» на Dashboard/П17 — считается, не хардкодится. */
export function getDueBillsCount(): number {
  return BILLS.filter((b) => b.in_main_list && b.checked_by_default).length;
}

export function getPayMethods() {
  return { methods: PAY_METHODS, default_id: DEFAULT_PAY_METHOD_ID };
}

export function getPaymentHistory(): Record<"jul" | "jun", PaymentHistoryRow[]> {
  return PAYMENT_HISTORY;
}

/**
 * Итоги «Истории оплат» d20 — из PAYMENT_HISTORY:
 * всего = сумма не-возвратов (10 250 000), возвраты = |отрицательных|
 * (150 000), успешных = всего − возвраты (10 100 000).
 */
export function getPaymentHistoryTotals(): { total: number; successful: number; refunds: number } {
  const all = [...PAYMENT_HISTORY.jul, ...PAYMENT_HISTORY.jun];
  const total = all.filter((p) => !p.is_refund).reduce((s, p) => s + p.amount, 0);
  const refunds = all.filter((p) => p.is_refund).reduce((s, p) => s + Math.abs(p.amount), 0);
  return { total, successful: total - refunds, refunds };
}

export function getReceipts(kind?: ReceiptRow["kind"]): ReceiptRow[] {
  return kind ? RECEIPTS.filter((r) => r.kind === kind) : RECEIPTS;
}

export function getPaymentsFaq() {
  return PAYMENTS_FAQ;
}

export function getPaymentsOverview() {
  return PAYMENTS_OVERVIEW;
}

export function getCardsFixture() {
  return {
    main_card_label: MAIN_CARD_LABEL,
    bin_brands: CARD_BIN_BRANDS,
    add_card_placeholders: ADD_CARD_PLACEHOLDERS,
  };
}

export function getPasswordFixture() {
  return { rules: PASSWORD_RULES, strength_labels: PASSWORD_STRENGTH_LABELS };
}

export function getPaySheetTexts() {
  return PAY_SHEET_TEXTS;
}

// ─── Кошелёк ─────────────────────────────────────────────────────────────────

export function getWallets(): WalletRow[] {
  return WALLETS;
}

/** ЕДИНЫЙ источник баланса кошелька ребёнка (Малика → 185 000). */
export function getWalletBalance(childId?: string): number {
  return WALLETS[childIndex(childId)].balance;
}

export function getWalletOps(_childId?: string): WalletOpsDayGroup[] {
  // Макет показывает один и тот же список операций для активного ребёнка.
  return WALLET_OPS;
}

export function getWalletLimits() {
  return WALLET_LIMITS;
}

export function getTopupPresets() {
  return TOPUP_PRESETS;
}

export function getTransferFixture() {
  return { presets: TRANSFER_PRESETS, insufficient_text: TRANSFER_INSUFFICIENT_TEXT };
}

// ─── Уведомления ─────────────────────────────────────────────────────────────

export function getNotifications(day?: NotificationRow["day"]): NotificationRow[] {
  return day ? NOTIFICATIONS.filter((n) => n.day === day) : NOTIFICATIONS;
}

/** Бейдж колокольчика «3» — из is_unread, не хардкод. */
export function getUnreadNotificationsCount(): number {
  return NOTIFICATIONS.filter((n) => n.is_unread).length;
}

export function getNotificationCategories() {
  return { categories: NOTIFICATION_CATEGORIES, master_default: NOTIFICATIONS_MASTER_DEFAULT };
}

// ─── Сообщения ───────────────────────────────────────────────────────────────

export function getMessageThreads(category?: MessageThreadRow["category"]): MessageThreadRow[] {
  return category ? MESSAGE_THREADS.filter((t) => t.category === category) : MESSAGE_THREADS;
}

export function getTeacherChat() {
  return { header: TEACHER_CHAT_HEADER, messages: TEACHER_CHAT, attach_options: CHAT_ATTACH_OPTIONS };
}

export function getSupportChat() {
  return { header: SUPPORT_CHAT_HEADER, messages: SUPPORT_CHAT, chips: SUPPORT_CHIPS };
}

// ─── Сервисы ─────────────────────────────────────────────────────────────────

export function getTests(): TestRow[] {
  return TESTS;
}

export function getTestReview() {
  return { questions: TEST_REVIEW, time_spent_suffix: TEST_REVIEW_TIME_SPENT_SUFFIX };
}

export function getLibrary() {
  return LIBRARY;
}

export function getMaterialDetail(subjectKey: Exclude<SubjectKey, "rusF">): MaterialDetailRow | undefined {
  return MATERIAL_DETAILS.find((m) => m.subject_id === subjectKey);
}

export function getMaterialRelatedLessonLabel() {
  return MATERIAL_RELATED_LESSON_LABEL;
}

export function getPortfolio() {
  return { works: PORTFOLIO_WORKS, achievements: PORTFOLIO_ACHIEVEMENTS, certificates: PORTFOLIO_CERTIFICATES };
}

export function getWorkDetail(workIndex: number): WorkDetailRow | undefined {
  return WORK_DETAILS[workIndex];
}

export function getApplications(): ApplicationRow[] {
  return APPLICATIONS;
}

export function getApplicationTypes() {
  return APPLICATION_TYPES;
}

export function getApplicationDetail(numberLabel: string): ApplicationDetailRow | undefined {
  return APPLICATION_DETAILS[numberLabel];
}

export function getAbsenceReasons() {
  return ABSENCE_REASONS;
}

export function getNewApplicationFixture() {
  return NEW_APPLICATION_SUBMIT;
}

export function getMedicalCard(childId?: string): MedicalCardRow {
  return MEDICAL_CARDS[childIndex(childId)];
}

export function getNoAllergiesText() {
  return NO_ALLERGIES_TEXT;
}

export function getVaccinations() {
  return VACCINATIONS;
}

export function getTransportRoute() {
  return { stops: TRANSPORT_STOPS, notify_defaults: TRANSPORT_NOTIFY_DEFAULTS };
}

export function getMealsWeek() {
  return { week: MEALS_WEEK, day_pills: MEALS_DAY_PILLS, default_day_index: DEFAULT_MEAL_DAY_INDEX };
}

// ─── Профиль / настройки ─────────────────────────────────────────────────────

export function getSessions() {
  return SESSIONS;
}

export function getChildDocuments() {
  return DOCUMENTS.filter((d) => d.owner === "child");
}

export function getParentDocuments() {
  return DOCUMENTS.filter((d) => d.owner === "parent");
}

export function getLegalDoc(id: LegalDocRow["id"]): LegalDocRow {
  return LEGAL_DOCS.find((d) => d.id === id) ?? LEGAL_DOCS[0];
}

export function getWhatsNew() {
  return WHATS_NEW;
}

export function getConfirmDialog(id: string) {
  return CONFIRM_DIALOGS.find((c) => c.id === id);
}

export function getAutoExitFixture() {
  return { options: AUTO_EXIT_OPTIONS, default_value: DEFAULT_AUTO_EXIT_VALUE };
}

// ─── Поиск ───────────────────────────────────────────────────────────────────

export function getSearchResults(filter?: SearchResultRow["filter"]): SearchResultRow[] {
  return filter ? SEARCH_RESULTS.filter((r) => r.filter === filter) : SEARCH_RESULTS;
}

export function getSearchFixture() {
  return { popular: SEARCH_POPULAR, recent: SEARCH_RECENT, filters: SEARCH_FILTERS };
}

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
    greeting: DASHBOARD_GREETING,
    parent: PARENT,
    child,
    child_status: DASHBOARD_CHILD_STATUS,
    wallet_balance: getWalletBalance(child.id),
    next_lesson: NEXT_LESSON_CARD,
    due_card: { ...DUE_CARD, amount: getDueTotal(), bills_count: getDueBillsCount() },
    meals_card: MEALS_CARD,
    quick_actions: QUICK_ACTIONS,
    feed: DASHBOARD_FEED,
    unread_notifications: getUnreadNotificationsCount(),
    assistant_text: getAssistantTexts(child.id).dashboard,
  };
}

/** Статус дня d6: расписание и баланс питания — из общих источников.
 *  {suf} в banner_sub («Пришл{suf} в 08:12») резолвится по is_female —
 *  как childSuf в макете (строка 3853). */
export function getDayStatus(childId?: string) {
  const child = resolveChild(childId);
  return {
    ...DAY_STATUS,
    banner_sub: DAY_STATUS.banner_sub.replace("{suf}", child.is_female ? "а" : ""),
    date_label: DEMO_TODAY.label_full,
    child,
    lessons: getTodaySchedule(child.id),
    lessons_attended: DASHBOARD_CHILD_STATUS.lessons_attended,
    lessons_total: DASHBOARD_CHILD_STATUS.lessons_total,
    meals_balance: getWalletBalance(child.id),
  };
}

/** Экран EduOS Assistant d7: прогресс по предметам = SUBJECT_STATS. */
export function getAssistantScreen(childId?: string) {
  return {
    ...ASSISTANT_SCREEN,
    overview_text: getAssistantTexts(childId).overview7,
    subject_progress: SUBJECT_STATS,
  };
}
