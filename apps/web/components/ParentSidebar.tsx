"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { cn } from "@/lib/cn";
import { useLocale } from "./LocaleProvider";
import { signOut } from "@/app/actions/auth";
import { Logo } from "./Logo";

const STORAGE_KEY = "parent_sidebar_collapsed";

export function ParentSidebar() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dp = d.parent;

  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") setCollapsed(true);
    } catch { /* blocked */ }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* blocked */ }
      return next;
    });
  }

  const isCollapsed = mounted && collapsed;
  const width = isCollapsed ? "w-16" : "w-[230px]";

  // Only one real destination for now — the rest of the parent nav (children
  // profiles, chat, payments, ...) lands in later Iteration 6 prompts (П5+).
  const navItems = [
    { key: "dashboard", href: "/parent/dashboard", icon: LayoutDashboard, label: dp.navDashboard },
  ];

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col py-6 shadow-2xl rounded-r-[32px] md:flex transition-[width] duration-200 sticky top-0 h-screen overflow-y-auto",
        width,
      )}
      style={{ background: "linear-gradient(to bottom, #db2777, #831843)" }}
    >
      <div className={cn(
        "mb-8 px-3",
        isCollapsed ? "flex flex-col items-center gap-3" : "flex items-center justify-between gap-2",
      )}>
        <div className="flex min-w-0 items-center gap-3">
          {isCollapsed ? (
            <span className="text-[11px] font-extrabold tracking-[3px] text-white">SNR</span>
          ) : (
            <div className="rounded-xl bg-white/90 px-2.5 py-1.5 shadow-inner">
              <Logo priority className="h-6" />
            </div>
          )}
        </div>
        <button
          onClick={toggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          title={isCollapsed ? "Развернуть" : "Свернуть"}
        >
          {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="mb-8 px-3">
          <div className="w-fit rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-pink-700 shadow-sm">
            {dp.role}
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-medium transition-all duration-200",
                active
                  ? "bg-white/25 text-white shadow-sm backdrop-blur-sm"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
                isCollapsed && "justify-center",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
              {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/20 pt-4 px-2">
        <form action={signOut}>
          <button
            type="submit"
            title="Выйти"
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl p-3 text-white/70 transition-all hover:bg-white/10 hover:text-white",
              isCollapsed && "justify-center",
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" strokeWidth={2} />
            {!isCollapsed && <span className="font-medium">Выйти</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}
