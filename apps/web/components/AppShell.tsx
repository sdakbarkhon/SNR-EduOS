"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "./LocaleProvider";
import { BottomNav } from "./BottomNav";
import { StudentSidebar } from "./StudentSidebar";
import { Topbar } from "./Topbar";
import { ToastProvider } from "./Toast";
import { navItems } from "./nav-items";
import { LessonStartBanner } from "./LessonStartBanner";

export function AppShell({
  studentName,
  avatarUrl,
  classLabel,
  children,
}: {
  studentName?: string;
  avatarUrl?: string | null;
  classLabel?: string;
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
      <ToastProvider>
        <div className="min-h-screen" style={{ background: "var(--shell-gradient)" }}>
          <LessonStartBanner />
          {children}
        </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="h-screen overflow-hidden bg-[#F2F1FA]">
        <LessonStartBanner />
        <div className="mx-auto flex h-full max-w-[1512px] gap-4 px-3 pb-4 pt-3 md:gap-[30px] md:px-[30px] md:pb-[34px] md:pt-[26px]">
          <StudentSidebar />

          {/* Правая колонка */}
          <div className="relative flex min-w-0 flex-1 flex-col gap-4 overflow-hidden md:gap-6">
            <Topbar title={title} studentName={studentName} avatarUrl={avatarUrl} classLabel={classLabel} />
            <main className="flex-1 overflow-y-auto pb-20 md:pb-1">
              {children}
            </main>
            <BottomNav />
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
