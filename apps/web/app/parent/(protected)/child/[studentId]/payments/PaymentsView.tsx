"use client";

import { getDictionary } from "@snr/core";
import type { Locale, Database, StudentStatus } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { ParentChild } from "@/lib/parent-child";

type Payment = Database["public"]["Tables"]["payments"]["Row"];
type Charge = Database["public"]["Tables"]["charges"]["Row"];

function formatUZS(n: number) {
  return Math.abs(n).toLocaleString("ru-RU");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function statusLabel(s: StudentStatus, d: ReturnType<typeof getDictionary>) {
  if (s === "active") return d.payments.statusActive;
  if (s === "debtor") return d.payments.statusDebtor;
  return d.payments.statusFrozen;
}

function statusColor(s: StudentStatus) {
  if (s === "active") return "#2DBE7E";
  if (s === "debtor") return "#F5455C";
  return "#F5A623";
}

function thisMonthTotal(items: Array<{ amount: number; dateField: string }>): number {
  const now = new Date();
  return items
    .filter((i) => {
      const dt = new Date(i.dateField);
      return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
    })
    .reduce((sum, i) => sum + i.amount, 0);
}

export function PaymentsView({
  child,
  payments,
  charges,
  balance,
  status,
}: {
  child: ParentChild;
  payments: Payment[];
  charges: Charge[];
  balance: number | null;
  status: StudentStatus | null;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  const paidMonth = thisMonthTotal(payments.map((p) => ({ amount: p.amount, dateField: p.paid_at })));
  const chargedMonth = thisMonthTotal(charges.map((c) => ({ amount: c.amount, dateField: c.charged_at })));
  const progressPct = paidMonth + chargedMonth === 0 ? 0 : Math.min(1, paidMonth / (paidMonth + chargedMonth));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{d.payments.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {child.full_name}
          {child.className ? ` · ${child.className}` : ""}
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-2 flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{d.payments.balance}</p>
          {status && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{ color: statusColor(status), backgroundColor: `${statusColor(status)}1A` }}
            >
              {statusLabel(status, d)}
            </span>
          )}
        </div>
        <p className={`text-4xl font-black ${balance != null && balance < 0 ? "text-red-500" : "text-gray-800"}`}>
          {balance != null ? `${balance < 0 ? "−" : ""}${formatUZS(balance)}` : "—"} UZS
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-base font-semibold text-gray-700">{d.payments.paymentStatusTitle}</h2>
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="text-gray-500">{d.payments.paidThisMonth}</span>
          <span className="font-semibold text-gray-800">{formatUZS(paidMonth)} UZS</span>
        </div>
        <div className="mb-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-pink-500" style={{ width: `${progressPct * 100}%` }} />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{d.payments.chargedThisMonth}</span>
          <span className="font-semibold text-gray-800">{formatUZS(chargedMonth)} UZS</span>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-base font-semibold text-gray-700">{d.payments.paymentsHistory}</h2>
        {payments.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">{d.payments.noPayments}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800">
                    {p.kind === "subscription" ? d.payments.subscription : d.payments.oneTime}
                  </p>
                  {p.note && <p className="truncate text-xs text-gray-400">{p.note}</p>}
                  <p className="text-xs text-gray-400">{formatDate(p.paid_at)}</p>
                </div>
                <span className="shrink-0 font-bold text-green-600">+{formatUZS(p.amount)} UZS</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-base font-semibold text-gray-700">{d.payments.chargesHistory}</h2>
        {charges.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">{d.payments.noCharges}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {charges.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{c.note ?? d.payments.oneTime}</p>
                  <p className="text-xs text-gray-400">{formatDate(c.charged_at)}</p>
                </div>
                <span className="shrink-0 font-bold text-gray-700">−{formatUZS(c.amount)} UZS</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
