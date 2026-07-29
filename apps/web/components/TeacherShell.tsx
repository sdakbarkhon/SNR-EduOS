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

  return (
    // Фиксированная ширина 1920px на viewport>=1920 (не max-width) — ниже
    // 1920 просто w-full (как раньше, без изменений). Выше 1920 весь каркас
    // (сайдбар+топбар+контент) буквально не растёт шире 1920px и центрируется
    // — по решению пользователя это НЕ "max-width с адаптацией", а
    // фиксация пикселей 1:1 с обычным 1920×1080. Дочерние max-w/mx-auto в
    // TeacherTopbar.tsx/PageContainer.tsx сняты — ширину теперь целиком
    // задаёт этот внешний контейнер, дублировать её ниже не нужно.
    <div className="w-full min-[1920px]:w-[1920px] min-[1920px]:mx-auto">
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--shell-gradient)" }}>
        <TeacherSidebar />

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
            <div className="absolute -left-[10%] -top-[10%] h-[50%] w-[50%] rounded-full blur-[100px]" style={{ background: "var(--shell-blob-1)" }} />
            <div className="absolute -right-[10%] top-[20%] h-[50%] w-[50%] rounded-full blur-[100px]" style={{ background: "var(--shell-blob-2)" }} />
            <div className="absolute bottom-[-10%] left-[20%] h-[60%] w-[60%] rounded-full blur-[100px]" style={{ background: "var(--shell-blob-3)" }} />
          </div>
          <div className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-[60px]" style={{ background: "var(--shell-overlay)" }} />

          <TeacherTopbar headerInfo={headerInfo} />
          <main className={cn("flex-1 px-4 pb-20 pt-1 md:px-8 md:pb-8", isMessagesRoute ? "overflow-hidden" : "overflow-y-auto")}>
            <div className={cn("w-full", isMessagesRoute && "h-full")}>
              {children}
            </div>
          </main>

          {/* Mobile bottom nav */}
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
        </div>
      </div>
    </div>
  );
}
