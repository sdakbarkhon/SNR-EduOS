/* Announcements + notifications queries (migration 34). New tables aren't in the
 * generated types yet → `(db as any)`. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Db } from "../supabase/factory";
import type {
  AnnouncementScope, AnnouncementCategory, Announcement,
  TeacherAnnouncement, StudentAnnouncement, ParentAnnouncement, AppNotification,
} from "../types";

// ── Teacher / Admin: announcements ──
// Промт 7.1 Часть 2: exactly one of teacherId/adminId must be set (matches
// the announcements_author_check CHECK constraint, migration 121) — teacher
// call sites pass only teacherId (unchanged), the admin call site passes
// only adminId.
export const createAnnouncement = async (
  db: Db,
  input: {
    teacherId?: string | null;
    adminId?: string | null;
    scope: AnnouncementScope;
    groupId?: string | null;
    targetStudentId?: string | null;
    title: string;
    body: string;
    isPinned?: boolean;
    category?: AnnouncementCategory;
    isTicker?: boolean;
    validUntil?: string | null;
  },
): Promise<string> => {
  const { data, error } = await (db as any).from("announcements").insert({
    created_by: input.teacherId ?? null,
    admin_id: input.adminId ?? null,
    scope: input.scope,
    group_id: input.scope === "group" ? input.groupId : null,
    target_student_id: input.scope === "student" ? input.targetStudentId : null,
    title: input.title,
    body: input.body,
    is_pinned: input.isPinned ?? false,
    category: input.category ?? "general",
    is_ticker: input.isTicker ?? false,
    valid_until: input.validUntil ?? null,
  }).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
};

export const updateAnnouncement = async (
  db: Db, announcementId: string, data: { title?: string; body?: string; is_pinned?: boolean },
): Promise<void> => {
  const { error } = await (db as any).from("announcements").update(data).eq("id", announcementId);
  if (error) throw error;
};

export const togglePinAnnouncement = async (db: Db, announcementId: string, isPinned: boolean): Promise<void> => {
  const { error } = await (db as any).from("announcements").update({ is_pinned: isPinned }).eq("id", announcementId);
  if (error) throw error;
};

export const deleteAnnouncement = async (db: Db, announcementId: string): Promise<void> => {
  const { error } = await (db as any).from("announcements").delete().eq("id", announcementId);
  if (error) throw error;
};

export const getTeacherAnnouncements = async (db: Db, teacherId: string): Promise<TeacherAnnouncement[]> => {
  // Base select drives visibility (RLS: own). Keep it free of joins so a join
  // problem can never hide the teacher's own announcements.
  const { data, error } = await (db as any).from("announcements")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  const list = (data ?? []) as any[];

  // ── Enrichment (best-effort; never throws) ──
  const gName = new Map<string, string>();
  const gSize = new Map<string, number>();
  try {
    const { data: groups } = await (db as any).from("groups").select("id, name, student_groups(count)");
    for (const g of (groups ?? [])) { gName.set(g.id, g.name); gSize.set(g.id, g.student_groups?.[0]?.count ?? 0); }
  } catch { /* ignore */ }

  let totalAll = 0;
  try {
    const { data: memb } = await (db as any).from("student_groups")
      .select("student_id, group:groups!inner(teacher_id)").eq("group.teacher_id", teacherId);
    totalAll = new Set((memb ?? []).map((m: any) => m.student_id)).size;
  } catch { /* ignore */ }

  const sName = new Map<string, string>();
  const sids = list.filter((a) => a.target_student_id).map((a) => a.target_student_id);
  if (sids.length) {
    try {
      const { data: studs } = await (db as any).from("students").select("id, full_name").in("id", sids);
      for (const s of (studs ?? [])) sName.set(s.id, s.full_name);
    } catch { /* ignore */ }
  }

  // Промт 7.2 Часть 2: was one awaited announcement_reads count query PER
  // ROW (N+1, ~20s+ hang once 1+ announcements exist) — replaced with a
  // single batched .in() query + a Map, matching the existing
  // per-parent-count idiom already used above for gSize and elsewhere in
  // the codebase (packages/core/src/queries/projects.ts's
  // getStudentProjects).
  const readCountByAnnouncementId = new Map<string, number>();
  const annIds = list.map((a) => a.id);
  if (annIds.length) {
    try {
      const { data: reads } = await (db as any).from("announcement_reads")
        .select("announcement_id").in("announcement_id", annIds);
      for (const r of (reads ?? []) as any[]) {
        readCountByAnnouncementId.set(r.announcement_id, (readCountByAnnouncementId.get(r.announcement_id) ?? 0) + 1);
      }
    } catch { /* ignore */ }
  }

  return list.map((a) => ({
    ...a,
    groupName: a.group_id ? (gName.get(a.group_id) ?? null) : null,
    targetStudentName: a.target_student_id ? (sName.get(a.target_student_id) ?? null) : null,
    readCount: readCountByAnnouncementId.get(a.id) ?? 0,
    totalRecipients: a.scope === "group" ? (gSize.get(a.group_id) ?? 0)
      : a.scope === "student" ? 1 : totalAll,
  })) as TeacherAnnouncement[];
};

// ── Student: announcements ──
export const getStudentAnnouncements = async (db: Db, _studentId: string): Promise<StudentAnnouncement[]> => {
  const { data, error } = await (db as any).from("announcements")
    .select("*, teacher:teachers(full_name), reads:announcement_reads(id)")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((a) => ({
    ...a,
    teacherName: a.teacher?.full_name ?? null,
    isRead: (a.reads ?? []).length > 0,
  })) as StudentAnnouncement[];
};

// Returns live ticker announcements visible to the current user (RLS filters).
// Sorted by pinned-first, then newest. Excludes expired (valid_until < now).
// onlyFromAdmins=true → further filters to announcements where created_by is in admins.id.
export const getActiveTickerAnnouncements = async (
  db: Db,
  options?: { onlyFromAdmins?: boolean },
): Promise<Announcement[]> => {
  const now = new Date().toISOString();
  const { data, error } = await (db as any).from("announcements")
    .select("*")
    .eq("is_ticker", true)
    .or(`valid_until.is.null,valid_until.gt.${now}`)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  let announcements = (data ?? []) as Announcement[];

  if (options?.onlyFromAdmins && announcements.length > 0) {
    const creatorIds = [...new Set(announcements.map((a) => a.created_by).filter(Boolean))];
    const { data: admins } = await (db as any).from("admins").select("id").in("id", creatorIds);
    const adminIds = new Set(((admins ?? []) as any[]).map((a) => a.id));
    announcements = announcements.filter((a) => adminIds.has(a.created_by));
  }

  return announcements;
};

// Returns ticker announcements not yet seen by the current user (using announcement_user_reads).
export const getUnreadTickerAnnouncements = async (
  db: Db, userId: string, options?: { onlyFromAdmins?: boolean },
): Promise<Announcement[]> => {
  const all = await getActiveTickerAnnouncements(db, options);
  if (all.length === 0) return [];
  const ids = all.map((a) => a.id);
  const { data: reads } = await (db as any).from("announcement_user_reads")
    .select("announcement_id")
    .eq("user_id", userId)
    .in("announcement_id", ids);
  const readSet = new Set(((reads ?? []) as any[]).map((r) => r.announcement_id));
  return all.filter((a) => !readSet.has(a.id));
};

export const markTickerAnnouncementsRead = async (db: Db, userId: string, announcementIds: string[]): Promise<void> => {
  if (announcementIds.length === 0) return;
  const rows = announcementIds.map((id) => ({ user_id: userId, announcement_id: id }));
  // v2 query builder is a thenable, not a real Promise — it has no .catch()
  // method (calling it threw "TypeError: ... .catch is not a function" and
  // crashed the whole handler, uncaught). Destructure the error instead.
  const { error } = await (db as any).from("announcement_user_reads")
    .upsert(rows, { onConflict: "user_id,announcement_id", ignoreDuplicates: true });
  if (error) console.error("[markTickerAnnouncementsRead] upsert failed:", error.message);
};

export const markAnnouncementRead = async (db: Db, announcementId: string, studentId: string): Promise<void> => {
  const { error } = await (db as any).from("announcement_reads")
    .upsert({ announcement_id: announcementId, student_id: studentId }, { onConflict: "announcement_id,student_id", ignoreDuplicates: true });
  if (error && error.code !== "23505") throw error;
};

// ── Parent: announcements (Промт МОБ-4, migration 126) ──
// RLS on `announcements` denied parents outright before migration 126 (no
// parent-identity path in any policy qual) — parents previously only saw a
// truncated preview via notifications (kind='announcement'). Now that the
// new "parent reads announcements for their children" SELECT policy exists,
// this mirrors getStudentAnnouncements' shape/ordering exactly.
export const getParentAnnouncements = async (db: Db, limit = 100): Promise<ParentAnnouncement[]> => {
  const { data, error } = await (db as any).from("announcements")
    .select("*, teacher:teachers(full_name), admin:admins(full_name)")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as any[]).map((a) => ({
    ...a,
    authorName: a.teacher?.full_name ?? a.admin?.full_name ?? null,
    isFromAdmin: a.admin_id != null,
    teacher: undefined,
    admin: undefined,
  })) as ParentAnnouncement[];
};

export const getParentAnnouncementById = async (db: Db, id: string): Promise<ParentAnnouncement | null> => {
  const { data, error } = await (db as any).from("announcements")
    .select("*, teacher:teachers(full_name), admin:admins(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    authorName: data.teacher?.full_name ?? data.admin?.full_name ?? null,
    isFromAdmin: data.admin_id != null,
    teacher: undefined,
    admin: undefined,
  } as ParentAnnouncement;
};

// ── Notifications (any role; RLS limits to own) ──
export const getMyNotifications = async (db: Db, limit = 50): Promise<AppNotification[]> => {
  const { data, error } = await (db as any).from("notifications")
    .select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
};

export const getUnreadCount = async (db: Db): Promise<number> => {
  const { count, error } = await (db as any).from("notifications")
    .select("id", { count: "exact", head: true }).eq("is_read", false);
  if (error) return 0;
  return count ?? 0;
};

export const markNotificationRead = async (db: Db, id: string): Promise<void> => {
  const { error } = await (db as any).from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
};

export const markAllNotificationsRead = async (db: Db): Promise<void> => {
  const { error } = await (db as any).from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() }).eq("is_read", false);
  if (error) throw error;
};

export const deleteNotification = async (db: Db, id: string): Promise<void> => {
  const { error } = await (db as any).from("notifications").delete().eq("id", id);
  if (error) throw error;
};
