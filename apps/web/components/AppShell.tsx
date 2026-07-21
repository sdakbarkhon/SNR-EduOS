"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { cn } from "@/lib/cn";
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
  isDemo,
  children,
}: {
  studentName?: string;
  avatarUrl?: string | null;
  classLabel?: string;
  isDemo?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const active = navItems.find((i) => pathname.startsWith(i.href));
  const title = active ? active.label(d) : d.common.appName;

  // Сообщения — фиксированная Telegram-раскладка (список/лента/поле ввода со
  // своим скроллом каждая, см. MessagesView.tsx) требует, чтобы {children}
  // реально получил высоту от <main>, а не сам скроллился вместе с ним.
  const isMessagesRoute = pathname === "/messages";

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

  // Промт 6.2.5: DemoBanner рендерит свой h-10 (40px) спейсер ПЕРЕД AppShell
  // как сосед (в layout.tsx), а не внутри него — h-screen здесь раньше не
  // учитывал этот сдвиг, из-за чего вся раскладка (в т.ч. сайдбар) съезжала
  // на 40px вниз и настолько же вылезала за нижний край вьюпорта. Теперь
  // высота явно уменьшается на те же 40px, когда баннер показан.
  return (
    <ToastProvider>
      <div className={cn("flex overflow-hidden bg-[#F2F1FA]", isDemo ? "h-[calc(100vh-2.5rem)]" : "h-screen")}>
        <LessonStartBanner />
        <StudentSidebar isDemo={isDemo} />

        {/* Правая колонка */}
        <div className="relative flex min-w-0 flex-1 flex-col gap-4 overflow-hidden py-3 pl-3 pr-3 md:gap-6 md:py-[26px] md:pl-[24px] md:pr-[30px]">
          <Topbar title={title} studentName={studentName} avatarUrl={avatarUrl} classLabel={classLabel} />
          <main className={cn("flex-1 pb-20 md:pb-1", isMessagesRoute ? "overflow-hidden" : "overflow-y-auto")}>
            <div className={cn("mx-auto w-full min-[1440px]:max-w-[1600px]", isMessagesRoute && "h-full")}>
              {children}
            </div>
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
