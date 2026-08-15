/**
 * ЕДИНСТВЕННОЕ МЕСТО, ГДЕ ЖИВУТ ВЫДУМАННЫЕ ДАННЫЕ ОПЛАТ МОБИЛЬНОГО ПРИЛОЖЕНИЯ.
 *
 * ПОЧЕМУ ОНИ ВЫДУМАНЫ. Платёжной подсистемы в проекте нет вовсе: таблиц
 * кошельков, карт, лимитов и счетов не существует, а `payments` и `charges`
 * пусты. Экраны при этом должны быть наполненными — иначе демонстрировать
 * нечего. Поэтому данные заданы здесь литералами, а каждый платёжный экран
 * честно говорит об этом плашкой сверху.
 *
 * ЧЕМ КАЖДЫЙ БЛОК ЗАМЕНИТСЯ, КОГДА ПОДСИСТЕМА ПОЯВИТСЯ:
 *
 *   BILL_META, PAYMENTS_OVERVIEW  → платёжный провайдер: таблица счетов
 *                                   (charges) + агрегат баланса семьи;
 *   PAYMENT_HISTORY               → таблица проведённых платежей (payments);
 *   RECEIPTS                      → фискальные документы провайдера, файлы
 *                                   чеков вместо кнопки «скачать»;
 *   MAIN_CARD / OTHER_CARDS /     → токены карт у платёжного шлюза
 *   OTHER_METHODS                   (Payme Merchant, Uzcard PSP). Реквизиты
 *                                   карт в приложении не хранятся и не
 *                                   вводятся — их принимает страница шлюза;
 *   WALLET_BALANCE, WALLET_OPS    → таблица операций кошелька и терминал в
 *                                   столовой;
 *   WALLET_LIMITS                 → таблица лимитов на ребёнка (сейчас их
 *                                   негде хранить);
 *   TOPUP_PRESETS,                → останутся настройкой интерфейса: это не
 *   TRANSFER_PRESETS                данные, а быстрые кнопки сумм.
 *
 * ДО ТЕХ ПОР НИ ОДНА КНОПКА ЭТИХ ЭКРАНОВ НИЧЕГО НЕ СОХРАНЯЕТ. Действие
 * показывает пояснение (`SoonNote`), а не делает вид, что сработало.
 *
 * ДАТЫ ЗДЕСЬ — ISO ИЛИ СМЕЩЕНИЕ В ДНЯХ, А НЕ ГОТОВЫЕ РУССКИЕ СТРОКИ.
 * Раньше в фикстурах лежали «3 июля» и «5 августа 2026» — на узбекском и
 * английском экран показывал бы русский текст. Теперь подписи собираются на
 * месте через `lib/dateLabels` на языке интерфейса, а операции кошелька
 * привязаны к «сегодня» школы смещением в днях.
 *
 * СУММЫ, ОБЩИЕ С ВЕБОМ (счета, баланс), берутся из `@snr/core` — там единый
 * мок для обоих приложений, чтобы веб и мобильный не спорили о цифрах.
 */
import { BILLS, PAYMENTS_OVERVIEW } from "@snr/core";
import type { Gradient } from "./types";

export { BILLS, PAYMENTS_OVERVIEW };

/* ── Счета: даты и хвост подписи ──────────────────────────────────────────── */

/**
 * У счетов из общего мока подпись содержит чужую демо-семью («Малика · 7-А»),
 * а срок лежит русской строкой. Здесь — только то, что принадлежит мобильному
 * приложению: срок в ISO и ХВОСТ подписи. Префикс «{Имя} · {класс}» экран
 * собирает из НАСТОЯЩЕГО ребёнка родителя.
 */
export const BILL_META: Record<string, { dueDate: string; noteTail: string }> = {
  edu: { dueDate: "2026-08-05", noteTail: "ежемесячный платёж" },
  food: { dueDate: "2026-08-05", noteTail: "обеды в столовой" },
  form: { dueDate: "2026-08-10", noteTail: "комплект на осень" },
  exc: { dueDate: "2026-08-15", noteTail: "выезд класса" },
};

/* ── Визуал категорий: плитка-иконка строки ───────────────────────────────── */

export type PayVisualKey = "edu" | "food" | "form" | "exc";

export const PAY_VISUAL: Record<PayVisualKey, { gradient: Gradient; paths: string[] }> = {
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
    paths: ["M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z", "M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"],
  },
};

/* ── История оплат ────────────────────────────────────────────────────────── */

export type HistoryCategory = "edu" | "food" | "other";

export interface HistoryRow {
  id: string;
  category: HistoryCategory;
  visual: PayVisualKey;
  title: string;
  /** Хвост подписи после «{Имя} · {класс}»: способ оплаты или пояснение. */
  via: string;
  /** ISO-дата платежа. Подпись собирается на языке интерфейса. */
  date: string;
  amount: number;
  isRefund: boolean;
}

export interface HistoryMonth {
  id: string;
  /** Первое число месяца, ISO — заголовок собирается по локали. */
  month: string;
  rows: HistoryRow[];
}

/** Уже проведённые оплаты, свежие сверху. */
export const PAYMENT_HISTORY: HistoryMonth[] = [
  {
    id: "jul",
    month: "2026-07-01",
    rows: [
      { id: "jul-edu", category: "edu", visual: "edu", title: "Обучение · июль", via: "Payme", date: "2026-07-03", amount: 4500000, isRefund: false },
      { id: "jul-food", category: "food", visual: "food", title: "Питание · июль", via: "Payme", date: "2026-07-03", amount: 450000, isRefund: false },
      { id: "jul-refund", category: "food", visual: "food", title: "Питание · перерасчёт", via: "возврат за 3 дня отсутствия", date: "2026-07-18", amount: 60000, isRefund: true },
    ],
  },
  {
    id: "jun",
    month: "2026-06-01",
    rows: [
      { id: "jun-edu", category: "edu", visual: "edu", title: "Обучение · июнь", via: "Click", date: "2026-06-04", amount: 4500000, isRefund: false },
      { id: "jun-food", category: "food", visual: "food", title: "Питание · июнь", via: "Payme", date: "2026-06-04", amount: 450000, isRefund: false },
      { id: "jun-form", category: "other", visual: "form", title: "Школьная форма", via: "UZCARD ···· 8341", date: "2026-06-12", amount: 350000, isRefund: false },
    ],
  },
];

/** Итоги истории — СЧИТАЮТСЯ, а не хардкодятся: иначе правка одной строки
 *  заставила бы цифры внизу экрана врать. */
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

/* ── Чеки и счета ─────────────────────────────────────────────────────────── */

export interface ReceiptRow {
  id: string;
  kind: "check" | "invoice";
  visual: PayVisualKey;
  title: string;
  /** Номер документа. Формат провайдера, поэтому строкой. */
  number: string;
  /** ISO-дата документа. */
  date: string;
  amount: number;
  paid: boolean;
}

/** Чеки — к уже проведённым оплатам, суммы совпадают с историей строка в
 *  строку. Счета — то, что ещё предстоит; их сроки совпадают с BILL_META. */
export const RECEIPTS: ReceiptRow[] = [
  { id: "rcp-18", kind: "check", visual: "edu", title: "Обучение · июль", number: "RCP-2026-07-018", date: "2026-07-03", amount: 4500000, paid: true },
  { id: "rcp-19", kind: "check", visual: "food", title: "Питание · июль", number: "RCP-2026-07-019", date: "2026-07-03", amount: 450000, paid: true },
  { id: "rcp-31", kind: "check", visual: "food", title: "Питание · перерасчёт", number: "RCP-2026-07-031", date: "2026-07-18", amount: 60000, paid: true },
  { id: "rcp-11", kind: "check", visual: "edu", title: "Обучение · июнь", number: "RCP-2026-06-011", date: "2026-06-04", amount: 4500000, paid: true },
  { id: "rcp-24", kind: "check", visual: "form", title: "Школьная форма", number: "RCP-2026-06-024", date: "2026-06-12", amount: 350000, paid: true },
  { id: "inv-01", kind: "invoice", visual: "edu", title: "Обучение · август", number: "INV-2026-07-001", date: "2026-07-20", amount: 4500000, paid: false },
  { id: "inv-02", kind: "invoice", visual: "food", title: "Питание · август", number: "INV-2026-07-002", date: "2026-07-20", amount: 450000, paid: false },
  { id: "inv-03", kind: "invoice", visual: "form", title: "Школьная форма", number: "INV-2026-07-003", date: "2026-07-21", amount: 350000, paid: false },
  { id: "inv-14", kind: "invoice", visual: "exc", title: "Экскурсия в музей", number: "INV-2026-06-014", date: "2026-06-28", amount: 150000, paid: false },
];

/* ── Карты и способы оплаты ───────────────────────────────────────────────── */

export interface SavedCard {
  id: string;
  brand: string;
  gradient: Gradient;
  /** Маскированный номер — единственное, что приложение видит о карте. */
  masked: string;
  /** «ММ/ГГ» строкой: это не дата события, а надпись на карте. */
  validThru: string;
}

/**
 * Основная карта — та же, что названа картой автоплатежа в
 * `PAYMENTS_OVERVIEW.autopay_note`: иначе у родителя было бы две разные
 * «главные» карты.
 */
export const MAIN_CARD = {
  brand: "UZCARD",
  masked: "···· ···· ···· 8341",
  validThru: "09/28",
} as const;

export const OTHER_CARDS: SavedCard[] = [
  { id: "humo", brand: "HUMO", gradient: ["#22d3ee", "#0891b2"], masked: "···· 5519", validThru: "04/27" },
  { id: "visa", brand: "VISA", gradient: ["#334155", "#0f172a"], masked: "···· 4242", validThru: "11/26" },
];

export interface PayMethodItem {
  id: string;
  tag: string;
  gradient: Gradient;
  title: string;
  /** Хвост подписи; «привязан» подставляется словарём. */
  linked: boolean;
}

export const OTHER_METHODS: PayMethodItem[] = [
  { id: "payme", tag: "PAYME", gradient: ["#2dd4bf", "#0d9488"], title: "Payme", linked: true },
  { id: "click", tag: "CLICK", gradient: ["#38bdf8", "#0284c7"], title: "Click", linked: true },
  { id: "uzum", tag: "UZUM", gradient: ["#a78bfa", "#7c3aed"], title: "Uzum Bank", linked: false },
];

/* ── Кошелёк ребёнка ──────────────────────────────────────────────────────── */

/**
 * Баланс кошелька. ОДНО число на всё приложение: главная, «Статус дня»,
 * «Оплаты» и сам кошелёк читают его отсюда — раньше он лежал в таблице
 * балансов по индексу выдуманного ребёнка, и после перехода на настоящую
 * семью индекс указывал не туда. То же число показывает веб-родитель.
 */
export const WALLET_BALANCE = 185000;

export type WalletOpDirection = "in" | "out";

export interface WalletOp {
  id: string;
  direction: WalletOpDirection;
  title: string;
  /** Где именно: столовая, магазин, карта пополнения. */
  via: string;
  /** «ЧЧ:ММ» — время суток; день задаётся смещением группы. */
  time: string;
  amount: number;
  gradient: Gradient;
  paths: string[];
}

export interface WalletOpDay {
  /** На сколько дней раньше школьного «сегодня». 0 — сегодня, 1 — вчера. */
  daysAgo: number;
  ops: WalletOp[];
}

const GLYPH_FOOD = ["M4 2v7a3 3 0 0 0 6 0V2", "M7 12v10", "M20 2a4 4 0 0 0-4 4v7h4", "M20 13v9"];
const GLYPH_SHOP = ["M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z", "M3 6h18", "M16 10a4 4 0 0 1-8 0"];
const GLYPH_PLUS = ["M12 5v14", "M5 12h14"];
const GLYPH_CUP = ["M17 8h1a4 4 0 0 1 0 8h-1", "M3 8h14v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"];
const GLYPH_PEN = ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"];

/** Операции кошелька по дням. День — смещение от школьного «сегодня», чтобы
 *  список не устаревал и не спорил с замороженной датой демо. */
export const WALLET_OPS: WalletOpDay[] = [
  {
    daysAgo: 0,
    ops: [
      { id: "t1", direction: "out", title: "Столовая · обед", via: "Комплекс «Стандарт»", time: "12:40", amount: 18000, gradient: ["#34d399", "#0ea5e9"], paths: GLYPH_FOOD },
      { id: "t2", direction: "out", title: "Школьный магазин", via: "Канцелярия · тетради", time: "10:05", amount: 7000, gradient: ["#60a5fa", "#2563eb"], paths: GLYPH_SHOP },
      { id: "t3", direction: "in", title: "Пополнение с карты", via: `${MAIN_CARD.brand} ···· 8341`, time: "08:02", amount: 50000, gradient: ["#34d399", "#059669"], paths: GLYPH_PLUS },
    ],
  },
  {
    daysAgo: 1,
    ops: [
      { id: "y1", direction: "out", title: "Столовая · обед", via: "Комплекс «Стандарт»", time: "12:38", amount: 18000, gradient: ["#34d399", "#0ea5e9"], paths: GLYPH_FOOD },
      { id: "y2", direction: "out", title: "Школьный магазин", via: "Тетради и ручки", time: "13:05", amount: 12000, gradient: ["#60a5fa", "#2563eb"], paths: GLYPH_SHOP },
      { id: "y3", direction: "out", title: "Буфет", via: "Сок и булочка", time: "10:20", amount: 9000, gradient: ["#fbbf24", "#f97316"], paths: GLYPH_CUP },
    ],
  },
  {
    daysAgo: 2,
    ops: [
      { id: "d1", direction: "in", title: "Пополнение с карты", via: `${MAIN_CARD.brand} ···· 8341`, time: "09:12", amount: 100000, gradient: ["#34d399", "#059669"], paths: GLYPH_PLUS },
      { id: "d2", direction: "out", title: "Буфет", via: "Вода", time: "11:40", amount: 5000, gradient: ["#fbbf24", "#f97316"], paths: GLYPH_CUP },
      { id: "d3", direction: "out", title: "Канцелярия", via: "Альбом для рисования", time: "13:30", amount: 8000, gradient: ["#a78bfa", "#7c3aed"], paths: GLYPH_PEN },
    ],
  },
];

/** Итоги показанного периода — считаются из операций, не хардкод. */
export function walletTotals(days: WalletOpDay[] = WALLET_OPS): {
  spent: number;
  topped: number;
  opsCount: number;
} {
  let spent = 0;
  let topped = 0;
  let opsCount = 0;
  for (const day of days) {
    for (const op of day.ops) {
      opsCount += 1;
      if (op.direction === "in") topped += op.amount;
      else spent += op.amount;
    }
  }
  return { spent, topped, opsCount };
}

/* ── Лимиты ───────────────────────────────────────────────────────────────── */

export interface WalletCategoryLimit {
  id: string;
  /** Ключ подписи в словаре — сама подпись переводится. */
  nameKey: "cafeteria" | "shop" | "stationery";
  limit: number;
  enabled: boolean;
}

export interface WalletLimits {
  dailyLimit: number;
  spentToday: number;
  /** Пресеты дневного лимита; 0 — «без лимита». */
  presets: number[];
  categories: WalletCategoryLimit[];
  notifyEveryOp: boolean;
  notifyOnLimit: boolean;
}

export const WALLET_LIMITS: WalletLimits = {
  dailyLimit: 50000,
  spentToday: 32000,
  presets: [20000, 30000, 50000, 0],
  categories: [
    { id: "caf", nameKey: "cafeteria", limit: 20000, enabled: true },
    { id: "shop", nameKey: "shop", limit: 15000, enabled: true },
    { id: "stat", nameKey: "stationery", limit: 10000, enabled: true },
  ],
  notifyEveryOp: true,
  notifyOnLimit: false,
};

/* ── Быстрые суммы ────────────────────────────────────────────────────────── */

export const TOPUP_PRESETS: readonly number[] = [50000, 100000, 200000, 500000];

/** «Всё» — весь баланс, поэтому null: конкретная сумма считается на месте. */
export const TRANSFER_PRESETS: readonly (number | null)[] = [10000, 25000, 50000, null];

/* ══════════════════════════════════════════════════════════════════════════
 * ПЕРЕХОДНИКИ ПОД СУЩЕСТВУЮЩУЮ ВЁРСТКУ
 *
 * Экраны раздела рисуют строки в форме `PaymentHistoryRow` / `ReceiptRow` /
 * `WalletOpsDayGroup` / `WalletLimits` (data/types.ts) — она сложилась вместе
 * с макетом. Данные выше остаются единственным источником: даты в них лежат
 * в ISO, а подпись собирается ЗДЕСЬ на языке интерфейса. Поэтому переходники
 * принимают `localeTag` и словарь — «5 августа 2026» больше нигде не лежит
 * готовой русской строкой.
 * ══════════════════════════════════════════════════════════════════════════ */

import { formatDate, formatDateTime } from "@snr/core";
import type { PaymentHistoryRow, ReceiptRow as LegacyReceiptRow, WalletLimits as LegacyWalletLimits, WalletOpsDayGroup } from "./types";

/** «3 июля» на языке интерфейса. */
function dayMonthLabel(iso: string, localeTag: string): string {
  return formatDate(`${iso}T12:00:00+05:00`, localeTag);
}

/** История оплат в форме, которую рисует экран, с подписями по локали. */
export function paymentHistoryFor(
  localeTag: string,
  who: string,
): Record<"jul" | "jun", PaymentHistoryRow[]> {
  const map = (m: HistoryMonth): PaymentHistoryRow[] =>
    m.rows.map((r) => ({
      category: r.category,
      title: r.title,
      note: [who, r.via].filter(Boolean).join(" · "),
      date_label: dayMonthLabel(r.date, localeTag),
      amount: r.isRefund ? -r.amount : r.amount,
      is_refund: r.isRefund,
      gradient: PAY_VISUAL[r.visual].gradient,
      icon_paths: PAY_VISUAL[r.visual].paths,
    }));
  return {
    jul: map(PAYMENT_HISTORY[0]),
    jun: map(PAYMENT_HISTORY[1]),
  };
}

/** Заголовок месяца («Июль 2026») на языке интерфейса. */
export function monthLabel(iso: string, localeTag: string): string {
  return new Date(`${iso}T12:00:00+05:00`)
    .toLocaleDateString(localeTag, { month: "long", year: "numeric", timeZone: "Asia/Tashkent" })
    .replace(/^./, (c) => c.toUpperCase());
}

/** Чеки и счета в форме экрана. `docWord` — «Чек»/«Счёт» из словаря. */
export function receiptsFor(
  localeTag: string,
  docWord: { check: string; invoice: string },
): LegacyReceiptRow[] {
  return RECEIPTS.map((r) => ({
    kind: r.kind,
    month: r.date < "2026-07-01" ? ("jun" as const) : ("jul" as const),
    title: r.title,
    number_label: `${r.kind === "check" ? docWord.check : docWord.invoice} № ${r.number}`,
    date_label: dayMonthLabel(r.date, localeTag),
    amount: r.amount,
  }));
}

/**
 * Операции кошелька в форме экрана. День берётся смещением от школьного
 * «сегодня», поэтому подпись «Сегодня / Вчера / 27 июля» собирается здесь и
 * не устаревает вместе с замороженной датой демо.
 */
export function walletOpsFor(): WalletOpsDayGroup[] {
  const KEY: WalletOpsDayGroup["day_key"][] = ["t", "y", "d21"];
  return WALLET_OPS.map((day, i) => ({
    day_key: KEY[i] ?? "d21",
    ops: day.ops.map((op) => ({
      direction: op.direction,
      title: op.title,
      subtitle: op.via,
      time_label: op.time,
      amount: op.amount,
      gradient: op.gradient,
      icon_paths: op.paths,
    })),
  }));
}

/** Лимиты в форме экрана; названия категорий — из словаря. */
export function walletLimitsFor(names: {
  cafeteria: string;
  shop: string;
  stationery: string;
}): LegacyWalletLimits {
  return {
    daily_limit: WALLET_LIMITS.dailyLimit,
    spent_today: WALLET_LIMITS.spentToday,
    presets: WALLET_LIMITS.presets,
    categories: WALLET_LIMITS.categories.map((c) => ({
      id: c.id as "caf" | "shop" | "stat",
      name: names[c.nameKey],
      limit: c.limit,
      enabled: c.enabled,
    })),
    notify_ops: WALLET_LIMITS.notifyEveryOp,
    notify_limit: WALLET_LIMITS.notifyOnLimit,
  };
}

/** Дата+время документа — для мест, где нужна полная отметка. */
export function stampFor(iso: string, localeTag: string): string {
  return formatDateTime(`${iso}T12:00:00+05:00`, localeTag);
}
