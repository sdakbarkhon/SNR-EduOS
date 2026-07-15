"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, BookOpen, Award, CalendarDays, GraduationCap, Briefcase,
  Megaphone, Users, Settings, LogOut, Bell, MessageCircle,
  PanelLeftClose, PanelLeftOpen, ClipboardList,
} from "lucide-react";
import { getDictionary, getUnreadThreadCount } from "@snr/core";
import type { Locale } from "@snr/core";
import { cn } from "@/lib/cn";
import { useLocale } from "./LocaleProvider";
import { useRealtimeChannel } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/actions/auth";
import { Logo } from "./Logo";

const STORAGE_KEY = "teacher_sidebar_collapsed";

// Runs before the browser paints (unlike useEffect, which runs after) so the
// persisted/tablet-default collapsed state applies on the very first frame —
// otherwise the sidebar briefly renders expanded with the "collapse" icon,
// then visibly animates to collapsed with the "expand" icon on every load.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Exported for TeacherTopbar.tsx — the page-title-instead-of-search shown
// there matches pathname against this same {href, label} list, so sidebar
// and header always agree on what the current page is called.
export const teacherNavItems = [
  { key: "home",       href: "/teacher/dashboard",    icon: Home,          label: (d: ReturnType<typeof getDictionary>) => d.teacher.navHome },
  { key: "lessons",    href: "/teacher/lessons",      icon: CalendarDays,  label: (d: ReturnType<typeof getDictionary>) => d.teacher.navLessons },
  { key: "curriculum", href: "/teacher/curriculum",   icon: ClipboardList, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navCurriculumPlans },
  { key: "homework",   href: "/teacher/homework",     icon: BookOpen,      label: (d: ReturnType<typeof getDictionary>) => d.teacher.navHomework },
  { key: "grades",     href: "/teacher/grades",       icon: Award,         label: (d: ReturnType<typeof getDictionary>) => d.teacher.navGrades },
  { key: "knowledgeBase", href: "/teacher/knowledge-base", icon: GraduationCap, label: (d: ReturnType<typeof getDictionary>) => d.teacher.navKnowledgeBase },
  { key: "notifications", href: "/teacher/notifications",  icon: Bell,      label: (d: ReturnType<typeof getDictionary>) => d.nav.notifications },
  { key: "messages",   href: "/teacher/messages",     icon: MessageCircle, label: (d: ReturnType<typeof getDictionary>) => d.nav.messages },
  { key: "announce",   href: "/teacher/announcements",icon: Megaphone,     label: (d: ReturnType<typeof getDictionary>) => d.teacher.announcements.nav },
  { key: "projects",   href: "/teacher/projects",     icon: Briefcase,     label: (d: ReturnType<typeof getDictionary>) => d.teacher.projects.nav },
  { key: "groups",     href: "/teacher/groups",       icon: Users,         label: (d: ReturnType<typeof getDictionary>) => d.teacher.navGroups },
  { key: "settings",   href: "/teacher/settings",     icon: Settings,      label: (d: ReturnType<typeof getDictionary>) => d.settings.title },
];

export function TeacherSidebar() {
  const pathname = usePathname();
  // pathname only updates once a navigation actually commits — with
  // prefetch off, that can take a beat. Tracking the just-clicked href lets
  // the active highlight react instantly instead of waiting on the route.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const router = useRouter();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unreadThreads, setUnreadThreads] = useState(0);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useIsoLayoutEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setCollapsed(true);
      else if (stored === "false") setCollapsed(false);
      // No explicit user preference yet — default collapsed on tablet widths
      // (md-lg, roughly 768-1023px), matching StudentSidebar's behavior.
      else if (window.innerWidth < 1024) setCollapsed(true);
    } catch { /* blocked */ }
  }, []);

  useEffect(() => {
    const db = createClient();
    db.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null));
    getUnreadThreadCount(db).then(setUnreadThreads).catch((e) => console.error("[TeacherSidebar] getUnreadThreadCount failed:", e?.message ?? e));
  }, []);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useRealtimeChannel(
    myUserId ? `teacher-sidebar-unread-${myUserId}` : null,
    "chat_messages",
    undefined,
    () => {
      getUnreadThreadCount(createClient()).then(setUnreadThreads).catch((e) => console.error("[TeacherSidebar] getUnreadThreadCount failed:", e?.message ?? e));
    },
  );

  // Reading a thread writes to chat_read_state, not chat_messages — without this,
  // the sidebar badge only cleared when a NEW message arrived, never when the
  // teacher actually read one (the chat header's own count updated fine since
  // MessagesView re-fetches itself after markThreadRead; this component didn't).
  useRealtimeChannel(
    myUserId ? `teacher-sidebar-unread-read-state-${myUserId}` : null,
    "chat_read_state",
    undefined,
    () => {
      getUnreadThreadCount(createClient()).then(setUnreadThreads).catch((e) => console.error("[TeacherSidebar] getUnreadThreadCount failed:", e?.message ?? e));
    },
  );

  useEffect(() => {
    if (pathname.startsWith("/teacher/messages")) {
      getUnreadThreadCount(createClient()).then(setUnreadThreads).catch((e) => console.error("[TeacherSidebar] getUnreadThreadCount failed:", e?.message ?? e));
    }
  }, [pathname]);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* blocked */ }
      return next;
    });
  }

  // Navigate away immediately — don't make the user wait on the
  // Supabase (Frankfurt) round trip before the screen changes. Сам выход —
  // через server action (single-session: штампует last_activity, снимает
  // auth- и демо-куки).
  function handleLogout() {
    router.replace("/login");
    signOut().catch(() => {});
  }

  const isCollapsed = mounted && collapsed;
  const width = isCollapsed ? "w-16" : "w-[230px]";

  return (
    <aside
      className={cn(
        "scrollbar-hide hidden shrink-0 flex-col py-4 shadow-2xl rounded-r-[32px] md:flex transition-[width] duration-200 h-screen overflow-y-auto sticky top-0",
        width,
      )}
      style={{ background: "linear-gradient(to bottom, #2563EB, #1E3A8A)" }}
    >
      {/* Branding + collapse */}
      <div className={cn(
        "mb-3 px-3",
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

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2">
        {teacherNavItems.map((item) => {
          const active = pendingHref ? pendingHref === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          const showBadge = item.key === "messages" && unreadThreads > 0;
          return (
            <Link
              key={item.key}
              href={item.href}
              // Промт «скорость», Задача 5: тот же fix, что StudentSidebar —
              // все пункты здесь реальные маршруты, префетч по умолчанию.
              onClick={() => setPendingHref(item.href)}
              title={item.label(d)}
              className={cn(
                "relative flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-medium transition-all duration-200",
                active
                  ? "bg-white/25 text-white shadow-sm backdrop-blur-sm"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
                isCollapsed && "justify-center",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
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

      {/* Logout */}
      <div className="shrink-0 border-t border-white/20 pt-4 px-2">
        <button
          type="button"
          onClick={handleLogout}
          title="Выйти"
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl p-3 text-white/70 transition-all hover:bg-white/10 hover:text-white",
            isCollapsed && "justify-center",
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" strokeWidth={2} />
          {!isCollapsed && <span className="font-medium">Выйти</span>}
        </button>
      </div>
    </aside>
  );
}
