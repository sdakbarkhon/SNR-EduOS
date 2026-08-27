/**
 * Общий мок вкладки «Оплаты» родительских приложений — единственный источник
 * для apps/web и apps/mobile-parent (CLAUDE.md §4: общий слой типов/данных,
 * чтобы веб и мобилка не расходились в суммах/названиях счетов).
 */

export interface BillRow {
  id: string;
  title: string;
  note: string;
  amount: number;
  due_date_label: string;
  gradient: [string, string];
  icon_paths: string[];
  in_main_list: boolean;
  checked_by_default: boolean;
}

/** 27.08.2026: autopay_enabled / autopay_note убраны. Автоплатежа в
 *  утверждённой модели оплаты нет — счёт выставляется 1 числа и гасится с
 *  баланса ребёнка, привязанных карт и автосписания не предусмотрено. */
export interface PaymentsOverview {
  total_balance: number;
  overpayment: number;
}

export interface WalletRow {
  student_id: string;
  balance: number;
}

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

/** Карточка баланса П17 (C3). */
export const PAYMENTS_OVERVIEW: PaymentsOverview = {
  total_balance: 1250000,
  overpayment: 120000,
};

/** wallets: [92000, 185000, 240000, 65000, 145000, 210000] — порядок совпадает
 *  с demo-фикстурой CHILDREN мобилки (Азиз/Малика/Фаррух/Азизбек/Мадина/Хумоюн);
 *  student_id — литералы её id, без импорта самой фикстуры (family.ts вне
 *  общего слоя). Индекс-based lookup (не поиск по student_id) — см. потребителей. */
export const WALLETS: WalletRow[] = [
  { student_id: "child-aziz", balance: 92000 },
  { student_id: "child-malika", balance: 185000 },
  { student_id: "child-farrukh", balance: 240000 },
  { student_id: "child-ismailov-azizbek", balance: 65000 },
  { student_id: "child-rakhimov-madina", balance: 145000 },
  { student_id: "child-rakhimov-humoyun", balance: 210000 },
];
