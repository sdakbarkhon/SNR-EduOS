import { createClient } from "@/lib/supabase/server";
import { getTeacherAllLessons, getTeacherGroups } from "@snr/core";
import { TeacherLessonsView } from "./TeacherLessonsView";
import { redirect } from "next/navigation";

export default async function TeacherLessonsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  const [lessons, groupsRaw] = await Promise.all([
    getTeacherAllLessons(db).catch(() => []),
    Promise.resolve(getTeacherGroups(db)).catch(() => []),
  ]);

  const groups = (groupsRaw as unknown as Array<{ id: string; name: string; subject: string }>);

  return <TeacherLessonsView lessons={lessons} groups={groups} />;
}
