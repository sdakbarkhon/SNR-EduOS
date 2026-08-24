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
import type {
  ApplicationDetailRow,
  ApplicationRow,
  BillRow,
  ChildInfoRow,
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
  MESSAGE_THREADS,
} from "./fixtures/messages";
import {
  MEDICAL_CARDS,
} from "./fixtures/services";
import {
  AUTO_EXIT_OPTIONS,
  CONFIRM_DIALOGS,
  DEFAULT_AUTO_EXIT_VALUE,
} from "./fixtures/profile";
import {
  ASSISTANT_TEXT_TEMPLATES,
  DASHBOARD_CHILD_STATUS,
  DASHBOARD_GREETING,
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

export function getBills(): BillRow[] {
  return BILLS;
}

/** Счета основного списка «К оплате сейчас» (по умолчанию отмечены). */
export function getDueBills(): BillRow[] {
  return BILLS.filter((b) => b.in_main_list);
}

/** «2 счёта» на Dashboard/П17 — считается, не хардкодится. */
export function getDueBillsCount(): number {
  return BILLS.filter((b) => b.in_main_list && b.checked_by_default).length;
}

/** ЕДИНЫЙ источник суммы «К оплате» (4 950 000 = 4 500 000 + 450 000). */
export function getDueTotal(): number {
  return BILLS.filter((b) => b.in_main_list && b.checked_by_default).reduce((s, b) => s + b.amount, 0);
}

export function getPaymentsOverview() {
  return PAYMENTS_OVERVIEW;
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

export function getWalletOps(_childId?: string): WalletOpsDayGroup[] {
  return walletOpsFor();
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


/**
 * Бейдж таба «Сообщения» — «2» в макете (строка 2651): число непрочитанных
 * ЧАТОВ (тредов категории chats с badge) = Гульнора + Севара. Считается из
 * MESSAGE_THREADS, не хардкодится.
 */
export function getUnreadMessageThreadsCount(): number {
  return MESSAGE_THREADS.filter((t) => t.category === "chats" && (t.badge ?? 0) > 0).length;
}




// ─── Сервисы ─────────────────────────────────────────────────────────────────








export function getMedicalCard(childId?: string): MedicalCardRow {
  return MEDICAL_CARDS[childIndex(childId)];
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
    greeting: DASHBOARD_GREETING,
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


