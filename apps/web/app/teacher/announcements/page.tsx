import { createClient } from "@/lib/supabase/server";
import { getMyTeacher, getTeacherAnnouncements, getTeacherGroups, getGroupStudents } from "@snr/core";
import { TeacherAnnouncementsView } from "./TeacherAnnouncementsView";

export default async function TeacherAnnouncementsPage() {
  const db = await createClient();
  const teacher = await Promise.resolve(getMyTeacher(db)).catch(() => null);
  const tid = (teacher as { id?: string } | null)?.id ?? "";
  const [announcements, groupsRaw] = await Promise.all([
    getTeacherAnnouncements(db, tid).catch(() => []),
    Promise.resolve(getTeacherGroups(db)).catch(() => []),
  ]);
  const groups = ((groupsRaw ?? []) as Array<{ id: string; name: string; subject: string }>).map((g) => ({ id: g.id, name: g.name, subject: g.subject }));

  const nested = await Promise.all(groups.map((g) => Promise.resolve(getGroupStudents(db, g.id)).catch(() => [])));
  const studentMap = new Map<string, { id: string; full_name: string }>();
  for (const arr of nested) for (const s of (arr as Array<{ id: string; full_name: string }>)) studentMap.set(s.id, { id: s.id, full_name: s.full_name });

  return (
    <TeacherAnnouncementsView
      teacherId={tid}
      announcements={announcements}
      groups={groups}
      students={[...studentMap.values()]}
    />
  );
}
