"use client";

/** Разметка «Операций кошелька»: фильтр + список по дням. Данные выдуманные,
 *  плашка над списком говорит об этом прямо. */

import { useMemo, useState } from "react";
import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { WalletOpDay } from "../../../_demo/demo-data";
import { formatMoney } from "../../../_demo/demo-data";
import { GlassCard } from "../../../v2/GlassCard";
import {
  EmptyState,
  Glyph,
  ICON,
  InnerHeader,
  ScreenScroll,
  SegmentPills,
  grad135,
} from "../../../_ui/screen-kit";
import { SoonNote } from "../../parts";
import { DIVIDER } from "../../../_ui/screen-tokens";
import { useDates } from "../../../_ui/dates";
import { addDaysKey } from "../../../_ui/format";
import { ink1, ink2, ink3 } from "../../../v2/tokens";

type Filter = "all" | "out" | "in";

export function WalletOpsView({
  days,
  totals,
  today,
}: {
  days: WalletOpDay[];
  totals: { spent: number; topped: number; opsCount: number };
  today: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more3;
  const dt = useDates();
  const [filter, setFilter] = useState<Filter>("all");

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: m.opsFilterAll },
    { key: "out", label: m.opsFilterOut },
    { key: "in", label: m.opsFilterIn },
  ];

  const shown = useMemo(
    () =>
      days
        .map((day) => ({
          ...day,
          ops: filter === "all" ? day.ops : day.ops.filter((o) => o.direction === filter),
        }))
        .filter((day) => day.ops.length > 0),
    [days, filter],
  );

  const activeIndex = Math.max(0, FILTERS.findIndex((f) => f.key === filter));

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={d.scr.walletOps} backHref="/parent/payments/wallet" />

      <ScreenScroll>
        <SegmentPills
          items={FILTERS.map((f) => f.label)}
          activeIndex={activeIndex}
          onChange={(i) => setFilter(FILTERS[i]?.key ?? "all")}
        />

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

        {shown.length === 0 ? (
          <GlassCard radius={22}>
            <EmptyState title={m.opsEmptyTitle} text={m.opsEmptyText} paths={ICON.wallet} />
          </GlassCard>
        ) : (
          shown.map((day) => (
            <div key={day.daysAgo} className="flex flex-col" style={{ gap: 7 }}>
              <span
                style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", color: ink3 }}
              >
                {dt.dayLabel(addDaysKey(today, -day.daysAgo), today)}
              </span>
              <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
                {day.ops.map((op, i) => (
                  <div
                    key={op.id}
                    className="flex items-center"
                    style={{
                      gap: 11,
                      paddingTop: 11,
                      paddingBottom: 11,
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
              </GlassCard>
            </div>
          ))
        )}
      </ScreenScroll>
    </div>
  );
}
