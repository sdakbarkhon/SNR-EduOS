/**
 * Провайдер темы v2: appearance 'light' | 'dark' | 'system' (дефолт system),
 * резолв system через useColorScheme(), персист выбора — через существующий
 * src/lib/mockStorage.ts (expo-secure-store), ключ "pm2.appearance".
 * Синхронно с настройкой темы на экране #34 макета.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import { darkTokens, lightTokens, type Scheme, type ThemeTokens } from "./tokens";
import { getJSON, setJSON } from "../lib/mockStorage";

export type AppearancePref = "light" | "dark" | "system";

const APPEARANCE_KEY = "pm2.appearance";

interface ThemeCtx {
  tokens: ThemeTokens;
  scheme: Scheme;
  appearance: AppearancePref;
  setAppearance: (next: AppearancePref) => void;
}

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [appearance, setAppearanceState] = useState<AppearancePref>("system");

  useEffect(() => {
    getJSON<AppearancePref>(APPEARANCE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") {
        setAppearanceState(saved);
      }
    });
  }, []);

  function setAppearance(next: AppearancePref) {
    setAppearanceState(next);
    setJSON(APPEARANCE_KEY, next).catch((e) => {
      console.error("[ThemeProvider] failed to persist appearance:", e);
    });
  }

  const scheme: Scheme =
    appearance === "system" ? (systemScheme === "dark" ? "dark" : "light") : appearance;

  const value = useMemo<ThemeCtx>(
    () => ({
      tokens: scheme === "dark" ? darkTokens : lightTokens,
      scheme,
      appearance,
      setAppearance,
    }),
    [scheme, appearance],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
