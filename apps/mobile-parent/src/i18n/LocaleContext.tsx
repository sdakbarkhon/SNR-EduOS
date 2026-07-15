import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as Localization from "expo-localization";
import { defaultLocale, getDictionary, locales, type Locale, type Dictionary } from "@snr/core";
import { getJSON, setJSON } from "../lib/mockStorage";

const LANGUAGE_KEY = "mob6.language";

function detectDeviceLocale(): Locale {
  const tag = Localization.getLocales()[0]?.languageCode ?? defaultLocale;
  return (locales as string[]).includes(tag) ? (tag as Locale) : defaultLocale;
}

type LocaleCtx = { locale: Locale; d: Dictionary; setLocale: (next: Locale) => void };

const LocaleContext = createContext<LocaleCtx | null>(null);

/** P1-5 аудит нашёл, что старый useAppLocale() (голый useState в каждом
 *  экране без Context) не распространял смену языка на уже смонтированные
 *  экраны и не переживал перезапуск. LocaleProvider — единственный источник
 *  правды на всё дерево: один useState здесь, все экраны читают его через
 *  useContext (см. useAppLocale ниже). Персистируется через mockStorage.ts
 *  (expo-secure-store) под ключом mob6.language — тот же механизм, что уже
 *  используют настройки уведомлений/биометрии из МОБ-6, а не отдельный
 *  react-i18next рантайм (этот проект намеренно без него, см. историю
 *  прежней версии этого хука). */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectDeviceLocale);

  useEffect(() => {
    getJSON<Locale>(LANGUAGE_KEY).then((saved) => {
      if (saved && (locales as string[]).includes(saved)) setLocaleState(saved);
    });
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    setJSON(LANGUAGE_KEY, next).catch((e) => {
      console.error("[LocaleProvider] failed to persist language choice:", e);
    });
  }

  const value: LocaleCtx = { locale, d: getDictionary(locale), setLocale };
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Тот же публичный интерфейс {locale, d, setLocale}, что и раньше — экраны,
 *  которые уже делают `const { d, locale } = useAppLocale()`, не требуют
 *  правок. */
export function useAppLocale(): LocaleCtx {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useAppLocale must be used within LocaleProvider");
  return ctx;
}
