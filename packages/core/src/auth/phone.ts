// Родительский вход по номеру телефона (веб-родитель, Заход 1 —
// apps/web/app/parent/**). Аддитивный файл, username.ts не трогает.
//
// Карта 3 тестовых номеров -> 3 реальных родителей поднята сюда из
// apps/mobile-parent/src/lib/testAccounts.ts, чтобы веб и мобилка со
// временем читали один источник правды (мобилка пока не перепривязана —
// её testAccounts.ts не тронут в этом заходе, см. отчёт).

export interface ParentPhoneAccount {
  username: string;
  displayName: string;
}

/** Общий пароль под капотом для всех телефон-аккаунтов (как в мобилке). */
export const PARENT_PHONE_PASSWORD = "parent2026";

export const PARENT_PHONE_ACCOUNTS: Record<string, ParentPhoneAccount> = {
  "912345678": { username: "parent_ismailov", displayName: "Ismailov Bakhtiyor" },
  "934567890": { username: "parent_rakhimov", displayName: "Rakhimov Odil" },
  "901234567": { username: "parent_karimov", displayName: "Karimov Sardor" },
};

/** `nationalDigits` — 9 цифр без кода страны (как ключи выше). */
export function resolveParentPhone(nationalDigits: string): ParentPhoneAccount | null {
  return PARENT_PHONE_ACCOUNTS[nationalDigits] ?? null;
}
