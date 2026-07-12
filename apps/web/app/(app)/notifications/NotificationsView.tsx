"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Megaphone, FileText, Award, CheckCircle, CalendarX, Clock,
  FolderOpen, Trash2, Check, BookOpen, CalendarDays, AlertTriangle, Pin, ChevronDown,
} from "lucide-react";
import {
  getDictionary, getMyNotifications, markNotificationRead,
  markAllNotificationsRead, deleteNotification, getStudentAnnouncements, markAnnouncementRead,
  type Locale, type AppNotification, type NotificationKind, type StudentAnnouncement,
  type AnnouncementCategory,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { cn } from "@/lib/cn";

// ── Icons ──────────────────────────────────────────────────────────────────

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

const PAGE_SIZE = 20;

// ── Date helpers (Part 3 fix: all comparisons use a passed-in `now`) ────────

function isToday(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
}

function isYesterday(iso: string, now: Date): boolean {
  const d = new Date(iso);
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  return d.getDate() === yest.getDate() &&
    d.getMonth() === yest.getMonth() &&
    d.getFullYear() === yest.getFullYear();
}

function dateLabel(iso: string, today: string, yesterday: string, now: Date | null): string {
  if (now) {
    if (isToday(iso, now)) return today;
    if (isYesterday(iso, now)) return yesterday;
  }
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tashkent",
  });
}

type Group = { label: string; items: AppNotification[] };

function groupByDate(items: AppNotification[], today: string, yesterday: string, now: Date | null): Group[] {
  const map = new Map<string, AppNotification[]>();
  for (const n of items) {
    const label = dateLabel(n.created_at, today, yesterday, now);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(n);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

// ── Announcement category config ───────────────────────────────────────────

const CATEGORY_CFG: Record<AnnouncementCategory, { cls: string; Icon: typeof Megaphone }> = {
  general:  { cls: "bg-slate-100 text-slate-600",   Icon: Megaphone },
  academic: { cls: "bg-blue-100 text-blue-700",     Icon: BookOpen },
  event:    { cls: "bg-violet-100 text-violet-700", Icon: CalendarDays },
  urgent:   { cls: "bg-red-100 text-red-700",       Icon: AlertTriangle },
  reminder: { cls: "bg-amber-100 text-amber-700",   Icon: Bell },
};

// ── Main Component ─────────────────────────────────────────────────────────

export function NotificationsView({
  initialNotifications,
  studentId,
}: {
  initialNotifications: AppNotification[];
  studentId: string | null;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.notifications;
  const ta = d.announcements;
  const router = useRouter();
  const dbRef = useRef<ReturnType<typeof createClient> | null>(null);

  const [uid, setUid] = useState<string | null>(null);
  const [items, setItems] = useState<AppNotification[]>(initialNotifications);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialNotifications.length >= PAGE_SIZE);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const reloadRef = useRef<() => void>(() => {});

  // Tabs
  const [activeTab, setActiveTab] = useState<"notifications" | "announcements">("notifications");
  const [announcements, setAnnouncements] = useState<StudentAnnouncement[] | null>(null);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [openAnnouncementId, setOpenAnnouncementId] = useState<string | null>(null);

  async function reload() {
    const db = dbRef.current;
    if (!db) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = await getMyNotifications(db as any, page * PAGE_SIZE).catch((e) => { console.error("[NotificationsView] reload failed:", e?.message ?? e); return []; });
    setItems(list);
    setHasMore(list.length >= page * PAGE_SIZE);
  }
  reloadRef.current = reload;

  useEffect(() => {
    const db = createClient();
    dbRef.current = db;
    db.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)).catch(() => null);
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: new notification → reload
  useEffect(() => {
    if (!uid) return;
    const db = dbRef.current;
    if (!db) return;
    const channel = (db as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .channel(`notif-page-${uid}`)
      .on("postgres_changes" as any, { // eslint-disable-line @typescript-eslint/no-explicit-any
        event: "INSERT", schema: "public", table: "notifications",
        filter: `recipient_user_id=eq.${uid}`,
      }, () => { reloadRef.current(); })
      .subscribe();
    return () => { (db as any).removeChannel(channel); }; // eslint-disable-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Lazy-load announcements on tab switch
  useEffect(() => {
    if (activeTab !== "announcements" || announcements !== null) return;
    const db = dbRef.current;
    if (!db || !studentId) { setAnnouncements([]); return; }
    setAnnouncementsLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (getStudentAnnouncements as any)(db, studentId)
      .then((list: StudentAnnouncement[]) => setAnnouncements(list))
      .catch(() => setAnnouncements([]))
      .finally(() => setAnnouncementsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const db = dbRef.current;
      if (!db) return;
      const nextPage = page + 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = await getMyNotifications(db as any, nextPage * PAGE_SIZE).catch((e) => { console.error("[NotificationsView] loadMore failed:", e?.message ?? e); return []; });
      setItems(list);
      setPage(nextPage);
      setHasMore(list.length >= nextPage * PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [page]);

  async function onItem(n: AppNotification) {
    const db = dbRef.current;
    if (!n.is_read && db) {
      setItems((p) => p.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      markNotificationRead(db as any, n.id).catch(() => null);
    }
    if (n.link) router.push(n.link);
  }

  async function onDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const db = dbRef.current;
    setItems((p) => p.filter((x) => x.id !== id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (db) deleteNotification(db as any, id).catch(() => null);
  }

  async function markAll() {
    const db = dbRef.current;
    setItems((p) => p.map((x) => ({ ...x, is_read: true })));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (db) await markAllNotificationsRead(db as any).catch(() => null);
  }

  function toggleAnnouncement(a: StudentAnnouncement) {
    const db = dbRef.current;
    const opening = openAnnouncementId !== a.id;
    setOpenAnnouncementId(opening ? a.id : null);
    if (opening && !a.isRead && studentId && db) {
      setAnnouncements((p) => p ? p.map((x) => x.id === a.id ? { ...x, isRead: true } : x) : p);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      markAnnouncementRead(db as any, a.id, studentId).catch(() => null);
    }
  }

  function ago(iso: string): string {
    if (nowMs === null) return "";
    const secs = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
    if (secs < 60) return t.agoSeconds.replace("{n}", String(secs));
    if (secs < 3600) return t.agoMinutes.replace("{n}", String(Math.floor(secs / 60)));
    if (secs < 86400) return t.agoHours.replace("{n}", String(Math.floor(secs / 3600)));
    return t.agoDays.replace("{n}", String(Math.floor(secs / 86400)));
  }

  // Part 3: derive `now` from state (null on server → no today/yesterday labels → no hydration mismatch)
  const now = useMemo(() => nowMs !== null ? new Date(nowMs) : null, [nowMs]);
  const unread = items.filter((n) => !n.is_read).length;
  const groups = useMemo(
    () => groupByDate(items, t.today, t.yesterday, now),
    [items, t.today, t.yesterday, now],
  );

  return (
    <div className="mx-auto max-w-2xl text-slate-800">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800">{t.title}</h1>
        {activeTab === "notifications" && unread > 0 && (
          <button
            onClick={markAll}
            className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-100"
          >
            <Check size={14} />
            {t.markAll}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-2xl border border-white/50 bg-white/60 p-1 shadow-sm backdrop-blur-md">
        {(["notifications", "announcements"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 rounded-xl py-2 text-sm font-semibold transition-all",
              activeTab === tab
                ? "bg-white shadow-sm text-slate-800"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {tab === "notifications" ? t.tabNotifications : t.tabAnnouncements}
          </button>
        ))}
      </div>

      {/* Notifications tab */}
      {activeTab === "notifications" && (
        items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white/40 py-20 text-center backdrop-blur-xl">
            <Bell className="h-12 w-12 text-slate-300" />
            <p className="text-base font-semibold text-slate-500">{t.empty}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map(({ label, items: groupItems }) => (
              <section key={label}>
                <h2
                  className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-slate-400"
                  suppressHydrationWarning
                >
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
                          <p className="mt-1 text-[11px] text-slate-400" suppressHydrationWarning>
                            {ago(n.created_at)}
                          </p>
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
        )
      )}

      {/* Announcements tab */}
      {activeTab === "announcements" && (
        announcementsLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-300 border-t-blue-600" />
          </div>
        ) : !announcements || announcements.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white/40 py-20 text-center backdrop-blur-xl">
            <Megaphone className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-400">{ta.empty}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => {
              const isOpen = openAnnouncementId === a.id;
              const date = new Date(a.created_at).toLocaleDateString("ru-RU", {
                day: "numeric", month: "long", timeZone: "Asia/Tashkent",
              });
              const cat = a.category ?? "general";
              const catCfg = CATEGORY_CFG[cat];
              const catLabel = (ta as Record<string, string>)[
                `category${cat.charAt(0).toUpperCase()}${cat.slice(1)}`
              ];
              return (
                <div
                  key={a.id}
                  className={cn(
                    "overflow-hidden rounded-2xl border shadow-sm backdrop-blur-xl transition-colors",
                    a.category === "urgent"
                      ? "border-l-4 border-red-400 bg-red-50/30"
                      : a.is_pinned
                      ? "border-l-4 border-amber-300 bg-amber-50/40"
                      : "border-white/70 bg-white/70",
                  )}
                >
                  <button onClick={() => toggleAnnouncement(a)} className="flex w-full items-start gap-3 p-5 text-left">
                    <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", catCfg.cls)}>
                      <catCfg.Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {a.is_pinned && <Pin size={13} className="text-amber-500" />}
                        <h3 className="text-[15px] font-bold text-slate-800">{a.title}</h3>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", catCfg.cls)}>
                          {catLabel}
                        </span>
                        {!a.isRead && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            {ta.newBadge}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[12px] text-slate-400">
                        <span>{a.teacherName ?? ta.by} · {date}</span>
                      </div>
                      {!isOpen && <p className="mt-2 line-clamp-1 text-sm text-slate-500">{a.body}</p>}
                    </div>
                    <ChevronDown
                      size={18}
                      className={cn("mt-1 shrink-0 text-slate-400 transition-transform", isOpen && "rotate-180")}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-100 px-5 pb-5 pt-3">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{a.body}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
