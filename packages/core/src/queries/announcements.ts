/* Announcements + notifications queries (migration 34). New tables aren't in the
 * generated types yet → `(db as any)`. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Db } from "../supabase/factory";
import type {
  AnnouncementScope, TeacherAnnouncement, StudentAnnouncement, AppNotification,
} from "../types";

// ── Teacher: announcements ──
export const createAnnouncement = async (
  db: Db,
  input: { teacherId: string; scope: AnnouncementScope; groupId?: string | null; targetStudentId?: string | null; title: string; body: string; isPinned?: boolean },
): Promise<string> => {
  const { data, error } = await (db as any).from("announcements").insert({
    created_by: input.teacherId,
    scope: input.scope,
    group_id: input.scope === "group" ? input.groupId : null,
    target_student_id: input.scope === "student" ? input.targetStudentId : null,
    title: input.title,
    body: input.body,
    is_pinned: input.isPinned ?? false,
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
  const { data, error } = await (db as any).from("announcements")
    .select("*, group:groups(name, student_groups(count)), target:students(full_name), reads:announcement_reads(count)")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  // total distinct students across the teacher's groups (for all_my_groups scope)
  let totalAll = 0;
  try {
    const { data: memb } = await (db as any).from("student_groups")
      .select("student_id, group:groups!inner(teacher_id)")
      .eq("group.teacher_id", teacherId);
    totalAll = new Set((memb ?? []).map((m: any) => m.student_id)).size;
  } catch { totalAll = 0; }
  return ((data ?? []) as any[]).map((a) => ({
    ...a,
    groupName: a.group?.name ?? null,
    targetStudentName: a.target?.full_name ?? null,
    readCount: a.reads?.[0]?.count ?? 0,
    totalRecipients: a.scope === "group" ? (a.group?.student_groups?.[0]?.count ?? 0)
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

export const markAnnouncementRead = async (db: Db, announcementId: string, studentId: string): Promise<void> => {
  const { error } = await (db as any).from("announcement_reads")
    .upsert({ announcement_id: announcementId, student_id: studentId }, { onConflict: "announcement_id,student_id", ignoreDuplicates: true });
  if (error && error.code !== "23505") throw error;
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
