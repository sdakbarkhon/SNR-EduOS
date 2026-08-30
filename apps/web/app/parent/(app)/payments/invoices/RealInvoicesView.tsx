"use client";

/**
 * «Счета» У НАСТОЯЩЕГО РОДИТЕЛЯ. Заход 3 по оплатам, 30.08.2026.
 *
 * Отдельный файл, развилка — в page.tsx. Файл витрины (InvoicesView.tsx) в
 * этом заходе не изменён ни строкой, и это проверяется составом коммита.
 *
 * ЧЕКОВ ЗДЕСЬ НЕТ, И ПЕРЕКЛЮЧАТЕЛЯ ТОЖЕ. У витрины два таба — «Чеки» и
 * «Счета». Чек выдаёт платёжная система, которой у школы нет, поэтому вкладка
 * убрана целиком: пустая вкладка обещает, что там что-то появится, а появиться
 * ему неоткуда. Осталась одна сущность — и переключатель из двух пилюль, где
 * вторая никуда не ведёт, стал бы бессмысленным элементом. Экран начинается
 * прямо со списка. Заголовок в шапке — «Счета», а не «Счета и чеки».
 *
 * КНОПКИ СКАЧИВАНИЯ ТОЖЕ НЕТ: файлов не существует (их формирует провайдер),
 * а круглая кнопка со стрелкой вниз — это обещание файла.
 *
 * СИНЕЙ ПЛАШКИ ПРО «ХРАНЯТСЯ В ЭЛЕКТРОННОМ ВИДЕ, МОЖНО СКАЧАТЬ В PDF» НЕТ:
 * скачать нельзя, на почту отправить нельзя. Обещание без исполнителя.
 *
 * ГРУППЫ — ПО СТАТУСУ, а не по сроку: срока у счёта в базе нет (в
 * `tuition_invoices` только месяц, сумма, статус и дата оплаты). Витринное
 * «К оплате сейчас / Позже» строится на выдуманных сроках макета.
 */

import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { formatSum } from "@/lib/course-price";
import type { ChildInvoice } from "@/lib/parent-queries";
import { GlassCard } from "../../v2/GlassCard";
import {
  EmptyState,
  ICON,
  IconTile,
  InnerHeader,
  ScreenScroll,
  SectionCap,
  StatusChip,
} from "../../_ui/screen-kit";
import { formatDateLong, monthYearLabel } from "../../_ui/format";
import { ink1, ink2, ink3, type StatusKey } from "../../v2/tokens";

/** «Август 2026» из period_month «2026-08-01». */
function invoiceMonth(periodMonth: string, locale: Locale): string {
  return monthYearLabel(
    Number(periodMonth.slice(0, 4)),
    Number(periodMonth.slice(5, 7)),
    locale,
  );
}

function InvoiceCard({
  invoice,
  chipLabel,
  chipFamily,
  note,
  monthLabel,
  title,
  dimmed,
}: {
  invoice: ChildInvoice;
  chipLabel: string;
  chipFamily: StatusKey;
  note: string | null;
  monthLabel: string;
  title: string;
  dimmed: boolean;
}) {
  return (
    <GlassCard variant="glass2" radius={16} style={{ padding: 12 }}>
      <div
        className="flex items-start"
        style={{ gap: 10, opacity: dimmed ? 0.6 : 1 }}
      >
        <IconTile
          gradient={["#a78bfa", "#7c3aed"]}
          paths={ICON.card}
          size={38}
          glyphSize={18}
        />
        <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 1 }}>
          <div className="flex items-center justify-between" style={{ gap: 8 }}>
            <span
              className="min-w-0 truncate"
              style={{ fontSize: 12, fontWeight: 800, color: ink1 }}
            >
              {title}
            </span>
            <span
              className="shrink-0"
              style={{ fontSize: 9, fontWeight: 700, color: ink3 }}
            >
              {monthLabel}
            </span>
          </div>
          {note ? (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                lineHeight: "14px",
                color: ink2,
              }}
            >
              {note}
            </span>
          ) : null}
          <div className="flex items-center" style={{ gap: 8, marginTop: 3 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>
              {formatSum(invoice.amount)}
            </span>
            <StatusChip label={chipLabel} family={chipFamily} fontSize={8.5} />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

export function RealInvoicesView({
  invoices,
  failed,
}: {
  /** Все счета ребёнка, новые сверху (childInvoices). */
  invoices: ChildInvoice[];
  failed: boolean;
}) {
  const { locale } = useLocale();
  const loc = locale as Locale;
  const d = getDictionary(loc).parentApp;
  const t = d.paymentsWeb;

  // Шапку рисует сам экран, а не страница: заголовок «Счета» берётся из
  // словаря, а серверная страница до словаря не дотягивается (см. page.tsx).
  const header = (
    <InnerHeader title={t.invoicesTitle} backHref="/parent/payments" />
  );

  if (failed) {
    // Сбой и «счетов нет» — разные вещи. Пустой список вместо ошибки был бы
    // правдоподобной ложью (признак failed заведён в parent-queries ровно
    // ради этого различия).
    return (
      <>
        {header}
        <ScreenScroll gap={11}>
          <GlassCard radius={20}>
            <EmptyState
              title={t.loadFailedTitle}
              text={t.loadFailedText}
              paths={ICON.info}
            />
          </GlassCard>
        </ScreenScroll>
      </>
    );
  }

  if (invoices.length === 0) {
    return (
      <>
        {header}
        <ScreenScroll gap={11}>
          <GlassCard radius={20}>
            <EmptyState
              title={t.noInvoicesTitle}
              text={t.noInvoicesText}
              paths={ICON.doc}
            />
          </GlassCard>
        </ScreenScroll>
      </>
    );
  }

  const open = invoices.filter((i) => i.status === "open");
  const paid = invoices.filter((i) => i.status === "paid");
  const canceled = invoices.filter((i) => i.status === "canceled");
  const openTotal = open.reduce((sum, i) => sum + i.amount, 0);

  /** Подпись под названием: изменённую школой сумму родитель обязан видеть. */
  const adjustNote = (inv: ChildInvoice): string | null => {
    if (inv.amount_source !== "admin_adjusted") return null;
    return inv.adjust_reason
      ? t.invoiceAdjusted.replace("{reason}", inv.adjust_reason)
      : t.invoiceAdjustedNoReason;
  };

  return (
    <>
      {header}
      <ScreenScroll gap={11}>
        {open.length > 0 ? (
          <div className="flex flex-col" style={{ gap: 11 }}>
            <div
              className="flex items-baseline justify-between"
              style={{ gap: 8 }}
            >
              <SectionCap label={t.invoicesOpenCap} tone="ink3" />
              {/* Итог группы — сумма ровно тех строк, что под ним: пересчитывается
                глазами и обязан совпасть с «К оплате» на корне раздела. */}
              <span
                className="shrink-0"
                style={{ fontSize: 9.5, fontWeight: 800, color: ink2 }}
              >
                {formatSum(openTotal)} {d.pay.sum}
              </span>
            </div>
            {open.map((inv) => (
              <InvoiceCard
                key={inv.id}
                invoice={inv}
                title={t.tuition}
                monthLabel={invoiceMonth(inv.period_month, loc)}
                chipLabel={t.invoiceUnpaid}
                chipFamily="orange"
                note={adjustNote(inv)}
                dimmed={false}
              />
            ))}
          </div>
        ) : null}

        {paid.length > 0 ? (
          <div className="flex flex-col" style={{ gap: 11 }}>
            <SectionCap label={t.invoicesPaidCap} tone="ink3" />
            {paid.map((inv) => (
              <InvoiceCard
                key={inv.id}
                invoice={inv}
                title={t.tuition}
                monthLabel={invoiceMonth(inv.period_month, loc)}
                // Дата оплаты в чипе, а не отдельной строкой: у оплаченного счёта
                // это главное, что отличает его от открытого.
                chipLabel={
                  inv.paid_at
                    ? t.invoicePaidOn.replace(
                        "{date}",
                        formatDateLong(inv.paid_at, loc),
                      )
                    : t.invoicePaid
                }
                chipFamily="green"
                note={adjustNote(inv)}
                dimmed={false}
              />
            ))}
          </div>
        ) : null}

        {canceled.length > 0 ? (
          <div className="flex flex-col" style={{ gap: 11 }}>
            <SectionCap label={t.invoicesCanceledCap} tone="ink3" />
            {canceled.map((inv) => (
              // Отменённый счёт не прячем: его отменил человек в школе, и родителю
              // честнее видеть, что счёт был и снят, чем не найти его вовсе.
              // Приглушён, чтобы не путался с долгом.
              <InvoiceCard
                key={inv.id}
                invoice={inv}
                title={t.tuition}
                monthLabel={invoiceMonth(inv.period_month, loc)}
                chipLabel={t.invoiceCanceled}
                chipFamily="gray"
                note={adjustNote(inv)}
                dimmed
              />
            ))}
          </div>
        ) : null}
      </ScreenScroll>
    </>
  );
}
