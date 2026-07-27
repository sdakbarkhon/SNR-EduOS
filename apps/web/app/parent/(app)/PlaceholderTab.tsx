"use client";

import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "@/components/parent/glass/GlassCard";

type NavKey = "home" | "grades" | "payments" | "messages" | "profile";

/** Плейсхолдер-таб (Заход 1) — реальные экраны подключаются в следующих заходах. */
export function PlaceholderTab({ titleKey }: { titleKey: NavKey }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const title = d.parentApp.nav[titleKey];

  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <GlassCard className="w-full px-6 py-8 text-center">
        <h1 className="text-lg font-bold" style={{ color: "#171243" }}>
          {title}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "rgba(26,19,74,0.64)" }}>
          {d.parentNav.messagesComingSoon}
        </p>
      </GlassCard>
    </div>
  );
}
