/**
 * Оплаты: счета BILLS (строки 3309–3314 макета), способы оплаты PAY_OPTS
 * (3315–3321), история HIST (3322–3333), чеки/инвойсы RECEIPTS (3334–3352),
 * FAQ_D (3455–3461), карточка баланса П17 (C3), карты (B6).
 * Все значения — ДОСЛОВНО из макета.
 *
 * ВАЖНО (связанные числа): сумма «К оплате» (4 950 000) НЕ хардкодится —
 * считается из отмеченных счетов основного списка (см. accessors в ../index.ts).
 * Итоги «Истории оплат» (10 250 000 / 10 100 000 / 150 000) — тоже считаются
 * из PAYMENT_HISTORY.
 */
import type { BillRow, PaymentHistoryRow, PaymentsFaqItem, PaymentsOverview, PayMethodRow, ReceiptRow } from "../types";

/** BILLS. Стартовое состояние: edu/food — основной список, отмечены;
 *  form/exc — блок «другие», не отмечены. */
export const BILLS: BillRow[] = [
  {
    id: "edu",
    title: "Обучение · август",
    note: "Малика · 7-А · ежемесячный платёж",
    amount: 4500000,
    due_date_label: "5 августа 2026",
    gradient: ["#7c3aed", "#4f6df5"],
    icon_paths: ["M22 10 12 5 2 10l10 5 10-5Z", "M6 12.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"],
    in_main_list: true,
    checked_by_default: true,
  },
  {
    id: "food",
    title: "Питание · август",
    note: "Малика · 7-А · обеды в столовой",
    amount: 450000,
    due_date_label: "5 августа 2026",
    gradient: ["#34d399", "#059669"],
    icon_paths: ["M4 2v7a3 3 0 0 0 6 0V2", "M7 12v10", "M20 2a4 4 0 0 0-4 4v7h4", "M20 13v9"],
    in_main_list: true,
    checked_by_default: true,
  },
  {
    id: "form",
    title: "Школьная форма",
    note: "Азиз · 3-А · комплект на осень",
    amount: 350000,
    due_date_label: "10 августа 2026",
    gradient: ["#60a5fa", "#2563eb"],
    icon_paths: [
      "M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.1a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.3-2.2Z",
    ],
    in_main_list: false,
    checked_by_default: false,
  },
  {
    id: "exc",
    title: "Экскурсия в музей",
    note: "Фаррух · 10-А · выезд класса",
    amount: 150000,
    due_date_label: "15 августа 2026",
    gradient: ["#f472b6", "#db2777"],
    icon_paths: ["M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z", "M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"],
    in_main_list: false,
    checked_by_default: false,
  },
];

/** PAY_OPTS — способы оплаты checkout; выбран по умолчанию payme. */
export const PAY_METHODS: PayMethodRow[] = [
  { id: "payme", name: "Payme", subtitle: "Мгновенная оплата без комиссии", gradient: ["#2dd4bf", "#0d9488"], tag: "PAYME", recommended: true },
  { id: "click", name: "Click", subtitle: "Оплата через приложение Click", gradient: ["#38bdf8", "#0284c7"], tag: "CLICK", recommended: false },
  { id: "card", name: "Банковская карта", subtitle: "Visa, MasterCard, Uzcard, Humo", gradient: ["#7c3aed", "#4f6df5"], tag: "CARD", recommended: false },
  { id: "uzum", name: "Uzum Bank", subtitle: "Оплата картой Uzum", gradient: ["#a78bfa", "#7c3aed"], tag: "UZUM", recommended: false },
  { id: "qr", name: "QR оплата", subtitle: "Сканируйте QR-код в приложении банка", gradient: ["#334155", "#0f172a"], tag: "QR", recommended: false },
];
export const DEFAULT_PAY_METHOD_ID = "payme";

/** HIST — история оплат по месяцам (jul/jun). Отрицательная сумма = возврат. */
export const PAYMENT_HISTORY: Record<"jul" | "jun", PaymentHistoryRow[]> = {
  jul: [
    {
      category: "edu",
      title: "Обучение · июль",
      note: "Малика · 7-А · Payme",
      date_label: "3 июля",
      amount: 4500000,
      is_refund: false,
      gradient: ["#7c3aed", "#4f6df5"],
      icon_paths: ["M22 10 12 5 2 10l10 5 10-5Z", "M6 12.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"],
    },
    {
      category: "food",
      title: "Питание · июль",
      note: "Малика · 7-А · Payme",
      date_label: "3 июля",
      amount: 450000,
      is_refund: false,
      gradient: ["#34d399", "#059669"],
      icon_paths: ["M4 2v7a3 3 0 0 0 6 0V2", "M7 12v10", "M20 2a4 4 0 0 0-4 4v7h4", "M20 13v9"],
    },
    {
      category: "other",
      title: "Экскурсия · возврат",
      note: "Фаррух · 10-А · выезд отменён школой",
      date_label: "10 июля",
      amount: -150000,
      is_refund: true,
      gradient: ["#f472b6", "#db2777"],
      icon_paths: ["M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z", "M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"],
    },
  ],
  jun: [
    {
      category: "edu",
      title: "Обучение · июнь",
      note: "Малика · 7-А · Click",
      date_label: "4 июня",
      amount: 4500000,
      is_refund: false,
      gradient: ["#7c3aed", "#4f6df5"],
      icon_paths: ["M22 10 12 5 2 10l10 5 10-5Z", "M6 12.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"],
    },
    {
      category: "food",
      title: "Питание · июнь",
      note: "Малика · 7-А · Payme",
      date_label: "4 июня",
      amount: 450000,
      is_refund: false,
      gradient: ["#34d399", "#059669"],
      icon_paths: ["M4 2v7a3 3 0 0 0 6 0V2", "M7 12v10", "M20 2a4 4 0 0 0-4 4v7h4", "M20 13v9"],
    },
    {
      category: "other",
      title: "Школьная форма · весна",
      note: "Азиз · 3-А · банковская карта",
      date_label: "12 июня",
      amount: 350000,
      is_refund: false,
      gradient: ["#60a5fa", "#2563eb"],
      icon_paths: [
        "M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.1a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.3-2.2Z",
      ],
    },
  ],
};

/** RECEIPTS — чеки (kind: check) и счета-инвойсы (kind: invoice). */
export const RECEIPTS: ReceiptRow[] = [
  { kind: "check", month: "jul", title: "Обучение · июль", number_label: "Чек № RCP-2026-07-018", date_label: "3 июля", amount: 4500000 },
  { kind: "check", month: "jul", title: "Питание · июль", number_label: "Чек № RCP-2026-07-019", date_label: "3 июля", amount: 450000 },
  { kind: "check", month: "jul", title: "Возврат · экскурсия", number_label: "Чек № RCP-2026-07-031", date_label: "10 июля", amount: 150000 },
  { kind: "check", month: "jun", title: "Обучение · июнь", number_label: "Чек № RCP-2026-06-011", date_label: "4 июня", amount: 4500000 },
  { kind: "check", month: "jun", title: "Школьная форма", number_label: "Чек № RCP-2026-06-024", date_label: "12 июня", amount: 350000 },
  { kind: "invoice", month: "jul", title: "Обучение · август", number_label: "Счёт № INV-2026-07-001", date_label: "20 июля", amount: 4500000 },
  { kind: "invoice", month: "jul", title: "Питание · август", number_label: "Счёт № INV-2026-07-002", date_label: "20 июля", amount: 450000 },
  { kind: "invoice", month: "jul", title: "Школьная форма", number_label: "Счёт № INV-2026-07-003", date_label: "21 июля", amount: 350000 },
  { kind: "invoice", month: "jun", title: "Экскурсия в музей", number_label: "Счёт № INV-2026-06-014", date_label: "28 июня", amount: 150000 },
];

/** FAQ_D — шторка «Справка» по оплатам. */
export const PAYMENTS_FAQ: PaymentsFaqItem[] = [
  {
    question: "Что входит в ежемесячный счёт?",
    answer:
      "Основной счёт — это обучение по договору. Отдельными счетами приходят питание, форма, экскурсии и другие разовые услуги — каждый счёт подписан, за что он выставлен.",
  },
  {
    question: "Когда начисляются счета?",
    answer:
      "Счёт за обучение выставляется 25-го числа за следующий месяц, срок оплаты — до 5-го. Разовые счета появляются по мере событий: экскурсия, заказ формы, продление питания.",
  },
  {
    question: "Что будет при просрочке?",
    answer:
      "Первые 5 дней — только напоминания. Дальше школа связывается с вами лично: доступ ребёнка к занятиям не ограничивается, но долг переносится в следующий счёт.",
  },
  {
    question: "Как получить чек для отчётности?",
    answer:
      "Каждая оплата создаёт фискальный чек — он в разделе «Счета и чеки». Чек можно скачать в PDF или переслать на почту, для бухгалтерии доступны официальные invoice.",
  },
  {
    question: "Как работает автоплатёж?",
    answer:
      "В выбранную дату система списывает сумму всех выставленных счетов с привязанной карты. Перед списанием придёт уведомление — автоплатёж можно пропустить или выключить в любой момент.",
  },
];

/** Карточка баланса П17 (C3) + автоплатёж (initial state: autopay true). */
export const PAYMENTS_OVERVIEW: PaymentsOverview = {
  total_balance: 1250000,
  overpayment: 120000,
  autopay_enabled: true,
  autopay_note: "1-го числа · Uzcard ····8341",
};

/** Карты (B6): основная UZCARD ···· 4242; BIN-определение бренда. */
export const MAIN_CARD_LABEL = "UZCARD ···· 4242";
export const CARD_BIN_BRANDS: [string, string][] = [
  ["8600", "UZCARD"],
  ["9860", "HUMO"],
  ["4", "VISA"],
  ["5", "MASTERCARD"],
];
export const ADD_CARD_PLACEHOLDERS = { expiry: "ММ/ГГ", holder: "ИМЯ ДЕРЖАТЕЛЯ" } as const;

/** Смена пароля (B6): требования и шкала. */
export const PASSWORD_RULES = ["Минимум 8 символов", "Есть заглавная буква", "Есть цифра"] as const;
export const PASSWORD_STRENGTH_LABELS = ["Слабый", "Средний", "Надёжный"] as const;

/** Заголовки/подписи success-шторки paySheet (B7) — дословно. */
export const PAY_SHEET_TEXTS = {
  top: { title: "Баланс пополнен", sub: "Кошелёк {gen} · зачислено мгновенно" },
  tr: { title: "Перевод выполнен", sub: "От {from} → {to} · мгновенно, без комиссии" },
  card: { title: "Карта добавлена", sub: "Карта появилась в списке «Другие карты»" },
  pw: { title: "Пароль изменён", sub: "Войдите заново на других устройствах" },
  pay: { title: "Платёж проведён", sub: "Оплачено: {list}" },
} as const;
