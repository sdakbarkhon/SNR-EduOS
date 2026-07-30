"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "./LocaleProvider";
import { TeacherSidebar } from "./TeacherSidebar";
import { TeacherTopbar } from "./TeacherTopbar";
import { Home, BookOpen, Award, Users, Settings } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useIsFullscreenLesson } from "./fullscreen-lesson-context";

const teacherNavItems = [
  { key: "home", href: "/teacher/dashboard", icon: Home, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navHome },
  { key: "homework", href: "/teacher/homework", icon: BookOpen, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navHomework },
  { key: "grades", href: "/teacher/grades", icon: Award, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navGrades },
  { key: "groups", href: "/teacher/groups", icon: Users, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navGroups },
  { key: "profile", href: "/teacher/profile", icon: Settings, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navProfile },
];

export function TeacherShell({
  headerInfo,
  children,
}: {
  headerInfo: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  // Сообщения — фиксированная Telegram-раскладка, см. AppShell.tsx для того же паттерна.
  const isMessagesRoute = pathname === "/teacher/messages";

  // Блок 2, Баг 3 — "Во весь экран" учителя (TeacherLessonDetailView.tsx)
  // прячет общий каркас (сайдбар/топбар) ровно тем же способом, что уже
  // работает у ученика — см. AppShell.tsx для идентичного паттерна.
  const isFullscreenLesson = useIsFullscreenLesson();

  // React #310, заход 3 — КРИТИЧНО: раньше здесь стоял ранний return с
  // ПОЛНОСТЬЮ другим деревом (<div min-h-screen>{children}</div>). Из-за
  // этого {children} менял родительскую цепочку: normal — "root > правая
  // колонка > main > div > children", fullscreen — "root > children".
  // React не умеет переносить fiber между разными родителями, поэтому при
  // каждом переключении ВСЁ поддерево страницы уничтожалось и создавалось
  // заново. Последствия, подтверждённые разведкой:
  //   1) Кнопка "Во весь экран" учителя была СЛОМАНА в принципе: focusMode
  //      живёт в useState ВНУТРИ TeacherLessonDetailView, то есть внутри
  //      уничтожаемого поддерева. Клик → setFullscreen(true) → ветка
  //      переключилась → компонент уничтожен → focusMode заново false →
  //      setFullscreen(false) → ветка вернулась назад. Кнопка физически не
  //      могла зафиксироваться и вдобавок дважды стирала состояние страницы.
  //   2) У ученика тот же флип на входе/выходе из живого урока давал лишний
  //      цикл destroy+recreate всего поддерева App Router — ровно то окно,
  //      в котором репортился #310.
  // Теперь дерево ОДНО, а обёртки в fullscreen получают display:contents
  // (Tailwind "contents") — они не создают бокс, визуально результат тот же,
  // что был у отдельной ветки, но {children} остаётся на одной и той же
  // позиции с одной и той же цепочкой родителей и НИКОГДА не пересоздаётся.
  return (
    // Ширина/масштаб больше не решаются здесь — ScaleWrapper.tsx (см.
    // app/teacher/layout.tsx) оборачивает весь каркас в логический холст
    // 1920×N и растягивает его CSS transform: scale() под физический
    // монитор. Этот корневой div — flex-1 min-h-0 вместо h-screen: высоту
    // теперь распределяет flex-col родитель (ScaleWrapper), а не сам
    // реальный viewport, иначе на масштабированном холсте контент вылезал
    // бы за экран.
    <div
      className={cn(isFullscreenLesson ? "min-h-screen" : "flex flex-1 min-h-0 overflow-hidden")}
      style={{ background: "var(--shell-gradient)" }}
    >
      {!isFullscreenLesson && <TeacherSidebar />}

      <div className={cn(isFullscreenLesson ? "contents" : "relative flex min-w-0 flex-1 flex-col overflow-hidden")}>
        {!isFullscreenLesson && (
          <>
            <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
              <div className="absolute -left-[10%] -top-[10%] h-[50%] w-[50%] rounded-full blur-[100px]" style={{ background: "var(--shell-blob-1)" }} />
              <div className="absolute -right-[10%] top-[20%] h-[50%] w-[50%] rounded-full blur-[100px]" style={{ background: "var(--shell-blob-2)" }} />
              <div className="absolute bottom-[-10%] left-[20%] h-[60%] w-[60%] rounded-full blur-[100px]" style={{ background: "var(--shell-blob-3)" }} />
            </div>
            <div className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-[60px]" style={{ background: "var(--shell-overlay)" }} />

            <TeacherTopbar headerInfo={headerInfo} />
          </>
        )}
        <main
          className={cn(
            isFullscreenLesson
              ? "contents"
              : cn("flex-1 px-4 pb-20 pt-1 md:px-8 md:pb-8", isMessagesRoute ? "overflow-hidden" : "overflow-y-auto"),
          )}
        >
          <div className={cn(isFullscreenLesson ? "contents" : cn("w-full", isMessagesRoute && "h-full"))}>
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        {!isFullscreenLesson && (
          <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-white/20 bg-white/80 pb-safe pt-2 backdrop-blur-xl md:hidden"
            style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
            {teacherNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.key} href={item.href}
                  className={cn("flex flex-col items-center gap-0.5 px-3 py-1 transition-colors",
                    isActive ? "text-brand-blue" : "text-slate-400 hover:text-slate-600")}>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px] font-medium">{item.label(d)}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
