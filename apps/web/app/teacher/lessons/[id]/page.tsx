import { createClient } from "@/lib/supabase/server";
import { getTeacherLessonView, initLessonStages, getMyTeacher } from "@snr/core";
import { notFound, redirect } from "next/navigation";
import { TeacherLessonDetailView } from "./TeacherLessonDetailView";

export default async function TeacherLessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  // Ensure required stages exist (idempotent)
  await initLessonStages(db, id).catch(() => null);

  const [lesson, teacher] = await Promise.all([
    getTeacherLessonView(db, id).catch(() => null),
    getMyTeacher(db).catch(() => null),
  ]);

  if (!lesson || !teacher) notFound();

  return <TeacherLessonDetailView lesson={lesson} teacher={teacher} />;
}
