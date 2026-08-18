import type { Dictionary, Locale } from "./types";

/**
 * Всё про языки, КРОМЕ самих словарей.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. 19.08.2026 у веба появилась своя, ленивая сборка
 * словарей (apps/web/lib/i18n-lazy.ts): в браузер грузится только активный
 * язык, остальные два — в момент переключения. Ей нужны ровно эти четыре вещи:
 * список языков, язык по умолчанию, теги для Intl и подстановка значений.
 *
 * Если бы их не вынесли, веб-версии пришлось бы их СКОПИРОВАТЬ — и правило
 * «uz это uz-Latn-UZ» стало бы жить в двух местах, где второе тихо отстаёт.
 * Здесь оно одно, а пользуются им обе сборки.
 *
 * Мобильное приложение ничего не заметило: index.ts как отдавал эти имена
 * наружу, так и отдаёт.
 */

export type { Dictionary, Locale };

export const defaultLocale: Locale = "ru";
export const locales: Locale[] = ["ru", "uz", "en"];

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
