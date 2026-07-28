"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "@/components/parent/glass/GlassCard";
import { GlassButton } from "@/components/parent/glass/GlassButton";
import { GlassInput } from "@/components/parent/glass/GlassInput";
import { loginParentByPhone } from "@/app/actions/parentPhoneAuth";
import { ink1, ink2 } from "@/lib/parent/glass-tokens";
import { OnboardingCarousel } from "./OnboardingCarousel";
import { LoginPhoneScreen } from "./LoginPhoneScreen";

type Step = "onboarding" | "phone" | "code";

/**
 * Неавторизованный вход родителя: онбординг (карусель 3 слайдов) → номер
 * телефона → код. Онбординг — 1:1 с apps/mobile-parent/src/screens/auth/
 * OnboardingScreen.tsx, см. OnboardingCarousel.tsx.
 */
export function AuthFlow() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp.auth;

  const router = useRouter();
  const [step, setStep] = useState<Step>("onboarding");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onPhoneDigits(raw: string) {
    setPhone(raw.replace(/\D/g, "").slice(0, 9));
  }

  function onCodeDigits(raw: string) {
    setCode(raw.replace(/\D/g, "").slice(0, 4));
  }

  function submitPhone() {
    setError(null);
    if (phone.length !== 9) return;
    setStep("code");
  }

  function submitCode() {
    if (code.length !== 4) return;
    setError(null);
    startTransition(async () => {
      const result = await loginParentByPhone(phone, code);
      if (!result.ok) {
        setError(
          result.error === "not_found"
            ? d.phoneNotFound
            : result.error === "invalid_code"
              ? d.wrongCode
              : d.loginFailed,
        );
        return;
      }
      router.replace(result.dest);
      router.refresh();
    });
  }

  if (step === "onboarding") {
    return <OnboardingCarousel onStart={() => setStep("phone")} />;
  }

  if (step === "phone") {
    return (
      <LoginPhoneScreen
        phone={phone}
        onPhoneChange={onPhoneDigits}
        onSubmit={submitPhone}
        onBack={() => setStep("onboarding")}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-6 px-6 py-10">
      <GlassCard className="p-5">
        <div className="flex flex-col gap-3">
          <h2 className="whitespace-pre-line text-lg font-bold" style={{ color: ink1 }}>
            {d.smsTitle}
          </h2>
          <p className="whitespace-pre-line text-sm" style={{ color: ink2 }}>
            {d.smsSubPrefix}+998 {phone}
          </p>
          <GlassInput
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="0000"
            value={code}
            onChange={(e) => onCodeDigits(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitCode()}
            className="text-center text-2xl tracking-[0.5em]"
          />
          {error && (
            <p className="text-sm font-medium" style={{ color: "#B91C1C" }}>
              {error}
            </p>
          )}
          <GlassButton onClick={submitCode} disabled={code.length !== 4 || isPending}>
            {d.continue}
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
}
