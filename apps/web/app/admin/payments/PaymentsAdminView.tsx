"use client";

/**
 * Раздел «Оплаты» в админке школы. Заход 5 по платежам.
 *
 * Два списка на одном экране, и это не экономия места:
 *   * «Счета школы» — что выставлено, что оплачено, что открыто;
 *   * «Без счёта — и почему» — кому счёт выставить не из чего.
 * Второй объясняет дыры в первом, и читать их порознь бессмысленно.
 *
 * МЕСЯЦ ПИШЕТСЯ КАК «07.2026», а не словом. Названий месяцев в админском
 * словаре нет, а `toLocaleDateString` без часового пояса в этом проекте уже
 * давал сдвиг на день. Резать строку `YYYY-MM-DD` — единственный способ, у
 * которого нет ни того, ни другого риска.
 *
 * ПОДТВЕРЖДЕНИЕ ПЕРЕД ВЫСТАВЛЕНИЕМ СПРАШИВАЕТ ЧИСЛА У СЕРВЕРА В МОМЕНТ
 * НАЖАТИЯ, а не берёт их из уже отрисованной страницы: между открытием экрана
 * и нажатием админ мог вписать цену классу, и счетов стало бы больше, чем
 * обещало окно.
 */

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Wallet, Pencil, Ban, RotateCcw, X } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { unwrap } from "@/lib/action-result";
import { formatCoursePriceInput, formatSum } from "@/lib/course-price";
import type { InvoiceBlockerRow, SchoolInvoiceRow } from "@/lib/admin-payments";
import {
  actionAdjustInvoice,
  actionCancelInvoice,
  actionIssueInvoicesNow,
  actionIssuePreview,
  actionRestoreInvoice,
} from "./actions";

type AdminDict = ReturnType<typeof getDictionary>["admin"];

/** «2026-07-01» → «07.2026». Без часовых поясов и без имён месяцев. */
function monthLabel(periodMonth: string): string {
  const [y, m] = periodMonth.split("-");
  return m && y ? `${m}.${y}` : periodMonth;
}

function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {children}
    </div>,
    document.body,
  );
}

function ModalCard({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
    />
  );
}

function StatusChip({ row, t }: { row: SchoolInvoiceRow; t: AdminDict }) {
  const map = {
    open: { label: t.invoiceOpen, cls: "bg-amber-50 text-amber-700 ring-amber-200" },
    paid: { label: t.invoicePaid, cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    canceled: { label: t.invoiceCanceled, cls: "bg-gray-100 text-gray-500 ring-gray-200" },
  }[row.status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${map.cls}`}>
      {map.label}
    </span>
  );
}

type Modal =
  | { kind: "none" }
  | { kind: "issue"; month: string; issue: number; skip: number; amount: number }
  | { kind: "adjust"; row: SchoolInvoiceRow }
  | { kind: "cancel"; row: SchoolInvoiceRow };

export function PaymentsAdminView({
  invoices,
  blockers,
  /**
   * Школа, в которой идёт работа. Срез 3d, роль менеджера.
   *
   * НЕ ПЕРЕДАНА — ничего не меняется: формы уходят байт в байт прежними,
   * доводы прежние, школу берут из строки вошедшего админа. Так работает
   * админ школы, и его экран не тронут.
   *
   * ПЕРЕДАНА — школа кладётся в каждую форму и в каждый довод. Так работает
   * менеджер: своей школы у него нет, и подставить её некому.
   */
  schoolId,
}: {
  invoices: SchoolInvoiceRow[];
  blockers: InvoiceBlockerRow[];
  schoolId?: string;
}) {
  /** Дописать школу в форму. Без неё форма остаётся прежней. */
  const сШколой = (fd: FormData) => {
    if (schoolId) fd.set("school_id", schoolId);
    return fd;
  };

  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.admin;

  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();

  function flash(msg: string) {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(null), 6000);
  }
  const fail = (e: unknown) => flash(humanizeAdminError(e, locale as Locale));

  const reasonLabel: Record<InvoiceBlockerRow["reason"], string> = {
    no_price: t.reasonNoPrice,
    many_groups: t.reasonManyGroups,
    no_group: t.reasonNoGroup,
  };

  /** Спрашиваем у сервера, что случится, и только потом показываем окно. */
  function openIssue() {
    startTransition(async () => {
      try {
        const p = await unwrap(actionIssuePreview(schoolId));
        if (p.will_issue === 0) {
          flash(t.paymentsIssueNothing.replace("{month}", monthLabel(p.invoice_month)));
          return;
        }
        setModal({
          kind: "issue",
          month: monthLabel(p.invoice_month),
          issue: p.will_issue,
          skip: p.will_skip,
          amount: p.total_amount,
        });
      } catch (e) { fail(e); }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">{t.paymentsTitle}</h1>
        <button
          onClick={openIssue}
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
        >
          <Wallet className="h-4 w-4" />
          {isPending ? t.paymentsIssuing : t.paymentsIssueBtn}
        </button>
      </div>

      {flashMsg && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
          {flashMsg}
        </div>
      )}

      {/* ── Счета школы ──────────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="border-b border-gray-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {t.paymentsInvoicesCap}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">{t.tableStudent}</th>
                <th className="px-4 py-3">{t.tableGroup}</th>
                <th className="px-4 py-3">{t.tableMonth}</th>
                <th className="px-4 py-3">{t.tableAmount}</th>
                <th className="px-4 py-3">{t.tableInvoiceStatus}</th>
                <th className="px-4 py-3">{t.tableBalance}</th>
                <th className="px-4 py-3 text-right">{t.tableActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="text-gray-500">{t.paymentsEmptyInvoices}</div>
                    <div className="mt-1 text-xs text-gray-400">{t.paymentsEmptyInvoicesHint}</div>
                  </td>
                </tr>
              ) : (
                invoices.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-800">{row.student_name}</td>
                    <td className="px-4 py-3 text-gray-500">{row.group_name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{monthLabel(row.period_month)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-800">
                      {formatSum(row.amount)} {t.sumUnit}
                      {row.amount_source === "admin_adjusted" && (
                        <div className="text-[11px] font-normal text-gray-400">
                          {t.invoiceAdjusted}
                          {row.adjust_reason ? `: ${row.adjust_reason}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusChip row={row} t={t} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {formatSum(row.balance)} {t.sumUnit}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {row.status === "open" && (
                          <>
                            <button
                              onClick={() => { setAmount(formatSum(row.amount)); setModal({ kind: "adjust", row }); }}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-violet-50 hover:text-violet-600"
                              title={t.adjustInvoiceBtn}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setModal({ kind: "cancel", row })}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              title={t.cancelInvoiceBtn}
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {row.status === "canceled" && (
                          <button
                            onClick={() => startTransition(async () => {
                              try {
                                await unwrap(actionRestoreInvoice(row.id, schoolId));
                                flash(t.invoiceRestoredMsg);
                              } catch (e) { fail(e); }
                            })}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
                            title={t.restoreInvoiceBtn}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Без счёта — и почему ─────────────────────────────────────────── */}
      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="border-b border-gray-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {t.paymentsBlockersCap}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">{t.tableStudent}</th>
                <th className="px-4 py-3">{t.tableMonth}</th>
                <th className="px-4 py-3">{t.tableReason}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {blockers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center">
                    <div className="text-gray-500">{t.paymentsEmptyBlockers}</div>
                    <div className="mt-1 text-xs text-gray-400">{t.paymentsAllBilled}</div>
                  </td>
                </tr>
              ) : (
                blockers.map((row) => (
                  <tr key={row.student_id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-800">{row.full_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{monthLabel(row.period_month)}</td>
                    <td className="px-4 py-3 text-gray-500">{reasonLabel[row.reason]}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Подтверждение выставления ────────────────────────────────────── */}
      {modal.kind === "issue" && (
        <Backdrop onClose={() => setModal({ kind: "none" })}>
          <ModalCard
            title={t.paymentsIssueTitle.replace("{month}", modal.month)}
            onClose={() => setModal({ kind: "none" })}
          >
            <p className="mb-6 text-sm text-gray-600">
              {t.paymentsIssueBody
                .replace("{issue}", String(modal.issue))
                .replace("{amount}", formatSum(modal.amount))
                .replace("{skip}", String(modal.skip))}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setModal({ kind: "none" })}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                {t.cancelBtn}
              </button>
              <button
                disabled={isPending}
                onClick={() => startTransition(async () => {
                  try {
                    const r = await unwrap(actionIssueInvoicesNow(schoolId));
                    flash(t.paymentsIssuedMsg
                      .replace("{issued}", String(r.issued))
                      .replace("{skipped}", String(r.skipped)));
                    setModal({ kind: "none" });
                  } catch (e) { fail(e); }
                })}
                className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {isPending ? t.paymentsIssuing : t.paymentsIssueBtn}
              </button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* ── Правка суммы ─────────────────────────────────────────────────── */}
      {modal.kind === "adjust" && (
        <Backdrop onClose={() => setModal({ kind: "none" })}>
          <ModalCard
            title={t.adjustInvoiceTitle
              .replace("{name}", modal.row.student_name)
              .replace("{month}", monthLabel(modal.row.period_month))}
            onClose={() => setModal({ kind: "none" })}
          >
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("invoice_id", modal.row.id);
                startTransition(async () => {
                  try {
                    await unwrap(actionAdjustInvoice(сШколой(fd)));
                    flash(t.invoiceAdjustedMsg);
                    setModal({ kind: "none" });
                  } catch (err) { fail(err); }
                });
              }}
            >
              <Field label={t.fieldInvoiceAmount}>
                <Input
                  name="amount"
                  value={amount}
                  onChange={(e) => setAmount(formatCoursePriceInput(e.target.value))}
                  inputMode="numeric"
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label={t.fieldInvoiceReason}>
                <Input name="reason" required placeholder={t.invoiceReasonPlaceholder} />
              </Field>
              <p className="text-xs text-gray-400">{t.adjustInvoiceHint}</p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal({ kind: "none" })}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {isPending ? "…" : t.adjustInvoiceSave}
                </button>
              </div>
            </form>
          </ModalCard>
        </Backdrop>
      )}

      {/* ── Отмена счёта ─────────────────────────────────────────────────── */}
      {modal.kind === "cancel" && (
        <Backdrop onClose={() => setModal({ kind: "none" })}>
          <ModalCard
            title={t.cancelInvoiceTitle
              .replace("{name}", modal.row.student_name)
              .replace("{month}", monthLabel(modal.row.period_month))}
            onClose={() => setModal({ kind: "none" })}
          >
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("invoice_id", modal.row.id);
                startTransition(async () => {
                  try {
                    await unwrap(actionCancelInvoice(сШколой(fd)));
                    flash(t.invoiceCanceledMsg);
                    setModal({ kind: "none" });
                  } catch (err) { fail(err); }
                });
              }}
            >
              <Field label={t.fieldInvoiceReason}>
                <Input name="reason" required placeholder={t.invoiceReasonPlaceholder} />
              </Field>
              <p className="text-xs text-gray-400">{t.cancelInvoiceHint}</p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal({ kind: "none" })}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isPending ? "…" : t.cancelInvoiceBtn}
                </button>
              </div>
            </form>
          </ModalCard>
        </Backdrop>
      )}
    </div>
  );
}
