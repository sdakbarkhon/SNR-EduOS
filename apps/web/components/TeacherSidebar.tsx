"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Award, FolderOpen, Users, Settings, LogOut, CheckCircle } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { cn } from "@/lib/cn";
import { useLocale } from "./LocaleProvider";
import { signOut } from "@/app/actions/auth";

const teacherNavItems = [
  { key: "home",      href: "/teacher/dashboard", icon: Home,       label: (d: ReturnType<typeof getDictionary>) => d.teacher.navHome },
  { key: "homework",  href: "/teacher/homework",  icon: BookOpen,   label: (d: ReturnType<typeof getDictionary>) => d.teacher.navHomework },
  { key: "grades",    href: "/teacher/grades",    icon: Award,      label: (d: ReturnType<typeof getDictionary>) => d.teacher.navGrades },
  { key: "materials", href: "/teacher/materials", icon: FolderOpen, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navMaterials },
  { key: "groups",    href: "/teacher/groups",    icon: Users,      label: (d: ReturnType<typeof getDictionary>) => d.teacher.navGroups },
  { key: "profile",   href: "/teacher/profile",   icon: Settings,   label: (d: ReturnType<typeof getDictionary>) => d.teacher.navProfile },
];

export function TeacherSidebar() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  return (
    <aside
      className="hidden w-64 shrink-0 flex-col p-6 text-white md:flex"
      style={{ background: "linear-gradient(to bottom, #2563EB, #1E3A8A)" }}
    >
      {/* Branding */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-lg shadow-blue-900/20">
          <CheckCircle className="h-6 w-6 text-blue-600" strokeWidth={2.5} />
        </div>
        <span className="text-xl font-bold tracking-tight">SNR EduOS</span>
      </div>

      {/* Role pill — white bg, blue text */}
      <div className="mb-10 w-fit rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
        {d.teacher.role}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {teacherNavItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl p-3 transition-all",
                active ? "bg-white/20" : "opacity-70 hover:opacity-100",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
              <span className="font-medium">{item.label(d)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: logout — серверный action (полная навигация, без F5) */}
      <div className="border-t border-white/20 pt-6">
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 p-3 opacity-70 transition-opacity hover:opacity-100"
          >
            <LogOut className="h-5 w-5" strokeWidth={2} />
            <span className="font-medium">Выйти</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
