"use client";

/**
 * Разметка «Лимитов расходов».
 *
 * Экран настроечный, поэтому органы управления живые: пресет выбирается,
 * тумблеры переключаются. Но сохранять выбор некуда — таблицы лимитов в базе
 * нет, — и кнопка «Сохранить» вместо тихого успеха показывает пояснение.
 */

import { useState } from "react";
import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { WalletLimits } from "../../_demo/demo-data";
import { SOON_PAYMENTS, formatMoney } from "../../_demo/demo-data";
import { GlassCard } from "../../v2/GlassCard";
import { InnerHeader, PrimaryButton, ScreenScroll, SectionCap, Toggle } from "../../_ui/screen-kit";
import { SoonNote } from "../parts";
import { DIVIDER, PILL_INACTIVE_BG } from "../../_ui/screen-tokens";
import { accent, ink1, ink2, ink3 } from "../../v2/tokens";

export function LimitsView({ limits }: { limits: WalletLimits }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more3;

  const [daily, setDaily] = useState(limits.dailyLimit);
  const [cats, setCats] = useState(limits.categories);
  const [notifyOps, setNotifyOps] = useState(limits.notifyEveryOp);
  const [notifyLimit, setNotifyLimit] = useState(limits.notifyOnLimit);
  const [soon, setSoon] = useState(false);

  const left = daily > 0 ? Math.max(0, daily - limits.spentToday) : null;
  const usedPct = daily > 0 ? Math.min(100, Math.round((limits.spentToday / daily) * 100)) : 0;

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={d.scr.limits} backHref="/parent/payments/wallet" />

      <ScreenScroll>
        <SoonNote text={m.walletDemoNoteShort} />

        {/* Дневной лимит и сколько от него осталось. */}
        <GlassCard radius={22} style={{ padding: 16 }}>
          <div className="flex items-baseline" style={{ gap: 8 }}>
            <span className="flex-1" style={{ fontSize: 11, fontWeight: 600, color: ink2 }}>
              {m.limitsDaily}
            </span>
            <span style={{ fontSize: 15, fontWeight: 800, color: ink1 }}>
              {daily > 0 ? formatMoney(daily, { withCurrency: true }) : m.limitsNoLimit}
            </span>
          </div>

          <span
            aria-hidden
            className="block w-full overflow-hidden"
            style={{ height: 6, borderRadius: 3, background: "rgba(23,18,67,0.08)", marginTop: 10 }}
          >
            <span
              className="block h-full"
              style={{
                width: `${Math.max(3, usedPct)}%`,
                borderRadius: 3,
                background: usedPct >= 90 ? "#EF4444" : accent,
              }}
            />
          </span>

          <div className="flex items-baseline" style={{ gap: 8, marginTop: 8 }}>
            <span className="flex-1" style={{ fontSize: 10, fontWeight: 600, color: ink2 }}>
              {`${m.limitsSpentToday}: ${formatMoney(limits.spentToday, { withCurrency: true })}`}
            </span>
            {left != null ? (
              <span style={{ fontSize: 10, fontWeight: 800, color: ink1 }}>
                {`${m.limitsLeft}: ${formatMoney(left, { withCurrency: true })}`}
              </span>
            ) : null}
          </div>
        </GlassCard>

        {/* Пресеты. */}
        <SectionCap label={m.limitsPresetsCap} />
        <div className="flex flex-wrap" style={{ gap: 7 }}>
          {limits.presets.map((p) => {
            const active = p === daily;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setDaily(p)}
                className="rounded-full"
                style={{
                  padding: "9px 14px",
                  fontSize: 11,
                  fontWeight: active ? 800 : 700,
                  color: active ? "#FFFFFF" : ink2,
                  background: active ? accent : PILL_INACTIVE_BG,
                }}
              >
                {p > 0 ? formatMoney(p) : m.limitsNoLimit}
              </button>
            );
          })}
        </div>

        {/* Категории. */}
        <SectionCap label={m.limitsCategoriesCap} />
        <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
          {cats.map((c, idx) => (
            <div
              key={c.id}
              className="flex items-center"
              style={{
                gap: 10,
                paddingTop: 11,
                paddingBottom: 11,
                borderTop: idx > 0 ? `1px solid ${DIVIDER}` : undefined,
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block" style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>
                  {c.name}
                </span>
                <span className="block" style={{ fontSize: 9.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
                  {formatMoney(c.limit, { withCurrency: true })}
                </span>
              </span>
              <Toggle
                value={c.enabled}
                ariaLabel={c.name}
                onChange={(next) =>
                  setCats((prev) => prev.map((x) => (x.id === c.id ? { ...x, enabled: next } : x)))
                }
              />
            </div>
          ))}
        </GlassCard>

        {/* Уведомления. */}
        <SectionCap label={m.limitsNotifyCap} />
        <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
          {[
            { label: m.limitsNotifyOps, value: notifyOps, set: setNotifyOps },
            { label: m.limitsNotifyLimit, value: notifyLimit, set: setNotifyLimit },
          ].map((row, idx) => (
            <div
              key={row.label}
              className="flex items-center"
              style={{
                gap: 10,
                paddingTop: 12,
                paddingBottom: 12,
                borderTop: idx > 0 ? `1px solid ${DIVIDER}` : undefined,
              }}
            >
              <span className="min-w-0 flex-1" style={{ fontSize: 11.5, fontWeight: 700, color: ink1 }}>
                {row.label}
              </span>
              <Toggle value={row.value} ariaLabel={row.label} onChange={row.set} />
            </div>
          ))}
        </GlassCard>

        <PrimaryButton label={m.limitsSave} onClick={() => setSoon(true)} />
        {soon ? <SoonNote text={SOON_PAYMENTS} /> : null}
      </ScreenScroll>
    </div>
  );
}
