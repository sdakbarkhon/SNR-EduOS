import type { Dictionary, Locale } from "./types";
import { ru } from "./ru";
import { uz } from "./uz";
import { en } from "./en";

export type { Dictionary, Locale };

export const defaultLocale: Locale = "ru";
export const locales: Locale[] = ["ru", "uz", "en"];

export const dictionaries: Record<Locale, Dictionary> = { ru, uz, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

/** Locale → BCP-47 тег для Intl/toLocaleDateString (formatDate/formatTime
 *  и подобных вызовов, которым нужен реальный локаль-тег, не короткий код
 *  приложения). Долги, проход 1 — до этого экраны mobile-parent хардкодили
 *  "ru-RU" напрямую вместо текущего языка. */
export const LOCALE_TAG: Record<Locale, string> = {
  ru: "ru-RU",
  uz: "uz-Latn-UZ",
  en: "en-US",
};

/** Подстановка {placeholders}: format("Привет, {name}", { name: "Адилбек" }). */
export function format(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}
