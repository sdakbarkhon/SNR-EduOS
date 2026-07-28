"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { useTheme, type Theme } from "@/components/ThemeProvider";
import { GlassCircleButton } from "@/components/parent/glass/GlassCircleButton";
import { GlassSheet } from "@/components/parent/glass/GlassSheet";
import { ink1, ink2 } from "@/lib/parent/glass-tokens";
import { CheckIcon, GlobeIcon, MonitorIcon, MoonIcon, SunIcon } from "@/components/parent/auth/icons";

type SheetKey = null | "lang" | "theme";

const LOCALES: Locale[] = ["ru", "uz", "en"];
const LANGUAGE_AUTONYMS: Record<Locale, string> = { ru: "Русский", uz: "Oʻzbekcha", en: "English" };

const THEME_GRADIENTS: Record<Theme, [string, string]> = {
  light: ["#fbbf24", "#f97316"],
  dark: ["#a78bfa", "#7c3aed"],
  system: ["#60a5fa", "#2563eb"],
};

function CheckDot({ active }: { active: boolean }) {
  if (!active) {
    return <div className="h-[22px] w-[22px] shrink-0 rounded-full" style={{ border: "1.5px solid rgba(23,18,67,0.22)" }} />;
  }
  return (
    <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full" style={{ background: "linear-gradient(135deg, #7C3AED, #4F6DF5)" }}>
      <CheckIcon />
    </div>
  );
}

function PickerRow({ onClick, divider, children }: { onClick: () => void; divider: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 py-2.5 text-left"
      style={divider ? { borderTop: "1px solid rgba(23,18,67,0.06)" } : undefined}
    >
      {children}
    </button>
  );
}

/**
 * Две круглые glass-кнопки «Язык»/«Тема» — переиспользуются на онбординге
 * (OnboardingCarousel) и на экране входа по номеру (LoginPhoneScreen).
 * Открывают шторки с выбором ru/uz/en и light/dark/system — реальные
 * useLocale()/useTheme() (те же контексты, что уже работают в профиле
 * ученика и на /login), не новый стейт. Ряд/CheckDot — тот же визуальный
 * паттерн, что и на мобильном screens/profile/LangSecurityScreen.tsx (не
 * тронут — только скопирован сюда, там ничего не экспортировано наружу).
 */
export function LangThemeButtons() {
  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const dict = getDictionary(locale as Locale).parentApp;
  const set = dict.set;

  const [sheet, setSheet] = useState<SheetKey>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (theme === "dark") setIsDark(true);
    else if (theme === "light") setIsDark(false);
    else setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, [theme]);

  const languageRows: { value: Locale; name: string; sub: string }[] = [
    { value: "ru", name: set.langRu, sub: LANGUAGE_AUTONYMS.ru },
    { value: "uz", name: set.langUz, sub: LANGUAGE_AUTONYMS.uz },
    { value: "en", name: set.langEn, sub: LANGUAGE_AUTONYMS.en },
  ];

  const themeRows: { value: Theme; title: string; sub: string; icon: ReactNode }[] = [
    { value: "light", title: set.light, sub: set.lightSub, icon: <SunIcon color="#FFFFFF" /> },
    { value: "dark", title: set.dark, sub: set.darkSub, icon: <MoonIcon color="#FFFFFF" /> },
    { value: "system", title: set.system, sub: set.systemSub, icon: <MonitorIcon /> },
  ];

  return (
    <>
      <div className="flex items-center gap-2">
        <GlassCircleButton onClick={() => setSheet("lang")} ariaLabel={set.appLanguage}>
          <GlobeIcon color={ink1} />
        </GlassCircleButton>
        <GlassCircleButton onClick={() => setSheet("theme")} ariaLabel={set.appearance}>
          {isDark ? <MoonIcon color={ink1} /> : <SunIcon color={ink1} />}
        </GlassCircleButton>
      </div>

      <GlassSheet visible={sheet === "lang"} onClose={() => setSheet(null)}>
        <div className="px-5 pb-3 pt-0.5">
          <h2 className="text-[14px] font-extrabold" style={{ color: ink1 }}>
            {set.appLanguage}
          </h2>
          <div className="mt-2">
            {languageRows.map((row, i) => (
              <PickerRow key={row.value} divider={i > 0} onClick={() => { setLocale(row.value); setSheet(null); }}>
                <div className="flex-1">
                  <div className="text-[12px] font-extrabold" style={{ color: ink1 }}>
                    {row.name}
                  </div>
                  <div className="mt-0.5 text-[9.5px] font-semibold" style={{ color: ink2 }}>
                    {row.sub}
                  </div>
                </div>
                <CheckDot active={locale === row.value} />
              </PickerRow>
            ))}
          </div>
        </div>
      </GlassSheet>

      <GlassSheet visible={sheet === "theme"} onClose={() => setSheet(null)}>
        <div className="px-5 pb-3 pt-0.5">
          <h2 className="text-[14px] font-extrabold" style={{ color: ink1 }}>
            {set.appearance}
          </h2>
          <div className="mt-2">
            {themeRows.map((row, i) => (
              <PickerRow key={row.value} divider={i > 0} onClick={() => { setTheme(row.value); setSheet(null); }}>
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]"
                  style={{ background: `linear-gradient(135deg, ${THEME_GRADIENTS[row.value][0]}, ${THEME_GRADIENTS[row.value][1]})` }}
                >
                  {row.icon}
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-extrabold" style={{ color: ink1 }}>
                    {row.title}
                  </div>
                  <div className="mt-0.5 text-[9.5px] font-semibold" style={{ color: ink2 }}>
                    {row.sub}
                  </div>
                </div>
                <CheckDot active={theme === row.value} />
              </PickerRow>
            ))}
          </div>
        </div>
      </GlassSheet>
    </>
  );
}
