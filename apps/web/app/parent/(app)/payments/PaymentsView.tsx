"use client";

import { useState } from "react";
import { getDictionary, format, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "@/components/parent/glass/GlassCard";
import { ink1, ink2, ink3, glassBorder } from "@/lib/parent/glass-tokens";

type Props = {
  childName: string | null;
};

/**
 * Экран «Оплаты» — состав 1:1 с apps/mobile-parent PaymentsScreen.tsx, но
 * ПОЛНОСТЬЮ мок: все суммы — d.parentApp.home.noDataYet ("Пока нет данных"),
 * как было решено для мок-карточек на Главной. Ничего не подключено к
 * payments/charges (старый веб-портал с реальными запросами уже снесён и
 * сознательно не переиспользуется). Все внутренние кнопки/ссылки — заглушки
 * без onClick/href на реальные роуты.
 *
 * Не перенесены (сознательно, чтобы не изобретать несуществующие данные):
 * счётчик "{n} счёта" на секции "К оплате сейчас" и подпись "до {date}" под
 * суммой счёта — оба требуют конкретных чисел/дат, которые выглядели бы как
 * настоящие обязательства.
 */
function WalletIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4" />
      <path d="M16 12h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a2 2 0 0 1 0-4Z" />
    </svg>
  );
}

function BillIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h9l4 4v16H6z" />
      <path d="M15 2v4h4" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}

function MealIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 2v8a2 2 0 0 0 2 2v10" />
      <path d="M7 2v8M11 2v8" />
      <path d="M17 2c-1.5 0-3 1.5-3 4v5h3v11" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function PayAllIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={5} width={18} height={14} rx={2} />
      <path d="M3 10h18" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={9} />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 2h7l4 4v16H7z" />
      <path d="M14 2v4h4" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={2} y={5} width={20} height={14} rx={2} />
      <path d="M2 10h20" />
    </svg>
  );
}

function ChevronIcon({ color = ink3 }: { color?: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function IconTile({ gradient, children }: { gradient: string; children: React.ReactNode }) {
  return (
    <div
      className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px]"
      style={{ background: gradient }}
    >
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
      style={{ background: value ? "#059669" : "rgba(120,120,128,0.32)" }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: value ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  );
}

export function PaymentsView({ childName }: Props) {
  const { locale } = useLocale();
  const loc = locale as Locale;
  const d = getDictionary(loc).parentApp;
  const [autopay, setAutopay] = useState(true);

  const noData = d.home.noDataYet;

  const bills: { title: string; icon: React.ReactNode; gradient: string }[] = [
    { title: d.paymentsWeb.tuition, icon: <BillIcon />, gradient: "linear-gradient(135deg, #f97316, #ea580c)" },
    { title: d.svc.meals, icon: <MealIcon />, gradient: "linear-gradient(135deg, #34d399, #059669)" },
  ];

  const quickActions: { label: string; icon: React.ReactNode; gradient: string }[] = [
    { label: d.pay.topupBtn, icon: <PlusIcon />, gradient: "linear-gradient(135deg, #34d399, #059669)" },
    { label: d.scr.payHistory, icon: <ClockIcon />, gradient: "linear-gradient(135deg, #60a5fa, #2563eb)" },
    { label: d.pay.billsReceipts, icon: <DocIcon />, gradient: "linear-gradient(135deg, #fbbf24, #d97706)" },
    { label: d.scr.payMethods, icon: <CardIcon />, gradient: "linear-gradient(135deg, #a78bfa, #7c3aed)" },
  ];

  const childInitial = childName?.trim().split(/\s+/).pop()?.slice(0, 1) ?? "?";

  return (
    <div className="flex flex-1 flex-col gap-3 py-4">
      {/* Баланс — 3-стопный градиент, как в мобильной PaymentsScreen */}
      <div
        className="rounded-[22px] p-4"
        style={{ background: "linear-gradient(135deg, #ec4899, #f97316, #4f86f6)", boxShadow: "0 14px 28px rgba(236,72,153,0.28)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-wide text-white/80">{d.pay.balanceTotalCap}</div>
            <div className="mt-1 text-[22px] font-extrabold text-white">{noData}</div>
            <div className="mt-0.5 text-[11px] font-semibold text-white/85">{d.pay.balanceAvailable}</div>
          </div>
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] border border-white/35 bg-white/15">
            <WalletIcon />
          </div>
        </div>
        <div className="mt-3 flex gap-2.5">
          <div className="flex-1 rounded-[14px] border border-white/25 bg-white/12 px-3 py-2">
            <div className="text-[8.5px] font-extrabold uppercase tracking-wide text-white/75">{d.pay.balanceDueCap}</div>
            <div className="mt-0.5 text-[13px] font-extrabold text-white">{noData}</div>
          </div>
          <div className="flex-1 rounded-[14px] border border-white/25 bg-white/12 px-3 py-2">
            <div className="text-[8.5px] font-extrabold uppercase tracking-wide text-white/75">{d.pay.balanceOverpaidCap}</div>
            <div className="mt-0.5 text-[13px] font-extrabold text-white">{noData}</div>
          </div>
        </div>
      </div>

      {/* К оплате сейчас */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[13px] font-extrabold" style={{ color: ink1 }}>
          {d.pay.dueNow}
        </span>
        <button type="button" className="text-[11.5px] font-bold" style={{ color: ink2 }}>
          {d.common.viewAll} ›
        </button>
      </div>

      <GlassCard className="divide-y" style={{ borderColor: glassBorder }}>
        {bills.map((bill, i) => (
          <div key={i} className="flex items-center gap-3 p-3" style={i > 0 ? { borderTop: `1px solid ${glassBorder}` } : undefined}>
            <IconTile gradient={bill.gradient}>{bill.icon}</IconTile>
            <div className="flex-1">
              <div className="text-[13.5px] font-bold" style={{ color: ink1 }}>
                {bill.title}
              </div>
              <div className="text-[11px]" style={{ color: ink3 }}>
                {d.stub.subtitle}
              </div>
            </div>
            <span className="text-[13.5px] font-extrabold" style={{ color: ink1 }}>
              {noData}
            </span>
          </div>
        ))}
      </GlassCard>

      {/* Автоплатёж */}
      <GlassCard className="flex items-center gap-3 p-3">
        <IconTile gradient="linear-gradient(135deg, #34d399, #059669)">
          <RefreshIcon />
        </IconTile>
        <div className="flex-1">
          <div className="text-[13.5px] font-bold" style={{ color: ink1 }}>
            {d.pay.autopay}
          </div>
          <div className="text-[11px]" style={{ color: ink3 }}>
            {d.stub.subtitle}
          </div>
        </div>
        <Toggle value={autopay} onChange={setAutopay} />
      </GlassCard>

      {/* Оплатить всё — заглушка */}
      <button
        type="button"
        className="flex items-center justify-center gap-2 rounded-[16px] py-3.5 text-[14px] font-extrabold text-white"
        style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)", boxShadow: "0 10px 22px rgba(79,70,229,0.28)" }}
      >
        <PayAllIcon />
        {format(d.pay.payAllBtn, { sum: noData })}
      </button>

      {/* Быстрые действия — 4 плитки, все заглушки */}
      <div className="grid grid-cols-4 gap-2.5">
        {quickActions.map((qa, i) => (
          <button key={i} type="button" className="flex flex-col items-center gap-1.5 rounded-[16px] p-2.5" style={{ ...glassTileStyle }}>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[12px]"
              style={{ background: qa.gradient }}
            >
              {qa.icon}
            </div>
            <span className="text-center text-[9.5px] font-bold leading-tight" style={{ color: ink2 }}>
              {qa.label}
            </span>
          </button>
        ))}
      </div>

      {/* Кошелёк ребёнка */}
      <button
        type="button"
        className="flex items-center gap-3 rounded-[20px] p-3.5 text-left"
        style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", boxShadow: "0 12px 26px rgba(124,58,237,0.28)" }}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/35 bg-white/15 text-[15px] font-extrabold text-white">
          {childInitial}
        </div>
        <div className="flex-1">
          <div className="text-[13.5px] font-extrabold text-white">{d.paymentsWeb.walletTitleGeneric}</div>
          <div className="text-[11px] font-semibold text-white/85">{d.pay.walletSub}</div>
        </div>
        <span className="text-[14px] font-extrabold text-white">{noData}</span>
        <ChevronIcon color="#FFFFFF" />
      </button>
    </div>
  );
}

const glassTileStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.55)",
  border: `1px solid ${glassBorder}`,
};
