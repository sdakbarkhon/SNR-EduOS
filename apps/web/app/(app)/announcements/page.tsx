import { createClient } from "@/lib/supabase/server";
import { getStudentAnnouncements } from "@snr/core";
import { getMyStudent } from "@/lib/cached-queries";
import { AnnouncementsView } from "./AnnouncementsView";

export default async function AnnouncementsPage() {
  const db = await createClient();
  const student = await Promise.resolve(getMyStudent(db)).catch(() => null);
  const announcements = student
    ? await getStudentAnnouncements(db, (student as { id: string }).id).catch(() => [])
    : [];
  return <AnnouncementsView studentId={(student as { id?: string } | null)?.id ?? ""} announcements={announcements} />;
}
