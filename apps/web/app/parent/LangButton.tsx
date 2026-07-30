"use client";

import { useState, type ReactNode } from "react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCircleButton } from "@/components/parent/glass/GlassCircleButton";
import { GlassSheet } from "@/components/parent/glass/GlassSheet";
import { ink1, ink2 } from "@/lib/parent/glass-tokens";
import { CheckIcon, GlobeIcon } from "@/components/parent/auth/icons";

const LANGUAGE_AUTONYMS: Record<Locale, string> = { ru: "Русский", uz: "Oʻzbekcha", en: "English" };

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
 * Круглая glass-кнопка «Язык» — на онбординге (OnboardingCarousel) и на
 * экране входа по номеру (LoginPhoneScreen). Открывает шторку выбора
 * ru/uz/en через реальный useLocale().
 *
 * РАНЬШЕ здесь была ВТОРАЯ кнопка — «Тема» (light/dark/system), и файл
 * назывался LangThemeButtons.tsx. Она писала в ГЛОБАЛЬНЫЙ ThemeProvider,
 * который вешает class="dark" на <html>, то есть переключала тему всего
 * приложения (включая ученика и учителя), а вариант «Системная» ещё и
 * читал prefers-color-scheme. Это был ЕДИНСТВЕННЫЙ источник тёмной темы во
 * всём /parent: сами экраны родителя нарисованы инлайновыми светлыми
 * токенами из v2/tokens.ts и lib/parent/glass-tokens.ts, ни одного
 * dark:-класса в app/parent и components/parent нет. Кнопка удалена —
 * у родителя тема зафиксирована светлой, переключателя нет.
 */
export function LangButton() {
  const { locale, setLocale } = useLocale();
  const set = getDictionary(locale as Locale).parentApp.set;
  const [open, setOpen] = useState(false);

  const languageRows: { value: Locale; name: string; sub: string }[] = [
    { value: "ru", name: set.langRu, sub: LANGUAGE_AUTONYMS.ru },
    { value: "uz", name: set.langUz, sub: LANGUAGE_AUTONYMS.uz },
    { value: "en", name: set.langEn, sub: LANGUAGE_AUTONYMS.en },
  ];

  return (
    <>
      <div className="flex items-center gap-2">
        <GlassCircleButton onClick={() => setOpen(true)} ariaLabel={set.appLanguage}>
          <GlobeIcon color={ink1} />
        </GlassCircleButton>
      </div>

      <GlassSheet visible={open} onClose={() => setOpen(false)}>
        <div className="px-5 pb-3 pt-0.5">
          <h2 className="text-[14px] font-extrabold" style={{ color: ink1 }}>
            {set.appLanguage}
          </h2>
          <div className="mt-2">
            {languageRows.map((row, i) => (
              <PickerRow key={row.value} divider={i > 0} onClick={() => { setLocale(row.value); setOpen(false); }}>
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
    </>
  );
}
