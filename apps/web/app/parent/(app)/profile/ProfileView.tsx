"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "@/components/parent/glass/GlassCard";
import { GlassCircleButton } from "@/components/parent/glass/GlassCircleButton";
import { useLogout, LogoutOverlay } from "@/components/LogoutOverlay";
import { SELECTED_CHILD_COOKIE, type ParentChild } from "@/lib/parent-child";
import { ink1, ink2, ink3 } from "@/lib/parent/glass-tokens";

type Props = {
  parentName: string;
  kids: ParentChild[];
  selectedChildId: string | null;
};

// Те же 3 (градиент, цвет кольца) для реальных детей, что и REAL_CHILD_PALETTE
// в apps/mobile-parent/src/lib/realChild.ts — цикл по индексу.
const CHILD_PALETTE: { grad: [string, string]; ring: string }[] = [
  { grad: ["#22d3ee", "#3b82f6"], ring: "#0891b2" },
  { grad: ["#8b5cf6", "#ec4899"], ring: "#8b5cf6" },
  { grad: ["#34d399", "#0ea5e9"], ring: "#059669" },
];

// Карточка родителя — фиксированный градиент/кольцо 1:1 с мобилкой
// (parent.avatar_gradient/ringColor="#8b5cf6" — визуал общий для мок/реал,
// меняются только инициалы/имя).
const PARENT_GRADIENT: [string, string] = ["#8b5cf6", "#22d3ee"];
const PARENT_RING = "#8b5cf6";

function parentInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p.slice(0, 1)).join("").toUpperCase();
}

/** Реальные ФИО хранятся как "Фамилия Имя" — инициал ребёнка берём по имени. */
function childInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return (parts[parts.length - 1] || fullName).slice(0, 1).toUpperCase();
}

function RingAvatar({ size, initial, gradient, ring }: { size: number; initial: string; gradient: [string, string]; ring: string }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: ring, padding: 2 }}
    >
      <div className="flex h-full w-full items-center justify-center rounded-full bg-white p-[2px]">
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-extrabold text-white"
          style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`, fontSize: size * 0.3 }}
        >
          {initial}
        </div>
      </div>
    </div>
  );
}

function IconBase({ children, size = 18, color = "#FFFFFF", strokeWidth = 1.8 }: { children: ReactNode; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const DocsIcon = () => (
  <IconBase>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6" />
    <path d="M9 17h4" />
  </IconBase>
);
const BellIcon = () => (
  <IconBase>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </IconBase>
);
const CardIcon = () => (
  <IconBase>
    <path d="M2 8a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z" />
    <path d="M2 10h20" />
  </IconBase>
);
const GlobeIcon = () => (
  <IconBase>
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
    <path d="M3 12h18" />
    <path d="M12 3a13 13 0 0 1 0 18" />
    <path d="M12 3a13 13 0 0 0 0 18" />
  </IconBase>
);
const HelpIcon = () => (
  <IconBase>
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
    <path d="M9 10a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.7" />
    <path d="M12 17h.01" />
  </IconBase>
);
const InfoIcon = () => (
  <IconBase>
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
    <path d="M12 8h.01" />
    <path d="M11 12h1v4h1" />
  </IconBase>
);
function SlidersIcon() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={ink1} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M6 12h12" />
      <path d="M9 18h6" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={ink3} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
function ActiveCheck() {
  return (
    <div
      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
      style={{ background: "linear-gradient(135deg, #7C3AED, #4F6DF5)", boxShadow: "0 3px 8px rgba(124,58,237,0.4)" }}
    >
      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-0.5 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: ink3 }}>
      {title}
    </div>
  );
}

type MenuItem = { title: string; sub: string; icon: ReactNode; grad: [string, string] };

function MenuRow({ item, divider, onClick }: { item: MenuItem; divider: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 p-3 text-left"
      style={divider ? { borderTop: "1px solid rgba(23,18,67,0.06)" } : undefined}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]"
        style={{ background: `linear-gradient(135deg, ${item.grad[0]}, ${item.grad[1]})` }}
      >
        {item.icon}
      </div>
      <div className="flex-1">
        <div className="text-[12.5px] font-extrabold" style={{ color: ink1 }}>
          {item.title}
        </div>
        <div className="mt-0.5 text-[9.5px] font-semibold" style={{ color: ink2 }}>
          {item.sub}
        </div>
      </div>
      <ChevronIcon />
    </button>
  );
}

/**
 * «Профиль» — 1:1 по составу с apps/mobile-parent ProfileHubScreen.tsx:
 * шапка (заголовок + кнопка-заглушка «Язык и безопасность»), карточка
 * родителя, «Мои дети», «Настройки» (4 строки), «Поддержка» (2 строки),
 * кнопка «Выйти». Разделы без реальной таблицы — заглушки: клик показывает
 * тот же локальный тост, что уже используется на LoginPhoneScreen.tsx
 * (в родительском шелле общий ToastProvider не смонтирован).
 *
 * Отличия от мобилки (обоснованы в отчёте):
 * - Номер входа родителя не показываем — getParentContext() его не отдаёт
 *   (таблица parents такого поля не хранит для веб-телефон-флоу), не
 *   выдумываем: место значения — прочерк.
 * - Статус-пилюли у детей не показываем (явное требование задачи).
 * - Тап по ребёнку меняет активного (тот же cookie-паттерн, что и в
 *   ParentAppShell), но НЕ открывает детальный профиль — такого экрана
 *   (/parent/child/[id] или аналог) в вебе ещё нет.
 * - Подпись версии приложения опущена — источника реальной версии
 *   (Expo config) на вебе нет, а показывать case-package.json "0.0.0"
 *   выглядело бы как реальный, но вводящий в заблуждение номер версии.
 */
export function ProfileView({ parentName, kids, selectedChildId }: Props) {
  const { locale } = useLocale();
  const dict = getDictionary(locale as Locale).parentApp;
  const d = dict.prof;
  const router = useRouter();
  const { loggingOut, logout } = useLogout();

  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | null>(null);

  function showComingSoon() {
    setNotice(dict.stub.subtitle);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2200) as unknown as number;
  }

  function selectChild(id: string) {
    document.cookie = `${SELECTED_CHILD_COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  const settingsItems: MenuItem[] = [
    { title: dict.scr.documents, sub: d.docsSub, icon: <DocsIcon />, grad: ["#60a5fa", "#2563eb"] },
    { title: dict.scr.notifSettings, sub: d.notifSetSub, icon: <BellIcon />, grad: ["#fbbf24", "#f97316"] },
    { title: dict.scr.payMethods, sub: d.payMethodsSub, icon: <CardIcon />, grad: ["#a78bfa", "#7c3aed"] },
    { title: dict.scr.langSec, sub: d.langSecSub, icon: <GlobeIcon />, grad: ["#22d3ee", "#0891b2"] },
  ];
  const supportItems: MenuItem[] = [
    { title: d.helpTitle, sub: d.helpSub, icon: <HelpIcon />, grad: ["#f472b6", "#db2777"] },
    { title: dict.scr.about, sub: d.aboutSub, icon: <InfoIcon />, grad: ["#94a3b8", "#64748b"] },
  ];

  return (
    <div className="flex flex-1 flex-col gap-3 py-4">
      {/* Шапка */}
      <div className="flex items-center gap-2.5 px-0.5">
        <h1 className="flex-1 text-lg font-bold" style={{ color: ink1 }}>
          {dict.nav.profile}
        </h1>
        <GlassCircleButton onClick={showComingSoon} ariaLabel={dict.scr.langSec}>
          <SlidersIcon />
        </GlassCircleButton>
      </div>

      {/* Карточка родителя */}
      <GlassCard className="flex items-center gap-3 p-3.5">
        <RingAvatar size={54} initial={parentInitials(parentName)} gradient={PARENT_GRADIENT} ring={PARENT_RING} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-extrabold" style={{ color: ink1 }}>
            {parentName}
          </div>
          <div className="mt-0.5 text-[10.5px] font-bold" style={{ color: "#6D28D9" }}>
            {d.parentRole}
          </div>
          <div className="mt-0.5 text-[10.5px] font-semibold" style={{ color: ink2 }}>
            —
          </div>
        </div>
        <ChevronIcon />
      </GlassCard>

      {/* Мои дети */}
      <SectionHeader title={d.myKids} />
      <GlassCard>
        {kids.map((child, i) => {
          const palette = CHILD_PALETTE[i % CHILD_PALETTE.length]!;
          const active = child.id === selectedChildId;
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => selectChild(child.id)}
              className="flex w-full items-center gap-3 p-3 text-left"
              style={i > 0 ? { borderTop: "1px solid rgba(23,18,67,0.06)" } : undefined}
            >
              <RingAvatar size={36} initial={childInitial(child.full_name)} gradient={palette.grad} ring={palette.ring} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-extrabold" style={{ color: ink1 }}>
                  {child.full_name}
                </div>
                {child.className && (
                  <div className="text-[10.5px] font-semibold" style={{ color: ink3 }}>
                    {child.className}
                  </div>
                )}
              </div>
              {active && <ActiveCheck />}
              <ChevronIcon />
            </button>
          );
        })}
      </GlassCard>

      {/* Настройки */}
      <SectionHeader title={d.settings} />
      <GlassCard>
        {settingsItems.map((item, i) => (
          <MenuRow key={item.title} item={item} divider={i > 0} onClick={showComingSoon} />
        ))}
      </GlassCard>

      {/* Поддержка */}
      <SectionHeader title={dict.scr.support} />
      <GlassCard>
        {supportItems.map((item, i) => (
          <MenuRow key={item.title} item={item} divider={i > 0} onClick={showComingSoon} />
        ))}
      </GlassCard>

      {/* Выйти — переиспользует единый web-логаут (useLogout из LogoutOverlay.tsx) */}
      <button
        type="button"
        onClick={logout}
        className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[12.5px] font-extrabold"
        style={{ borderWidth: 1.5, borderStyle: "solid", borderColor: "rgba(220,38,38,0.55)", color: "#DC2626" }}
      >
        <LogoutIcon />
        {d.exit}
      </button>

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-6">
          <div className="rounded-full px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-lg" style={{ background: "rgba(23,18,67,0.92)" }}>
            {notice}
          </div>
        </div>
      )}
      {loggingOut && <LogoutOverlay />}
    </div>
  );
}
