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
import { tr, trDeep } from "./i18n";
import type {
  ApplicationDetailRow,
  ApplicationRow,
  AdminMessage,
  AnnouncementCardRow,
  AnnouncementCategory,
  AttendanceDayRow,
  AttendanceStats,
  BaseSubjectKey,
  BillRow,
  DiaryWeekRow,
  LibraryBookRow,
  TestRow,
  ChildInfoRow,
  ParentProfileRow,
  ChildRow,
  HomeworkCardRow,
  LegalDocRow,
  MedicalCardRow,
  AboutShowcase,
  CurrentSessionRow,
  MessageThreadRow,
  MessagesStoryRow,
  NotificationRow,
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
  SUBJECT_DETAIL_MATH,
  SUBJECT_STATS,
  TEACHER_PROFILE,
  TEACHER_REVIEWS,
  TOPICS,
  TOPIC_MASTERED_AT,
  TOPIC_SUBJECT_ORDER,
} from "./fixtures/subjects";
import {
  DATE_PICKER_MONTHS,
  DATE_PICKER_QUICK_CHIPS,
  DAY_STATUS,
  DEMO_TODAY,
  SCHEDULE_DAYS,
  SCHEDULE_ROOM_LABEL,
  SETS_BY_CHILD,
  SLOT_ENDS,
  SLOT_STARTS,
  TODAY_DONE_LESSONS,
  TODAY_LIVE_LESSON_INDEX,
} from "./fixtures/schedule";
import { ADMIN_MESSAGE, ANNOUNCEMENTS } from "./fixtures/announcements";
import { DIARY_WEEKS, LIBRARY_BOOKS, TESTS } from "./fixtures/studyServices";
import { formatMoney } from "../lib/format";
import {
  ATTENDANCE_LAST_DAYS,
  ATTENDANCE_MONTHS,
  ATTENDANCE_STATS,
  DEFAULT_ATTENDANCE_MONTH_INDEX,
} from "./fixtures/attendance";
import {
  DEFAULT_GRADE_PERIOD,
  GRADES_ASSISTANT_NOTES,
  GRADES_SUMMARY,
  GRADE_PERIODS,
  SKILLS_SCREEN,
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
  NOTIFICATIONS_MASTER_DEFAULT,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_FEED,
} from "./fixtures/notifications";
import {
  CHAT_ATTACH_OPTIONS,
  MESSAGES_STORIES,
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
  MEALS_DAY_PILLS,
  MEALS_WEEK,
  MEDICAL_CARDS,
  NO_ALLERGIES_TEXT,
  PORTFOLIO_ACHIEVEMENTS,
  PORTFOLIO_CERTIFICATES,
  PORTFOLIO_WORKS,
  TRANSPORT_NOTIFY_DEFAULTS,
  TRANSPORT_STOPS,
  NEW_APPLICATION_SUBMIT,
  VACCINATIONS,
  WORK_DETAILS,
} from "./fixtures/services";
import {
  SEARCH_FILTERS,
  SEARCH_POPULAR,
  SEARCH_RECENT,
  SEARCH_RESULTS,
  type SearchGroupKey,
} from "./fixtures/search";
import {
  CONFIRM_DIALOGS,
  ABOUT_SHOWCASE,
  CARD_DETAIL,
  CURRENT_SESSION,
  DOCUMENTS,
  LEGAL_DOCS,
  WHATS_NEW,
  WHATS_NEW_CURRENT,
  SESSIONS,
} from "./fixtures/profile";
import {
  ASSISTANT_TEXT_TEMPLATES,
  DASHBOARD_CHILD_STATUS,
  DASHBOARD_FEED,
  DUE_CARD,
  MEALS_TILE,
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

/**
 * ПУСТОЙ СПИСОК — ЭТО ОТВЕТ, А НЕ ОТСУТСТВИЕ ОТВЕТА.
 *
 * До 28.08.2026 пустой список схлопывался в null, а null означает «ещё не
 * загружено» и включает фикстуры. Родитель, которому ребёнка ещё не
 * привязали, из-за этого видел выдуманную семью Каримовых как свою.
 * Теперь [] сохраняется как [], и getChildren() честно отдаёт пустоту.
 */
export function setRealChildren(rows: ChildRow[] | null): void {
  REAL_CHILDREN = rows;
}

/**
 * Идёт ли показ демонстрации.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ФЛАГ. Слой данных не имеет доступа к контекстам, а
 * решение «подставлять фикстуру или нет» принимать обязан: демо-гостю
 * витрина нужна ровно такой, какой была, а настоящему родителю подставлять
 * нельзя ничего. Значение кладёт ParentDataProvider из того же источника,
 * которым пользуется demoOr — ключа аренды демо-места в защищённом
 * хранилище (DemoSessionContext). Не путать с session.demoParentId: то поле
 * НИКОГДА не выставляется (проверено 28.08.2026, присваивание одно — null в
 * INITIAL_STATE), и все проверки через него всегда ложны.
 */
let DEMO_SHOWCASE = false;

export function setDemoShowcase(on: boolean): void {
  DEMO_SHOWCASE = on;
}

/** Показывать ли выдуманное вместо отсутствующего. Только для демо. */
export function isDemoShowcase(): boolean {
  return DEMO_SHOWCASE;
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
 * Индекс прижимается к длине списка. А вот пустой список 28.08.2026
 * перестал отдавать первого фикстурного: раньше родитель без привязанных
 * детей молча получал выдуманную «Малику Каримову» и читал её расписание,
 * оценки и профиль как данные своего ребёнка. Теперь возвращается null, и
 * экран обязан сказать человеку, что ребёнка ещё не привязали.
 *
 * Демо-гостю витрина сохранена: при показе (см. setDemoShowcase) пустота
 * по-прежнему отдаёт фикстурного ребёнка — там выдуманная семья и есть
 * содержание показа.
 */
export function getDefaultChild(): ChildRow | null {
  const rows = getChildren();
  if (rows.length === 0) return DEMO_SHOWCASE ? (CHILDREN[0] ?? null) : null;
  return rows[Math.min(Math.max(0, DEFAULT_CHILD_INDEX), rows.length - 1)] ?? null;
}

/** id ребёнка по умолчанию или null, если детей нет. */
export function defaultChildId(): string | null {
  return getDefaultChild()?.id ?? null;
}

/**
 * КОРЕНЬ ТРЁХ ЗАХОДОВ ПОДРЯД.
 *
 * Здесь стояло `?? CHILDREN[DEFAULT_CHILD_INDEX]`: не нашли ребёнка —
 * подставили выдуманную «Малику Каримову». Отсюда текло всё, что мы чинили
 * у устья — профиль ребёнка, личные данные родителя, «Успехи»: каждый экран
 * получал молча подставленного чужого ребёнка и честно его рисовал.
 *
 * Теперь подстановки нет: не нашли — null, и вызывающий обязан это разобрать.
 * Для демо-показа подстановка сохранена: там выдуманная семья и есть
 * содержание витрины.
 */
function resolveChild(childId?: string): ChildRow | null {
  const found = childId ? getChildById(childId) : undefined;
  if (found) return found;
  if (!childId) {
    // Без явного id — «тот, что открыт по умолчанию».
    return getDefaultChild();
  }
  return DEMO_SHOWCASE ? (CHILDREN[DEFAULT_CHILD_INDEX] ?? null) : null;
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
  const idx = child ? CHILDREN.findIndex((c) => c.id === child.id) : -1;
  if (idx >= 0) return idx;
  // Витрина: у демо-гостя ребёнок НАСТОЯЩИЙ (Шерзод из демо-школы), в
  // фикстурном списке его нет, и до 28.08.2026 промах прижимался к нулю —
  // показ шёл с профилем нулевого фикстурного ребёнка. Сохраняем ровно это:
  // витрину заказчик показывает людям в таком виде.
  return DEMO_SHOWCASE ? 0 : null;
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
  /** null — ребёнка нет: не привязан, ещё не загрузился или id чужой. */
  child: ChildRow | null;
  info: ChildInfoRow | null;
  wallet_balance: number;
} {
  return {
    child: resolveChild(childId),
    info: childInfoAt(childIndex(childId)),
    // Баланс кошелька от ребёнка не зависит вовсе — одно число на семью.
    wallet_balance: getWalletBalance(),
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


// ─── Посещаемость ────────────────────────────────────────────────────────────

/**
 * Два месяца календаря витрины и месяц, открытый по умолчанию.
 *
 * Переводится ТОЛЬКО подпись месяца. Через trDeep гонять весь месяц нельзя:
 * он пошёл бы и по массиву кодов ячеек, а это односимвольные строки («p»,
 * «e», «w»…). Сегодня в таблице переводов такого ключа нет, и разницы не
 * видно, — но появись он завтра, календарь молча посыпался бы, и искать
 * причину пришлось бы долго.
 */
export function getAttendanceMonths(locale: Locale) {
  return {
    months: ATTENDANCE_MONTHS.map((m) => ({ ...m, label: tr(m.label, locale) })),
    default_month_index: DEFAULT_ATTENDANCE_MONTH_INDEX,
  };
}

/** Три плитки. Числа пересчитывают июльский календарь выше: два дня `u`
 *  (3-й и 14-й) и один `n` (21-й) — сходятся, потому что и то и другое
 *  снято с одного макета. */
export function getAttendanceStats(): AttendanceStats {
  return ATTENDANCE_STATS;
}

/**
 * «Последние дни». {suf} — гендерный суффикс ребёнка, как childSuf в
 * макете (строка 3853).
 *
 * ПОРЯДОК ВАЖЕН: сначала перевод, потом подстановка суффикса. Наоборот
 * ключ таблицы («Присутствовал{suf}») уже не совпал бы со строкой, и
 * узбекский с английским молча остались бы русскими. В переводах
 * плейсхолдера нет вовсе — там род не выражается, и replace ничего не
 * находит.
 */
export function getAttendanceLastDays(childId: string | undefined, locale: Locale): AttendanceDayRow[] {
  const suf = resolveChild(childId)?.is_female ? "а" : "";
  return ATTENDANCE_LAST_DAYS.map((row) => ({
    ...row,
    date_label: tr(row.date_label, locale),
    status_label: tr(row.status_label, locale).replace("{suf}", suf),
  }));
}

// ─── Оценки и успехи ─────────────────────────────────────────────────────────

// ─── Экраны действий (заглушки макета) ───────────────────────────────────────

/** Детали работы портфолио (da3). В макете разворот один — первый. */
export function getWorkDetail(locale: Locale) {
  return trDeep(WORK_DETAILS[0], locale);
}

/** Детали заявления (da4) — первое из списка, как в макете. */
export function getApplicationDetail(locale: Locale) {
  const заявления = trDeep(APPLICATIONS, locale);
  const первое = заявления[0] ?? null;
  const детали = первое ? APPLICATION_DETAILS[первое.number_label] : undefined;
  return первое && детали ? { row: первое, detail: trDeep(детали, locale) } : null;
}

/** Новое заявление (da5): типы, причины и текст подтверждения. */
export function getNewApplication(locale: Locale) {
  return {
    types: trDeep(APPLICATION_TYPES, locale),
    reasons: trDeep(ABSENCE_REASONS, locale),
    submit: trDeep(NEW_APPLICATION_SUBMIT, locale),
  };
}

/**
 * Поиск по сервисам (da6).
 *
 * Результаты сгруппированы по разделу, порядок групп — как в макете.
 * Поле ввода в показе не набирается: витрина показывает, как выглядит
 * найденное, а искать в заготовках нечего.
 */
export function getSearchShowcase(locale: Locale, group?: SearchGroupKey | null) {
  const все = trDeep(SEARCH_RESULTS, locale);
  const rows = group ? все.filter((r) => r.group === group) : все;
  const порядок: SearchGroupKey[] = ["msgs", "mats", "hw", "pays", "svc"];
  const groups = порядок
    .map((g) => ({ key: g, rows: rows.filter((r) => r.group === g) }))
    .filter((g) => g.rows.length > 0);
  return {
    groups,
    total: все.length,
    recent: trDeep(SEARCH_RECENT, locale),
    popular: trDeep(SEARCH_POPULAR, locale),
    filters: trDeep(SEARCH_FILTERS, locale),
  };
}

/** «Что нового» (da8): текущая версия и предыдущие. */
export function getWhatsNew(locale: Locale) {
  return {
    current: trDeep(WHATS_NEW_CURRENT, locale),
    previous: trDeep(WHATS_NEW, locale),
  };
}

/** Документ (ddoc): условия, политика или лицензии. */
export function getLegalDoc(locale: Locale, id?: string) {
  const док = LEGAL_DOCS.find((x) => x.id === id) ?? LEGAL_DOCS[0];
  return док ? trDeep(док, locale) : null;
}

/** Детали карты (dcarddet). Номер маскированный — настоящих карт в показе
 *  нет и быть не может. */
export function getCardDetail(locale: Locale) {
  return trDeep(CARD_DETAIL, locale);
}

// ─── Уведомления, сессии, «О приложении» ─────────────────────────────────────

/**
 * Лента уведомлений витрины.
 *
 * Тексты собираются, а не лежат готовыми: {name} и {suf} — от выбранного
 * ребёнка, {sum} — из счёта «Обучение · август», того же, что в разделе
 * оплат. Иначе показ рассказывал бы Азизу про Малику, а сумма счёта жила
 * бы в двух местах.
 *
 * Порядок подстановки тот же, что у «Последних дней» посещаемости:
 * сначала перевод, потом плейсхолдеры — иначе ключ таблицы не совпал бы
 * со строкой.
 */
export function getNotificationFeed(childId: string | undefined, locale: Locale): NotificationRow[] {
  const ребёнок = resolveChild(childId);
  const счёт = BILLS.find((b) => b.id === "edu");
  return NOTIFICATION_FEED.map((n) => ({
    ...n,
    title: tr(n.title, locale),
    text: tr(n.text, locale)
      .replace("{name}", ребёнок?.first_name ?? "")
      .replace("{suf}", ребёнок?.is_female ? "а" : "")
      .replace("{sum}", форматСуммы(счёт?.amount ?? 0)),
  }));
}

/** Сумма для подстановки в текст уведомления — тем же форматтером, что
 *  и на экранах оплат: разряды неразрывным пробелом. */
function форматСуммы(v: number): string {
  return formatMoney(v);
}

/**
 * Непрочитанные в показе — для бэйджа колокольчика.
 *
 * СЧИТАЕТСЯ ПО ЛЕНТЕ, а не стоит константой. В макете на колокольчике
 * нарисована тройка, и по этому же списку выходит ровно три — но связь
 * должна быть расчётом, иначе правка ленты и число над ней разойдутся.
 * Ровно поэтому бэйдж и был отложен в заходе 2: ленты тогда не было.
 */
export function getUnreadShowcaseCount(): number {
  return NOTIFICATION_FEED.filter((n) => n.is_unread).length;
}

/** Активные сессии витрины: текущее устройство отдельно, остальные — списком
 *  (в макете это два разных блока). */
export function getSessions(locale: Locale) {
  return {
    current: trDeep(CURRENT_SESSION, locale) as CurrentSessionRow,
    others: trDeep(SESSIONS, locale),
  };
}

/** «О приложении» витрины. У настоящего родителя экран показывает свои
 *  версию, канал обновлений и школу — сюда он не заходит. */
export function getAboutShowcase(locale: Locale): AboutShowcase {
  return trDeep(ABOUT_SHOWCASE, locale) as AboutShowcase;
}

// ─── Дневник, тесты, библиотека ──────────────────────────────────────────────

/**
 * Дневник витрины.
 *
 * СРЕДНИЙ БАЛЛ ДНЯ СЧИТАЕТСЯ, а не берётся подписью: в макете все восемь
 * дневных подписей сходятся с оценками своего дня, и хранить их второй
 * копией незачем.
 *
 * ТРИ ЧИСЛА ШАПКИ НЕДЕЛИ — наоборот, отдаются как есть. Список дней в
 * макете неполный (четыре дня из семи), поэтому «оценок получено» и
 * «заданий сдано» относятся ко всей неделе, а не к видимым карточкам:
 * пересчёт по списку молча заменил бы одно другим. Что именно не сходится
 * — в журнале захода 5.
 */
export function getDiaryWeeks(locale: Locale) {
  return (trDeep(DIARY_WEEKS, locale) as DiaryWeekRow[]).map((w) => ({
    ...w,
    days: w.days.map((day) => {
      const оценки = day.lessons.map((l) => l.grade).filter((g): g is number => g !== null);
      const среднее = оценки.length ? оценки.reduce((a, b) => a + b, 0) / оценки.length : null;
      return { ...day, avg_label: среднее === null ? null : среднее.toFixed(1) };
    }),
  }));
}

/**
 * Тесты витрины.
 *
 * Все три числа шапки СЧИТАЮТСЯ: список тестов полный (шесть строк, все
 * видны), и зритель может пересчитать каждое. Два из трёх совпали с
 * макетом («пройдено 4», «средний балл 4.5»), третье — нет: в макете
 * стояло 82%, а по результатам самих тестов выходит 85% (и как среднее
 * процентов, и как 34 балла из 40). Показываем посчитанное.
 */
export function getTests(locale: Locale, only?: "done" | "upcoming" | null) {
  const все = trDeep(TESTS, locale) as TestRow[];
  const пройденные = все.filter((t) => t.done);
  const баллы = пройденные.map((t) => t.grade ?? 0);
  const проценты = пройденные.map((t) => t.pct ?? 0);
  const rows = only === "done" ? пройденные : only === "upcoming" ? все.filter((t) => !t.done) : все;
  return {
    rows,
    passed: пройденные.length,
    avg_grade_label: пройденные.length
      ? (баллы.reduce((a, b) => a + b, 0) / пройденные.length).toFixed(1)
      : "—",
    avg_pct: пройденные.length
      ? Math.round(проценты.reduce((a, b) => a + b, 0) / пройденные.length)
      : 0,
  };
}

/**
 * Библиотека витрины: недавно открытые и все материалы, с фильтром по
 * предмету. Чипы предметов строятся по самим материалам — предмет без
 * книг в списке чипов не появится.
 */
export function getLibrary(locale: Locale, subjectId?: BaseSubjectKey | null) {
  const все = trDeep(LIBRARY_BOOKS, locale) as LibraryBookRow[];
  const rows = subjectId ? все.filter((b) => b.subject_id === subjectId) : все;
  const предметы: BaseSubjectKey[] = [];
  for (const b of все) if (!предметы.includes(b.subject_id)) предметы.push(b.subject_id);
  return {
    rows,
    recent: все.filter((b) => b.is_recent),
    total: все.length,
    subjects: предметы,
  };
}

// ─── Объявления и сообщение от администрации ─────────────────────────────────

/**
 * Объявления витрины. Счётчик по каждой категории считается по самим
 * карточкам — в макете чипы фильтра числа не показывают, но раз уж мы их
 * считаем для пустого состояния, пусть это будет один расчёт, а не два.
 */
export function getAnnouncements(locale: Locale, category?: AnnouncementCategory | null) {
  const все = trDeep(ANNOUNCEMENTS, locale) as AnnouncementCardRow[];
  const rows = category ? все.filter((a) => a.category === category) : все;
  return { rows, total: все.length };
}

/**
 * Разворот объявления (экран 27).
 *
 * Просмотры и комментарии берутся у своей карточки, а не лежат второй
 * копией: в макете там те же 245 и 12, и разойтись им негде.
 */
export function getAdminMessage(locale: Locale) {
  const карточка = ANNOUNCEMENTS.find((a) => a.id === ADMIN_MESSAGE.announcement_id) ?? null;
  return {
    ...(trDeep(ADMIN_MESSAGE, locale) as AdminMessage),
    views: карточка?.views ?? 0,
    comments: карточка?.comments ?? 0,
  };
}

/** Отзывы учителей витрины. Тексты — содержимое, поэтому через словарь
 *  заготовок: на узбекском и английском показ читается целиком. */
export function getTeacherReviews(locale: Locale): TeacherReviewRow[] {
  return trDeep(TEACHER_REVIEWS, locale);
}

/** Вкладка «Навыки» витрины: плитки, чипы и радар. У настоящего родителя
 *  вкладка считается из его данных и сюда не заходит. */
export function getSkillsTab(locale: Locale) {
  return {
    tiles: trDeep(SKILLS_TAB.tiles, locale),
    chips: trDeep(SKILLS_TAB.chips, locale),
    radar: SKILLS_TAB.radar,
  };
}

/**
 * Экран 16 «Навыки и развитие» — витрина.
 *
 * Индекс 4.6 и 92% отдаются как есть: в макете они согласованы между собой
 * (4.6 / 5.0 = 92%), но НЕ равны среднему шести осей (оно 4.4). Считать
 * индекс самим значило бы придумать формулу, которой макет не задавал.
 */
export function getSkillsScreen(locale: Locale) {
  return {
    overall_label: SKILLS_SCREEN.overall_label,
    overall_max_label: SKILLS_SCREEN.overall_max_label,
    overall_pct: SKILLS_SCREEN.overall_pct,
    overall_note: tr(SKILLS_SCREEN.overall_note, locale),
    axes: SKILLS_SCREEN.axes.map((a) => ({ ...a, name: tr(a.name, locale) })),
    radar: SKILLS_SCREEN.radar,
    assistant_note: tr(SKILLS_SCREEN.assistant_note, locale),
    practice: SKILLS_SCREEN.practice.map((p) => ({
      ...p,
      title: tr(p.title, locale),
      meta_label: tr(p.meta_label, locale),
    })),
  };
}

/**
 * Экран «Все предметы» — витрина.
 *
 * Количество и средний балл СЧИТАЮТСЯ по строкам, а не берутся подписью из
 * макета. Там они совпали (5 предметов, среднее ровно 4.60), но копия числа
 * рядом с данными — это будущее расхождение: правка одной оценки увела бы
 * подпись в сторону, и никто бы не заметил.
 */
export function getAllSubjects(locale: Locale) {
  const rows = trDeep(SUBJECT_STATS, locale);
  const сумма = SUBJECT_STATS.reduce((a, r) => a + Number(r.grade_label), 0);
  const среднее = SUBJECT_STATS.length ? сумма / SUBJECT_STATS.length : 0;
  return {
    rows,
    count: SUBJECT_STATS.length,
    average_label: среднее.toFixed(1),
  };
}

/** Карточка предмета d11 — витрина. В макете заполнена только математика
 *  (у остальных предметов карточки нет вовсе), поэтому возвращается она
 *  же независимо от того, какой предмет открыли. Так и в макете. */
export function getSubjectDetail(locale: Locale) {
  return trDeep(SUBJECT_DETAIL_MATH, locale);
}

/**
 * Профиль учителя — в макете заполнен только для математики.
 *
 * Длительность урока СЧИТАЕТСЯ по строке расписания («10:20 – 11:05»), а
 * не записана числом. В макете под каждой строкой стоит «45 минут»; все
 * шесть слотов действительно по 45 — проверено. Но записать это числом
 * значило бы завести подпись, которая переживёт правку времени урока.
 *
 * Отзывы — те же, что на экране «Отзывы учителей», отфильтрованные по
 * имени учителя и обрезанные до двух, как в макете (строка 4343).
 */
export function getTeacherProfile(locale: Locale, childId?: string) {
  const профиль = trDeep(TEACHER_PROFILE, locale);
  const минуты = (диапазон: string): number | null => {
    const m = диапазон.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return (Number(m[3]) * 60 + Number(m[4])) - (Number(m[1]) * 60 + Number(m[2]));
  };
  const ребёнок = resolveChild(childId);
  return {
    ...профиль,
    room_label: SCHEDULE_ROOM_LABEL,
    schedule: профиль.schedule.map(([day, time]) => ({
      day,
      time,
      minutes: минуты(time),
    })),
    reviews: trDeep(TEACHER_REVIEWS, locale)
      .filter((r) => r.teacher_name === TEACHER_PROFILE.full_name)
      .slice(0, 2),
    child_name: ребёнок?.first_name ?? "",
  };
}

/**
 * Экран «Освоение тем» — витрина.
 *
 * ЧИСЛА ШАПКИ СЧИТАЮТСЯ, А НЕ БЕРУТСЯ ИЗ МАКЕТА. В макете там стоял
 * статический текст «20 тем в учебном плане · 14 освоено на 70% и выше ·
 * 6 тем требуют внимания» и шкала на 70%. Пересчёт по самим темам даёт
 * 20 / 15 / 5 и среднее 80% — то есть подпись расходилась со списком прямо
 * под ней, и любой, кто пересчитал бы помеченные строки, получил бы пять,
 * а не шесть. Считаем по данным: это единственный способ, при котором
 * шапка и список не могут разойтись.
 *
 * Шкала — среднее по выбранному предмету (или по всем, если выбран «Все»).
 * Отдельно любопытно, что 70% макета — это в точности среднее английского;
 * похоже, шкалу срисовали при выбранном английском, а подписи — со всего
 * плана.
 */
export function getTopicMastery(locale: Locale, subjectId?: BaseSubjectKey | null) {
  const выбранные = subjectId ? TOPICS.filter((t) => t.subject_id === subjectId) : TOPICS;
  const освоено = выбранные.filter((t) => t.mastery_pct >= TOPIC_MASTERED_AT).length;
  const сумма = выбранные.reduce((a, t) => a + t.mastery_pct, 0);
  const groups = TOPIC_SUBJECT_ORDER
    .filter((s) => !subjectId || s === subjectId)
    .map((s) => ({
      subject_id: s,
      rows: выбранные
        .filter((t) => t.subject_id === s)
        .map((t) => ({
          ...t,
          title: tr(t.title, locale),
          meta_label: tr(t.meta_label, locale),
        })),
    }))
    .filter((g) => g.rows.length > 0);
  return {
    groups,
    total: выбранные.length,
    mastered: освоено,
    need_attention: выбранные.length - освоено,
    overall_pct: выбранные.length ? Math.round(сумма / выбранные.length) : 0,
    mastered_at: TOPIC_MASTERED_AT,
    subject_order: TOPIC_SUBJECT_ORDER,
  };
}

/**
 * Экран 6 «Статус дня» — витрина.
 *
 * Своих чисел почти нет: уроки дня, сколько прошло и какой идёт берутся у
 * расписания (getDaySchedule на тот же день), время прихода — с главной,
 * баланс — из кошелька. Поэтому «2 из 6» и «3-й урок идёт сейчас, впереди
 * ещё 3» не записаны нигде подписью, а выводятся из самого списка: у
 * ребёнка с другим набором уроков они пересчитаются сами.
 *
 * Уважительных и неуважительных пропусков ноль не потому, что так в
 * макете, а потому, что у строки расписания вообще нет статуса пропуска —
 * только «прошёл», «идёт», «впереди». Взяться единице неоткуда.
 */
export function getDayStatus(childId: string | undefined, locale: Locale) {
  const lessons = getDaySchedule(DEMO_TODAY.weekday_index, childId);
  const done = lessons.filter((l) => l.status === "done").length;
  const liveIndex = lessons.findIndex((l) => l.status === "live");
  return {
    lessons,
    total: lessons.length,
    done,
    excused: 0,
    unexcused: 0,
    live_number: liveIndex >= 0 ? liveIndex + 1 : null,
    ahead: liveIndex >= 0 ? lessons.length - liveIndex - 1 : 0,
    arrived_label: DASHBOARD_CHILD_STATUS.at_school_since_label,
    meals: {
      menu_label: tr(DAY_STATUS.menu_label, locale),
      lunch_label: tr(DAY_STATUS.lunch_label, locale),
      balance: getWalletBalance(),
    },
  };
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
/** Лента «важных» на вкладке сообщений — пять кружков макета. Подписи
 *  берёт экран из словаря по label_key, поэтому перевод здесь не нужен. */
export function getMessageStories(): MessagesStoryRow[] {
  return MESSAGES_STORIES;
}

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

// getAutoExitFixture убрана 28.08.2026 вместе со строкой «Автовыход» на
// экране настроек: логики выхода по бездействию в приложении нет, и подпись
// «Через 15 минут» была ложным утверждением о безопасности аккаунта. Сами
// AUTO_EXIT_OPTIONS / DEFAULT_AUTO_EXIT_VALUE остались в заготовке нетронутыми
// (её править нельзя) — просто больше никем не читаются.

// ─── Поиск ───────────────────────────────────────────────────────────────────



// ─── Dashboard / EduOS Assistant ─────────────────────────────────────────────

/** Тексты ассистента, генерируемые от ребёнка (шаблоны конкатенации B10). */
export function getAssistantTexts(childId?: string): {
  dashboard: string;
  overview7: string;
  review: string;
} {
  // Ребёнка может не быть. Экран прогресса зовёт это только в демо-ветке,
  // но пустые строки честнее склейки с чужим именем.
  const k = resolveChild(childId);
  if (!k) return { dashboard: "", overview7: "", review: "" };
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
export function getDashboard(childId: string | undefined, locale: Locale) {
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
    wallet_balance: getWalletBalance(),
    // Лента «Сегодня» и плитка «Питание» — как и «К оплате», ТОЛЬКО для
    // показа: гейт стоит в HomeScreen. Настоящему родителю событий взять
    // неоткуда — ленты в базе нет вовсе.
    feed: trDeep(DASHBOARD_FEED, locale),
    meals_tile: {
      status_label: tr(MEALS_TILE.status_label, locale),
      gradient: MEALS_TILE.gradient,
    },
  };
}


