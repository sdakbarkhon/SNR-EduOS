"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, ChevronLeft, ChevronRight } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { cn } from "@/lib/cn";
import { useLocale } from "./LocaleProvider";
import { navItems } from "./nav-items";

const STORAGE_KEY = "sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

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

  const width = mounted && collapsed ? "w-16" : "w-[230px]";

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col py-6 shadow-2xl rounded-r-[32px] md:flex transition-[width] duration-200",
        width,
      )}
      style={{ background: "linear-gradient(to bottom, #2A75FF, #0A3CB4)" }}
    >
      {/* Бренд */}
      <div className="mb-8 flex items-center gap-3 px-4 overflow-hidden">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-inner">
          <GraduationCap className="h-6 w-6 text-white" strokeWidth={2.5} />
        </div>
        {(!mounted || !collapsed) && (
          <span className="whitespace-nowrap text-[17px] font-bold tracking-wide text-white">
            SNR EduOS
          </span>
        )}
      </div>

      {/* Навигация */}
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              title={item.label(d)}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-medium transition-all duration-200",
                active
                  ? "bg-white/25 text-white shadow-sm backdrop-blur-sm"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
                mounted && collapsed && "justify-center",
              )}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 2}
                className="shrink-0"
              />
              {(!mounted || !collapsed) && (
                <span className="whitespace-nowrap">{item.label(d)}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Toggle button */}
      <button
        onClick={toggle}
        className="mx-auto mt-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white/80 transition-colors hover:bg-white/25 hover:text-white"
        title={collapsed ? "Развернуть" : "Свернуть"}
      >
        {mounted && collapsed
          ? <ChevronRight className="h-4 w-4" />
          : <ChevronLeft className="h-4 w-4" />
        }
      </button>
    </aside>
  );
}
