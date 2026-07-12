"use client";

import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell, Megaphone, FileText, Award, CheckCircle, CalendarX, FolderOpen, Check, ChevronRight, Clock,
} from "lucide-react";
import {
  getDictionary, getMyNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead,
  type Locale, type AppNotification, type NotificationKind,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "./LocaleProvider";
import { cn } from "@/lib/cn";

const ICONS: Record<NotificationKind, typeof Bell> = {
  announcement: Megaphone,
  new_homework: FileText,
  new_grade: Award,
  homework_graded: Award,
  lesson_material: FolderOpen,
  student_excused: CalendarX,
  student_submitted: CheckCircle,
  leave_request: CalendarX,
  leave_decision: CheckCircle,
  lesson_starting_soon: Clock,
};

export const NotificationsBell = memo(function NotificationsBell() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.notifications;
  const router = useRouter();
  const db = createClient();

  const [uid, setUid] = useState<string | null>(null);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [shake, setShake] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 64, right: 16 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const prevUnread = useRef(0);
  const reloadRef = useRef<() => void>(() => {});

  async function reload() {
    const [list, count] = await Promise.all([
      getMyNotifications(db, 20).catch((e) => { console.error("[NotificationsBell] getMyNotifications failed:", e?.message ?? e); return []; }),
      getUnreadCount(db).catch((e) => { console.error("[NotificationsBell] getUnreadCount failed:", e?.message ?? e); return 0; }),
    ]);
    setItems(list);
    setUnread(count);
    if (count > prevUnread.current) { setShake(true); setTimeout(() => setShake(false), 700); }
    prevUnread.current = count;
  }
  reloadRef.current = reload;

  // Resolve auth uid + initial load + clock (once)
  useEffect(() => {
    db.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    reload();
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: subscribe EXACTLY once per uid, filtered by auth user id.
  useEffect(() => {
    if (!uid) return;
    const channel = db
      .channel(`notif-${uid}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${uid}` },
        () => { reloadRef.current(); },
      )
      .subscribe();
    return () => { db.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Close on outside click (account for the portalled dropdown)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const tgt = e.target as Node;
      if (btnRef.current?.contains(tgt)) return;
      if (dropRef.current?.contains(tgt)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    }
    setOpen((o) => !o);
  }

  function ago(iso: string): string {
    if (nowMs === null) return "";
    const secs = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
    if (secs < 60) return t.agoSeconds.replace("{n}", String(secs));
    if (secs < 3600) return t.agoMinutes.replace("{n}", String(Math.floor(secs / 60)));
    if (secs < 86400) return t.agoHours.replace("{n}", String(Math.floor(secs / 3600)));
    return t.agoDays.replace("{n}", String(Math.floor(secs / 86400)));
  }

  async function onItem(n: AppNotification) {
    if (!n.is_read) {
      setItems((p) => p.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      prevUnread.current = Math.max(0, prevUnread.current - 1);
      markNotificationRead(db, n.id).catch(() => null);
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function markAll() {
    setItems((p) => p.map((x) => ({ ...x, is_read: true })));
    setUnread(0);
    prevUnread.current = 0;
    await markAllNotificationsRead(db).catch(() => null);
  }

  const dropdown = open && typeof document !== "undefined" ? createPortal(
    <div
      ref={dropRef}
      style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999, width: 380, maxWidth: "92vw" }}
      className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.title}</span>
        {unread > 0 && (
          <button onClick={markAll} className="flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:underline dark:text-blue-400">
            <Check size={13} /> {t.markAll}
          </button>
        )}
      </div>
      <div className="max-h-[440px] overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">{t.empty}</p>
        ) : (
          items.map((n) => {
            const Icon = ICONS[n.kind] ?? Bell;
            return (
              <button key={n.id} onClick={() => onItem(n)}
                className={cn("flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-700/40",
                  !n.is_read && "bg-blue-50/40 dark:bg-blue-500/10")}>
                <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  !n.is_read ? "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300" : "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400")}>
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[13px] text-slate-800 dark:text-slate-100", !n.is_read ? "font-bold" : "font-medium")}>{n.title}</p>
                  {n.body && <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">{n.body}</p>}
                  <p className="mt-0.5 text-[11px] text-slate-400">{ago(n.created_at)}</p>
                </div>
                {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
              </button>
            );
          })
        )}
      </div>
      {/* See all link */}
      <div className="border-t border-slate-100 dark:border-slate-700">
        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="flex w-full items-center justify-center gap-1 py-2.5 text-[12px] font-semibold text-blue-600 hover:bg-slate-50 dark:text-blue-400 dark:hover:bg-slate-700/40"
        >
          {t.seeAll}
          <ChevronRight size={12} />
        </Link>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="relative">
      <style>{`@keyframes bellshake{0%,100%{transform:rotate(0)}20%{transform:rotate(15deg)}40%{transform:rotate(-12deg)}60%{transform:rotate(8deg)}80%{transform:rotate(-5deg)}}`}</style>
      <button
        ref={btnRef}
        type="button"
        aria-label={t.title}
        onClick={toggle}
        className="relative flex h-10 items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 shadow-sm backdrop-blur-xl transition-colors hover:bg-white/90 dark:border-slate-600 dark:bg-slate-700/70 dark:hover:bg-slate-700"
      >
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <defs>
            <linearGradient id="notif-bell-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7C63F0" />
              <stop offset="1" stopColor="#6A4FE6" />
            </linearGradient>
          </defs>
        </svg>
        <Bell size={18} stroke="url(#notif-bell-gradient)" style={shake ? { animation: "bellshake 0.7s ease" } : undefined} />
        {/* Промт 6.2.1: слово "Уведомления" рядом с колокольчиком на
            планшете съедало место в шапке — скрыто до lg (>=1024),
            остаются только иконка + badge непрочитанных. */}
        <span
          className="hidden bg-clip-text text-sm font-medium text-transparent lg:inline"
          style={{ backgroundImage: "linear-gradient(135deg,#7C63F0,#6A4FE6)" }}
        >
          {d.nav.notifications}
        </span>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {dropdown}
    </div>
  );
});
