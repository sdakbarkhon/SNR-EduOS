"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { SELECTED_CHILD_COOKIE, type ParentChild } from "@/lib/parent-child";
import { LogoutButton } from "@/components/LogoutButton";
import { GlassCard } from "@/components/parent/glass/GlassCard";
import { glassBorder } from "@/lib/parent/glass-tokens";
import { ParentTabBar } from "./ParentTabBar";

export function ParentAppShell({
  parentName,
  kids,
  selectedChildId,
  children,
}: {
  parentName: string;
  kids: ParentChild[];
  selectedChildId: string | null;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp.auth;
  const router = useRouter();

  function selectChild(id: string) {
    document.cookie = `${SELECTED_CHILD_COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-6">
        <span className="text-sm font-semibold" style={{ color: "#171243" }}>
          {parentName}
        </span>
        <LogoutButton />
      </header>

      {kids.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-5 pb-3">
          {kids.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => selectChild(k.id)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition"
              style={{
                border: `1px solid ${glassBorder}`,
                background: k.id === selectedChildId ? "linear-gradient(135deg, #7C3AED, #4F6DF5)" : "rgba(255,255,255,0.5)",
                color: k.id === selectedChildId ? "#fff" : "#171243",
              }}
            >
              {k.full_name}
              {k.className ? ` · ${k.className}` : ""}
            </button>
          ))}
        </div>
      )}

      {kids.length === 0 && (
        <div className="px-5 pb-3">
          <GlassCard className="px-4 py-2.5">
            <span className="text-xs" style={{ color: "rgba(26,19,74,0.64)" }}>
              {d.chooseChild}: —
            </span>
          </GlassCard>
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-5 pb-28">{children}</main>

      <ParentTabBar />
    </div>
  );
}
