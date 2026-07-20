import { createClient } from "@/lib/supabase/server";
import { getMyNotifications, getTeacherAnnouncements, getTeacherGroups, getGroupStudents } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { safeQuery } from "@/lib/safe-query";
import { TeacherNotificationsView } from "./TeacherNotificationsView";

export const metadata = { title: "Уведомления" };

export default async function TeacherNotificationsPage() {
  const db = await createClient();
  const teacher = (await safeQuery(Promise.resolve(getMyTeacher(db)), null, "TeacherNotificationsPage.teacher")).data;
  const tid = (teacher as { id?: string } | null)?.id ?? "";

  const [notificationsRes, announcementsRes, groupsRes] = await Promise.all([
    safeQuery(getMyNotifications(db, 30), [], "TeacherNotificationsPage.notifications"),
    safeQuery(getTeacherAnnouncements(db, tid), [], "TeacherNotificationsPage.announcements"),
    safeQuery(Promise.resolve(getTeacherGroups(db)), [], "TeacherNotificationsPage.groups"),
  ]);
  const notifications = notificationsRes.data;
  const announcements = announcementsRes.data;
  const groups = ((groupsRes.data ?? []) as Array<{ id: string; name: string; subject: string }>).map((g) => ({ id: g.id, name: g.name, subject: g.subject }));

  const nested = await Promise.all(groups.map((g) => safeQuery(Promise.resolve(getGroupStudents(db, g.id)), [], `TeacherNotificationsPage.students.${g.id}`).then((r) => r.data)));
  const studentMap = new Map<string, { id: string; full_name: string }>();
  for (const arr of nested) for (const s of (arr as Array<{ id: string; full_name: string }>)) studentMap.set(s.id, { id: s.id, full_name: s.full_name });

  return (
    <TeacherNotificationsView
      initialNotifications={notifications}
      teacherId={tid}
      announcements={announcements}
      groups={groups}
      students={[...studentMap.values()]}
    />
  );
}
