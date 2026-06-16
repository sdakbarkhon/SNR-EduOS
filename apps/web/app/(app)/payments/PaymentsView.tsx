"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Calendar,
  CreditCard,
  Info,
  Plus,
  Wallet,
} from "lucide-react";
import {
  getDictionary,
  getPayments,
  getCharges,
  getSubjectStyle,
} from "@snr/core";
import type { Database, Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { GlassCard, Modal, StatusChip, SubjectIcon, useLocale } from "@/components";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Group = Database["public"]["Tables"]["groups"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];
type Charge = Database["public"]["Tables"]["charges"]["Row"];

function statusVariant(s: Student["status"]) {
  if (s === "active") return "success" as const;
  if (s === "debtor") return "danger" as const;
  return "warning" as const;
}

function statusLabel(s: Student["status"], d: ReturnType<typeof getDictionary>) {
  if (s === "active") return d.payments.statusActive;
  if (s === "debtor") return d.payments.statusDebtor;
  return d.payments.statusFrozen;
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString("ru-RU");
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function monthTotal(items: Array<{ amount: number }>, dateKey: string) {
  const now = new Date();
  return items
    .filter((i) => {
      const raw = (i as Record<string, unknown>)[dateKey];
      if (!raw) return false;
      const d = new Date(raw as string);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, i) => s + i.amount, 0);
}

/** Строка платежа (переиспользуется в основном блоке и модалке) */
function PaymentRow({ p, d }: { p: Payment; d: ReturnType<typeof getDictionary> }) {
  return (
    <div className="group -mx-3 flex items-center justify-between rounded-xl px-3 py-3.5 transition-colors hover:bg-white/40 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-100/50 bg-blue-50 text-blue-600 shadow-sm transition-transform duration-200 group-hover:scale-105">
          {p.kind === "subscription"
            ? <CreditCard className="h-5 w-5" strokeWidth={2} />
            : <Wallet className="h-5 w-5" strokeWidth={2} />}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {p.kind === "subscription" ? d.payments.subscription : d.payments.oneTime}
          </p>
          {p.note && <p className="text-[11px] text-slate-400 mt-0.5">{p.note}</p>}
          <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(p.paid_at)}</p>
        </div>
      </div>
      <span className="whitespace-nowrap font-bold text-green-600">+ {fmt(p.amount)} UZS</span>
    </div>
  );
}

/** Строка списания */
function ChargeRow({ c }: { c: Charge }) {
  return (
    <div className="group -mx-3 flex items-center justify-between rounded-xl px-3 py-3.5 transition-colors hover:bg-white/40 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-100/50 bg-slate-50 text-slate-500 shadow-sm transition-transform duration-200 group-hover:scale-105">
          <BookOpen className="h-5 w-5" strokeWidth={2} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">{c.note ?? "Занятие"}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-[10px] text-slate-400">{fmtDate(c.charged_at)}</span>
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">Курс</span>
          </div>
        </div>
      </div>
      <span className="whitespace-nowrap font-bold text-slate-900">− {fmt(c.amount)} UZS</span>
    </div>
  );
}

export function PaymentsView({
  student,
  groups,
  initialPayments,
  initialCharges,
}: {
  student: Student;
  groups: Group[];
  initialPayments: Payment[];
  initialCharges: Charge[];
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const sb = createClient();

  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [charges, setCharges] = useState<Charge[]>(initialCharges);
  const [showTopup, setShowTopup] = useState(false);
  const [showAllPay, setShowAllPay] = useState(false);
  const [showAllChg, setShowAllChg] = useState(false);

  useEffect(() => {
    const ch = sb
      .channel("payments-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, async () => {
        setPayments(await getPayments(sb));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "charges" }, async () => {
        setCharges(await getCharges(sb));
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb]);

  const paidMonth = monthTotal(payments, "paid_at");
  const chargedMonth = monthTotal(charges, "charged_at");
  const progressPct = (paidMonth + chargedMonth) === 0
    ? 0
    : Math.min(100, Math.round((paidMonth / (paidMonth + chargedMonth)) * 100));

  const LIMIT = 4;
  const shownPayments = payments.slice(0, LIMIT);
  const shownCharges = charges.slice(0, LIMIT);

  return (
    <>
      <div className="space-y-6">
        {/* Row 1: BalanceHero (2/3) + PaymentStatus (1/3) */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── BalanceHeroCard ── */}
          <GlassCard className="lg:col-span-2 p-8 flex flex-col relative overflow-hidden group">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-300 opacity-20 blur-[80px] transition-colors duration-500 group-hover:bg-blue-300/30" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-5 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                    {d.payments.balance}
                  </span>
                  <StatusChip variant={statusVariant(student.status)}>
                    {statusLabel(student.status, d)}
                  </StatusChip>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-5xl font-black tracking-tight"
                    style={{ color: student.balance < 0 ? "#F0556B" : "#1D1D1F" }}
                  >
                    {student.balance < 0 ? "−" : ""}{fmt(student.balance)}
                  </span>
                  <span className="text-3xl font-black text-slate-900">UZS</span>
                </div>
                {student.balance < 0 && (
                  <p className="mt-2 text-sm font-medium text-red-500">
                    Необходимо пополнить счёт
                  </p>
                )}
              </div>

              {/* Кнопка Пополнить */}
              <button
                onClick={() => setShowTopup(true)}
                className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#007AFF] px-6 py-3 text-base font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-[#0063CC] hover:-translate-y-0.5"
              >
                <Plus className="h-5 w-5" strokeWidth={3} />
                {d.payments.topupButton}
              </button>
            </div>

            {/* Мои курсы */}
            <div className="relative z-10 border-t border-slate-200/60 pt-6 mt-auto">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
                {d.payments.myCourses}
              </h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {groups.map((g) => {
                  const style = getSubjectStyle(g.subject);
                  return (
                    <div
                      key={g.id}
                      className="flex items-start gap-3 rounded-2xl border border-white/60 bg-white/40 p-3 shadow-sm hover:bg-white/50 transition-all hover:-translate-y-0.5"
                    >
                      <div
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: style.color + "22" }}
                      >
                        <SubjectIcon subject={g.subject} size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 leading-snug">{style.label}</p>
                        <p className="mt-1 text-sm font-black text-slate-900">
                          {g.course_price.toLocaleString("ru-RU")} UZS
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </GlassCard>

          {/* ── Статус оплаты ── */}
          <GlassCard className="p-6 flex flex-col">
            <h3 className="mb-5 text-sm font-bold uppercase tracking-wider text-slate-500">
              {d.payments.paymentStatusTitle}
            </h3>
            <div className="flex flex-col gap-4 flex-1 justify-center">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-slate-600">{d.payments.paidThisMonth}</span>
                <span className="text-slate-900">{fmt(paidMonth)} UZS</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-slate-600">{d.payments.chargedThisMonth}</span>
                <span className="text-slate-900">{fmt(chargedMonth)} UZS</span>
              </div>
            </div>
            {charges[0] && (
              <div className="mt-6 border-t border-slate-100/50 pt-5">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Последнее списание
                </h4>
                <div className="flex items-start gap-3 rounded-2xl border border-white/60 bg-white/40 p-4 shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{fmtDate(charges[0].charged_at)}</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">{charges[0].note ?? "Занятие"}</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{fmt(charges[0].amount)} UZS</p>
                  </div>
                </div>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Row 2: Histories */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* История пополнений */}
          <GlassCard className="flex flex-col p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600">
                  <ArrowDownLeft className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">{d.payments.paymentsHistory}</h3>
              </div>
              {payments.length > LIMIT && (
                <button
                  onClick={() => setShowAllPay(true)}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {d.payments.showAll}
                </button>
              )}
            </div>
            {payments.length === 0
              ? <p className="py-4 text-center text-sm text-gray-400">{d.payments.noPayments}</p>
              : shownPayments.map((p) => <PaymentRow key={p.id} p={p} d={d} />)
            }
          </GlassCard>

          {/* История списаний */}
          <GlassCard className="flex flex-col p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">{d.payments.chargesHistory}</h3>
              </div>
              {charges.length > LIMIT && (
                <button
                  onClick={() => setShowAllChg(true)}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {d.payments.showAll}
                </button>
              )}
            </div>
            {charges.length === 0
              ? <p className="py-4 text-center text-sm text-gray-400">{d.payments.noCharges}</p>
              : shownCharges.map((c) => <ChargeRow key={c.id} c={c} />)
            }
          </GlassCard>
        </div>
      </div>

      {/* ── Модалка «Пополнить» ── */}
      <Modal open={showTopup} onClose={() => setShowTopup(false)} title={d.payments.topupTitle}>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
            <Info className="h-8 w-8" />
          </div>
          <p className="text-base font-semibold text-slate-800">{d.payments.topupStub}</p>
          <p className="text-sm text-slate-500">{d.payments.topupContacts}</p>
          <button
            onClick={() => setShowTopup(false)}
            className="mt-2 rounded-2xl bg-[#007AFF] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 hover:bg-[#0063CC] transition-colors"
          >
            {d.payments.topupClose}
          </button>
        </div>
      </Modal>

      {/* ── Модалка все пополнения ── */}
      <Modal open={showAllPay} onClose={() => setShowAllPay(false)} title={d.payments.paymentsHistory}>
        {payments.map((p) => <PaymentRow key={p.id} p={p} d={d} />)}
      </Modal>

      {/* ── Модалка все списания ── */}
      <Modal open={showAllChg} onClose={() => setShowAllChg(false)} title={d.payments.chargesHistory}>
        {charges.map((c) => <ChargeRow key={c.id} c={c} />)}
      </Modal>
    </>
  );
}
