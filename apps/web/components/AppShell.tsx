"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "./LocaleProvider";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { navItems } from "./nav-items";
import { LessonStartBanner } from "./LessonStartBanner";

export function AppShell({
  studentName,
  avatarUrl,
  children,
}: {
  studentName?: string;
  avatarUrl?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const active = navItems.find((i) => pathname.startsWith(i.href));
  const title = active ? active.label(d) : d.common.appName;

  // Fullscreen lesson workspace — hide chrome so the stage content gets full viewport
  const isFullscreenLesson = /^\/lessons\/[^/]+/.test(pathname);
  if (isFullscreenLesson) {
    return (
      <div className="min-h-screen" style={{ background: "var(--shell-gradient)" }}>
        <LessonStartBanner />
        {children}
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen"
      style={{ background: "var(--shell-gradient)" }}
    >
      <LessonStartBanner />
      <Sidebar studentName={studentName} avatarUrl={avatarUrl} />

      {/* Правая колонка */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Фоновые свечения */}
        <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
          <div className="absolute -left-[10%] -top-[10%] h-[50%] w-[50%] rounded-full blur-[100px]" style={{ background: "var(--shell-blob-1)" }} />
          <div className="absolute -right-[10%] top-[20%] h-[50%] w-[50%] rounded-full blur-[100px]" style={{ background: "var(--shell-blob-2)" }} />
          <div className="absolute bottom-[-10%] left-[20%] h-[60%] w-[60%] rounded-full blur-[100px]" style={{ background: "var(--shell-blob-3)" }} />
        </div>
        {/* Стеклянная подложка */}
        <div className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-[60px]" style={{ background: "var(--shell-overlay)" }} />

        <Topbar title={title} studentName={studentName} avatarUrl={avatarUrl} />
        <main className="flex-1 overflow-y-auto px-4 pb-20 pt-5 md:px-8 md:pb-8 md:pt-6">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
