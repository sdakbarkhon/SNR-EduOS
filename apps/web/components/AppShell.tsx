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
  // React #310, заход 3 — КРИТИЧНО: раньше здесь стоял ранний return с
  // ПОЛНОСТЬЮ другим деревом. {children} менял родительскую цепочку
  // (normal: "root > правая колонка > main > div > children", fullscreen:
  // "root > children"), а React не умеет переносить fiber между разными
  // родителями — поэтому КАЖДЫЙ вход в живой урок и КАЖДЫЙ выход из него
  // уничтожал и заново создавал всё поддерево страницы App Router. Именно
  // в этом окне репортился #310 ("падает при выходе из урока"), и именно
  // из-за этого урок монтировался дважды (useRealtimeChannel подписывался
  // два раза, 3-секундный опрос и таймеры создавались дважды).
  // Тот же баг ломал кнопку "Во весь экран" у учителя — см. подробный
  // разбор в TeacherShell.tsx.
  // Теперь дерево ОДНО, обёртки в fullscreen получают display:contents
  // (Tailwind "contents") — бокс не создаётся, картинка та же, но
  // {children} остаётся на одной позиции и НИКОГДА не пересоздаётся.
  const isFullscreenLesson = useIsFullscreenLesson();

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
          В fullscreen-уроке ScaleWrapper тоже становится no-op (он читает
          тот же useIsFullscreenLesson()), так что рабочая область урока
          получает весь физический экран. */}
      <div
        className={cn(isFullscreenLesson ? "min-h-screen" : "flex flex-1 min-h-0 overflow-hidden bg-[#F2F1FA]")}
        style={isFullscreenLesson ? { background: "var(--shell-gradient)" } : undefined}
      >
        <LessonStartBanner />
        {!isFullscreenLesson && <StudentSidebar isDemo={isDemo} />}

        {/* Правая колонка (в fullscreen — display:contents, см. комментарий выше) */}
        <div
          className={cn(
            isFullscreenLesson
              ? "contents"
              : "relative flex min-w-0 flex-1 flex-col gap-4 overflow-hidden py-3 pl-3 pr-3 md:gap-6 md:py-[26px] md:px-[24px]",
          )}
        >
          {!isFullscreenLesson && (
            <Topbar title={title} studentName={studentName} avatarUrl={avatarUrl} classLabel={classLabel} />
          )}
          <main
            className={cn(
              isFullscreenLesson
                ? "contents"
                : cn("flex-1 pb-20 md:pb-1", isMessagesRoute ? "overflow-hidden" : "overflow-y-auto"),
            )}
          >
            <div className={cn(isFullscreenLesson ? "contents" : cn("w-full", isMessagesRoute && "h-full"))}>
              {children}
            </div>
          </main>
          {!isFullscreenLesson && <BottomNav />}
        </div>

        {/* Скрыта в fullscreen-уроке (рабочей области нужен весь экран) и на
            /messages: плавающая кнопка перекрывала кнопку отправки в чате. */}
        {!isFullscreenLesson && !isMessagesRoute && <AiFloatingButton />}
      </div>
    </ToastProvider>
  );
}
