"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, format, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassSheet } from "@/components/parent/glass/GlassSheet";
import { ink1, ink2 } from "@/lib/parent/glass-tokens";
import { loginParentByPhone } from "@/app/actions/parentPhoneAuth";

type DemoAccount = {
  phone: string;
  displayName: string;
  children: { name: string }[];
  gradient: [string, string];
};

/** Формат «+998 90 123 45 67» — тот же паттерн, что в LoginPhoneScreen. */
function formatPhoneDisplay(nationalDigits: string): string {
  const m = nationalDigits.match(/^(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})/);
  if (!m) return `+998 ${nationalDigits}`;
  return `+998 ${[m[1], m[2], m[3], m[4]].filter(Boolean).join(" ")}`;
}

// Те же 3 родителя, что в apps/mobile-parent/src/lib/testAccounts.ts —
// реальные номера/дети, совпадают с packages/core/src/auth/phone.ts
// (PARENT_PHONE_ACCOUNTS: те же 3 username).
const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    phone: "912345678",
    displayName: "Ismailov Bakhtiyor",
    children: [{ name: "Ismailov Sherzod" }],
    gradient: ["#22d3ee", "#3b82f6"],
  },
  {
    phone: "934567890",
    displayName: "Rakhimov Odil",
    children: [{ name: "Rakhimova Nodira" }, { name: "Rakhimov Rustam" }],
    gradient: ["#8b5cf6", "#ec4899"],
  },
  {
    phone: "901234567",
    displayName: "Karimov Sardor",
    children: [{ name: "Karimov Aziz" }, { name: "Karimov Farrukh" }, { name: "Karimova Malika" }],
    gradient: ["#34d399", "#0ea5e9"],
  },
];

const CHILD_GRADIENTS: [string, string][] = [
  ["#22d3ee", "#3b82f6"],
  ["#8b5cf6", "#ec4899"],
  ["#34d399", "#0ea5e9"],
];

/**
 * «Демо-режим» — 1:1 с apps/mobile-parent AuthDemoPickerSheet.tsx. Тап по
 * карточке — РЕАЛЬНЫЙ вход через уже существующий loginParentByPhone (тот
 * же server action, что и обычный номер+SMS-флоу) с фиктивным 4-значным
 * кодом — код там не проверяется по-настоящему (только формат /^\d{4}$/),
 * поэтому экран SMS-кода можно полностью пропустить, как в мобилке.
 */
export function AuthDemoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).parentApp.auth;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  async function handlePress(account: DemoAccount) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const result = await loginParentByPhone(account.phone, "0000");
    if (!result.ok) {
      setError(t.loginFailed);
      busyRef.current = false;
      setBusy(false);
      return;
    }
    router.replace(result.dest);
    router.refresh();
  }

  return (
    <GlassSheet visible={visible} onClose={onClose}>
      <div className="px-5 pb-3 pt-0.5">
        <h2 className="text-[14px] font-extrabold" style={{ color: ink1 }}>
          {t.demo}
        </h2>
        <p className="mt-0.5 pb-3 text-[10px] font-semibold leading-[1.5]" style={{ color: ink2 }}>
          {t.demoSub}
        </p>

        <div className="flex flex-col gap-2">
          {DEMO_ACCOUNTS.map((account) => {
            const kidsLabel =
              account.children.length === 1 ? t.kidsOne : format(t.kidsMany, { n: account.children.length });
            return (
              <button
                key={account.phone}
                type="button"
                disabled={busy}
                onClick={() => handlePress(account)}
                className="flex items-center gap-3 rounded-2xl p-3 text-left disabled:opacity-60"
                style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.85)" }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white text-[15px] font-extrabold text-white"
                  style={{ background: `linear-gradient(135deg, ${account.gradient[0]}, ${account.gradient[1]})` }}
                >
                  {account.displayName.slice(0, 1)}
                </div>
                <div className="flex-1">
                  <div className="text-[12.5px] font-extrabold" style={{ color: ink1 }}>
                    {account.displayName}
                  </div>
                  <div className="text-[9.5px] font-semibold" style={{ color: ink2 }}>
                    {formatPhoneDisplay(account.phone)}
                  </div>
                  <div className="text-[9.5px] font-bold" style={{ color: "#7C3AED" }}>
                    {kidsLabel}
                  </div>
                </div>
                <div className="flex shrink-0">
                  {account.children.map((child, i) => {
                    const [gradFrom, gradTo] = CHILD_GRADIENTS[i % CHILD_GRADIENTS.length]!;
                    return (
                      <div
                        key={child.name}
                        className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-extrabold text-white"
                        style={{
                          background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`,
                          marginLeft: i === 0 ? 0 : -7,
                        }}
                      >
                        {child.name.slice(0, 1)}
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="pt-3 text-center text-[11px] font-semibold" style={{ color: "#B91C1C" }}>
            {error}
          </p>
        )}
      </div>
    </GlassSheet>
  );
}
