import { useCallback, useState } from "react";
import * as Localization from "expo-localization";
import { defaultLocale, getDictionary, locales, type Locale } from "@snr/core";

function detectDeviceLocale(): Locale {
  const tag = Localization.getLocales()[0]?.languageCode ?? defaultLocale;
  return (locales as string[]).includes(tag) ? (tag as Locale) : defaultLocale;
}

/** Простой i18n-хук поверх словарей packages/core (тот же паттерн, что и в apps/mobile —
 *  без react-i18next: getDictionary(locale) + локальный useState, никакого доп. рантайма). */
export function useAppLocale() {
  const [locale, setLocale] = useState<Locale>(detectDeviceLocale);
  const d = getDictionary(locale);
  const changeLocale = useCallback((next: Locale) => setLocale(next), []);
  return { locale, d, setLocale: changeLocale };
}
