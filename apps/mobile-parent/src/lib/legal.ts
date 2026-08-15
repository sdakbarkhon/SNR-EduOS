/**
 * Адреса правовых документов — одно место на всё приложение.
 *
 * Ссылки на пользовательское соглашение и политику конфиденциальности требуют
 * оба магазина, но вести в никуда они не могут. Адрес берётся из настроек
 * сборки (`app.json → expo.extra.legalTermsUrl / legalPrivacyUrl`): как только
 * заказчик опубликует документы и впишет сюда два адреса, ссылки заработают
 * без единой правки кода и без новой сборки — значения приезжают вместе с
 * обновлением по воздуху.
 *
 * Пока адреса пустые, оба места (экран входа и «Профиль → Язык и
 * безопасность») ведут себя одинаково и честно: объясняют, что документ
 * готовится, а не молчат и не открывают пустую страницу. Раньше эта проверка
 * жила только на экране входа, а профиль всегда вёл на экран-объяснение — то
 * есть после публикации документов профиль так и остался бы без ссылки.
 */
import Constants from "expo-constants";

export type LegalKind = "terms" | "privacy";

const EXTRA_KEY: Record<LegalKind, string> = {
  terms: "legalTermsUrl",
  privacy: "legalPrivacyUrl",
};

/** Адрес документа или null, если заказчик его ещё не дал. */
export function legalUrl(kind: LegalKind): string | null {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const raw = extra?.[EXTRA_KEY[kind]];
  return typeof raw === "string" && raw.startsWith("http") ? raw : null;
}
