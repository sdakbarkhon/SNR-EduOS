"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Award,
  ClipboardList,
  CheckSquare,
  Wallet,
  UserCircle,
  MessageCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { getDictionary, getUnreadThreadCount } from "@snr/core";
import type { Locale } from "@snr/core";
import { cn } from "@/lib/cn";
import { useLocale } from "./LocaleProvider";
import { useLogout, LogoutOverlay } from "./LogoutOverlay";
import { useRealtimeChannel } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "./Logo";

const STORAGE_KEY = "parent_sidebar_collapsed";

// Runs before the browser paints (unlike useEffect, which runs after) so the
// persisted collapsed state applies on the very first frame — otherwise the
// sidebar briefly renders expanded with the "collapse" icon, then visibly
// animates to collapsed with the "expand" icon on every load.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface SidebarItem {
  key: string;
  hrefFor: (childId: string | null) => string;
  icon: LucideIcon;
  label: (d: ReturnType<typeof getDictionary>) => string;
}

const ITEMS: SidebarItem[] = [
  { key: "dashboard", hrefFor: () => "/parent/dashboard", icon: Home, label: (d) => d.parentNav.dashboard },
  { key: "schedule", hrefFor: (id) => `/parent/child/${id ?? ""}/schedule`, icon: Calendar, label: (d) => d.parentNav.schedule },
  { key: "grades", hrefFor: (id) => `/parent/child/${id ?? ""}/grades`, icon: Award, label: (d) => d.parentNav.grades },
  { key: "homework", hrefFor: (id) => `/parent/child/${id ?? ""}/homework`, icon: ClipboardList, label: (d) => d.parentNav.homework },
  { key: "attendance", hrefFor: (id) => `/parent/child/${id ?? ""}/attendance`, icon: CheckSquare, label: (d) => d.parentNav.attendance },
  { key: "payments", hrefFor: (id) => `/parent/child/${id ?? ""}/payments`, icon: Wallet, label: (d) => d.parentNav.payments },
  { key: "profile", hrefFor: (id) => `/parent/child/${id ?? ""}/profile`, icon: UserCircle, label: (d) => d.parentNav.childProfile },
  { key: "messages", hrefFor: () => "/parent/messages", icon: MessageCircle, label: (d) => d.parentNav.messages },
];

export function ParentSidebar({ selectedChildId }: { selectedChildId: string | null }) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const { loggingOut, logout } = useLogout();

  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unreadThreads, setUnreadThreads] = useState(0);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useIsoLayoutEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") setCollapsed(true);
    } catch { /* blocked */ }
  }, []);

  useEffect(() => {
    const db = createClient();
    db.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null));
    getUnreadThreadCount(db).then(setUnreadThreads).catch((e) => console.error("[ParentSidebar] getUnreadThreadCount failed:", e?.message ?? e));
  }, []);

  useRealtimeChannel(
    myUserId ? `parent-sidebar-unread-${myUserId}` : null,
    "chat_messages",
    undefined,
    () => {
      getUnreadThreadCount(createClient()).then(setUnreadThreads).catch((e) => console.error("[ParentSidebar] getUnreadThreadCount failed:", e?.message ?? e));
    },
  );

  // Reading a thread writes to chat_read_state, not chat_messages — without this,
  // the badge only cleared when a NEW message arrived, never when the parent
  // actually read one.
  useRealtimeChannel(
    myUserId ? `parent-sidebar-unread-read-state-${myUserId}` : null,
    "chat_read_state",
    undefined,
    () => {
      getUnreadThreadCount(createClient()).then(setUnreadThreads).catch((e) => console.error("[ParentSidebar] getUnreadThreadCount failed:", e?.message ?? e));
    },
  );

  useEffect(() => {
    if (pathname.startsWith("/parent/messages")) {
      getUnreadThreadCount(createClient()).then(setUnreadThreads).catch((e) => console.error("[ParentSidebar] getUnreadThreadCount failed:", e?.message ?? e));
    }
  }, [pathname]);

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
      style={{ background: "linear-gradient(to bottom, #db2777, #831843)" }}
    >
      <div className={cn(
        "mb-6 px-3",
        isCollapsed ? "flex flex-col items-center gap-3" : "flex items-center justify-between gap-2",
      )}>
        <div className="flex min-w-0 items-center gap-3">
          {isCollapsed ? (
            <span className="text-[11px] font-extrabold tracking-[3px] text-white">SNR</span>
          ) : (
            <div className="rounded-xl px-2.5 py-1.5">
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
        <div className="mb-6 px-3">
          <div className="w-fit rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-pink-700 shadow-sm">
            {d.parent.role}
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2">
        {ITEMS.map((item) => {
          const href = item.hrefFor(selectedChildId);
          const active = item.key === "dashboard"
            ? pathname === "/parent/dashboard"
            : item.key === "messages"
              ? pathname.startsWith("/parent/messages")
              : pathname.startsWith(`/parent/child/`) && pathname.includes(`/${item.key}`);
          const Icon = item.icon;
          const showBadge = item.key === "messages" && unreadThreads > 0;
          return (
            <Link
              key={item.key}
              href={href}
              title={item.label(d)}
              className={cn(
                "relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200",
                active
                  ? "bg-white/25 text-white shadow-sm backdrop-blur-sm"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
                isCollapsed && "justify-center",
              )}
            >
              <Icon size={19} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
              {!isCollapsed && <span className="whitespace-nowrap">{item.label(d)}</span>}
              {showBadge && !isCollapsed && (
                <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#F5455C] px-1.5 text-[11px] font-extrabold text-white">
                  {unreadThreads > 99 ? "99+" : unreadThreads}
                </span>
              )}
              {showBadge && isCollapsed && (
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#F5455C]" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/20 pt-4 px-2">
        <button
          type="button"
          onClick={logout}
          title={d.parent.role}
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl p-3 text-white/70 transition-all hover:bg-white/10 hover:text-white",
            isCollapsed && "justify-center",
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" strokeWidth={2} />
          {!isCollapsed && <span className="font-medium">{d.parentNav.logout}</span>}
        </button>
      </div>
      {loggingOut && <LogoutOverlay />}
    </aside>
  );
}
