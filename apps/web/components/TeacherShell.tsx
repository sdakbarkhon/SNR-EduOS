"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "./LocaleProvider";
import { TeacherSidebar } from "./TeacherSidebar";
import { Topbar } from "./Topbar";
import { LayoutDashboard, ClipboardList, Users, User } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

const teacherNavItems = [
  { key: "home", href: "/teacher/dashboard", icon: LayoutDashboard, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navHome },
  { key: "homework", href: "/teacher/homework", icon: ClipboardList, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navHomework },
  { key: "groups", href: "/teacher/groups", icon: Users, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navGroups },
  { key: "profile", href: "/teacher/profile", icon: User, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navProfile },
];

export function TeacherShell({ teacherName, children }: { teacherName?: string; children: ReactNode }) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const active = teacherNavItems.find((i) => pathname.startsWith(i.href));
  const title = active ? active.label(d) : d.common.appName;

  return (
    <div className="flex min-h-screen overflow-hidden" style={{ background: "var(--shell-gradient)" }}>
      <TeacherSidebar />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
          <div className="absolute -left-[10%] -top-[10%] h-[50%] w-[50%] rounded-full blur-[100px]" style={{ background: "var(--shell-blob-1)" }} />
          <div className="absolute -right-[10%] top-[20%] h-[50%] w-[50%] rounded-full blur-[100px]" style={{ background: "var(--shell-blob-2)" }} />
          <div className="absolute bottom-[-10%] left-[20%] h-[60%] w-[60%] rounded-full blur-[100px]" style={{ background: "var(--shell-blob-3)" }} />
        </div>
        <div className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-[60px]" style={{ background: "var(--shell-overlay)" }} />

        <Topbar title={title} studentName={teacherName} />
        <main className="flex-1 overflow-y-auto px-4 pb-20 pt-5 md:px-8 md:pb-8 md:pt-6">
          {children}
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
  );
}
