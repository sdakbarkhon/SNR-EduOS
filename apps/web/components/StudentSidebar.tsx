"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Trophy, CircleDot, MessageCircle, type LucideIcon } from "lucide-react";
import { getDictionary, getHomework, getMySubmissions, getUnreadThreadCount } from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { useLocale } from "./LocaleProvider";
import { useToast } from "./Toast";
import { useRealtimeChannel } from "@/lib/realtime";
import { Logo } from "./Logo";
import { navItems as baseNavItems, type NavItem } from "./nav-items";

const STORAGE_KEY = "student-sidebar-collapsed";

interface SidebarItem extends NavItem {
  isStub?: boolean;
}

// The 3 stub items (no real page yet) are inserted between "Проекты" and
// "AI-помощник" — kept OUT of the shared nav-items.ts array on purpose, since
// that array is also consumed by BottomNav.tsx (mobile), which we're not
// touching in this redesign.
const STUB_ITEMS: SidebarItem[] = [
  { key: "achievements", href: "#", icon: Trophy, label: (d) => d.nav.achievements, isStub: true },
  { key: "clubs", href: "#", icon: CircleDot, label: (d) => d.nav.clubs, isStub: true },
  { key: "messages", href: "/messages", icon: MessageCircle, label: (d) => d.nav.messages },
];

// "ai" is filtered out here only — nav-items.ts itself is left untouched
// since BottomNav.tsx (and the AI-assistant page's own route) still consume
// it unchanged; the AI assistant is now a floating button (see
// AiFloatingButton.tsx), not a sidebar destination.
function buildItems(): SidebarItem[] {
  const items = (baseNavItems as SidebarItem[]).filter((i) => i.key !== "ai");
  const projectsIdx = items.findIndex((i) => i.key === "projects");
  items.splice(projectsIdx + 1, 0, ...STUB_ITEMS);
  return items;
}

const SIDEBAR_ITEMS = buildItems();

// Цвет иконки + фон-плашка на пункт меню — по палитре Claude Design (Iter5 P9).
// Пунктов дизайна (9) меньше, чем в проекте (13) — для недостающих подобраны
// цвета из той же палитры мока (см. отчёт).
const ITEM_STYLE: Record<string, { color: string; bg: string }> = {
  home: { color: "#FF9A3D", bg: "#FFE9CC" },
  lessons: { color: "#7C5CFF", bg: "#ECE6FF" },
  homework: { color: "#3E86F5", bg: "#E3EDFF" },
  grades: { color: "#20B6C6", bg: "#DFF6F5" },
  attendance: { color: "#35C08E", bg: "#DFF7EC" },
  materials: { color: "#F368A8", bg: "#FDE6F0" },
  books: { color: "#FF7A3D", bg: "#FFE7DC" },
  projects: { color: "#46C06B", bg: "#E2F5E9" },
  achievements: { color: "#FFB020", bg: "#FFF0CE" },
  clubs: { color: "#8A5CF6", bg: "#EFE7FF" },
  messages: { color: "#F5455C", bg: "#FFE1EA" },
  ai: { color: "#6A48E4", bg: "#EFEBFF" },
  profile: { color: "#9A9AB5", bg: "#ECECF3" },
};
const DEFAULT_ITEM_STYLE = { color: "#9A9AB5", bg: "#ECECF3" };

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function StudentSidebar() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const showToast = useToast();

  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [homeworkCount, setHomeworkCount] = useState(0);
  const [unreadThreads, setUnreadThreads] = useState(0);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setCollapsed(true);
      else if (stored === "false") setCollapsed(false);
      // No explicit user preference yet — default collapsed on tablet widths
      // (md-lg, roughly 768-1023px) so the 320px-wide expanded sidebar
      // doesn't eat most of the viewport; desktop/large screens keep the
      // existing expanded default.
      else if (window.innerWidth < 1024) setCollapsed(true);
    } catch { /* blocked */ }

    const db = createClient();
    Promise.all([getHomework(db), getMySubmissions(db)])
      .then(([homework, submissions]) => {
        const submittedIds = new Set(submissions.map((s) => s.homework_id));
        setHomeworkCount(homework.filter((h) => !submittedIds.has(h.id)).length);
      })
      .catch(() => null);

    db.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null));
    getUnreadThreadCount(db).then(setUnreadThreads).catch(() => null);
  }, []);

  useRealtimeChannel(
    myUserId ? `student-sidebar-unread-${myUserId}` : null,
    "chat_messages",
    undefined,
    () => {
      getUnreadThreadCount(createClient()).then(setUnreadThreads).catch(() => null);
    },
  );

  // Reading a thread writes to chat_read_state, not chat_messages — without this,
  // the badge only cleared when a NEW message arrived, never when the student
  // actually read one.
  useRealtimeChannel(
    myUserId ? `student-sidebar-unread-read-state-${myUserId}` : null,
    "chat_read_state",
    undefined,
    () => {
      getUnreadThreadCount(createClient()).then(setUnreadThreads).catch(() => null);
    },
  );

  useEffect(() => {
    if (pathname.startsWith("/messages")) {
      getUnreadThreadCount(createClient()).then(setUnreadThreads).catch(() => null);
    }
  }, [pathname]);

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
        "hidden shrink-0 flex-col gap-2 rounded-r-[24px] bg-white p-3 md:flex",
        "shadow-[0_8px_24px_rgba(93,80,150,0.05)] transition-[width] duration-200 ease-in-out",
        isCollapsed ? "w-16 px-2" : "w-80 px-4",
      )}
    >
      {/* Логотип + сворачивание */}
      <div className={cn("flex items-center", isCollapsed ? "flex-col gap-2" : "justify-between")}>
        {isCollapsed ? (
          <span className="text-[11px] font-extrabold tracking-[3px] text-[#FF9A3D]">SNR</span>
        ) : (
          <Logo priority className="h-7" />
        )}
        <button
          onClick={toggle}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F4F2FC] text-[#7C5CFF] transition hover:bg-[#EBE7F8]"
          title={isCollapsed ? "Развернуть" : "Свернуть"}
          aria-label={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform duration-200", isCollapsed && "rotate-180")} />
        </button>
      </div>

      {/* Пункты меню */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = !item.isStub && pathname.startsWith(item.href);
          const Icon = item.icon as LucideIcon;
          const style = ITEM_STYLE[item.key] ?? DEFAULT_ITEM_STYLE;
          const badge =
            item.key === "homework" ? homeworkCount
            : item.key === "messages" ? unreadThreads
            : undefined;
          const showBadge = badge !== undefined && badge > 0 && !isCollapsed;

          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={item.isStub ? onStubClick : undefined}
              title={item.label(d)}
              className={cn(
                "relative flex items-center gap-3 rounded-xl py-1.5 transition-colors",
                isCollapsed ? "justify-center px-0" : "px-2.5",
                isActive ? "bg-[#FFF3D4]" : "hover:bg-[#F3EFFF]",
              )}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] transition-colors"
                style={{
                  color: isActive ? "#fff" : style.color,
                  background: isActive ? style.color : style.bg,
                  boxShadow: isActive ? `0 5px 12px ${hexToRgba(style.color, 0.4)}` : undefined,
                }}
              >
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              {!isCollapsed && (
                <div className="flex min-w-0 flex-1 items-center justify-between">
                  <span
                    className="truncate text-sm"
                    style={{ fontWeight: isActive ? 800 : 700, color: isActive ? "#2C2A48" : "#6F6F8C" }}
                  >
                    {item.label(d)}
                  </span>
                  {showBadge && (
                    <span className="ml-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#F5455C] px-1.5 text-[11px] font-extrabold text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </div>
              )}
              {isCollapsed && badge !== undefined && badge > 0 && (
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#F5455C]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Карточка уровня — заглушка без БД */}
      <div
        className={cn(
          "relative mt-auto shrink-0 overflow-hidden rounded-2xl",
          "shadow-[0_12px_26px_rgba(120,90,240,0.14)]",
          isCollapsed ? "px-1.5 py-2.5 text-center" : "px-3 py-2.5",
        )}
        style={{ background: "linear-gradient(160deg,#EFEBFF 0%,#E5DBFF 100%)" }}
      >
        {!isCollapsed && (
          <>
            <span className="animate-twinkle absolute left-[96px] top-2 text-[13px] text-[#B79BFF]">✦</span>
            <span className="animate-twinkle absolute left-[118px] top-9 text-[10px] text-[#FFC93C]" style={{ animationDelay: ".8s" }}>✦</span>
            <div className="max-w-[118px]">
              <p className="text-[11px] font-extrabold text-[#9781CE]">{d.nav.myLevel}</p>
              <p className="text-lg font-black leading-none text-[#7C5CFF]">Lv. 12</p>
              <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-white shadow-[inset_0_1px_2px_rgba(120,90,240,0.1)]">
                <div className="h-full rounded-full" style={{ width: "68%", background: "linear-gradient(90deg,#FFD24A,#FF9F2E)" }} />
              </div>
              <p className="mt-1 text-[11px] font-extrabold text-[#6F6F8C]">820 / 1200 XP</p>
            </div>
          </>
        )}
        <div className={cn("text-[38px] leading-none", isCollapsed ? "mt-0.5" : "absolute -bottom-1 right-0.5")}>
          🧑‍🚀
        </div>
      </div>
    </aside>
  );
}
