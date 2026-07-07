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
import { AiFloatingButton } from "./AiFloatingButton";

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
      <div className="flex h-screen overflow-hidden bg-[#F2F1FA]">
        <LessonStartBanner />
        <StudentSidebar />

        {/* Правая колонка */}
        <div className="relative flex min-w-0 flex-1 flex-col gap-4 overflow-hidden py-3 pl-3 pr-3 md:gap-6 md:py-[26px] md:pl-[24px] md:pr-[30px]">
          <Topbar title={title} studentName={studentName} avatarUrl={avatarUrl} classLabel={classLabel} />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-1">
            {children}
          </main>
          <BottomNav />
        </div>

        {/* Reachable from every student page except the fullscreen-lesson
            branch above (workspace/pre-lesson/presentations) — that branch
            returns early and never reaches this JSX. */}
        <AiFloatingButton />
      </div>
    </ToastProvider>
  );
}
