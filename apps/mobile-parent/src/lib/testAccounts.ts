/**
 * Заход 1 — три тестовых номера входа. Настоящего SMS нет: номер+код
 * резолвятся в реальный parent-username (для signInWithUsername/
 * loginAsParent, пароль везде "parent2026" — см. auth.ts), а не создают
 * никакой сессии сами по себе.
 *
 * fixtureChildIds — НЕ реальные ID детей (у Supabase-детей своя таблица);
 * это ID из data/fixtures/family.ts, подобранные так, чтобы КОЛИЧЕСТВО
 * совпадало с реальным числом детей семьи в базе (1/2/3) — тем самым
 * childPicker-логика (kidsCount-ветвление на picker/direct-app) идёт по
 * уже рабочему пути, который раньше обкатан демо-входом. Экраны данных
 * внутри приложения в этом заходе остаются на фикстурах (см. заход-план) —
 * это единственное место, где реальный логин временно "подменяется"
 * фикстурным ребёнком для остального дерева экранов.
 */
export interface TestAccount {
  username: string;
  code: string;
  fixtureChildIds: string[];
}

/** Ключ — 9 национальных цифр без кода страны (формат setPhone уже отдаёт
 *  ровно это: `digits.replace(/\D/g, "").slice(0, 9)`). */
export const TEST_ACCOUNTS: Record<string, TestAccount> = {
  "111111111": {
    username: "parent_ismailov",
    code: "1111",
    fixtureChildIds: ["child-ismailov-azizbek"],
  },
  "222222222": {
    username: "parent_rakhimov",
    code: "2222",
    fixtureChildIds: ["child-rakhimov-madina", "child-rakhimov-humoyun"],
  },
  "333333333": {
    username: "parent_karimov",
    code: "3333",
    fixtureChildIds: ["child-aziz", "child-malika", "child-farrukh"],
  },
};

/** Пароль всех трёх тестовых аккаунтов — реальный пароль реальных строк
 *  в auth.users, не относится к сгенерированным демо-паролям. */
export const TEST_ACCOUNT_PASSWORD = "parent2026";

export function findTestAccount(nationalDigits: string): TestAccount | null {
  return TEST_ACCOUNTS[nationalDigits] ?? null;
}
