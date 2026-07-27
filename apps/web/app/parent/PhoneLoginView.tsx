"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "@/components/parent/glass/GlassCard";
import { GlassButton } from "@/components/parent/glass/GlassButton";
import { GlassInput } from "@/components/parent/glass/GlassInput";
import { loginParentByPhone } from "@/app/actions/parentPhoneAuth";

type Step = "phone" | "code";

export function PhoneLoginView() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp.auth;

  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
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

  return (
    <div className="flex flex-1 flex-col justify-center gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold" style={{ color: "#171243" }}>
          {step === "phone" ? d.welcome : null}
        </h1>
        {step === "phone" && (
          <p className="mt-2 text-sm" style={{ color: "rgba(26,19,74,0.64)" }}>
            {d.signInSub}
          </p>
        )}
      </div>

      <GlassCard className="p-5">
        {step === "phone" ? (
          <div className="flex flex-col gap-3">
            <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "rgba(26,19,74,0.45)" }}>
              {d.phoneHint}
            </label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[15px] font-semibold" style={{ color: "#171243" }}>
                +998
              </span>
              <GlassInput
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder={d.phonePlaceholder}
                value={phone}
                onChange={(e) => onPhoneDigits(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitPhone()}
              />
            </div>
            <GlassButton onClick={submitPhone} disabled={phone.length !== 9}>
              {d.continue}
            </GlassButton>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="whitespace-pre-line text-lg font-bold" style={{ color: "#171243" }}>
              {d.smsTitle}
            </h2>
            <p className="whitespace-pre-line text-sm" style={{ color: "rgba(26,19,74,0.64)" }}>
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
        )}
      </GlassCard>
    </div>
  );
}
