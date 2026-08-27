/**
 * ЕДИНСТВЕННОЕ МЕСТО, ГДЕ ЖИВУТ ВЫДУМАННЫЕ ДАННЫЕ ВЕБ-РОДИТЕЛЯ.
 *
 * Что здесь лежит: оплаты (история, чеки, счета, карты, способы оплаты),
 * кошелёк ребёнка (баланс, операции, лимиты, пресеты перевода) и обращения в
 * поддержку. Экраны берут данные ТОЛЬКО отсюда и ничего не выдумывают у себя —
 * иначе одни и те же суммы разъезжаются по экранам, что в этом разделе уже
 * случалось (см. ниже про 4 950 000 против 5 100 000).
 *
 * ЧЕМ ЭТО ЗАМЕНИТСЯ, КОГДА ПОЯВЯТСЯ ПОДСИСТЕМЫ:
 *  • оплаты и карты — платёжный провайдер: таблицы платежей, чеков и карт,
 *    аксессоры рядом с остальными в lib/parent-queries.ts;
 *  • кошелёк ребёнка — таблица операций кошелька и терминал в столовой;
 *  • лимиты — таблица лимитов на ребёнка (сейчас их негде хранить);
 *  • поддержка — уже существующие chat_threads/chat_messages: как только у
 *    школы появится тред поддержки, экран /parent/support заменится обычной
 *    перепиской, такой же как /parent/chat/[id].
 * До тех пор ни одна кнопка этих экранов ничего не сохраняет: действие
 * показывает пояснение (SOON_PAYMENTS / SOON_SUPPORT), а не делает вид, что
 * сработало.
 *
 * Дальше — исходная шапка про оплаты, она по-прежнему верна.
 *
 * Мок-данные подэкранов раздела «Оплаты» (/parent/payments/top-up · history ·
 * invoices · methods).
 *
 * ПОЧЕМУ МОКИ. Платёжного провайдера в проекте нет вообще: таблицы платежей в
 * БД пустые, чеков/инвойсов не существует как сущности, карты нигде не
 * хранятся. Экраны при этом обязаны быть наполненными (в мобилке они такие),
 * поэтому данные заданы здесь литералами — ровно как на ветке
 * `feat/mobile-parent-redesign` (src/data/fixtures/payments.ts), но с двумя
 * обязательными правками:
 *
 *  1. СЕМЬЯ. В мобильных фикстурах подписи строк содержат троих детей чужой
 *     демо-семьи в трёх разных классах. В веб-демо семья одна: родитель
 *     Исмаилов Бахтиёр, ребёнок Исмаилов Шерзод, 10-А. Поэтому подписи здесь
 *     НЕ хранятся целиком:
 *     фикстура несёт только «хвост» (`via` — способ оплаты / пояснение), а
 *     префикс «{Имя} · {класс}» собирается из РЕАЛЬНЫХ данных ребёнка,
 *     полученных на сервере (см. rowNote / whoLabel).
 *
 *  2. ДАТЫ И СУММЫ СОГЛАСОВАНЫ С ЭКРАНОМ /parent/payments. «Сегодня» демо —
 *     30 июля 2026, поэтому:
 *       * история — то, что уже оплачено (июнь и июль 2026);
 *       * чеки — фискальные документы к этим же оплатам, суммы совпадают
 *         строка в строку с историей;
 *       * счета сгруппированы ПО СРОКУ, а не по месяцу выставления, и это
 *         важно. Карточка «К оплате сейчас» на /parent/payments показывает
 *         ТОЛЬКО счета основного списка (BILLS.in_main_list в
 *         ../v2/data/fixtures/payments.ts): обучение 4 500 000 + питание
 *         450 000 = 4 950 000, «2 счёта». Экскурсия 150 000 туда не входит —
 *         у неё срок 15 августа и в фикстуре она вне основного списка.
 *         Поэтому вкладка «Счета» тоже разносит их на «К оплате сейчас»
 *         (те же две строки и та же сумма) и «Позже» (экскурсия). Раньше все
 *         три лежали одной кучей «Июль 2026», и экран, на который ведёт
 *         «Смотреть все ›», противоречил тому, откуда пришёл родитель:
 *         5 100 000 против 4 950 000 и три счёта против двух.
 *     Основная карта — UZCARD ···· 8341: именно её /parent/payments называет
 *     картой автоплатежа («1-го числа · Uzcard ····8341»), поэтому в «Способах
 *     оплаты» она же основная (в макете там стояла ···· 4242 — это дало бы
 *     родителю две разные «главные» карты).
 *
 * 27.08.2026: снесены заготовки экранов «Перевод» и «Лимиты» (WALLET_LIMITS,
 * TRANSFER_PRESETS) и сохранённых карт (SavedCard, MAIN_CARD, OTHER_CARDS) —
 * сами экраны удалены, карт в проекте не хранится, потребителей не осталось.
 */

/* ── Деньги ─────────────────────────────────────────────────────────────── */

export const CURRENCY = "сум";

/** Разделитель разрядов — NBSP, как в PaymentsView и в мобильном formatMoney. */
const NBSP = " ";

/** Модуль числа с разрядами: 4500000 → «4 500 000». Знак добавляет вызывающий. */
export function formatMoney(n: number, opts: { withCurrency?: boolean } = {}): string {
  const grouped = Math.abs(Math.round(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return opts.withCurrency ? `${grouped}${NBSP}${CURRENCY}` : grouped;
}

/* ── Имя ребёнка ────────────────────────────────────────────────────────── */

/**
 * Имя из `full_name`. В БД одно поле в порядке «Фамилия Имя [Отчество]»
 * («Исмаилов Шерзод») — имя это второе слово; если слово одно, берём его.
 * Та же логика, что у `givenNameLetter` из `_ui/format.ts` (там — только
 * первая буква, здесь нужно слово целиком).
 */
export function givenNameOf(fullName: string | null): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return parts[1] ?? parts[0] ?? "";
}

/** Имя целиком из кириллицы (дефис и апостроф допустимы: «Шер-Али»). */
const CYRILLIC_NAME = /^[Ѐ-ӿ][Ѐ-ӿ'’-]*$/;

/**
 * Родительный падеж имени для шаблона «Кошелёк {gen}»: Шерзод → Шерзода.
 *
 * ТОЛЬКО для кириллических имён. В демо-БД ученик записан латиницей
 * («Ismailov Sherzod»), и безусловное «+ а» давало гибрид «Кошелёк Sherzodа» —
 * латинское слово с кириллической буквой на хвосте. Для нескланяемого имени
 * возвращаем null, а заголовок строит walletTitleOf() — без падежа.
 */
export function genitiveNameOf(fullName: string | null): string | null {
  const given = givenNameOf(fullName);
  if (!given || !CYRILLIC_NAME.test(given)) return null;
  const last = given.slice(-1);
  const prev = given.slice(-2, -1).toLowerCase();
  if (last === "й" || last === "ь") return `${given.slice(0, -1)}я`;
  if (last === "я") return `${given.slice(0, -1)}и`;
  if (last === "а") return `${given.slice(0, -1)}${"гкхжчшщ".includes(prev) ? "и" : "ы"}`;
  if ("оеиуыэюё".includes(last.toLowerCase())) return given;
  return `${given}а`;
}

/**
 * Заголовок карточки кошелька — ОДИН на весь раздел (/parent/payments и
 * /parent/payments/top-up рисуют одну и ту же сущность и обязаны называть её
 * одинаково). Кириллическое имя склоняем, латинское ставим через «·».
 */
export function walletTitleOf(fullName: string | null): string {
  const gen = genitiveNameOf(fullName);
  if (gen) return `Кошелёк ${gen}`;
  const given = givenNameOf(fullName);
  return given ? `Кошелёк · ${given}` : "Кошелёк ребёнка";
}

/** Префикс подписей строк: «Шерзод · 10-А». */
export function whoLabel(childName: string | null, className: string | null): string {
  return [givenNameOf(childName), className ?? ""].filter(Boolean).join(" · ");
}

/** «Шерзод · 10-А · Payme» — пустые части выпадают, лишних « · » не остаётся. */
export function rowNote(who: string, via: string): string {
  return [who, via].filter(Boolean).join(" · ");
}

/**
 * «Хвост» подписи счетов карточки «К оплате сейчас» на /parent/payments.
 *
 * Сами счета приходят из фикстур ../v2/data (BILLS), а там поле `note` —
 * целая строка мобильного макета вида «{чужой ребёнок} · {чужой класс} ·
 * ежемесячный платёж». Фикстуру мы не правим (её делят другие экраны), но и
 * показывать её `note` нельзя: в веб-демо семья одна. Поэтому от фикстуры
 * берём только сумму/срок/иконку, а подпись собираем как
 * rowNote(whoLabel(<настоящий ребёнок>), BILL_NOTE_TAIL[bill.id]).
 * Ключи — id из BILLS.
 */
export const BILL_NOTE_TAIL: Record<string, string> = {
  edu: "ежемесячный платёж",
  food: "обеды в столовой",
  form: "комплект на осень",
  exc: "выезд класса",
};

/* ── Счётность ──────────────────────────────────────────────────────────── */

/** «1 счёт» / «2 счёта» / «5 счетов» — русская тройная форма. */
export function billsCountLabel(n: number): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${n} счетов`;
  if (mod10 === 1) return `${n} счёт`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} счёта`;
  return `${n} счетов`;
}

/* ── Визуал категорий (плитка-иконка строки) ────────────────────────────── */

export type PayVisualKey = "edu" | "food" | "form" | "exc";

/** Градиент + path'ы глифа. Значения — дословно из макета (BILLS.gradient/icon_paths). */
export const PAY_VISUAL: Record<
  PayVisualKey,
  { gradient: readonly [string, string]; paths: readonly string[] }
> = {
  edu: {
    gradient: ["#7c3aed", "#4f6df5"],
    paths: ["M22 10 12 5 2 10l10 5 10-5Z", "M6 12.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"],
  },
  food: {
    gradient: ["#34d399", "#059669"],
    paths: ["M4 2v7a3 3 0 0 0 6 0V2", "M7 12v10", "M20 2a4 4 0 0 0-4 4v7h4", "M20 13v9"],
  },
  form: {
    gradient: ["#60a5fa", "#2563eb"],
    paths: [
      "M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.1a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.3-2.2Z",
    ],
  },
  exc: {
    gradient: ["#f472b6", "#db2777"],
    paths: [
      "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z",
      "M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    ],
  },
};

/* ── Пополнение ─────────────────────────────────────────────────────────── */

/** Быстрые суммы (topChips макета). Ввод вручную — до 9 цифр. */
export const TOPUP_PRESETS: readonly number[] = [50000, 100000, 200000, 500000];

/* ── История оплат ──────────────────────────────────────────────────────── */

/** Категория чипа-фильтра: «Обучение» / «Питание» / «Другое». */
export type HistoryCategory = "edu" | "food" | "other";

export interface HistoryRow {
  id: string;
  category: HistoryCategory;
  visual: PayVisualKey;
  title: string;
  /** Хвост подписи после «{Имя} · {класс}»: способ оплаты или пояснение. */
  via: string;
  dateLabel: string;
  amount: number;
  isRefund: boolean;
}

export interface HistoryMonth {
  id: string;
  label: string;
  rows: HistoryRow[];
}

/** Уже проведённые оплаты. Свежие сверху — как в мобилке. */
export const PAYMENT_HISTORY: HistoryMonth[] = [
  {
    id: "jul",
    label: "Июль 2026",
    rows: [
      {
        id: "jul-edu",
        category: "edu",
        visual: "edu",
        title: "Обучение · июль",
        via: "Payme",
        dateLabel: "3 июля",
        amount: 4500000,
        isRefund: false,
      },
      {
        id: "jul-food",
        category: "food",
        visual: "food",
        title: "Питание · июль",
        via: "Payme",
        dateLabel: "3 июля",
        amount: 450000,
        isRefund: false,
      },
      {
        id: "jul-refund",
        category: "food",
        visual: "food",
        title: "Питание · перерасчёт",
        via: "возврат за 3 дня отсутствия",
        dateLabel: "18 июля",
        amount: 60000,
        isRefund: true,
      },
    ],
  },
  {
    id: "jun",
    label: "Июнь 2026",
    rows: [
      {
        id: "jun-edu",
        category: "edu",
        visual: "edu",
        title: "Обучение · июнь",
        via: "Click",
        dateLabel: "4 июня",
        amount: 4500000,
        isRefund: false,
      },
      {
        id: "jun-food",
        category: "food",
        visual: "food",
        title: "Питание · июнь",
        via: "Payme",
        dateLabel: "4 июня",
        amount: 450000,
        isRefund: false,
      },
      {
        id: "jun-form",
        category: "other",
        visual: "form",
        title: "Школьная форма",
        via: "UZCARD ···· 8341",
        dateLabel: "12 июня",
        amount: 350000,
        isRefund: false,
      },
    ],
  },
];

/**
 * Итоги для сводной карточки. НЕ хардкод: считаются из PAYMENT_HISTORY, иначе
 * при правке одной строки цифры внизу экрана начали бы врать.
 * `net` — сколько фактически ушло со счёта (оплаты минус возвраты).
 */
export function historyTotals(): { total: number; net: number; refunds: number } {
  let total = 0;
  let refunds = 0;
  for (const month of PAYMENT_HISTORY) {
    for (const row of month.rows) {
      if (row.isRefund) refunds += row.amount;
      else total += row.amount;
    }
  }
  return { total, net: total - refunds, refunds };
}

/* ── Счета и чеки ───────────────────────────────────────────────────────── */

export interface ReceiptRow {
  id: string;
  visual: PayVisualKey;
  title: string;
  /** «Чек № RCP-2026-07-018» / «Счёт № INV-2026-07-001». */
  numberLabel: string;
  dateLabel: string;
  amount: number;
  /** Только у счетов: «Оплачен 3 июля» / «К оплате до 5 августа». */
  statusLabel?: string;
  statusPaid?: boolean;
}

export interface ReceiptMonth {
  id: string;
  label: string;
  rows: ReceiptRow[];
}

/** Фискальные чеки — строка в строку соответствуют PAYMENT_HISTORY. */
export const CHECK_MONTHS: ReceiptMonth[] = [
  {
    id: "jul",
    label: "Июль 2026",
    rows: [
      {
        id: "rcp-07-018",
        visual: "edu",
        title: "Обучение · июль",
        numberLabel: "Чек № RCP-2026-07-018",
        dateLabel: "3 июля",
        amount: 4500000,
      },
      {
        id: "rcp-07-019",
        visual: "food",
        title: "Питание · июль",
        numberLabel: "Чек № RCP-2026-07-019",
        dateLabel: "3 июля",
        amount: 450000,
      },
      {
        id: "rcp-07-046",
        visual: "food",
        title: "Питание · перерасчёт",
        numberLabel: "Чек № RCP-2026-07-046",
        dateLabel: "18 июля",
        amount: 60000,
      },
    ],
  },
  {
    id: "jun",
    label: "Июнь 2026",
    rows: [
      {
        id: "rcp-06-011",
        visual: "edu",
        title: "Обучение · июнь",
        numberLabel: "Чек № RCP-2026-06-011",
        dateLabel: "4 июня",
        amount: 4500000,
      },
      {
        id: "rcp-06-012",
        visual: "food",
        title: "Питание · июнь",
        numberLabel: "Чек № RCP-2026-06-012",
        dateLabel: "4 июня",
        amount: 450000,
      },
      {
        id: "rcp-06-024",
        visual: "form",
        title: "Школьная форма",
        numberLabel: "Чек № RCP-2026-06-024",
        dateLabel: "12 июня",
        amount: 350000,
      },
    ],
  },
];

/**
 * Счета — сгруппированы ПО СРОКУ ОПЛАТЫ, а не по месяцу выставления.
 *
 * Группа «К оплате сейчас» обязана строка в строку совпадать с одноимённой
 * карточкой на /parent/payments: те же два счёта (обучение 4 500 000 +
 * питание 450 000 = 4 950 000, срок 5 августа), что и BILLS.in_main_list в
 * ../v2/data/fixtures/payments.ts. Экскурсия вне основного списка фикстуры и
 * со сроком 15 августа — отдельная группа «Позже»; её 150 000 в «К оплате»
 * не входят ни здесь, ни там.
 */
export const INVOICE_MONTHS: ReceiptMonth[] = [
  {
    id: "due-now",
    label: "К оплате сейчас",
    rows: [
      {
        id: "inv-07-001",
        visual: "edu",
        title: "Обучение · август",
        numberLabel: "Счёт № INV-2026-07-001",
        dateLabel: "20 июля",
        amount: 4500000,
        statusLabel: "К оплате до 5 августа",
        statusPaid: false,
      },
      {
        id: "inv-07-002",
        visual: "food",
        title: "Питание · август",
        numberLabel: "Счёт № INV-2026-07-002",
        dateLabel: "20 июля",
        amount: 450000,
        statusLabel: "К оплате до 5 августа",
        statusPaid: false,
      },
    ],
  },
  {
    id: "later",
    label: "Позже",
    rows: [
      {
        id: "inv-07-014",
        visual: "exc",
        title: "Экскурсия в музей",
        numberLabel: "Счёт № INV-2026-07-014",
        dateLabel: "24 июля",
        amount: 150000,
        statusLabel: "К оплате до 15 августа",
        statusPaid: false,
      },
    ],
  },
  {
    id: "paid",
    label: "Оплаченные",
    rows: [
      {
        id: "inv-06-021",
        visual: "edu",
        title: "Обучение · июль",
        numberLabel: "Счёт № INV-2026-06-021",
        dateLabel: "25 июня",
        amount: 4500000,
        statusLabel: "Оплачен 3 июля",
        statusPaid: true,
      },
      {
        id: "inv-06-022",
        visual: "food",
        title: "Питание · июль",
        numberLabel: "Счёт № INV-2026-06-022",
        dateLabel: "25 июня",
        amount: 450000,
        statusLabel: "Оплачен 3 июля",
        statusPaid: true,
      },
    ],
  },
];

/**
 * Подпись группы счетов: «2 счёта · 4 950 000 сум» по НЕОПЛАЧЕННЫМ строкам.
 * Считается из самих строк — иначе подпись и список снова разъехались бы.
 * Для группы, где всё оплачено, возвращает null (там сумма к оплате не нужна).
 *
 * Условие именно `statusPaid === false`, а не `!statusPaid`: у чеков
 * (CHECK_MONTHS) статуса нет вовсе, и «не оплачен» для них бессмысленно —
 * иначе вкладка «Чеки» получила бы подпись «3 счёта · …» над фискальными
 * документами, которые уже оплачены по определению.
 */
export function unpaidGroupNote(rows: readonly ReceiptRow[]): string | null {
  const unpaid = rows.filter((r) => r.statusPaid === false);
  if (unpaid.length === 0) return null;
  const total = unpaid.reduce((s, r) => s + r.amount, 0);
  return `${billsCountLabel(unpaid.length)} · ${formatMoney(total, { withCurrency: true })}`;
}

/* ── Способы оплаты ─────────────────────────────────────────────────────── */

// 27.08.2026: MAIN_CARD и OTHER_CARDS снесены. Ни одной карты в проекте не
// хранится, провайдера нет, а экран показывал «UZCARD •••• 8341, автоплатёж
// 1-го числа» и два сохранённых пластика со сроками действия — то есть
// выглядел подключённым. Заказчик показывает приложение клиентам, и всё, что
// выглядит рабочим, он нажимает.

export interface PayMethodItem {
  id: string;
  tag: string;
  title: string;
  /** 27.08.2026: подписи в заготовке больше нет — её даёт словарь на языке
   *  интерфейса. Раньше здесь лежало русское «Привязан аккаунт», которое
   *  узбек и англичанин видели по-русски и вдобавок неправдой. */
  linked: boolean;
  gradient: readonly [string, string];
}

// 27.08.2026: три способа из утверждённой модели, все НЕ привязаны. Было:
// Click и Payme значились «Привязан аккаунт» зелёным, хотя платить ими нечем;
// Apple Pay в модели нет вовсе, зато не было Uzum. Поле linked оставлено —
// оно ещё понадобится, когда провайдер подключится по-настоящему.
export const OTHER_METHODS: PayMethodItem[] = [
  { id: "payme", tag: "PAYME", title: "Payme", linked: false, gradient: ["#2dd4bf", "#0d9488"] },
  { id: "click", tag: "CLICK", title: "Click", linked: false, gradient: ["#38bdf8", "#0284c7"] },
  { id: "uzum",  tag: "UZUM",  title: "Uzum",  linked: false, gradient: ["#a78bfa", "#7c3aed"] },
];

/* ── Единый текст «пока не работает» ────────────────────────────────────── */

/**
 * Все действия этих экранов упираются в отсутствующего провайдера, поэтому
 * текст один и тот же — родитель не должен гадать, почему кнопка не сработала.
 */
export const SOON_PAYMENTS =
  "Онлайн-оплата пока не подключена: школа принимает платежи напрямую. Раздел заработает сразу после подключения платёжного провайдера.";
export const SOON_FILE =
  "Скачивание документов появится вместе с онлайн-оплатой — файлы чеков и счетов формирует платёжный провайдер.";

/* ══════════════════════════════════════════════════════════════════════════
 * КОШЕЛЁК РЕБЁНКА, ЛИМИТЫ, ПЕРЕВОД, ОПЕРАЦИИ  (12.08.2026)
 *
 * Данных нет ни в одной таблице: кошелька, его операций и лимитов в схеме не
 * существует вовсе. Значения взяты в том же порядке, что уже стоят в разделе
 * «Оплаты» и на главной, чтобы экраны не спорили друг с другом: баланс
 * 185 000 сум — то самое число, которое главная показывает в плитке
 * «КОШЕЛЁК», а карта пополнения — та же UZCARD ···· 8341, что и в «Способах
 * оплаты».
 * ══════════════════════════════════════════════════════════════════════════ */

/** Баланс кошелька ребёнка. Ровно то число, что на главной. */
export const WALLET_BALANCE = 185000;

export type WalletOpDirection = "in" | "out";

export interface WalletOp {
  id: string;
  direction: WalletOpDirection;
  /** Где потратили или откуда пришло. */
  title: string;
  /** Уточнение: комплекс обеда, маска карты. */
  via: string;
  /** «HH:MM» — время операции внутри дня. */
  time: string;
  amount: number;
  gradient: readonly [string, string];
}

export interface WalletOpDay {
  /** Сдвиг от «сегодня» школы в днях: 0 — сегодня, 1 — вчера и так далее.
   *  Не абсолютная дата: демо-«сегодня» задаёт школа, и жёстко записанная
   *  дата разъехалась бы с остальными экранами при сдвиге заморозки. */
  daysAgo: number;
  ops: WalletOp[];
}

/** Траты в столовой, буфете и школьном магазине плюс пополнения родителем. */
export const WALLET_OPS: WalletOpDay[] = [
  {
    daysAgo: 0,
    ops: [
      { id: "t1", direction: "out", title: "Столовая · обед", via: "Комплекс «Стандарт»", time: "12:40", amount: 18000, gradient: ["#34d399", "#0ea5e9"] },
      { id: "t2", direction: "out", title: "Школьный магазин", via: "Тетради, 2 шт.", time: "10:05", amount: 7000, gradient: ["#60a5fa", "#2563eb"] },
      { id: "t3", direction: "in", title: "Пополнение с карты", via: "UZCARD ···· 8341", time: "08:02", amount: 50000, gradient: ["#34d399", "#059669"] },
    ],
  },
  {
    daysAgo: 1,
    ops: [
      { id: "y1", direction: "out", title: "Столовая · обед", via: "Комплекс «Стандарт»", time: "12:38", amount: 18000, gradient: ["#34d399", "#0ea5e9"] },
      { id: "y2", direction: "out", title: "Буфет", via: "Сок и булочка", time: "10:20", amount: 9000, gradient: ["#fbbf24", "#f97316"] },
    ],
  },
  {
    daysAgo: 2,
    ops: [
      { id: "d2a", direction: "out", title: "Столовая · обед", via: "Комплекс «Лёгкий»", time: "12:35", amount: 15000, gradient: ["#34d399", "#0ea5e9"] },
      { id: "d2b", direction: "out", title: "Канцелярия", via: "Альбом для рисования", time: "13:30", amount: 8000, gradient: ["#a78bfa", "#7c3aed"] },
    ],
  },
  {
    daysAgo: 5,
    ops: [
      { id: "d5a", direction: "in", title: "Пополнение с карты", via: "UZCARD ···· 8341", time: "09:12", amount: 100000, gradient: ["#34d399", "#059669"] },
      { id: "d5b", direction: "out", title: "Буфет", via: "Вода", time: "11:40", amount: 5000, gradient: ["#fbbf24", "#f97316"] },
    ],
  },
  {
    daysAgo: 6,
    ops: [
      { id: "d6a", direction: "out", title: "Столовая · обед", via: "Комплекс «Стандарт»", time: "12:41", amount: 18000, gradient: ["#34d399", "#0ea5e9"] },
    ],
  },
];

/** Итоги показанного периода — считаются из WALLET_OPS, а не задаются руками:
 *  так подписи «потрачено/пополнено» не разойдутся со списком. */
export function walletTotals(): { spent: number; topped: number; opsCount: number } {
  let spent = 0;
  let topped = 0;
  let opsCount = 0;
  for (const day of WALLET_OPS) {
    for (const op of day.ops) {
      opsCount += 1;
      if (op.direction === "out") spent += op.amount;
      else topped += op.amount;
    }
  }
  return { spent, topped, opsCount };
}

/* ══════════════════════════════════════════════════════════════════════════
 * ПОДДЕРЖКА  (12.08.2026)
 *
 * Переписки с поддержкой в базе нет: тред поддержки в chat_threads не заведён,
 * и /parent/chat/support сегодня показывает пустоту. Здесь — три
 * правдоподобных обращения с ответами: про деньги, про расписание и бытовое.
 * ══════════════════════════════════════════════════════════════════════════ */

export type SupportStatus = "answered" | "closed" | "waiting";

export interface SupportMessage {
  /** «me» — родитель, «support» — служба поддержки школы. */
  from: "me" | "support";
  text: string;
  /** Сдвиг от школьного «сегодня» в днях и время внутри дня. */
  daysAgo: number;
  time: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  status: SupportStatus;
  messages: SupportMessage[];
}

export const SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: "pay",
    subject: "Вопрос по сумме счёта за август",
    status: "answered",
    messages: [
      {
        from: "me",
        daysAgo: 2,
        time: "10:15",
        text: "Здравствуйте! Почему сумма к оплате за август больше, чем в прошлом месяце?",
      },
      {
        from: "support",
        daysAgo: 2,
        time: "10:22",
        text: "Здравствуйте! К оплате за август: обучение — 4 500 000 сум и питание — 450 000 сум, итого 4 950 000 сум. В июле питание было оплачено за половину месяца, отсюда разница. Дополнительных начислений нет.",
      },
      { from: "me", daysAgo: 2, time: "10:26", text: "Спасибо, теперь понятно." },
    ],
  },
  {
    id: "schedule",
    subject: "Перенос урока робототехники",
    status: "closed",
    messages: [
      {
        from: "me",
        daysAgo: 6,
        time: "18:40",
        text: "Добрый вечер! Урок робототехники в пятницу перенесли? В расписании он стоит на 9:00, а ребёнок говорит про 11:00.",
      },
      {
        from: "support",
        daysAgo: 6,
        time: "19:05",
        text: "Добрый вечер! Да, занятие сдвинули на 11:00 — готовили кабинет. Расписание в приложении уже обновлено, откройте «Расписание»: там актуальное время.",
      },
    ],
  },
  {
    id: "lost",
    subject: "Забытая куртка в раздевалке",
    status: "waiting",
    messages: [
      {
        from: "me",
        daysAgo: 0,
        time: "08:50",
        text: "Здравствуйте! Ребёнок вчера забыл синюю куртку в раздевалке на втором этаже. Подскажите, куда её могли отнести?",
      },
    ],
  },
];

/** Быстрые темы для формы нового обращения — как чипы в мобильном экране. */
export const SUPPORT_TOPICS: readonly string[] = [
  "Оплата и счета",
  "Расписание",
  "Питание",
  "Документы",
];

/**
 * Единый текст «пока не работает» для поддержки. Отдельный от SOON_PAYMENTS:
 * здесь дело не в платёжном провайдере, а в том, что тред поддержки в базе
 * ещё не заведён.
 */
export const SOON_SUPPORT =
  "Отправка обращений прямо из приложения появится вместе с чатом поддержки школы. Пока напишите классному руководителю в «Сообщениях» или позвоните в приёмную.";
