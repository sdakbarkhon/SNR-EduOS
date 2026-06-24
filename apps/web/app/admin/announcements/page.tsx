import { createClient } from "@/lib/supabase/server";
import { deleteAnnouncement, type TeacherAnnouncement } from "@snr/core";
import { AdminAnnouncementsView } from "./AdminAnnouncementsView";

export const metadata = { title: "Объявления — Админ" };

export default async function AdminAnnouncementsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();

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
      creatorId={user?.id ?? ""}
      announcements={announcements}
      groups={groups}
    />
  );
}
