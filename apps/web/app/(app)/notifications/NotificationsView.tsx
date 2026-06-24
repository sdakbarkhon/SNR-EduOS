"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Megaphone, FileText, Award, CheckCircle, CalendarX,
  FolderOpen, Trash2, Check,
} from "lucide-react";
import {
  getDictionary, getMyNotifications, markNotificationRead,
  markAllNotificationsRead, deleteNotification,
  type Locale, type AppNotification, type NotificationKind,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { cn } from "@/lib/cn";

// ── Config ────────────────────────────────────────────────────────────

const ICONS: Record<NotificationKind, typeof Bell> = {
  announcement: Megaphone,
  new_homework: FileText,
  new_grade: Award,
  homework_graded: Award,
  lesson_material: FolderOpen,
  student_excused: CalendarX,
  student_submitted: CheckCircle,
};

const PAGE_SIZE = 20;

// ── Helpers ───────────────────────────────────────────────────────────

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
}

function isYesterday(iso: string): boolean {
  const d = new Date(iso);
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  return d.getDate() === yest.getDate() &&
    d.getMonth() === yest.getMonth() &&
    d.getFullYear() === yest.getFullYear();
}

function dateLabel(iso: string, today: string, yesterday: string): string {
  if (isToday(iso)) return today;
  if (isYesterday(iso)) return yesterday;
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tashkent",
  });
}

type Group = { label: string; items: AppNotification[] };

function groupByDate(items: AppNotification[], today: string, yesterday: string): Group[] {
  const map = new Map<string, AppNotification[]>();
  for (const n of items) {
    const label = dateLabel(n.created_at, today, yesterday);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(n);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

// ── Main Component ────────────────────────────────────────────────────

export function NotificationsView({
  initialNotifications,
}: {
  initialNotifications: AppNotification[];
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.notifications;
  const router = useRouter();
  const db = createClient();

  const [uid, setUid] = useState<string | null>(null);
  const [items, setItems] = useState<AppNotification[]>(initialNotifications);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialNotifications.length >= PAGE_SIZE);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const reloadRef = useRef<() => void>(() => {});

  async function reload() {
    const list = await getMyNotifications(db, page * PAGE_SIZE).catch(() => []);
    setItems(list);
    setHasMore(list.length >= page * PAGE_SIZE);
  }
  reloadRef.current = reload;

  useEffect(() => {
    db.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: new notification → prepend
  useEffect(() => {
    if (!uid) return;
    const channel = db
      .channel(`notif-page-${uid}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `recipient_user_id=eq.${uid}`,
      }, () => { reloadRef.current(); })
      .subscribe();
    return () => { db.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const nextPage = page + 1;
      const list = await getMyNotifications(db, nextPage * PAGE_SIZE).catch(() => []);
      setItems(list);
      setPage(nextPage);
      setHasMore(list.length >= nextPage * PAGE_SIZE);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function onItem(n: AppNotification) {
    if (!n.is_read) {
      setItems((p) => p.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
      markNotificationRead(db, n.id).catch(() => null);
    }
    if (n.link) router.push(n.link);
  }

  async function onDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setItems((p) => p.filter((x) => x.id !== id));
    deleteNotification(db, id).catch(() => null);
  }

  async function markAll() {
    setItems((p) => p.map((x) => ({ ...x, is_read: true })));
    await markAllNotificationsRead(db).catch(() => null);
  }

  function ago(iso: string): string {
    if (nowMs === null) return "";
    const secs = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
    if (secs < 60) return t.agoSeconds.replace("{n}", String(secs));
    if (secs < 3600) return t.agoMinutes.replace("{n}", String(Math.floor(secs / 60)));
    if (secs < 86400) return t.agoHours.replace("{n}", String(Math.floor(secs / 3600)));
    return t.agoDays.replace("{n}", String(Math.floor(secs / 86400)));
  }

  const unread = items.filter((n) => !n.is_read).length;
  const groups = groupByDate(items, t.today, t.yesterday);

  return (
    <div className="mx-auto max-w-2xl text-slate-800">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800">{t.title}</h1>
        {unread > 0 && (
          <button
            onClick={markAll}
            className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-100"
          >
            <Check size={14} />
            {t.markAll}
          </button>
        )}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white/40 py-20 text-center backdrop-blur-xl">
          <Bell className="h-12 w-12 text-slate-300" />
          <p className="text-base font-semibold text-slate-500">{t.empty}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(({ label, items: groupItems }) => (
            <section key={label}>
              <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                {label}
              </h2>
              <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/70 shadow-sm backdrop-blur-xl">
                {groupItems.map((n, idx) => {
                  const Icon = ICONS[n.kind] ?? Bell;
                  return (
                    <div
                      key={n.id}
                      onClick={() => onItem(n)}
                      className={cn(
                        "group flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50",
                        idx > 0 && "border-t border-slate-50",
                        !n.is_read && "bg-blue-50/40",
                      )}
                    >
                      <span className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        !n.is_read ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400",
                      )}>
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm text-slate-800", !n.is_read ? "font-bold" : "font-medium")}>
                          {n.title}
                        </p>
                        {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>}
                        <p className="mt-1 text-[11px] text-slate-400">{ago(n.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {!n.is_read && (
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                        <button
                          onClick={(e) => onDelete(e, n.id)}
                          className="rounded-lg p-1.5 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                          title={t.delete}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Load more / no more */}
          <div className="flex justify-center pb-4">
            {hasMore ? (
              <button
                onClick={loadMore}
                disabled={loading}
                className="rounded-xl border border-white/50 bg-white/60 px-6 py-2.5 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white disabled:opacity-60"
              >
                {loading ? "…" : t.loadMore}
              </button>
            ) : (
              <p className="text-sm text-slate-400">{t.noMore}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
