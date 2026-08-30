"use client";

/**
 * «История оплат» У НАСТОЯЩЕГО РОДИТЕЛЯ. Заход 3 по оплатам, 30.08.2026.
 *
 * Отдельный файл, развилка — в page.tsx. Файл витрины
 * (PaymentHistoryView.tsx) в этом заходе не изменён ни строкой.
 *
 * ИСТОЧНИК — ЖУРНАЛ ДВИЖЕНИЙ ПО БАЛАНСУ (`balance_entries`, миграция 227).
 * Журнал только пополняется: править и удалять записи запрещает триггер, даже
 * служебному ключу. Поэтому строка здесь — не «платёж», а движение: четыре
 * вида, и каждый со своим знаком, заданным проверкой в самой базе:
 *   topup           пополнение              всегда «+»
 *   invoice_charge  погашение счёта         всегда «−»
 *   refund          возврат                 всегда «−»
 *   adjustment      корректировка школы     знак любой
 *
 * ЧЕТЫРЁХ ФИЛЬТРОВ ВИТРИНЫ («Все / Обучение / Питание / Другое») ЗДЕСЬ НЕТ.
 * Это категории выдуманных платежей макета; в `balance_entries` категории нет
 * вовсе, а фильтровать по виду движения при списке из нескольких строк не по
 * чему. Экран — просто журнал по месяцам, новые сверху.
 *
 * СВОДКА ВНИЗУ ПОКАЗЫВАЕТСЯ НЕ ВСЕГДА. Она считается по строкам, которые
 * лежат на этом же экране, и врать не должна: `childBalanceEntries` берёт
 * последние 100 движений, и если их ровно столько — журнал, возможно, длиннее,
 * а итог был бы не итогом. Тогда сводка не рисуется. Три её колонки не
 * пересекаются: пополнено − списано − возвраты = баланс.
 */

import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { formatSum } from "@/lib/course-price";
import type { ChildBalanceEntry } from "@/lib/parent-queries";
import { GlassCard } from "../../v2/GlassCard";
import { EmptyState, ICON, IconTile, ScreenScroll, SectionCap, WHITE } from "../../_ui/screen-kit";
import { formatDateLong, monthYearLabel } from "../../_ui/format";
import { ink1, ink2, ink3, status } from "../../v2/tokens";

/** Вид движения → как он выглядит. Ключи — enum `balance_entry_kind` из 227. */
const KIND_VISUAL: Record<
  ChildBalanceEntry["kind"],
  { gradient: readonly [string, string]; paths: readonly string[] }
> = {
  topup: { gradient: ["#34d399", "#059669"], paths: ICON.wallet },
  invoice_charge: { gradient: ["#a78bfa", "#7c3aed"], paths: ICON.card },
  adjustment: { gradient: ["#60a5fa", "#2563eb"], paths: ICON.info },
  refund: { gradient: ["#f87171", "#ef4444"], paths: ICON.back },
};

function TotalsColumn({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
      <span
        style={{
          fontSize: 8,
          fontWeight: 800,
          letterSpacing: 0.48,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.75)",
        }}
      >
        {label}
      </span>
      <span className="truncate" style={{ fontSize: 12.5, fontWeight: 800, color: WHITE }}>
        {value}
      </span>
    </div>
  );
}

export function RealPaymentHistoryView({
  entries,
  failed,
  complete,
}: {
  /** Движения по балансу, новые сверху (childBalanceEntries). */
  entries: ChildBalanceEntry[];
  failed: boolean;
  /** false — список упёрся в предел выборки, итог считать нельзя. */
  complete: boolean;
}) {
  const { locale } = useLocale();
  const loc = locale as Locale;
  const d = getDictionary(loc).parentApp;
  const t = d.paymentsWeb;

  if (failed) {
    return (
      <ScreenScroll gap={11}>
        <GlassCard radius={20}>
          <EmptyState title={t.loadFailedTitle} text={t.loadFailedText} paths={ICON.info} />
        </GlassCard>
      </ScreenScroll>
    );
  }

  if (entries.length === 0) {
    // Сегодня это и есть настоящее состояние: никто не пополнял баланс, счета
    // с него не гасились. Пустой экран молча выглядел бы как поломка.
    return (
      <ScreenScroll gap={11}>
        <GlassCard radius={20}>
          <EmptyState title={t.historyEmptyTitle} text={t.historyEmptyText} paths={ICON.clock} />
        </GlassCard>
      </ScreenScroll>
    );
  }

  const kindLabel: Record<ChildBalanceEntry["kind"], string> = {
    topup: t.historyTopup,
    invoice_charge: t.historyCharge,
    adjustment: t.historyAdjust,
    refund: t.historyRefund,
  };

  // Группировка по месяцу движения. Порядок внутри и между группами — тот,
  // что пришёл из запроса (created_at по убыванию), поэтому пересортировка
  // не нужна: достаточно не ломать последовательность.
  const months: { key: string; label: string; rows: ChildBalanceEntry[] }[] = [];
  for (const entry of entries) {
    const key = entry.created_at.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.key === key) last.rows.push(entry);
    else {
      months.push({
        key,
        label: monthYearLabel(Number(key.slice(0, 4)), Number(key.slice(5, 7)), loc),
        rows: [entry],
      });
    }
  }

  const topped = entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const charged = entries
    .filter((e) => e.amount < 0 && e.kind !== "refund")
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const refunds = entries.filter((e) => e.kind === "refund").reduce((s, e) => s + Math.abs(e.amount), 0);

  return (
    <ScreenScroll gap={11}>
      {months.map((month) => (
        <div key={month.key} className="flex flex-col" style={{ gap: 11 }}>
          <SectionCap label={month.label} />
          {month.rows.map((entry) => {
            const visual = KIND_VISUAL[entry.kind];
            const positive = entry.amount > 0;
            return (
              <GlassCard key={entry.id} radius={18} style={{ padding: "11px 13px" }}>
                <div className="flex items-start" style={{ gap: 11 }}>
                  <IconTile gradient={visual.gradient} paths={visual.paths} size={38} glyphSize={16} />
                  <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 1 }}>
                    <div className="flex items-center justify-between" style={{ gap: 8 }}>
                      <span
                        className="min-w-0 truncate"
                        style={{ fontSize: 12, fontWeight: 800, color: ink1 }}
                      >
                        {kindLabel[entry.kind]}
                      </span>
                      <span className="shrink-0" style={{ fontSize: 9, fontWeight: 700, color: ink3 }}>
                        {formatDateLong(entry.created_at, loc)}
                      </span>
                    </div>
                    {entry.note ? (
                      <span className="truncate" style={{ fontSize: 10, fontWeight: 600, color: ink2 }}>
                        {entry.note}
                      </span>
                    ) : null}
                    <div className="flex justify-end" style={{ marginTop: 2 }}>
                      {/* Знак приходит из самой суммы: formatSum ставит «−»
                          отрицательной, «+» дописываем положительной. */}
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 800,
                          color: positive ? status.green.text : ink1,
                        }}
                      >
                        {positive ? "+" : ""}
                        {formatSum(entry.amount)} {d.pay.sum}
                      </span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      ))}

      {complete ? (
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: 20,
            background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
            boxShadow: "0 16px 36px rgba(91,33,182,0.35)",
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0"
            style={{ height: 1.5, background: "rgba(255,255,255,0.35)" }}
          />
          <div className="flex items-stretch" style={{ gap: 8, padding: 14 }}>
            <TotalsColumn label={t.historyToppedCap} value={formatSum(topped)} />
            <span aria-hidden style={{ width: 1, background: "rgba(255,255,255,0.2)" }} />
            <TotalsColumn label={t.historyChargedCap} value={formatSum(charged)} />
            <span aria-hidden style={{ width: 1, background: "rgba(255,255,255,0.2)" }} />
            <TotalsColumn label={t.historyRefundsCap} value={formatSum(refunds)} />
          </div>
        </div>
      ) : null}
    </ScreenScroll>
  );
}
