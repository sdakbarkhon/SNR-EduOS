/**
 * Типы data-слоя родительского приложения v2 (Заход 1, Правка 3 заказчика).
 *
 * Интерфейсы спроектированы максимально близко к реальным строкам БД проекта
 * (packages/core/src/types.ts, packages/core/src/queries/parent.ts): snake_case
 * полей как в Supabase-строках (full_name, group_id, starts_at, due_date,
 * amount, status…), та же вложенность. Для сущностей, которых в базе пока нет
 * (кошельки, счета, транспорт, медкарта…), строки спроектированы в том же
 * стиле — как будто таблицы существуют.
 *
 * Поля с суффиксом `_label` — предзаготовленные строки макета («5 августа
 * 2026», «2 ч назад»): на этапе данных они будут вычисляться из ISO-дат.
 * Презентационные поля (gradient / icon_paths / ring_color) — тоже из макета
 * дословно; в реальной базе их заменят конфиги предметов/категорий.
 */

// ─── Общие алиасы ────────────────────────────────────────────────────────────

/** Ключ предмета макета (SUBJ). `rusF` — факультатив русского. */
export type SubjectKey = "rus" | "eng" | "math" | "prog" | "robo" | "rusF";

/** Базовый ключ предмета (без факультатива) — TOPICS/LIB_D/TESTS_D. */
export type BaseSubjectKey = Exclude<SubjectKey, "rusF">;

/** Градиент [from, to] — как g/g1..g2 в константах макета. */
export type Gradient = [string, string];

// ─── family ──────────────────────────────────────────────────────────────────

/** Ребёнок (students + student_groups/groups) + витринные поля макета KIDS. */
export interface ChildRow {
  id: string;
  full_name: string;          // KIDS.full
  first_name: string;         // KIDS.n
  // first_name_gen (родительный падеж имени) удалён 28.08.2026: у
  // настоящего ребёнка склонять имя нечем, и поле хранило именительный
  // под именем родительного. Фразы переписаны так, что падеж не нужен.
  is_female: boolean;         // KIDS.f
  class_name: string;         // KIDS.cl — groups.name
  group_id: string;
  /** Чип статуса на карточке — дословно из макета («В школе» / «Дома»). */
  status_chip: string;        // KIDS.chip
  avatar_gradient: Gradient;  // KIDS.g1/g2
  avatar_ring: string;        // KIDS.ring
}

/** Профиль ребёнка d29 (CHILD_INFO), индекс = ребёнок. */
export interface ChildInfoRow {
  student_id: string;
  birth_date_label: string;   // dob
  age_label: string;          // age
  curator_name: string;       // cur — классный руководитель
  student_code: string;       // id («SNR-2026-00847»)
  file_no: string;            // file — личное дело
  allergies_label: string;    // alg
  med_note_label: string;     // med
}

/** Родитель (parents) — Дилноза Каримова (C11). */
export interface ParentRow {
  id: string;
  full_name: string;
  first_name: string;
  initials: string;           // «ДК»
  avatar_gradient: Gradient;
  phone: string;
  email: string;
  role_label: string;         // «Мать»
}

/** Данные родителя d30 (виртуальная таблица parent_profiles). */
export interface ParentProfileRow {
  parent_id: string;
  full_name_official: string; // «Каримова Дилноза Рустамовна»
  birth_date_label: string;
  gender_label: string;
  marital_status_label: string;
  city: string;
  address: string;
  postal_code: string;
  workplace: string;
  job_title: string;
  work_phone: string;
  backup_phone: string;
}

/** Демо-родители экрана входа (B9). */
export interface DemoParentRow {
  /** Стабильный ключ демо-аккаунта (Заход 4) — используется контекстом
   *  сессии и списком-селектором. */
  id: string;
  name: string;
  phone: string;
  kids_count: number;         // n
  kids_initials: string[];    // kids
  /** ID детей CHILDREN, доступные этому демо-родителю (длина = kids_count).
   *  Порядок совпадает с kids_initials — макет показывает А/М/Ф именно так. */
  child_ids: string[];
}

// ─── subjects ────────────────────────────────────────────────────────────────

/** Предмет (subjects) + витринные цвета макета SUBJ. */
export interface SubjectRow {
  id: SubjectKey;
  name: string;               // n
  color: string;              // c
  gradient: Gradient;         // из CSS `linear-gradient(135deg, from, to)`
  text_color: string;         // tx
  chip_bg: string;            // bg
  chip_border: string;        // bd
  current_topic: string;      // th
  teacher_name: string;       // tch
}

/**
 * Освоение темы (TOPICS макета, 3267–3273).
 *
 * Возвращён 29.08.2026 вместе с показом без базы. Удалён был 14.08, когда
 * «Освоение тем» перешло на расчёт по журналу: два источника рядом были
 * ни к чему. Теперь показу считать не из чего, и заготовка снова нужна —
 * но только ему: настоящий родитель по-прежнему видит расчёт.
 */
export interface TopicMasteryRow {
  subject_id: BaseSubjectKey;
  title: string;
  mastery_pct: number;
  meta_label: string;         // «8 уроков · 6 заданий»
}

// ─── Дневник, тесты, библиотека (сервис-разделы) ─────────────────────────────

/** Урок в дневнике: предмет, тема, домашнее задание, оценка. */
export interface DiaryLessonRow {
  subject_id: BaseSubjectKey;
  theme: string;
  homework: string;           // «Д/З: № 140–148» или «Д/З: не задано»
  grade: number | null;
}

/** День дневника. Средний балл дня НЕ хранится: он считается по оценкам
 *  этого же дня — все четыре подписи макета так и сходятся. */
export interface DiaryDayRow {
  label: string;              // «ПОНЕДЕЛЬНИК · 21 июля»
  lessons: DiaryLessonRow[];
}

/**
 * Неделя дневника.
 *
 * Три числа шапки хранятся ПОДПИСЯМИ, а не считаются, и это осознанно:
 * список дней в макете неполный (четыре дня из семи), поэтому счётчики
 * относятся ко всей неделе, а не к видимым карточкам. Пересчитать их по
 * списку значило бы молча заменить «за неделю» на «за показанные дни».
 * Расхождения описаны в журнале захода 5.
 */
export interface DiaryWeekRow {
  index: number;              // 1 — текущая неделя макета
  label: string;              // «20 – 26 июля»
  grades_label: string;       // «8»
  avg_label: string;          // «4.6»
  homework_label: string;     // «8 из 10»
  days: DiaryDayRow[];
}

/** Тест: пройденный (с результатом) или предстоящий (с отсчётом). */
export interface TestRow {
  subject_id: BaseSubjectKey;
  name: string;
  topic: string;
  date_label: string;
  done: boolean;
  result_label?: string;      // «9 из 10»
  pct?: number;
  grade?: number;
  countdown_label?: string;   // «Через 3 дня»
}

/** Материал школьной библиотеки. */
export interface LibraryBookRow {
  subject_id: BaseSubjectKey;
  name: string;
  author: string;
  meta_label: string;         // «PDF · 4.2 МБ»
  /** Попадает в блок «Недавно открытые» (rec в макете). */
  is_recent: boolean;
}

/** Категория объявления в макете: важное, мероприятие, информация. */
export type AnnouncementCategory = "imp" | "event" | "info";

/** Карточка объявления (разметка 810–835 макета). */
export interface AnnouncementCardRow {
  id: string;
  category: AnnouncementCategory;
  date_label: string;         // «21 июля 2026»
  title: string;
  text: string;
  author: string;
  views: number;
  comments: number;
  /** Куда ведёт карточка. null — разворота у неё в макете нет. */
  go: string | null;
}

/** Разворот объявления — экран 27 (разметка 840–872). Счётчики просмотров
 *  и комментариев здесь НЕ хранятся: их отдаёт сама карточка. */
export interface AdminMessage {
  announcement_id: string;
  author: string;
  sent_label: string;         // «21 июля 2026, 10:30»
  title: string;
  paragraphs: string[];
  facts: { label_key: "eventDate" | "eventTime" | "eventPlace"; value: string }[];
  note: string;
  files: { name: string; size_label: string; kind: "pdf" | "img" | "doc" }[];
}

/** Учитель (teachers) — профиль dteach (TEACHERS.math). */
export interface TeacherProfileRow {
  full_name: string;
  subject_id: BaseSubjectKey;
  subject_name: string;
  experience_label: string;   // exp
  education_label: string;    // edu
  classes_label: string;      // cls
  schedule: [string, string][]; // [['Пн','10:20 – 11:05'], …]
}

/** Отзыв учителя (REVS). grp: t — сегодня, w — на этой неделе, e — ранее. */
export interface TeacherReviewRow {
  group: "t" | "w" | "e";
  teacher_name: string;
  subject_id: BaseSubjectKey;
  time_label: string;
  likes: number;
  text: string;
}

/** Строка «Все предметы» (allSubjRows). */
export interface SubjectStatRow {
  subject_id: BaseSubjectKey;
  grade_label: string;        // «4.9»
  pct: number;
  delta_label: string;        // «↑ 0.2»
  is_up: boolean;
  meta_label: string;         // «24 урока · 18 заданий за месяц»
}

// ─── schedule ────────────────────────────────────────────────────────────────

/** «Сегодня» прототипа — среда 23 июля 2026, зафиксировано константой. */
export interface DemoToday {
  iso_date: string;           // '2026-07-23'
  /** Момент «сейчас» прототипа (идёт 3-й урок, оценка 10:42). */
  now_iso: string;
  day: number;                // 23
  month_index: number;        // 1 — «Июль 2026» в DS_MONTHS
  weekday_index: number;      // 2 — Ср в SCHED_DAYS
  label_full: string;         // dsLbl6v «Среда, 23 июля»
  label_today: string;        // dsLblMv «Сегодня, 23 июля»
}

export type LessonSetId = "A" | "B" | "C";

/** День недельного расписания (SCHED_DAYS). */
export interface ScheduleDayRow {
  weekday_label: string;      // w
  day: number;                // d
  set_id: LessonSetId;
  /** Оценки по слотам (null — нет оценки); длина ≤ числа уроков. */
  grades: (number | null)[];
}

/** Урок, собранный из сетов и слотов (аналог lessons + subjects join). */
export interface ScheduleLessonRow {
  slot_index: number;
  subject_id: SubjectKey;
  starts_at: string;          // SLOT_S[i] «08:30»
  ends_at: string;            // SLOT_E[i] «09:15»
  room_label: string;         // «Кабинет 101»
  grade: number | null;
  /** Статус слота на «сегодня»: прошёл / идёт сейчас / далее. */
  status: "done" | "live" | "next";
}

/** Месяц дейтпикера (DS_MONTHS). */
export interface DatePickerMonth {
  name: string;               // «Июль 2026»
  days: number;
  offset: number;             // off — сдвиг первого дня
  gen_label: string;          // «июля»
}

// ─── attendance ──────────────────────────────────────────────────────────────

/**
 * Код ячейки календаря посещаемости (attCells): e пусто, p присутствовал,
 * u уважительная, n неуважительная, w выходной, f будущий, t сегодня.
 */
export type AttendanceCellCode = "e" | "p" | "u" | "n" | "w" | "f" | "t";

/** Месяц календаря посещаемости в витрине (attCells макета, 3807–3828).
 *  Возвращён 29.08.2026 вместе с заготовкой: показ снова без базы, и
 *  фиксированный двухмесячный набор макета снова достижим. Настоящий
 *  календарь по-прежнему строится на лету по видимому месяцу и этого типа
 *  не касается. */
export interface AttendanceMonthRow {
  month_index: number;         // 1 = «Июль 2026», 0 = «Июнь 2026»
  label: string;
  cells: AttendanceCellCode[]; // 35 ячеек, Пн–Вс
}

/** Статистика экрана «Посещаемость» (разметка 593–595). */
export interface AttendanceStats {
  attendance_pct: number;     // 96
  excused_count: number;      // 2
  unexcused_count: number;    // 1
}

/** «Последние дни» (разметка 616–619). */
export interface AttendanceDayRow {
  date_label: string;         // «Сегодня 23 июля»
  status_label: string;       // «Присутствует» / «Отсутствовал(а) без …»
  arrived_label: string | null; // «08:12»
  left_label: string | null;  // «15:34» / null («—»)
}

// ─── grades / diary ──────────────────────────────────────────────────────────
// Строки дневника (DiaryLessonRow/DiaryDayRow/DiaryWeekRow) удалены
// 14.08.2026: «Дневник» собирается из расписания класса и оценок за уроки,
// а типы приходят из @snr/core (DiaryWeek / DiaryDay / DiaryLesson).

/** Сводка «Успехи» П10 (C2) — витринные значения макета. */
export interface GradesSummary {
  average_label: string;      // «4.6»
  average_max_label: string;  // «5.0»
  average_chip: string;       // «Отлично!»
  stars_filled: number;       // 4 из 5
  week_progress_label: string; // «↑ 12%»
  week_progress_note: string; // «отличный рост»
  sparkline_points: string;   // «2,19 14,16 …»
  attendance_pct: number;     // 96
  attendance_ratio_label: string; // «24/25»
  vs_prev_month_note: string; // «Выше на 0.2, чем в июне»
  strengths: string[];
  growth_areas: string[];
  dynamics_points: string;    // график вкладки «Динамика»
  dynamics_months: { month_label: string; avg_label: string; delta_label: string }[];
  dynamics_note: string;
}

/** Детали предмета d11 — Математика (C5; темы — хардкод экрана, см. аномалию №3). */
export interface SubjectDetail {
  subject_id: BaseSubjectKey;
  teacher_name: string;
  teacher_online: boolean;
  current_grade_label: string; // «4.8»
  grade_note: string;          // «Отлично!»
  gauge_pct: number;           // 96
  topics: { title: string; pct: number }[];
  last_work: { title: string; date_label: string; grade: number };
  upcoming_test: { title: string; date_label: string; countdown_label: string };
  teacher_comment: string;
  teacher_comment_extra: string;
  teacher_comment_time_label: string;
  assistant_note: string;
}

// ─── homework ────────────────────────────────────────────────────────────────

/** Карточка ДЗ d12 (C6) — витринный аналог homework + homework_submissions. */
export interface HomeworkCardRow {
  id: string;
  subject_id: BaseSubjectKey;
  status_label: string;       // «Выполнено» / «В работе» / …
  title: string;              // «№ 140–148, дроби и уравнения»
  due_label: string;          // «Сдано сегодня, 10:15» / «Срок: завтра, 18:00»
  /** Прогресс-кольцо: 0–100, 'hourglass' (на проверке) или null («—»). */
  progress: number | "hourglass" | null;
}

/** Фильтры-чипы d12 («Все · 5» и т.д.). */
export interface HomeworkFilterChip {
  label: string;
  count: number;
}

/** Детали задания d13 (C7). */
export interface HomeworkDetail {
  subject_id: BaseSubjectKey;
  title: string;
  status_chip: string;        // «На проверке»
  due_label: string;          // «Срок: 24 июля, 18:00»
  teacher_name: string;
  teacher_initials: string;
  instruction: string;
  attachment: { name: string; type_label: string; size_label: string };
  timeline: { label: string; date_label: string }[];
  teacher_comment: string;
  teacher_comment_date_label: string;
}

/** Файлы формы отправки работы (B11). */
export interface UploadFileFixture {
  name: string;
  size_label: string;
}

// ─── payments ────────────────────────────────────────────────────────────────

/** Счёт к оплате (BILLS) — тип и фикстура подняты в @snr/core (единый мок
 *  для web+mobile, см. packages/core/src/mocks/payments.ts). */
export type { BillRow } from "@snr/core";

/** Способ оплаты checkout (PAY_OPTS). */
export interface PayMethodRow {
  id: string;
  name: string;
  subtitle: string;
  gradient: Gradient;         // pg
  tag: string;                // pt «PAYME»
  recommended: boolean;       // rec
}

/** Операция истории оплат (HIST) — аналог payments. */
export interface PaymentHistoryRow {
  category: "edu" | "food" | "other";
  title: string;
  note: string;
  date_label: string;
  amount: number;             // отрицательное = возврат
  is_refund: boolean;
  gradient: Gradient;
  icon_paths: string[];
}

/** Чек или счёт-инвойс (RECEIPTS). */
export interface ReceiptRow {
  kind: "check" | "invoice";
  month: "jul" | "jun";
  title: string;
  number_label: string;       // «Чек № RCP-2026-07-018»
  date_label: string;
  amount: number;
}

export interface PaymentsFaqItem {
  question: string;
  answer: string;
}

/** Карточка баланса П17 + автоплатёж (C3) — тип и фикстура подняты в
 *  @snr/core. */
export type { PaymentsOverview } from "@snr/core";

// ─── wallet ──────────────────────────────────────────────────────────────────

/** Кошелёк ребёнка (виртуальная таблица wallets) — тип и фикстура подняты в
 *  @snr/core. */
export type { WalletRow } from "@snr/core";

/** Операция кошелька (WOPS). */
export interface WalletOpRow {
  direction: "in" | "out";    // dir
  title: string;              // name
  subtitle: string;           // sub
  time_label: string;         // time
  amount: number;             // sum
  gradient: Gradient;         // g
  icon_paths: string[];       // p
}

/** Группа операций по дню: t — сегодня, y — вчера, d21 — 21 июля. */
export interface WalletOpsDayGroup {
  day_key: "t" | "y" | "d21";
  /** Сколько дней назад: 0 — сегодня. Подпись собирает экран. */
  days_ago: number;
  ops: WalletOpRow[];
}

/** Лимиты расходов (B6). */
export interface WalletLimits {
  daily_limit: number;        // 50 000
  spent_today: number;        // 32 000
  presets: number[];          // [20000, 30000, 50000] (+ «Без лимита» = 0)
  categories: { id: "caf" | "shop" | "stat"; name: string; limit: number; enabled: boolean }[];
  notify_ops: boolean;        // limN1
  notify_limit: boolean;      // limN2
}

// ─── notifications ───────────────────────────────────────────────────────────
// NotificationRow удалён 14.08.2026: лента идёт из таблицы notifications
// (@snr/core, тип AppNotification). Здесь остались только НАСТРОЙКИ.

/** Категория настроек уведомлений (NTF_DEFS). */
export interface NotificationCategoryRow {
  id: string;
  name: string;               // n
  subtitle: string;           // s
  gradient: Gradient;
  icon_paths: string[];
  enabled_by_default: boolean;
}

// ─── messages ────────────────────────────────────────────────────────────────

/** Тред списка сообщений (msgList). */
export interface MessageThreadRow {
  category: "chats" | "ann" | "svc";
  name: string;
  role_label: string | null;
  preview: string;
  time_label: string;
  badge: number | null;
  /** Маршрут макета («d25») или stub-ключ («stub:meals»). */
  go: string;
  /** Заход 4 (d24 «Сообщения»): визуал аватара треда — градиент + опц. инициалы
   *  (для чатов учителей) или ключ иконки из ICONS (для объявлений/сервисов). */
  avatar_gradient?: Gradient;
  avatar_initials?: string;
  avatar_icon_key?: string;
  is_online?: boolean;
}

/** Стория раздела «Сообщения» d24: 5 круглых элементов сверху экрана. */
export interface MessagesStoryRow {
  /** Стабильный ключ; лейбл — из словаря по label_key. */
  id: string;
  /** Ключ i18n в parentApp.msg (без секции): «storyImportant» / «storyMath» / … */
  label_key: string;
  /** Внутренний градиент круга (после белого зазора). */
  gradient: Gradient;
  /** Тип содержимого круга: «icon» — ключ ICONS (мегафон/дом), «chat» — инициалы. */
  kind: "icon" | "chat";
  /** Для kind==="icon": ключ ICONS (bell/mega/user/…). */
  icon_key?: string;
  /** Для kind==="chat": инициалы (напр. «ГЮ», «СУ», «НА»). */
  initials?: string;
  /** Онлайн-точка (для учителей). */
  is_online?: boolean;
  /** Куда ведёт тап (ключ маршрута макета). */
  go: string;
}

/** Реплика чата (d25 / d28). from: 't' учитель/поддержка, 'p' родитель. */
export interface ChatMessageRow {
  from: "t" | "p";
  time_label: string;
  text: string;
  /** Карточка «Информация по счёту» в чате поддержки (C10, реплика 4). */
  is_info_card?: boolean;
  info_card_title?: string;
}

// ─── services: тесты / библиотека / портфолио / заявления / медкарта /
//     транспорт / питание ────────────────────────────────────────────────────

export interface PortfolioWorkRow {
  subject_id: BaseSubjectKey;
  name: string;
  /** День работы, «YYYY-MM-DD». Подпись собирает экран (dayMonth). */
  date: string;
  grade: number;
}

export interface AchievementRow {
  name: string;
  subtitle: string;
  /** Месяц, «YYYY-MM»: числа у награды нет. Подпись — monthYear. */
  month: string;
  gradient: Gradient;
}

export interface CertificateRow {
  name: string;
  org: string;
  /** Месяц выдачи, «YYYY-MM». Подпись — monthYear. */
  month: string;
}

/** Детали работы портфолио (WORK_X), индекс = PORT_D.works. */
export interface WorkDetailRow {
  description: string;
  criteria: [string, number][];
  comment: string;
  comment_from_subject: BaseSubjectKey; // cfrom
  files: { name: string; size_label: string }[];
}

export type ApplicationStatus = "rev" | "ok" | "no"; // на рассмотрении / одобрено / отклонено

export interface ApplicationRow {
  status: ApplicationStatus;  // st
  name: string;
  number_label: string;       // num «№ 2026-07-016»
  /** День подачи, «YYYY-MM-DD». Подпись — dayMonth. */
  date: string;
  /** С какого дня готово, «YYYY-MM-DD». Только у одобренных. */
  ready_from?: string;
  gradient: Gradient;
}

export interface ApplicationTypeRow {
  name: string;
  subtitle: string;
}

/** Детали заявления (APP_X), ключ = number_label. */
export interface ApplicationDetailRow {
  period_label: string;
  reason: string;
  comment: string;
  comment_by: string;         // who
  comment_date_label: string; // wdate
}

/** Медкарта (MED_D), индекс = ребёнок. */
export interface MedicalCardRow {
  student_id: string;
  stats: [string, string][];  // [['РОСТ', '128 см'], …]
  allergies: [string, string][]; // [[название, примечание]] — пусто = «Не выявлено»
}

export interface VaccinationRow {
  name: string;
  /** Сделана: день «YYYY-MM-DD». Плановая: месяц «YYYY-MM» в month. */
  date?: string;
  month?: string;
  status: "ok" | "plan";
}

/** Остановка маршрута (TR_STOPS). */
export interface TransportStopRow {
  name: string;
  time_label: string;
  status: "past" | "now" | "next";
  is_my_stop?: boolean;
}

/** Меню дня питания (MEALS_WEEK) — [[блюдо, категория] × 4]. */
export type MealsDayMenu = [string, string][];

// ─── profile / настройки ─────────────────────────────────────────────────────

/** Активная сессия (SESS). */
export interface SessionRow {
  id: string;
  name: string;
  subtitle: string;
  icon_paths: string[];       // p
  gradient: Gradient;
}

/**
 * Уведомление в ленте (ntData макета, строки 3560–3573).
 *
 * Текст — ШАБЛОН: два уведомления в макете называют ребёнка по имени, а
 * одно ещё и склеивает сумму счёта. Хранить их готовыми строками значило
 * бы, что при переключении на другого ребёнка ему сообщат про Малику, а
 * правка счёта разошлась бы с разделом оплат.
 */
export interface NotificationRow {
  id: string;
  group: "today" | "yday";
  title: string;
  /** Может содержать {name}, {suf} и {sum} — подставляет аксессор. */
  text: string;
  time_label: string;
  is_unread: boolean;
  is_important: boolean;
  icon_paths: string[];
  gradient: Gradient;
  /** Маршрут перехода — как в макете. */
  go: string;
}

/** Текущее устройство на экране «Активные сессии» (разметка 1940–1941). */
export interface CurrentSessionRow {
  name: string;
  place_label: string;        // «Ташкент · IP 84.54.72.11»
  entered_label: string;      // «Вход выполнен: 23 июля, 09:14»
}

/** Экран «О приложении» (разметка 2354–2394). */
export interface AboutShowcase {
  app_name: string;
  tagline: string;
  version_label: string;      // «Версия 1.0.0»
  facts: { label_key: string; value: string }[];
  school_name: string;
  school_address: string;
  school_contacts: string;
  copyright: string;
}

/** Документ (DOCS_CHILD / DOCS_PARENT). */
export interface DocumentRow {
  owner: "child" | "parent";
  name: string;               // n
  subtitle: string;           // s «Добавлен 12.01.2026»
  gradient: Gradient;
}

/** Юридический документ (DOC_D): terms / privacy / lic. */
export interface LegalDocRow {
  id: "terms" | "privacy" | "lic";
  title: string;
  sections: [string, string][]; // [заголовок, текст]
}

/** Запись «Что нового» (WN_D). */
export interface WhatsNewRow {
  version_label: string;      // v
  date_label: string;         // d
  items: string[];
}

/** Конфирм-диалог (B8). */
export interface ConfirmDialogRow {
  id: string;
  title: string;
  body: string;
  action_label: string;
}

// ─── search ──────────────────────────────────────────────────────────────────

export interface SearchResultRow {
  filter: "msgs" | "mats" | "hw" | "pays" | "svc";
  header: string;             // hdr «СООБЩЕНИЯ»
  name: string;
  subtitle: string;
  detail_label: string;       // d «чат» / «PDF» / «23 июля»
  go: string;
}

// ─── home / dashboard ────────────────────────────────────────────────────────

/** Элемент ленты «Сегодня» Dashboard (C1), разметка 266–268 макета. */
export interface DashboardFeedItem {
  title: string;
  subtitle: string;
  /** Плашка-оценка (5) или чип-текст («Срок завтра» / «Успешно»). */
  /** Тон чипа снят с макета: 249,115,22 — оранжевый, 16,185,129 — зелёный.
   *  Имена совпадают с ключами tokens.status, экран ничего не выводит сам. */
  badge:
    | { kind: "grade"; value: number }
    | { kind: "chip"; label: string; tone: "green" | "orange" };
  /** Плитка слева: текстовый глиф («√x», «Aa») или ключ ICONS («food»).
   *  В макете первые две строки — текст, третья — иконка питания. */
  tile: { kind: "text"; label: string } | { kind: "icon"; icon: string };
  gradient: Gradient;
  /** Маршрут перехода — тот же, что в макете (goSubj / goHw / goMeals). */
  go: string;
}

/** Карточка «Следующий урок» Dashboard (C1). */
export interface NextLessonCard {
  subject_name: string;
  time_room_teacher_label: string; // «10:20–11:05 · Каб. 101 · Гульнора Юсупова»
  tile_label: string;         // «√x»
  gradient: Gradient;
}
