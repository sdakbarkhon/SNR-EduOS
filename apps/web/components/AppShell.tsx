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
import { useIsFullscreenLesson } from "./fullscreen-lesson-context";

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

  // Fullscreen lesson workspace — hide chrome so the stage content gets full
  // viewport. Раньше это была pathname-эвристика (/^\/lessons\/[^/]+/),
  // матчившая ВСЕ 3 состояния урока (scheduled/in_progress/completed), а не
  // только живой урок — PreLessonView и завершённый LessonView теряли
  // каркас без причины. Теперь источник — Context, который выставляет
  // ТОЛЬКО LessonWorkspaceView (status="in_progress"), см.
  // fullscreen-lesson-context.tsx.
  const isFullscreenLesson = useIsFullscreenLesson();
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

  // DemoBanner рендерится ПЕРЕД AppShell как flex-сосед внутри ScaleWrapper
  // (см. app/(app)/layout.tsx) — свой h-10 (40px) спейсер в потоке, ниже
  // сам AppShell. Раньше высота AppShell вычиталась вручную (h-screen минус
  // 2.5rem баннера) — больше не нужно: этот корневой div теперь flex-1
  // min-h-0, а не h-screen/h-[calc(...)], так что flex-col родитель
  // (ScaleWrapper) сам отдаёт AppShell ровно оставшееся место, был баннер
  // или нет.
  return (
    <ToastProvider>
      {/* Ширина/масштаб больше не решаются здесь — см. ScaleWrapper.tsx.
          Fullscreen-lesson ветка (return выше) сознательно рендерится ДО
          этого блока и никогда сюда не доходит — рабочей области урока
          нужен весь физический экран, ScaleWrapper для неё тоже становится
          no-op (см. useIsFullscreenLesson() внутри ScaleWrapper). */}
      <div className={cn("flex flex-1 min-h-0 overflow-hidden bg-[#F2F1FA]")}>
        <LessonStartBanner />
        <StudentSidebar isDemo={isDemo} />

        {/* Правая колонка */}
        <div className="relative flex min-w-0 flex-1 flex-col gap-4 overflow-hidden py-3 pl-3 pr-3 md:gap-6 md:py-[26px] md:pl-[24px] md:pr-[30px]">
          <Topbar title={title} studentName={studentName} avatarUrl={avatarUrl} classLabel={classLabel} />
          <main className={cn("flex-1 pb-20 md:pb-1", isMessagesRoute ? "overflow-hidden" : "overflow-y-auto")}>
            <div className={cn("w-full", isMessagesRoute && "h-full")}>
              {children}
            </div>
          </main>
          <BottomNav />
        </div>

        {/* Reachable from every student page except the fullscreen-lesson
            branch above (workspace/pre-lesson/presentations) — that branch
            returns early and never reaches this JSX. Also hidden on
            /messages: the floating button overlapped the chat composer's
            send button (see isMessagesRoute above). */}
        {!isMessagesRoute && <AiFloatingButton />}
      </div>
    </ToastProvider>
  );
}
