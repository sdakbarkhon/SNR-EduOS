"use client";

/**
 * Разметка «Кошелька ребёнка».
 *
 * Блоки как в мобильном экране: непрозрачная карточка баланса с именем
 * ребёнка, быстрые действия, итоги периода, последние операции.
 * Действия ведут на соседние экраны — пополнение и все операции; ни одно из
 * них ничего не списывает. (27.08.2026: действий стало два вместо четырёх —
 * «перевод» и «лимиты» удалены вместе с экранами.)
 */

import Link from "next/link";
import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { WalletOpDay } from "../../_demo/demo-data";
import { formatMoney, walletTitleOf } from "../../_demo/demo-data";
import { GlassCard } from "../../v2/GlassCard";
import { Glyph, ICON, InnerHeader, ScreenScroll, SectionCap, grad135 } from "../../_ui/screen-kit";
import { SoonNote } from "../parts";
import { DIVIDER } from "../../_ui/screen-tokens";
import { useDates } from "../../_ui/dates";
import { addDaysKey } from "../../_ui/format";
import { ink1, ink2, ink3, radius, shCard } from "../../v2/tokens";

const BALANCE_CARD: readonly [string, string] = ["#7C3AED", "#A855F7"];

/**
 * Быстрые действия под балансом.
 *
 * 27.08.2026: было четыре, стало два. «Перевод между детьми» снят заказчиком —
 * по утверждённой модели деньги между балансами детей не ходят вовсе.
 * «Лимиты» противоречат модели: баланс минус счёт за обучение, ограничивать
 * нечего. Оба экрана удалены целиком, а не спрятаны за условием: спрятанный
 * мёртвый код через полгода принимают за рабочий.
 */
const ACTIONS = [
  { key: "topUp", href: "/parent/payments/top-up", paths: ICON.wallet },
  { key: "ops", href: "/parent/payments/wallet/ops", paths: ICON.doc },
] as const;

export function WalletView({
  balance,
  days,
  totals,
  childName,
  today,
}: {
  balance: number;
  days: WalletOpDay[];
  totals: { spent: number; topped: number; opsCount: number };
  childName: string | null;
  today: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more3;
  const dt = useDates();

  const actionLabel: Record<string, string> = {
    topUp: m.walletTopUp,
    ops: m.walletOps,
  };

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={d.scr.childWallet} backHref="/parent/payments" />

      <ScreenScroll>
        {/* Баланс. */}
        <div
          style={{
            borderRadius: radius.card,
            background: grad135(BALANCE_CARD),
            boxShadow: shCard,
            padding: 16,
          }}
        >
          <span
            className="block"
            style={{
              fontSize: 8.5,
              fontWeight: 800,
              letterSpacing: 0.7,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.82)",
            }}
          >
            {walletTitleOf(childName)}
          </span>
          <div className="flex items-end" style={{ gap: 10, marginTop: 10 }}>
            <span style={{ fontSize: 27, fontWeight: 800, color: "#FFFFFF", lineHeight: 1 }}>
              {formatMoney(balance)}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)", paddingBottom: 2 }}>
              {m.walletBalance.toLowerCase()}
            </span>
          </div>
        </div>

        {/* Быстрые действия. */}
        <div className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          {ACTIONS.map((a) => (
            <Link
              key={a.key}
              href={a.href}
              className="flex flex-col items-center"
              style={{ gap: 6 }}
            >
              <span
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 44,
                  height: 44,
                  background: "rgba(124,58,237,0.10)",
                  border: "1px solid rgba(124,58,237,0.22)",
                }}
              >
                <Glyph paths={a.paths} size={18} color="#7C3AED" strokeWidth={1.8} />
              </span>
              <span className="text-center" style={{ fontSize: 9, fontWeight: 700, color: ink2 }}>
                {actionLabel[a.key]}
              </span>
            </Link>
          ))}
        </div>

        {/* Итоги показанного периода. */}
        <GlassCard radius={22} style={{ padding: 14 }}>
          <div className="flex">
            {[
              { cap: m.walletSpent, value: formatMoney(totals.spent) },
              { cap: m.walletTopped, value: formatMoney(totals.topped) },
              { cap: m.walletOpsCount, value: String(totals.opsCount) },
            ].map((c, i) => (
              <div
                key={c.cap}
                className="flex flex-1 flex-col items-center"
                style={{ gap: 4, borderLeft: i > 0 ? `1px solid ${DIVIDER}` : undefined }}
              >
                <span style={{ fontSize: 14, fontWeight: 800, color: ink1 }}>{c.value}</span>
                <span
                  className="text-center"
                  style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", color: ink3 }}
                >
                  {c.cap}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        <SoonNote text={m.walletDemoNote} />

        <SectionCap label={m.walletRecentCap} />

        <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
          {days.map((day, di) => (
            <div key={day.daysAgo}>
              <span
                className="block"
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: ink3,
                  paddingTop: di > 0 ? 12 : 10,
                  paddingBottom: 4,
                  borderTop: di > 0 ? `1px solid ${DIVIDER}` : undefined,
                }}
              >
                {dt.dayLabel(addDaysKey(today, -day.daysAgo), today)}
              </span>
              {day.ops.map((op, i) => (
                <div
                  key={op.id}
                  className="flex items-center"
                  style={{
                    gap: 11,
                    paddingTop: 10,
                    paddingBottom: 10,
                    borderTop: i > 0 ? `1px solid ${DIVIDER}` : undefined,
                  }}
                >
                  <span
                    className="flex shrink-0 items-center justify-center"
                    style={{ width: 34, height: 34, borderRadius: 11, background: grad135(op.gradient) }}
                  >
                    <Glyph
                      paths={op.direction === "in" ? ICON.wallet : ICON.card}
                      size={15}
                      color="#FFFFFF"
                      strokeWidth={1.9}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>
                      {op.title}
                    </span>
                    <span className="block" style={{ fontSize: 9.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
                      {`${op.via} · ${op.time}`}
                    </span>
                  </span>
                  <span
                    className="shrink-0"
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color:
                        op.direction === "in"
                          ? "var(--p-status-green-text, #047857)"
                          : "var(--p-status-red-text, #B91C1C)",
                    }}
                  >
                    {`${op.direction === "in" ? "+" : "−"}${formatMoney(op.amount)}`}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </GlassCard>
      </ScreenScroll>
    </div>
  );
}
