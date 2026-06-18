import { createClient } from "@/lib/supabase/server";
import { getTeacherAllLessons } from "@snr/core";
import { TeacherLessonsView } from "./TeacherLessonsView";
import { redirect } from "next/navigation";

export default async function TeacherLessonsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  const lessons = await getTeacherAllLessons(db).catch(() => []);

  return <TeacherLessonsView lessons={lessons} />;
}
