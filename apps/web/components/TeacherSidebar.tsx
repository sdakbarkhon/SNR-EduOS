"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, LayoutDashboard, ClipboardList, Users, User } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { cn } from "@/lib/cn";
import { useLocale } from "./LocaleProvider";

const teacherNavItems = [
  { key: "home", href: "/teacher/dashboard", icon: LayoutDashboard, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navHome },
  { key: "homework", href: "/teacher/homework", icon: ClipboardList, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navHomework },
  { key: "groups", href: "/teacher/groups", icon: Users, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navGroups },
  { key: "profile", href: "/teacher/profile", icon: User, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navProfile },
];

export function TeacherSidebar() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  return (
    <aside
      className="hidden w-[230px] shrink-0 flex-col py-6 px-4 shadow-2xl rounded-r-[32px] md:flex"
      style={{ background: "linear-gradient(to bottom, #2A75FF, #0A3CB4)" }}
    >
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-inner">
          <GraduationCap className="h-6 w-6 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-[17px] font-bold tracking-wide text-white">SNR EduOS</div>
          <div className="text-[11px] font-medium text-white/60">{d.teacher.role}</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2">
        {teacherNavItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-medium transition-all duration-200",
                active
                  ? "bg-white/25 text-white shadow-sm backdrop-blur-sm"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
              {item.label(d)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
