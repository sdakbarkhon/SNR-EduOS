"use client";

/**
 * Экран «История оплат» (d20) — веб-порт
 * apps/mobile-parent/src/screens/payments/PaymentHistoryScreen.tsx (макет
 * «SNR EduOS v2 Light.dc.html», строки 969–994).
 *
 * Композиция:
 *  1. Четыре чипа-фильтра «Все / Обучение / Питание / Другое» (SegmentPills
 *     из общего screen-kit — в мобилке этот компонент был продублирован
 *     вручную внутри экрана, в вебе он уже есть в ките).
 *  2. Группы по месяцам: заголовок «ИЮЛЬ 2026» + карточки-строки.
 *     Строка: плитка категории 38, название + дата, подпись, статус
 *     «Успешно»/«Возврат» и сумма (возврат — красный, со знаком «−»).
 *  3. Фиолетовая сводная карточка: всего оплат / списано / возвраты.
 *
 * Единственный интерактив — фильтр (как в мобилке): строки истории никуда не
 * ведут, детали платежа отдельным экраном не спроектированы. Пустой результат
 * фильтра показывает EmptyState вместо молчаливо пустого экрана.
 */

import { useState } from "react";
import { GlassCard } from "../../v2/GlassCard";
import {
  EmptyState,
  IconTile,
  ScreenScroll,
  SectionCap,
  SegmentPills,
  WHITE,
} from "../../_ui/screen-kit";
import { ink1, ink2, ink3, status } from "../../v2/tokens";
import {
  PAYMENT_HISTORY,
  PAY_VISUAL,
  formatMoney,
  historyTotals,
  rowNote,
  type HistoryCategory,
  type HistoryRow,
} from "../../_demo/demo-data";

/** Порядок важен: индекс SegmentPills → категория. */
const FILTERS: readonly { key: HistoryCategory | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "edu", label: "Обучение" },
  { key: "food", label: "Питание" },
  { key: "other", label: "Другое" },
];

function HistoryCard({ row, who }: { row: HistoryRow; who: string }) {
  const visual = PAY_VISUAL[row.visual];
  const sumColor = row.isRefund ? status.red.text : ink1;
  const stateColor = row.isRefund ? status.red.text : status.green.text;

  return (
    <GlassCard radius={18} style={{ padding: "11px 13px" }}>
      <div className="flex items-start" style={{ gap: 11 }}>
        <IconTile gradient={visual.gradient} paths={visual.paths} size={38} glyphSize={16} />
        <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 1 }}>
          <div className="flex items-center justify-between" style={{ gap: 8 }}>
            <span className="min-w-0 truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
              {row.title}
            </span>
            <span className="shrink-0" style={{ fontSize: 9, fontWeight: 700, color: ink3 }}>
              {row.dateLabel}
            </span>
          </div>
          <span className="truncate" style={{ fontSize: 10, fontWeight: 600, color: ink2 }}>
            {rowNote(who, row.via)}
          </span>
          <div className="flex items-center justify-between" style={{ gap: 8, marginTop: 2 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: stateColor }}>
              {row.isRefund ? "Возврат" : "Успешно"}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: sumColor }}>
              {row.isRefund ? "−" : ""}
              {formatMoney(row.amount, { withCurrency: true })}
            </span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

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

export function PaymentHistoryView({ isDemo: _isDemo, who }: {
  /**
   * Демо ли смотрящий (`schools.is_demo`, заход 1 по оплатам). ПОКА НЕ
   * ИСПОЛЬЗУЕТСЯ И ЭТО НАМЕРЕННО: заход 1 только доводит признак до экрана,
   * ветвиться будет заход 2, когда деньги переедут на настоящие счета. До
   * тех пор заготовка видна обоим — и гостю, и настоящему родителю.
   */
  isDemo: boolean;
  who: string;
}) {
  const [filterIndex, setFilterIndex] = useState(0);
  const activeKey = FILTERS[filterIndex]?.key ?? "all";

  const months = PAYMENT_HISTORY.map((month) => ({
    ...month,
    rows: month.rows.filter((row) => activeKey === "all" || row.category === activeKey),
  })).filter((month) => month.rows.length > 0);

  const totals = historyTotals();

  return (
    <ScreenScroll gap={11}>
      <SegmentPills
        items={FILTERS.map((f) => f.label)}
        activeIndex={filterIndex}
        onChange={setFilterIndex}
      />

      {months.length === 0 ? (
        <GlassCard radius={20}>
          <EmptyState
            title="Оплат в этой категории нет"
            text="За июнь и июль 2026 по выбранной категории платежей не было. Выберите «Все», чтобы увидеть всю историю."
          />
        </GlassCard>
      ) : null}

      {months.map((month) => (
        <div key={month.id} className="flex flex-col" style={{ gap: 11 }}>
          <SectionCap label={month.label} />
          {month.rows.map((row) => (
            <HistoryCard key={row.id} row={row} who={who} />
          ))}
        </div>
      ))}

      {/* Сводка за весь период — не зависит от фильтра (как в мобилке). */}
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
          <TotalsColumn label="Всего оплат" value={formatMoney(totals.total)} />
          <span aria-hidden style={{ width: 1, background: "rgba(255,255,255,0.2)" }} />
          <TotalsColumn label="Списано" value={formatMoney(totals.net)} />
          <span aria-hidden style={{ width: 1, background: "rgba(255,255,255,0.2)" }} />
          <TotalsColumn label="Возвраты" value={formatMoney(totals.refunds)} />
        </div>
      </div>
    </ScreenScroll>
  );
}
