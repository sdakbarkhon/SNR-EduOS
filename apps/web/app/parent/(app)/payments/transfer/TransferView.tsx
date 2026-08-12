"use client";

/**
 * Разметка «Перевода между кошельками».
 *
 * Форма живая — сумма вводится, пресеты выбираются, «недостаточно средств»
 * считается по-настоящему, — но перевод не выполняется: кнопка показывает
 * пояснение, а не сообщение об успехе. Делать вид, что деньги ушли, нельзя.
 */

import { useState } from "react";
import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { SOON_PAYMENTS, formatMoney, givenNameOf, walletTitleOf } from "../../_demo/demo-data";
import { GlassCard } from "../../v2/GlassCard";
import { Glyph, ICON, InnerHeader, PrimaryButton, ScreenScroll, SectionCap } from "../../_ui/screen-kit";
import { SoonNote } from "../parts";
import { DIVIDER, PILL_INACTIVE_BG } from "../../_ui/screen-tokens";
import { accent, accentGrad, glassBorder, ink1, ink2, ink3, status } from "../../v2/tokens";

export function TransferView({
  balance,
  presets,
  childName,
}: {
  balance: number;
  presets: readonly (number | null)[];
  childName: string | null;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more3;

  const [amount, setAmount] = useState<number>(0);
  const [soon, setSoon] = useState(false);

  const notEnough = amount > balance;
  const canSend = amount > 0 && !notEnough;

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={d.scr.transfer} backHref="/parent/payments/wallet" />

      <ScreenScroll>
        <SoonNote text={m.walletDemoNoteShort} />

        {/* Откуда и куда. */}
        <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
          {[
            { cap: m.transferFrom, title: m.transferFromParent, sub: formatMoney(balance, { withCurrency: true }) },
            {
              cap: m.transferTo,
              title: walletTitleOf(childName),
              sub: givenNameOf(childName),
            },
          ].map((row, idx) => (
            <div
              key={row.cap}
              className="flex items-center"
              style={{
                gap: 11,
                paddingTop: 13,
                paddingBottom: 13,
                borderTop: idx > 0 ? `1px solid ${DIVIDER}` : undefined,
              }}
            >
              <span
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{ width: 34, height: 34, background: idx === 0 ? PILL_INACTIVE_BG : accentGrad }}
              >
                <Glyph
                  paths={ICON.wallet}
                  size={15}
                  color={idx === 0 ? ink2 : "#FFFFFF"}
                  strokeWidth={1.9}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block"
                  style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", color: ink3 }}
                >
                  {row.cap}
                </span>
                <span className="block" style={{ fontSize: 11.5, fontWeight: 800, color: ink1, marginTop: 2 }}>
                  {row.title}
                </span>
                <span className="block" style={{ fontSize: 9.5, fontWeight: 600, color: ink2 }}>
                  {row.sub}
                </span>
              </span>
            </div>
          ))}
        </GlassCard>

        {/* Сумма. */}
        <SectionCap label={m.transferAmount} />
        <GlassCard radius={22} style={{ padding: 14 }}>
          <input
            inputMode="numeric"
            value={amount > 0 ? formatMoney(amount) : ""}
            placeholder="0"
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
              setAmount(digits ? Number(digits) : 0);
            }}
            className="w-full text-center"
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${notEnough ? "rgba(239,68,68,0.5)" : glassBorder}`,
              background: "rgba(255,255,255,0.55)",
              fontSize: 22,
              fontWeight: 800,
              color: ink1,
            }}
          />

          <div className="flex flex-wrap" style={{ gap: 7, marginTop: 10 }}>
            {presets.map((p, i) => {
              const value = p ?? balance;
              const active = amount === value && amount > 0;
              return (
                <button
                  key={p ?? `all-${i}`}
                  type="button"
                  onClick={() => setAmount(value)}
                  className="rounded-full"
                  style={{
                    padding: "8px 13px",
                    fontSize: 11,
                    fontWeight: active ? 800 : 700,
                    color: active ? "#FFFFFF" : ink2,
                    background: active ? accent : PILL_INACTIVE_BG,
                  }}
                >
                  {p == null ? m.transferAll : formatMoney(p)}
                </button>
              );
            })}
          </div>

          {notEnough ? (
            <span
              className="block"
              style={{ fontSize: 10.5, fontWeight: 700, color: status.red.text, marginTop: 9, textAlign: "center" }}
            >
              {m.transferNotEnough}
            </span>
          ) : null}
        </GlassCard>

        <PrimaryButton label={m.transferSend} onClick={() => setSoon(true)} disabled={!canSend} />
        {soon ? <SoonNote text={SOON_PAYMENTS} /> : null}
      </ScreenScroll>
    </div>
  );
}
