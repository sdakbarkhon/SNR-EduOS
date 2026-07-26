/**
 * Заход 2, шаг 2 — три тестовых номера входа. Настоящего SMS по-прежнему
 * нет: номер резолвится в реальный parent-username (для signInWithUsername/
 * loginAsParent, пароль везде "parent2026" — см. auth.ts), КОД больше не
 * проверяется (любые 4 цифры проходят) — конкретного значения кода в карте
 * больше нет.
 *
 * fixtureChildIds — НЕ реальные ID детей (у Supabase-детей своя таблица);
 * это ID из data/fixtures/family.ts, подобранные так, чтобы КОЛИЧЕСТВО
 * совпадало с реальным числом детей семьи в базе (1/2/3) — тем самым
 * childPicker-логика (kidsCount-ветвление на picker/direct-app) идёт по
 * уже рабочему пути. Экраны данных внутри приложения остаются на фикстурах
 * (см. заход-план) — единственное место, где реальный логин временно
 * "подменяется" фикстурным ребёнком для остального дерева экранов.
 *
 * displayName/displayChildren — Заход 2, шаг 2: превью реального родителя
 * и его детей ДО входа, для карточек модалки «Демо-режим». До авторизации
 * RLS не отдаст эти данные из БД (anon-сессии ничего не видно), а модалка
 * должна показать их ДО тапа — поэтому продублированы вручную из базы (те
 * же значения, что вернёт useParentData() ПОСЛЕ входа этим же аккаунтом).
 * Не альтернатива реальным данным — после входа Профиль/шапка/«Мои дети»
 * ВСЕГДА берут актуальные данные через useParentData(), эти поля читает
 * ТОЛЬКО AuthDemoPickerSheet для превью карточки.
 */
export interface TestChildDisplay {
  name: string;
  className: string;
}

export interface TestAccount {
  username: string;
  fixtureChildIds: string[];
  displayName: string;
  displayChildren: TestChildDisplay[];
}

/** Ключ — 9 национальных цифр без кода страны (формат setPhone уже отдаёт
 *  ровно это: `digits.replace(/\D/g, "").slice(0, 9)`). */
export const TEST_ACCOUNTS: Record<string, TestAccount> = {
  "912345678": {
    username: "parent_ismailov",
    fixtureChildIds: ["child-ismailov-azizbek"],
    displayName: "Ismailov Bakhtiyor",
    displayChildren: [{ name: "Ismailov Sherzod", className: "10-А" }],
  },
  "934567890": {
    username: "parent_rakhimov",
    fixtureChildIds: ["child-rakhimov-madina", "child-rakhimov-humoyun"],
    displayName: "Rakhimov Odil",
    displayChildren: [
      { name: "Rakhimova Nodira", className: "7-А" },
      { name: "Rakhimov Rustam", className: "3-А" },
    ],
  },
  "901234567": {
    username: "parent_karimov",
    fixtureChildIds: ["child-aziz", "child-malika", "child-farrukh"],
    displayName: "Karimov Sardor",
    displayChildren: [
      { name: "Karimov Aziz", className: "3-А" },
      { name: "Karimov Farrukh", className: "10-А" },
      { name: "Karimova Malika", className: "7-А" },
    ],
  },
};

/** Пароль всех трёх тестовых аккаунтов — реальный пароль реальных строк
 *  в auth.users, не относится к сгенерированным демо-паролям. */
export const TEST_ACCOUNT_PASSWORD = "parent2026";

export function findTestAccount(nationalDigits: string): TestAccount | null {
  return TEST_ACCOUNTS[nationalDigits] ?? null;
}

/** Заход 2, шаг 2: все аккаунты с их телефон-ключом — источник карточек
 *  AuthDemoPickerSheet (та же карта, что резолвит ввод номера). */
export function listTestAccounts(): Array<{ phone: string; account: TestAccount }> {
  return Object.entries(TEST_ACCOUNTS).map(([phone, account]) => ({ phone, account }));
}

/** Заход 2, шаг 2: обратный поиск номера по username — для отображения
 *  "телефон, которым вошли" на экране Профиль после реального логина, когда
 *  вход был через демо-модалку (там state.phone не заполнялся вводом). */
export function findPhoneForUsername(username: string): string | null {
  const entry = Object.entries(TEST_ACCOUNTS).find(([, acc]) => acc.username === username);
  return entry ? entry[0] : null;
}
