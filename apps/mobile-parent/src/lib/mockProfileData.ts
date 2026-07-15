/** Промт МОБ-6 — mock-interactive данные "Профиль расширенно" (вариант C).
 *  Персистится через mockStorage.ts (expo-secure-store) — см. комментарий
 *  там же про замену AsyncStorage. Ключи совпадают с именами из ТЗ. */
import { getOrSeed, setJSON } from "./mockStorage";
import { genId } from "./mockPaymentsData";

export type NotificationSettings = {
  grades: boolean;
  homework: boolean;
  attendance: boolean;
  announcements: boolean;
  teacherMessages: boolean;
  paymentReminders: boolean;
};

export type QuietHours = { enabled: boolean; from: string; to: string };

export type PaymentCard = {
  id: string;
  brand: "Uzcard" | "Humo";
  last4: string;
  isPrimary: boolean;
  expiry: string; // MM/YY, мок
};

const NOTIFICATIONS_KEY = "mob6.notifications";
const QUIET_HOURS_KEY = "mob6.notifications.quiet_hours";
const PAYMENT_METHODS_KEY = "mob6.payment_methods";
const BIOMETRIC_KEY = "mob6.security.biometric";
const PIN_ENABLED_KEY = "mob6.security.pin_enabled";
const PIN_HASH_KEY = "mob6.security.pin_hash"; // TODO(security): хранится в открытом виде, для мока — норм; реальный вход по PIN потребует серверной проверки/хэширования.

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  grades: true,
  homework: true,
  attendance: true,
  announcements: true,
  teacherMessages: true,
  paymentReminders: true,
};

const DEFAULT_QUIET_HOURS: QuietHours = { enabled: false, from: "22:00", to: "07:00" };

const DEFAULT_CARDS: PaymentCard[] = [
  { id: genId("card"), brand: "Uzcard", last4: "4521", isPrimary: true, expiry: "09/27" },
  { id: genId("card"), brand: "Humo", last4: "8830", isPrimary: false, expiry: "03/28" },
];

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  return getOrSeed(NOTIFICATIONS_KEY, DEFAULT_NOTIFICATIONS);
}
export async function saveNotificationSettings(v: NotificationSettings): Promise<void> {
  await setJSON(NOTIFICATIONS_KEY, v);
}

export async function loadQuietHours(): Promise<QuietHours> {
  return getOrSeed(QUIET_HOURS_KEY, DEFAULT_QUIET_HOURS);
}
export async function saveQuietHours(v: QuietHours): Promise<void> {
  await setJSON(QUIET_HOURS_KEY, v);
}

export async function loadPaymentCards(): Promise<PaymentCard[]> {
  return getOrSeed(PAYMENT_METHODS_KEY, DEFAULT_CARDS);
}
export async function savePaymentCards(v: PaymentCard[]): Promise<void> {
  await setJSON(PAYMENT_METHODS_KEY, v);
}

export async function loadBiometricEnabled(): Promise<boolean> {
  return getOrSeed(BIOMETRIC_KEY, false);
}
export async function saveBiometricEnabled(v: boolean): Promise<void> {
  await setJSON(BIOMETRIC_KEY, v);
}

export async function loadPinEnabled(): Promise<boolean> {
  return getOrSeed(PIN_ENABLED_KEY, false);
}
export async function savePinEnabled(v: boolean): Promise<void> {
  await setJSON(PIN_ENABLED_KEY, v);
}
export async function savePinHash(pin: string): Promise<void> {
  await setJSON(PIN_HASH_KEY, pin);
}

export type MockDocument = {
  id: string;
  title: string;
  status: "uploaded" | "needs_update" | "missing";
};

// Mock-flat (ключа в хранилище нет в ТЗ) — "Загрузить" переводит статус
// локально в состоянии экрана, но не переживает перезапуск приложения.
export const MOCK_DOCUMENTS: MockDocument[] = [
  { id: "birth_cert", title: "Свидетельство о рождении", status: "uploaded" },
  { id: "medical_086", title: "Медсправка форма 086/у", status: "needs_update" },
  { id: "contract", title: "Договор об обучении", status: "uploaded" },
  { id: "consent", title: "Согласие на обработку данных", status: "uploaded" },
  { id: "vaccination", title: "Прививочный сертификат", status: "missing" },
];

export type MockSession = { id: string; device: string; location: string; activeLabel: "now" | "days_ago"; daysAgo?: number };

export const MOCK_ACTIVE_SESSIONS: MockSession[] = [
  { id: "sess_1", device: "iPhone 14 Pro", location: "Ташкент", activeLabel: "now" },
  { id: "sess_2", device: "Samsung Galaxy", location: "Ташкент", activeLabel: "days_ago", daysAgo: 3 },
];

export type MockLoginRecord = { id: string; device: string; date: string };

export const MOCK_LOGIN_HISTORY: MockLoginRecord[] = [
  { id: "log_1", device: "iPhone 14 Pro · Expo Go", date: "2026-07-14T18:20:00.000Z" },
  { id: "log_2", device: "iPhone 14 Pro · Expo Go", date: "2026-07-12T09:05:00.000Z" },
  { id: "log_3", device: "Samsung Galaxy · APK", date: "2026-07-10T16:40:00.000Z" },
  { id: "log_4", device: "iPhone 14 Pro · Expo Go", date: "2026-07-08T07:55:00.000Z" },
  { id: "log_5", device: "Samsung Galaxy · APK", date: "2026-07-03T12:10:00.000Z" },
];
