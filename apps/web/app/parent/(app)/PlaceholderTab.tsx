"use client";

import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "@/components/parent/glass/GlassCard";
import { accentGradCss, ink1, ink2, ink3 } from "@/lib/parent/glass-tokens";

type NavKey = "home" | "grades" | "payments" | "messages" | "profile";

function ClockIcon() {
  return (
    <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={9} />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

/** Заглушка «Скоро» — экраны, которые ещё не подключены к реальным данным. */
export function PlaceholderTab({ titleKey }: { titleKey: NavKey }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const sectionName = d.parentApp.nav[titleKey];
  const stub = d.parentApp.stub;

  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <GlassCard className="flex w-full flex-col items-center gap-3 px-6 py-9 text-center">
        <div
          className="flex h-[68px] w-[68px] items-center justify-center rounded-[22px]"
          style={{ background: accentGradCss, boxShadow: "0 14px 28px rgba(99,86,214,0.30)" }}
        >
          <ClockIcon />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: ink3 }}>
          {sectionName}
        </span>
        <h1 className="text-lg font-bold" style={{ color: ink1 }}>
          {stub.title}
        </h1>
        <p className="text-sm" style={{ color: ink2 }}>
          {stub.subtitle}
        </p>
      </GlassCard>
    </div>
  );
}
