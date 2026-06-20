"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Megaphone, FileText, Award, CheckCircle, CalendarX, FolderOpen, Check,
} from "lucide-react";
import {
  getDictionary, getMyNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead,
  type Locale, type AppNotification, type NotificationKind,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeChannel } from "@/lib/realtime";
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
};

export function NotificationsBell() {
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const prevUnread = useRef(0);

  async function reload() {
    const [list, count] = await Promise.all([
      getMyNotifications(db, 20).catch(() => []),
      getUnreadCount(db).catch(() => 0),
    ]);
    setItems(list);
    setUnread(count);
    if (count > prevUnread.current) { setShake(true); setTimeout(() => setShake(false), 700); }
    prevUnread.current = count;
  }

  useEffect(() => {
    db.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    reload();
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: new notification for me
  useRealtimeChannel(uid ? `notif-${uid}` : null, "notifications", uid ? `recipient_user_id=eq.${uid}` : undefined, reload);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

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

  return (
    <div ref={wrapRef} className="relative">
      <style>{`@keyframes bellshake{0%,100%{transform:rotate(0)}20%{transform:rotate(15deg)}40%{transform:rotate(-12deg)}60%{transform:rotate(8deg)}80%{transform:rotate(-5deg)}}`}</style>
      <button
        type="button"
        aria-label={t.title}
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/70 text-blue-600 shadow-sm backdrop-blur-xl transition-colors hover:bg-white/90"
      >
        <Bell size={18} style={shake ? { animation: "bellshake 0.7s ease" } : undefined} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[380px] max-w-[90vw] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-bold text-slate-800">{t.title}</span>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:underline">
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
                    className={cn("flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50", !n.is_read && "bg-blue-50/40")}>
                    <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", !n.is_read ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400")}>
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[13px] text-slate-800", !n.is_read ? "font-bold" : "font-medium")}>{n.title}</p>
                      {n.body && <p className="truncate text-[12px] text-slate-500">{n.body}</p>}
                      <p className="mt-0.5 text-[11px] text-slate-400">{ago(n.created_at)}</p>
                    </div>
                    {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
