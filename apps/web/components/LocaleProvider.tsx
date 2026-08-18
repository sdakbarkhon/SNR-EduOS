"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
// ИМЕННО ИЗ "@snr/core", А НЕ ПО ПУТИ lib/i18n-lazy. В браузерной сборке
// core-модуль подменяется на i18n-lazy, но webpack считает подменённый модуль
// и тот же файл, импортированный напрямую, ДВУМЯ РАЗНЫМИ модулями — у каждого
// свой набор загруженных словарей. Загрузишь узбекский в один, а экраны
// спросят другой, и после переключения языка весь интерфейс останется
// русским. Так и было 19.08.2026, пока не поймали замером.
import { loadDictionary, isDictionaryLoaded, type Locale } from "@snr/core";

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleCtx>({ locale: "ru", setLocale: () => {} });

/**
 * Язык приложения.
 *
 * 19.08.2026 — ЗДЕСЬ ЖИВЁТ ГАРАНТИЯ, НА КОТОРОЙ ДЕРЖИТСЯ ЛЕНИВАЯ ЗАГРУЗКА
 * СЛОВАРЕЙ. В браузер едет только активный язык (lib/i18n-lazy.ts), а
 * getDictionary осталась синхронной — её зовут 175 файлов, переписывать их
 * было нельзя. Синхронность работает ровно потому, что состояние языка здесь
 * НИКОГДА не меняется раньше, чем словарь окажется в памяти: сперва
 * loadDictionary, и только потом setLocaleState.
 *
 * ПОРЯДОК ВАЖЕН ИМЕННО В ЭТУ СТОРОНУ. Поменяй местами — и на один кадр все
 * экраны спросят словарь, которого ещё нет. Ключей человек не увидит (запасной
 * язык русский, см. i18n-lazy), но увидит вспышку чужого языка, а в консоли
 * появится ошибка. Так что это не перестраховка, а условие работы.
 *
 * ЕСЛИ СЛОВАРЬ НЕ СКАЧАЛСЯ — язык остаётся прежним, а причина уходит в
 * консоль. Молча подставлять русский вместо выбранного узбекского нельзя:
 * человек решит, что кнопка сломана, и будет прав. Пусть лучше видно, что
 * переключение не произошло.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  // Стартуем с русского всегда: сервер отдаёт один HTML на всех и про язык
  // конкретного человека не знает. Запомненный язык подхватывается ниже.
  const [locale, setLocaleState] = useState<Locale>("ru");

  useEffect(() => {
    const saved = (localStorage.getItem("snr-locale") as Locale) ?? "ru";
    if (saved === "ru") return;
    if (isDictionaryLoaded(saved)) { setLocaleState(saved); return; }

    let cancelled = false;
    loadDictionary(saved)
      .then(() => { if (!cancelled) setLocaleState(saved); })
      .catch((e) => {
        console.error(`[LocaleProvider] не удалось загрузить словарь «${saved}»:`, e);
      });
    return () => { cancelled = true; };
  }, []);

  function setLocale(l: Locale) {
    if (isDictionaryLoaded(l)) {
      localStorage.setItem("snr-locale", l);
      setLocaleState(l);
      return;
    }

    loadDictionary(l)
      .then(() => {
        localStorage.setItem("snr-locale", l);
        setLocaleState(l);
      })
      .catch((e) => {
        // Язык не меняем: показать половину экрана на новом языке, а половину
        // на старом хуже, чем не переключиться вовсе.
        console.error(`[LocaleProvider] не удалось загрузить словарь «${l}», язык оставлен прежним:`, e);
      });
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);
