"use client";

/**
 * Экран «Счета» (d21).
 *
 * 27.08.2026, ЗАХОД 4 ПО ПЛАТЕЖАМ — ЭКРАН ПЕРЕВЕДЁН НА НАСТОЯЩИЕ СЧЕТА и
 * переписан. Счета приходят из `tuition_invoices` (миграции 227/229) через
 * `childInvoices()`.
 *
 * ЧЕКИ УБРАНЫ ЦЕЛИКОМ, И ЭТО ГЛАВНОЕ. Раньше здесь было два таба, и в табе
 * «Чеки» лежали ВЫДУМАННЫЕ фискальные документы — с номерами, суммами и
 * кнопкой «скачать». Поддельный чек хуже любой другой подделки на экране: это
 * финансовый документ, его несут бухгалтеру. Чеки выдаёт платёжная система,
 * которой нет, поэтому вместо них — прямая фраза о том, когда они появятся.
 *
 * Кнопки «скачать» тоже нет: скачивать нечего, файлов не существует. Кнопка,
 * которая на нажатие отвечает «пока нельзя», — та же «кнопка в никуда», от
 * которой мы избавлялись во всём разделе.
 *
 * Группы те же две, что и раньше по смыслу: «К оплате сейчас» и «Оплаченные».
 * Первая обязана показывать ровно те же счета и ту же сумму, что карточка
 * «К оплате сейчас» на /parent/payments — экран открывается оттуда ссылкой
 * «Смотреть все ›».
 */

import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { ChildInvoice } from "@/lib/parent-queries";
import { GlassCard } from "../../v2/GlassCard";
import { ICON, IconTile, ScreenScroll, SectionCap, StatusChip } from "../../_ui/screen-kit";
import { ink1, ink2, ink3 } from "../../v2/tokens";
import { formatMoney } from "../../_demo/demo-data";
import { useDates } from "../../_ui/dates";
import { NoticeBanner } from "../parts";

/** Плитка счёта: фиолетовый документ — тот же вид, что у строки счёта на
 *  корневом экране раздела. */
const INVOICE_GRADIENT: readonly [string, string] = ["#a78bfa", "#7c3aed"];

function InvoiceCard({
  title,
  subtitle,
  amountLabel,
  statusLabel,
  paid,
}: {
  title: string;
  subtitle: string | null;
  amountLabel: string;
  statusLabel: string;
  paid: boolean;
}) {
  return (
    <GlassCard variant="glass2" radius={16} style={{ padding: 12 }}>
      <div className="flex items-center" style={{ gap: 10 }}>
        <IconTile gradient={INVOICE_GRADIENT} paths={ICON.doc} size={38} glyphSize={18} />

        <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 1 }}>
          <span className="min-w-0 truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
            {title}
          </span>
          {subtitle ? (
            <span className="truncate" style={{ fontSize: 9.5, fontWeight: 700, color: ink3 }}>
              {subtitle}
            </span>
          ) : null}
          <div className="flex items-center" style={{ gap: 8, marginTop: 2 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>{amountLabel}</span>
            <StatusChip label={statusLabel} family={paid ? "green" : "orange"} fontSize={8.5} />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

export function InvoicesView({
  invoices,
  failed,
}: {
  invoices: ChildInvoice[];
  /** Прочитать не удалось — это НЕ то же самое, что «счетов нет». */
  failed: boolean;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const p2 = d.parentApp.pay2;
  const dates = useDates();

  /** «Июль 2026» из первого числа месяца, YYYY-MM-DD. */
  const monthLabel = (periodMonth: string) => {
    const [y, m] = periodMonth.split("-");
    return dates.monthYear(Number(y), Number(m));
  };

  const open = invoices.filter((i) => i.status === "open");
  const paid = invoices.filter((i) => i.status === "paid");
  const openTotal = open.reduce((sum, i) => sum + i.amount, 0);

  const groups: Array<{ id: string; label: string; note: string | null; rows: ChildInvoice[] }> = [
    {
      id: "open",
      label: p2.billsDueCap,
      note: open.length ? formatMoney(openTotal, { withCurrency: true }) : null,
      rows: open,
    },
    { id: "paid", label: p2.historyTotal, note: null, rows: paid },
  ].filter((g) => g.rows.length > 0);

  return (
    <ScreenScroll gap={11}>
      {failed ? (
        <GlassCard variant="glass2" radius={16} style={{ padding: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>{p2.loadFailed}</span>
        </GlassCard>
      ) : groups.length === 0 ? (
        // Пусто значит пусто — и объясняем, когда появится. Пустой белый экран
        // человек читает как поломку.
        <GlassCard variant="glass2" radius={16} style={{ padding: 14 }}>
          <div className="flex flex-col" style={{ gap: 4 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>{p2.billsEmpty}</span>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: ink2 }}>
              {p2.invoicesEmptyHint}
            </span>
          </div>
        </GlassCard>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="flex flex-col" style={{ gap: 11 }}>
            <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
              <SectionCap label={group.label} tone="ink3" />
              {group.note ? (
                <span className="shrink-0" style={{ fontSize: 9.5, fontWeight: 800, color: ink2 }}>
                  {group.note}
                </span>
              ) : null}
            </div>
            {group.rows.map((row) => (
              <InvoiceCard
                key={row.id}
                title={`${p2.tuitionInvoice} · ${monthLabel(row.period_month)}`}
                subtitle={row.amount_source === "admin_adjusted" ? p2.adjustedByAdmin : null}
                amountLabel={formatMoney(row.amount, { withCurrency: true })}
                statusLabel={row.status === "paid" ? p2.receiptPaid : p2.receiptUnpaid}
                paid={row.status === "paid"}
              />
            ))}
          </div>
        ))
      )}

      {/* Про чеки — прямо и без обещаний кнопкой. */}
      <NoticeBanner family="blue" text={p2.receiptsSoon} />
    </ScreenScroll>
  );
}
