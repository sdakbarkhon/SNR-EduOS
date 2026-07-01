"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Trophy, CircleDot, type LucideIcon } from "lucide-react";
import { getDictionary, getHomework, getMySubmissions } from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { useLocale } from "./LocaleProvider";
import { useToast } from "./Toast";
import { navItems as baseNavItems, type NavItem } from "./nav-items";

const STORAGE_KEY = "student-sidebar-collapsed";

interface SidebarItem extends NavItem {
  isStub?: boolean;
}

// The 2 stub items (no real page yet) are inserted between "Проекты" and
// "AI-помощник" — kept OUT of the shared nav-items.ts array on purpose, since
// that array is also consumed by BottomNav.tsx (mobile), which we're not
// touching in this redesign.
const STUB_ITEMS: SidebarItem[] = [
  { key: "achievements", href: "#", icon: Trophy, label: (d) => d.nav.achievements, isStub: true },
  { key: "clubs", href: "#", icon: CircleDot, label: (d) => d.nav.clubs, isStub: true },
];

function buildItems(): SidebarItem[] {
  const projectsIdx = baseNavItems.findIndex((i) => i.key === "projects");
  const items = [...baseNavItems] as SidebarItem[];
  items.splice(projectsIdx + 1, 0, ...STUB_ITEMS);
  return items;
}

const SIDEBAR_ITEMS = buildItems();

export function StudentSidebar() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const showToast = useToast();

  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [homeworkCount, setHomeworkCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") setCollapsed(true);
    } catch { /* blocked */ }

    const db = createClient();
    Promise.all([getHomework(db), getMySubmissions(db)])
      .then(([homework, submissions]) => {
        const submittedIds = new Set(submissions.map((s) => s.homework_id));
        setHomeworkCount(homework.filter((h) => !submittedIds.has(h.id)).length);
      })
      .catch(() => null);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* blocked */ }
      return next;
    });
  }

  function onStubClick(e: MouseEvent) {
    e.preventDefault();
    showToast(d.auth.comingSoon);
  }

  const isCollapsed = mounted && collapsed;

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-slate-100 bg-white py-4 transition-[width] duration-200 md:flex",
        isCollapsed ? "w-16" : "w-64",
      )}
    >
      {/* Логотип + сворачивание */}
      <div className={cn("mb-4 flex items-center px-4", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && (
          <span className="text-lg font-bold text-slate-900">
            SNR <span className="text-orange-500">EduOS</span>
          </span>
        )}
        <button
          onClick={toggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
          title={isCollapsed ? "Развернуть" : "Свернуть"}
          aria-label={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Пункты меню */}
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3">
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = !item.isStub && pathname.startsWith(item.href);
          const Icon = item.icon as LucideIcon;
          const badge = item.key === "homework" ? homeworkCount : undefined;

          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={item.isStub ? onStubClick : undefined}
              title={item.label(d)}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive ? "bg-orange-50 text-orange-600 shadow-sm" : "text-slate-600 hover:bg-slate-50",
                isCollapsed && "justify-center",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              {!isCollapsed && (
                <div className="flex min-w-0 flex-1 items-center justify-between">
                  <span className="truncate">{item.label(d)}</span>
                  {badge !== undefined && badge > 0 && (
                    <span className="ml-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {badge}
                    </span>
                  )}
                </div>
              )}
              {isCollapsed && badge !== undefined && badge > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
