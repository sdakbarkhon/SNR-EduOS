/**
 * Кошельки детей: балансы (initial state wallets, строка 3482 макета),
 * операции WOPS (3158–3174), лимиты/пресеты (B6).
 * Все значения — ДОСЛОВНО из макета.
 *
 * ВАЖНО (связанные числа): баланс кошелька Малики (185 000) существует
 * ТОЛЬКО здесь (WALLETS[1]) — метрики Dashboard, карточка П17, «Баланс
 * питания» d6 читают его через getWalletBalance() (см. ../index.ts).
 * walletBal: 185000 из initial state макета — легаси (аномалия №9).
 */
import type { WalletLimits, WalletOpsDayGroup, WalletRow } from "../types";
import { CHILDREN } from "./family";

/** wallets: [92000, 185000, 240000] — Азиз / Малика / Фаррух.
 *  Заход 5: индексы 3–5 — Азизбек Исмаилов / Мадина Рахимова / Хумоюн Рахимов;
 *  сохраняем инвариант CHILDREN.length === WALLETS.length, чтобы index-based
 *  lookup getWalletBalance() не падал для новых семей. */
export const WALLETS: WalletRow[] = [
  { student_id: CHILDREN[0].id, balance: 92000 },
  { student_id: CHILDREN[1].id, balance: 185000 },
  { student_id: CHILDREN[2].id, balance: 240000 },
  { student_id: CHILDREN[3].id, balance: 65000 },
  { student_id: CHILDREN[4].id, balance: 145000 },
  { student_id: CHILDREN[5].id, balance: 210000 },
];

/** WOPS — операции по дням: t сегодня, y вчера, d21 — 21 июля. */
export const WALLET_OPS: WalletOpsDayGroup[] = [
  {
    day_key: "t",
    ops: [
      {
        direction: "out",
        title: "Столовая · обед",
        subtitle: "Комплекс «Стандарт»",
        time_label: "12:40",
        amount: 18000,
        gradient: ["#34d399", "#0ea5e9"],
        icon_paths: ["M4 2v7a3 3 0 0 0 6 0V2", "M7 12v10", "M20 2a4 4 0 0 0-4 4v7h4", "M20 13v9"],
      },
      {
        direction: "out",
        title: "Школьный магазин",
        subtitle: "Канцелярия · тетради",
        time_label: "10:05",
        amount: 7000,
        gradient: ["#60a5fa", "#2563eb"],
        icon_paths: ["M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z", "M3 6h18", "M16 10a4 4 0 0 1-8 0"],
      },
      {
        direction: "in",
        title: "Пополнение с карты",
        subtitle: "UZCARD ···· 4242",
        time_label: "08:02",
        amount: 50000,
        gradient: ["#34d399", "#059669"],
        icon_paths: ["M12 5v14", "M5 12h14"],
      },
    ],
  },
  {
    day_key: "y",
    ops: [
      {
        direction: "out",
        title: "Столовая · обед",
        subtitle: "Комплекс «Стандарт»",
        time_label: "12:38",
        amount: 18000,
        gradient: ["#34d399", "#0ea5e9"],
        icon_paths: ["M4 2v7a3 3 0 0 0 6 0V2", "M7 12v10", "M20 2a4 4 0 0 0-4 4v7h4", "M20 13v9"],
      },
      {
        direction: "out",
        title: "Школьный магазин",
        subtitle: "Тетради и ручки",
        time_label: "13:05",
        amount: 12000,
        gradient: ["#60a5fa", "#2563eb"],
        icon_paths: ["M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z", "M3 6h18", "M16 10a4 4 0 0 1-8 0"],
      },
      {
        direction: "out",
        title: "Буфет",
        subtitle: "Сок и булочка",
        time_label: "10:20",
        amount: 9000,
        gradient: ["#fbbf24", "#f97316"],
        icon_paths: ["M17 8h1a4 4 0 0 1 0 8h-1", "M3 8h14v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"],
      },
    ],
  },
  {
    day_key: "d21",
    ops: [
      {
        direction: "in",
        title: "Пополнение с карты",
        subtitle: "UZCARD ···· 4242",
        time_label: "09:12",
        amount: 100000,
        gradient: ["#34d399", "#059669"],
        icon_paths: ["M12 5v14", "M5 12h14"],
      },
      {
        direction: "out",
        title: "Буфет",
        subtitle: "Вода",
        time_label: "11:40",
        amount: 5000,
        gradient: ["#fbbf24", "#f97316"],
        icon_paths: ["M17 8h1a4 4 0 0 1 0 8h-1", "M3 8h14v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"],
      },
      {
        direction: "out",
        title: "Канцелярия",
        subtitle: "Альбом для рисования",
        time_label: "13:30",
        amount: 8000,
        gradient: ["#a78bfa", "#7c3aed"],
        icon_paths: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"],
      },
    ],
  },
];

/** Лимиты расходов (B6). Пресет «Без лимита» = 0. */
export const WALLET_LIMITS: WalletLimits = {
  daily_limit: 50000,
  spent_today: 32000,
  presets: [20000, 30000, 50000, 0],
  categories: [
    { id: "caf", name: "Столовая", limit: 20000, enabled: true },
    { id: "shop", name: "Школьный магазин", limit: 15000, enabled: true },
    { id: "stat", name: "Канцелярия", limit: 10000, enabled: true },
  ],
  notify_ops: true,
  notify_limit: false,
};

/** Пресеты пополнения (topChips); ввод до 9 цифр. */
export const TOPUP_PRESETS = [50000, 100000, 200000, 500000] as const;

/** Пресеты перевода (trChips); «Всё» = весь баланс (null). */
export const TRANSFER_PRESETS: (number | null)[] = [10000, 25000, 50000, null];
export const TRANSFER_INSUFFICIENT_TEXT = "Недостаточно средств";
