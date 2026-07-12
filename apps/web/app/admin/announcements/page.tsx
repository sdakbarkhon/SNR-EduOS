import { createClient } from "@/lib/supabase/server";
import { deleteAnnouncement, type TeacherAnnouncement } from "@snr/core";
import { AdminAnnouncementsView } from "./AdminAnnouncementsView";

export const metadata = { title: "Объявления — Админ" };

export default async function AdminAnnouncementsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();

  // Промт 7.1 Часть 2: creatorId раньше был user?.id (auth.uid()) напрямую —
  // announcements.created_by/admin_id хотят admins.id, не auth.users.id
  // (та же разница, что teachers.id vs auth.uid() для getMyTeacher).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admin } = user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (db as any).from("admins").select("id").eq("user_id", user.id).maybeSingle()
    : { data: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [announcementsRaw, groupsRaw] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).from("announcements")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }: { data: unknown[] | null }) => data ?? []),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).from("groups")
      .select("id, name, subject")
      .order("name")
      .then(({ data }: { data: unknown[] | null }) => data ?? []),
  ]);

  const announcements = (announcementsRaw as TeacherAnnouncement[]).map((a) => ({
    ...a, groupName: null, targetStudentName: null, readCount: 0, totalRecipients: 0,
  }));

  const groups = groupsRaw as Array<{ id: string; name: string; subject: string }>;

  return (
    <AdminAnnouncementsView
      adminId={admin?.id ?? ""}
      announcements={announcements}
      groups={groups}
    />
  );
}
