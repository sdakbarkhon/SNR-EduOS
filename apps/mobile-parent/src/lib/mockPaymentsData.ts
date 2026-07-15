/** Промт МОБ-5 — mock-interactive данные "Оплаты" (вариант C, гибрид).
 *  Персистятся через mockStorage.ts (expo-secure-store), ключи ниже — те же
 *  имена, что в ТЗ ("AsyncStorage keys"), семантика идентична. */
import { getOrSeed, setJSON, getJSON } from "./mockStorage";

export function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type Bill = {
  id: string;
  title: string;
  amount: number;
  dueDate: string; // ISO
};

export type PaymentHistoryRecord = {
  id: string;
  title: string;
  amount: number;
  paidAt: string; // ISO
};

export type WalletPurchase = {
  id: string;
  title: string;
  amount: number;
  date: string; // ISO
};

const balanceKey = (childId: string) => `mob5.balance.${childId}`;
const billsKey = (childId: string) => `mob5.bills.${childId}`;
const historyKey = (childId: string) => `mob5.history.${childId}`;
const walletKey = (childId: string) => `mob5.wallet.${childId}`;

function addDays(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

const RU_MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
function monthYear(iso: string): string {
  const d = new Date(iso);
  return `${RU_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Незакрытые счета — генерируются относительно "сегодня" (не абсолютными
 *  датами из ТЗ), иначе демо, запущенное позже написания промта, показало бы
 *  ВСЕ счета просроченными. Один из четырёх — намеренно уже просрочен. */
function buildInitialBills(childClassName: string): Bill[] {
  const tuitionDue = addDays(10);
  const mealsDue = addDays(5);
  return [
    { id: genId("bill"), title: `Обучение — ${monthYear(tuitionDue)}`, amount: 2_400_000, dueDate: tuitionDue },
    { id: genId("bill"), title: `Питание — ${monthYear(mealsDue)}`, amount: 480_000, dueDate: mealsDue },
    { id: genId("bill"), title: `Учебники ${childClassName}`, amount: 150_000, dueDate: addDays(-3) },
    { id: genId("bill"), title: "Кружок робототехники", amount: 350_000, dueDate: addDays(20) },
  ];
}

const INITIAL_HISTORY: PaymentHistoryRecord[] = [
  { id: genId("hist"), title: "Обучение — декабрь 2025", amount: 2_400_000, paidAt: "2025-12-20T10:00:00.000Z" },
  { id: genId("hist"), title: "Питание — декабрь 2025", amount: 480_000, paidAt: "2025-12-20T10:05:00.000Z" },
  { id: genId("hist"), title: "Учебники 2-А", amount: 130_000, paidAt: "2025-09-03T09:00:00.000Z" },
];

const WALLET_BY_FIRST_NAME: Record<string, number> = {
  "шерзод": 45_000,
  "нодира": 22_000,
  "азиз": 60_000,
  "рустам": 30_000,
  "фаррух": 55_000,
  "малика": 38_000,
};

/** Стабильная псевдослучайная сумма 20000..65000 (кратно 1000) для детей вне
 *  списка выше — не Math.random() (менялось бы при каждом вызове), а хэш
 *  childId, чтобы значение было одинаковым между запусками до первой записи
 *  в хранилище. */
function hashAmount(childId: string): number {
  let h = 0;
  for (let i = 0; i < childId.length; i++) h = (h * 31 + childId.charCodeAt(i)) >>> 0;
  return 20_000 + (h % 46) * 1000;
}

function initialWalletBalance(childId: string, childFullName: string): number {
  const firstName = childFullName.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return WALLET_BY_FIRST_NAME[firstName] ?? hashAmount(childId);
}

function initialWalletPurchases(): WalletPurchase[] {
  const items: [string, number][] = [
    ["Обед — комплексный", 15_000],
    ["Булочка и сок", 8_000],
    ["Обед — комплексный", 15_000],
    ["Мороженое", 5_000],
    ["Обед — комплексный", 15_000],
  ];
  return items.map(([title, amount], i) => ({
    id: genId("wp"),
    title,
    amount,
    date: addDays(-(i * 2 + 1)),
  }));
}

export async function loadBalance(childId: string): Promise<number> {
  return getOrSeed(balanceKey(childId), 125_000);
}
export async function saveBalance(childId: string, value: number): Promise<void> {
  await setJSON(balanceKey(childId), value);
}

export async function loadBills(childId: string, childClassName: string): Promise<Bill[]> {
  return getOrSeed(billsKey(childId), buildInitialBills(childClassName || "—"));
}
export async function saveBills(childId: string, bills: Bill[]): Promise<void> {
  await setJSON(billsKey(childId), bills);
}

export async function loadHistory(childId: string): Promise<PaymentHistoryRecord[]> {
  return getOrSeed(historyKey(childId), INITIAL_HISTORY);
}
export async function saveHistory(childId: string, history: PaymentHistoryRecord[]): Promise<void> {
  await setJSON(historyKey(childId), history);
}

export type WalletState = { balance: number; purchases: WalletPurchase[] };
export async function loadWallet(childId: string, childFullName: string): Promise<WalletState> {
  return getOrSeed(walletKey(childId), { balance: initialWalletBalance(childId, childFullName), purchases: initialWalletPurchases() });
}
export async function saveWallet(childId: string, state: WalletState): Promise<void> {
  await setJSON(walletKey(childId), state);
}

/** Полная транзакция "Оплатить": снимает баланс, убирает счёт из
 *  неоплаченных, добавляет запись в историю — используется CheckoutScreen. */
export async function payBill(childId: string, childClassName: string, bill: Bill): Promise<void> {
  const [balance, bills, history] = await Promise.all([
    loadBalance(childId),
    loadBills(childId, childClassName),
    loadHistory(childId),
  ]);
  await Promise.all([
    saveBalance(childId, balance - bill.amount),
    saveBills(childId, bills.filter((b) => b.id !== bill.id)),
    saveHistory(childId, [{ id: genId("hist"), title: bill.title, amount: bill.amount, paidAt: new Date().toISOString() }, ...history]),
  ]);
}

export async function findHistoryRecord(childId: string, recordId: string): Promise<PaymentHistoryRecord | null> {
  const history = await getJSON<PaymentHistoryRecord[]>(historyKey(childId));
  return history?.find((r) => r.id === recordId) ?? null;
}
