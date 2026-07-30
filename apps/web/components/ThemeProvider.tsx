"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: "light", setTheme: () => {} });

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "dark") {
    root.classList.add("dark");
  } else if (t === "light") {
    root.classList.remove("dark");
  } else {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", dark);
  }
}

/** Кто-то записал 'snr-theme' мимо провайдера — просьба перечитать хранилище.
 *  Событие `storage` для этого не годится: браузер шлёт его только ДРУГИМ
 *  вкладкам, а /parent меняет тему в этой же. */
export const THEME_CHANGE_EVENT = "snr-theme-change";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const saved = (localStorage.getItem("snr-theme") as Theme) ?? "light";
    setThemeState(saved);
    applyTheme(saved);

    /* Хранилище могут поменять В ОБХОД провайдера: экран /parent пишет тот же
       ключ 'snr-theme' напрямую (app/parent/ParentThemeSync.tsx), да и вторая
       вкладка тоже. Без этой синхронизации состояние провайдера оставалось бы
       от значения, прочитанного при монтировании: если родитель выбрал тёмную,
       а здесь всё ещё числится 'system', то смена темы ОС дёрнула бы
       applyTheme('system') и перебила бы явный выбор пользователя. */
    const resync = () => {
      const next = (localStorage.getItem("snr-theme") as Theme) ?? "light";
      setThemeState(next);
    };
    window.addEventListener("storage", resync);
    window.addEventListener(THEME_CHANGE_EVENT, resync);
    return () => {
      window.removeEventListener("storage", resync);
      window.removeEventListener(THEME_CHANGE_EVENT, resync);
    };
  }, []);

  /* Слушатель системной темы живёт РОВНО пока выбран вариант «Системная».
     Раньше он навешивался один раз при монтировании и переживал смену темы. */
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  function setTheme(t: Theme) {
    localStorage.setItem("snr-theme", t);
    setThemeState(t);
    applyTheme(t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
