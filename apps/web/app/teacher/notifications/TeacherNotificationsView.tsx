"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Megaphone, FileText, Award, CheckCircle, CalendarX, Clock,
  FolderOpen, Trash2, Check,
} from "lucide-react";
import {
  getDictionary, getMyNotifications, markNotificationRead,
  markAllNotificationsRead, deleteNotification,
  type Locale, type AppNotification, type NotificationKind, type TeacherAnnouncement,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { cn } from "@/lib/cn";
import { TeacherAnnouncementsView } from "../announcements/TeacherAnnouncementsView";

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

function isToday(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}
function isYesterday(iso: string, now: Date): boolean {
  const d = new Date(iso);
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  return d.getDate() === yest.getDate() && d.getMonth() === yest.getMonth() && d.getFullYear() === yest.getFullYear();
}
function dateLabel(iso: string, today: string, yesterday: string, now: Date | null): string {
  if (now) {
    if (isToday(iso, now)) return today;
    if (isYesterday(iso, now)) return yesterday;
  }
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tashkent" });
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

export function TeacherNotificationsView({
  initialNotifications, teacherId, announcements, groups, students,
}: {
  initialNotifications: AppNotification[];
  teacherId: string;
  announcements: TeacherAnnouncement[];
  groups: Array<{ id: string; name: string }>;
  students: Array<{ id: string; full_name: string }>;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.notifications;
  const router = useRouter();
  const dbRef = useRef<ReturnType<typeof createClient> | null>(null);

  const [uid, setUid] = useState<string | null>(null);
  const [items, setItems] = useState<AppNotification[]>(initialNotifications);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialNotifications.length >= PAGE_SIZE);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"notifications" | "announcements">("notifications");
  const reloadRef = useRef<() => void>(() => {});

  async function reload() {
    const db = dbRef.current;
    if (!db) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = await getMyNotifications(db as any, page * PAGE_SIZE).catch((e) => { console.error("[TeacherNotificationsView] reload failed:", e?.message ?? e); return []; });
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

  useEffect(() => {
    if (!uid) return;
    const db = dbRef.current;
    if (!db) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (db as any)
      .channel(`notif-teacher-${uid}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `recipient_user_id=eq.${uid}`,
      }, () => { reloadRef.current(); })
      .subscribe();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => { (db as any).removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const db = dbRef.current;
      if (!db) return;
      const nextPage = page + 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = await getMyNotifications(db as any, nextPage * PAGE_SIZE).catch((e) => { console.error("[TeacherNotificationsView] loadMore failed:", e?.message ?? e); return []; });
      setItems(list);
      setPage(nextPage);
      setHasMore(list.length >= nextPage * PAGE_SIZE);
    } finally { setLoading(false); }
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

  function ago(iso: string): string {
    if (nowMs === null) return "";
    const secs = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
    if (secs < 60) return t.agoSeconds.replace("{n}", String(secs));
    if (secs < 3600) return t.agoMinutes.replace("{n}", String(Math.floor(secs / 60)));
    if (secs < 86400) return t.agoHours.replace("{n}", String(Math.floor(secs / 3600)));
    return t.agoDays.replace("{n}", String(Math.floor(secs / 86400)));
  }

  const now = useMemo(() => nowMs !== null ? new Date(nowMs) : null, [nowMs]);
  const unread = items.filter((n) => !n.is_read).length;
  const dateGroups = useMemo(() => groupByDate(items, t.today, t.yesterday, now), [items, t.today, t.yesterday, now]);

  return (
    <div className="mx-auto max-w-2xl text-slate-800">
      <div className="mb-6 flex items-center justify-end">
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
              activeTab === tab ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700",
            )}
          >
            {tab === "notifications" ? t.tabNotifications : t.tabAnnouncements}
          </button>
        ))}
      </div>

      {/* Notifications tab */}
      {activeTab === "notifications" && (
        items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white/40 py-20 text-center">
            <Bell className="h-12 w-12 text-slate-300" />
            <p className="text-base font-semibold text-slate-500">{t.empty}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {dateGroups.map(({ label, items: groupItems }) => (
              <section key={label}>
                <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-slate-400" suppressHydrationWarning>
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
                        <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                          !n.is_read ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400")}>
                          <Icon size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm text-slate-800", !n.is_read ? "font-bold" : "font-medium")}>
                            {n.title}
                          </p>
                          {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>}
                          <p className="mt-1 text-[11px] text-slate-400" suppressHydrationWarning>{ago(n.created_at)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {!n.is_read && <span className="h-2 w-2 rounded-full bg-blue-500" />}
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
                <button onClick={loadMore} disabled={loading}
                  className="rounded-xl border border-white/50 bg-white/60 px-6 py-2.5 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white disabled:opacity-60">
                  {loading ? "…" : t.loadMore}
                </button>
              ) : (
                <p className="text-sm text-slate-400">{t.noMore}</p>
              )}
            </div>
          </div>
        )
      )}

      {/* Announcements tab — full management view embedded directly (was a
          separate /teacher/announcements route, duplicating this page;
          folded in here per ЧАСТЬ 3, root cause of the old empty stub tab
          below). */}
      {activeTab === "announcements" && (
        <TeacherAnnouncementsView teacherId={teacherId} announcements={announcements} groups={groups} students={students} />
      )}
    </div>
  );
}
