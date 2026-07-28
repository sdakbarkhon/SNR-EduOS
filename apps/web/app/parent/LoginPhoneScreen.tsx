"use client";

import { useRef, useState } from "react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "@/components/parent/glass/GlassCard";
import { GlassButton } from "@/components/parent/glass/GlassButton";
import { GlassInput } from "@/components/parent/glass/GlassInput";
import { GlassCircleButton } from "@/components/parent/glass/GlassCircleButton";
import { ink1, ink2, ink3, glassBorder, glass1Css, shCardCss, accent } from "@/lib/parent/glass-tokens";
import {
  AppleIcon,
  BackArrowIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GoogleIcon,
  SparkleIcon,
  UzFlagIcon,
} from "@/components/parent/auth/icons";
import { AuthHelpSheet } from "./AuthHelpSheet";
import { AuthDemoSheet } from "./AuthDemoSheet";
import { LangThemeButtons } from "./LangThemeButtons";

type SheetKey = null | "help" | "demo";

/** Формат «90 123 45 67» — 1:1 с мобильным LoginPhoneScreen.tsx. */
function formatPhone(digits: string): string {
  const m = digits.match(/^(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})/);
  if (!m) return digits;
  return [m[1], m[2], m[3], m[4]].filter(Boolean).join(" ");
}

type Props = {
  phone: string;
  onPhoneChange: (digits: string) => void;
  onSubmit: () => void;
  onBack: () => void;
};

/**
 * Экран входа по номеру — 1:1 перенос apps/mobile-parent LoginPhoneScreen.tsx
 * (иконки/шторки — тоже 1:1, см. auth/icons.tsx, AuthHelpSheet.tsx,
 * AuthDemoSheet.tsx). Валидацию номера и переход к SMS-коду не трогаем —
 * phone/onSubmit управляются в AuthFlow.tsx как и раньше.
 *
 * Селектор страны в этой версии статичен (только Узбекистан) — клик
 * показывает тост «Скоро», как и клики по Google/Apple (OAuth не
 * подключаем в этом заходе).
 */
export function LoginPhoneScreen({ phone, onPhoneChange, onSubmit, onBack }: Props) {
  const { locale } = useLocale();
  const dict = getDictionary(locale as Locale);
  const t = dict.parentApp.auth;
  const comingSoonText = dict.auth.comingSoon;

  const [sheet, setSheet] = useState<SheetKey>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | null>(null);

  function showComingSoon() {
    setNotice(comingSoonText);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2200) as unknown as number;
  }

  const canSubmit = phone.length === 9;
  const ctaCardStyle = { ...glass1Css, borderRadius: 16, boxShadow: shCardCss };

  return (
    <div className="flex flex-1 flex-col">
      {/* Шапка: назад + Язык/Тема + «Нужна помощь?» */}
      <div className="flex items-center gap-2.5 px-4 pb-2 pt-6">
        <GlassCircleButton onClick={onBack} ariaLabel={dict.parentApp.common.back}>
          <BackArrowIcon color={ink1} />
        </GlassCircleButton>
        <div className="flex-1" />
        <LangThemeButtons />
        <button type="button" onClick={() => setSheet("help")} className="text-[12px] font-extrabold" style={{ color: accent }}>
          {t.needHelp}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-8 pt-2">
        <h1 className="text-xl font-bold" style={{ color: ink1 }}>
          {t.welcome}
        </h1>
        <p className="text-[13px] font-semibold" style={{ color: ink2 }}>
          {t.signInSub}
        </p>

        <GlassCard className="p-3.5">
          <label className="mb-2 block text-[10px] font-extrabold tracking-wide" style={{ color: ink2 }}>
            {t.phoneHint}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={showComingSoon}
              className="flex shrink-0 items-center gap-1.5 rounded-[14px] px-2.5 py-3"
              style={{ background: "rgba(255,255,255,0.55)", border: `1px solid ${glassBorder}` }}
            >
              <UzFlagIcon size={18} />
              <span className="text-[13px] font-extrabold" style={{ color: ink1 }}>
                +998
              </span>
              <ChevronDownIcon size={11} color={ink3} />
            </button>
            <GlassInput
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder={t.phonePlaceholder}
              value={formatPhone(phone)}
              onChange={(e) => onPhoneChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              maxLength={12}
              className="flex-1"
            />
          </div>
          <div className="mt-3">
            <GlassButton onClick={onSubmit} disabled={!canSubmit}>
              {t.continue}
            </GlassButton>
          </div>
        </GlassCard>

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1" style={{ background: ink3 }} />
          <span className="text-[10.5px] font-bold" style={{ color: ink3 }}>
            {t.or}
          </span>
          <div className="h-px flex-1" style={{ background: ink3 }} />
        </div>

        <button
          type="button"
          onClick={() => setSheet("demo")}
          className="flex items-center gap-2.5 p-3.5 text-left"
          style={{ ...ctaCardStyle, border: "1.5px solid rgba(124,58,237,0.5)" }}
        >
          <div
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px]"
            style={{ background: "linear-gradient(135deg, #7C3AED, #4F6DF5)", boxShadow: "0 6px 14px rgba(124,58,237,0.35)" }}
          >
            <SparkleIcon size={16} color="#FFFFFF" />
          </div>
          <div className="flex-1">
            <div className="text-[12.5px] font-extrabold" style={{ color: ink1 }}>
              {t.demoCtaTitle}
            </div>
            <div className="mt-0.5 text-[9.5px] font-semibold" style={{ color: ink2 }}>
              {t.demoCtaSub}
            </div>
          </div>
          <ChevronRightIcon size={15} color={ink3} />
        </button>

        <button
          type="button"
          onClick={showComingSoon}
          className="flex items-center gap-2.5 p-3.5 text-left"
          style={{ ...ctaCardStyle, border: `1px solid ${glassBorder}` }}
        >
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] bg-white">
            <GoogleIcon size={18} />
          </div>
          <span className="flex-1 text-[12.5px] font-extrabold" style={{ color: ink1 }}>
            {t.withGoogle}
          </span>
        </button>

        <button
          type="button"
          onClick={showComingSoon}
          className="flex items-center gap-2.5 p-3.5 text-left"
          style={{ ...ctaCardStyle, border: `1px solid ${glassBorder}` }}
        >
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] bg-white">
            <AppleIcon size={18} color={ink1} />
          </div>
          <span className="flex-1 text-[12.5px] font-extrabold" style={{ color: ink1 }}>
            {t.withApple}
          </span>
        </button>

        <p className="px-2 pt-1.5 text-center text-[9.5px] leading-[1.5]" style={{ color: ink3 }}>
          {t.legalPrefix}
          <a href="#" className="font-extrabold" style={{ color: accent }}>
            {t.legalTerms}
          </a>
          {t.legalAnd}
          <a href="#" className="font-extrabold" style={{ color: accent }}>
            {t.legalPrivacy}
          </a>
        </p>
      </div>

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-6">
          <div className="rounded-full px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-lg" style={{ background: "rgba(23,18,67,0.92)" }}>
            {notice}
          </div>
        </div>
      )}

      <AuthHelpSheet visible={sheet === "help"} onClose={() => setSheet(null)} />
      <AuthDemoSheet visible={sheet === "demo"} onClose={() => setSheet(null)} />
    </div>
  );
}
