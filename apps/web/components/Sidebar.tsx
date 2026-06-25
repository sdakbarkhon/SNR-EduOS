"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { getDictionary, getUnreadCount } from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { useLocale } from "./LocaleProvider";
import { navItems } from "./nav-items";
import { Avatar } from "./Avatar";

const STORAGE_KEY = "sidebar-collapsed";

export function Sidebar({
  studentName,
  avatarUrl,
}: {
  studentName?: string;
  avatarUrl?: string | null;
} = {}) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dbRef = useRef<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") setCollapsed(true);
    } catch { /* blocked */ }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    try {
      const db = createClient();
      dbRef.current = db;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getUnreadCount(db as any).then(setUnreadCount).catch(() => null);
      intervalId = setInterval(() => {
        const d = dbRef.current;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (d) getUnreadCount(d as any).then(setUnreadCount).catch(() => null);
      }, 30000);
    } catch { /* noop */ }

    return () => { if (intervalId) clearInterval(intervalId); };
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

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col py-6 shadow-2xl rounded-r-[32px] md:flex transition-[width] duration-200 sticky top-0 h-screen overflow-y-auto",
        width,
      )}
      style={{ background: "linear-gradient(to bottom, #2A75FF, #0A3CB4)" }}
    >
      {/* Бренд + кнопка сворачивания (в одной строке сверху) */}
      <div
        className={cn(
          "mb-8 px-3",
          isCollapsed ? "flex flex-col items-center gap-3" : "flex items-center justify-between gap-2",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-inner">
            <GraduationCap className="h-6 w-6 text-white" strokeWidth={2.5} />
          </div>
          {!isCollapsed && (
            <span className="whitespace-nowrap text-[17px] font-bold tracking-wide text-white">
              SNR EduOS
            </span>
          )}
        </div>

        <button
          onClick={toggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          title={isCollapsed ? "Развернуть" : "Свернуть"}
          aria-label={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
        >
          {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      </div>

      {/* Профиль */}
      {studentName && (
        <div className="mb-4 px-3">
          <Link
            href="/profile"
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-white/10",
              isCollapsed && "justify-center",
            )}
          >
            <Avatar name={studentName} src={avatarUrl ?? undefined} size={32} />
            {!isCollapsed && (
              <span className="truncate text-sm font-semibold text-white/90">{studentName}</span>
            )}
          </Link>
        </div>
      )}

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
                "relative flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-medium transition-all duration-200",
                active
                  ? "bg-white/25 text-white shadow-sm backdrop-blur-sm"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
                isCollapsed && "justify-center",
              )}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 2}
                className="shrink-0"
              />
              {!isCollapsed && (
                <span className="whitespace-nowrap">{item.label(d)}</span>
              )}
              {item.key === "notifications" && unreadCount > 0 && !isCollapsed && (
                <span className="ml-auto min-w-[20px] rounded-full bg-red-500 px-1.5 text-center text-[10px] font-bold leading-[20px] text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
              {item.key === "notifications" && unreadCount > 0 && isCollapsed && (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
