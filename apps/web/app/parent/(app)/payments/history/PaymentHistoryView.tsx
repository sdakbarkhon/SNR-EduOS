"use client";

/**
 * Экран «История оплат» (d20).
 *
 * 27.08.2026, ЗАХОД 4 ПО ПЛАТЕЖАМ — ЭКРАН ПЕРЕВЕДЁН НА НАСТОЯЩИЕ ДАННЫЕ и
 * переписан. Показывает журнал движений по балансу ребёнка
 * (`balance_entries`, миграции 227/229): пополнения, погашения счетов,
 * поправки школы, возвраты. Раньше здесь лежали выдуманные платежи.
 *
 * ЧЕТЫРЁХ ФИЛЬТРОВ «Все / Обучение / Питание / Другое» БОЛЬШЕ НЕТ. Они делили
 * выдуманные платежи по выдуманным категориям; у настоящего движения категории
 * нет вовсе — есть ВИД (`kind`), и видов ровно четыре, причём «питание» среди
 * них не значится: школьного кошелька в схеме не существует. Фильтр по полю,
 * которого нет, — обещание, которого мы не сдержим.
 *
 * ЗНАК СУММЫ БЕРЁТСЯ ИЗ ДАННЫХ, А НЕ ИЗ ВИДА. В журнале пополнение
 * положительное, погашение отрицательное — так его и рисуем. Считать знак по
 * виду значило бы завести второе правило рядом с первым.
 *
 * Строки никуда не ведут: экрана деталей движения не спроектировано, а шеврон
 * без перехода — обещание в никуда.
 */

import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { ChildBalanceEntry } from "@/lib/parent-queries";
import { GlassCard } from "../../v2/GlassCard";
import { EmptyState, ICON, IconTile, ScreenScroll, SectionCap } from "../../_ui/screen-kit";
import { ink1, ink2, ink3, status } from "../../v2/tokens";
import { formatMoney, rowNote } from "../../_demo/demo-data";
import { useDates } from "../../_ui/dates";

/** Вид движения → как он выглядит. Ключи — значения `balance_entry_kind`
 *  из миграции 227, других не бывает. */
const KIND_VISUAL: Record<
  ChildBalanceEntry["kind"],
  { gradient: readonly [string, string]; paths: readonly string[] }
> = {
  topup: { gradient: ["#34d399", "#059669"], paths: ICON.wallet },
  adjustment: { gradient: ["#34d399", "#059669"], paths: ICON.wallet },
  invoice_charge: { gradient: ["#a78bfa", "#7c3aed"], paths: ICON.doc },
  refund: { gradient: ["#fbbf24", "#f97316"], paths: ICON.clock },
};

function EntryCard({
  kind,
  title,
  note,
  timeLabel,
  amount,
}: {
  kind: ChildBalanceEntry["kind"];
  title: string;
  note: string | null;
  timeLabel: string;
  amount: number;
}) {
  const visual = KIND_VISUAL[kind];
  const negative = amount < 0;
  return (
    <GlassCard variant="glass2" radius={16} style={{ padding: 12 }}>
      <div className="flex items-center" style={{ gap: 10 }}>
        <IconTile gradient={visual.gradient} paths={visual.paths} size={38} glyphSize={18} />
        <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 1 }}>
          <span className="min-w-0 truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
            {title}
          </span>
          {note ? (
            <span className="truncate" style={{ fontSize: 9.5, fontWeight: 700, color: ink3 }}>
              {note}
            </span>
          ) : null}
          <span style={{ fontSize: 9, fontWeight: 700, color: ink3, marginTop: 2 }}>
            {timeLabel}
          </span>
        </div>
        <span
          className="shrink-0"
          style={{
            fontSize: 12.5,
            fontWeight: 800,
            color: negative ? ink1 : status.green.text,
          }}
        >
          {negative ? "−" : "+"}
          {formatMoney(Math.abs(amount), { withCurrency: true })}
        </span>
      </div>
    </GlassCard>
  );
}

export function PaymentHistoryView({
  entries,
  failed,
  who,
}: {
  entries: ChildBalanceEntry[];
  /** Прочитать не удалось — это НЕ «движений нет». */
  failed: boolean;
  /** «Шерзод · 10-А» — подпись строк, чтобы у родителя с двумя детьми было
   *  видно, чей это журнал. */
  who: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const p2 = d.parentApp.pay2;
  const dates = useDates();

  const titleOf = (kind: ChildBalanceEntry["kind"]) => {
    if (kind === "invoice_charge") return p2.tuitionInvoice;
    if (kind === "refund") return p2.historyRefunds;
    return p2.historyTotal;
  };

  // Группировка по месяцу движения: «ИЮЛЬ 2026» над своими строками.
  const groups: Array<{ key: string; label: string; rows: ChildBalanceEntry[] }> = [];
  for (const row of entries) {
    const dt = new Date(row.created_at);
    const key = `${dt.getFullYear()}-${dt.getMonth() + 1}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else groups.push({ key, label: dates.monthYear(dt.getFullYear(), dt.getMonth() + 1), rows: [row] });
  }

  const toppedUp = entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const spent = entries.filter((e) => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);

  if (failed) {
    return (
      <ScreenScroll gap={11}>
        <EmptyState title={p2.loadFailed} />
      </ScreenScroll>
    );
  }

  if (entries.length === 0) {
    return (
      <ScreenScroll gap={11}>
        <EmptyState title={p2.historyEmpty} />
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll gap={11}>
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col" style={{ gap: 11 }}>
          <SectionCap label={group.label} tone="ink3" />
          {group.rows.map((row) => (
            <EntryCard
              key={row.id}
              kind={row.kind}
              title={titleOf(row.kind)}
              note={rowNote(who, row.note ?? "")}
              timeLabel={dates.dateTime(row.created_at)}
              amount={row.amount}
            />
          ))}
        </div>
      ))}

      {/* Итоги — по тем же строкам, что выше: складывать нечего, кроме них. */}
      <GlassCard variant="glass2" radius={18} style={{ padding: 14 }}>
        <div className="flex items-center justify-between" style={{ gap: 12 }}>
          <div className="flex flex-col" style={{ gap: 2 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: ink2 }}>{p2.historyTotal}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: ink1 }}>
              {formatMoney(toppedUp, { withCurrency: true })}
            </span>
          </div>
          <div className="flex flex-col items-end" style={{ gap: 2 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: ink2 }}>{p2.historyNet}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: ink1 }}>
              {formatMoney(spent, { withCurrency: true })}
            </span>
          </div>
        </div>
      </GlassCard>
    </ScreenScroll>
  );
}
