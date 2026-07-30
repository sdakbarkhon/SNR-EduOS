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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const saved = (localStorage.getItem("snr-theme") as Theme) ?? "light";
    setThemeState(saved);
    applyTheme(saved);

    /* Другая вкладка могла сменить тему — подхватываем, чтобы состояние
       провайдера не разъезжалось с реально применённым классом.
       (/parent сюда больше не пишет: у него свой ключ 'snr-parent-theme'.) */
    const resync = () => {
      const next = (localStorage.getItem("snr-theme") as Theme) ?? "light";
      setThemeState(next);
    };
    window.addEventListener("storage", resync);
    return () => window.removeEventListener("storage", resync);
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
