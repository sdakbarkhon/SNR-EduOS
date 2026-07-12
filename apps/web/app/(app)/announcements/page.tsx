import { createClient } from "@/lib/supabase/server";
import { getStudentAnnouncements } from "@snr/core";
import { getMyStudent } from "@/lib/cached-queries";
import { safeQuery } from "@/lib/safe-query";
import { AnnouncementsView } from "./AnnouncementsView";

export default async function AnnouncementsPage() {
  const db = await createClient();
  const student = (await safeQuery(Promise.resolve(getMyStudent(db)), null, "AnnouncementsPage.student")).data;
  const announcements = student
    ? (await safeQuery(getStudentAnnouncements(db, (student as { id: string }).id), [], "AnnouncementsPage.announcements")).data
    : [];
  return <AnnouncementsView studentId={(student as { id?: string } | null)?.id ?? ""} announcements={announcements} />;
}
