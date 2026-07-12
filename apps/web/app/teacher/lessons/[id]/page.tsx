import { createClient } from "@/lib/supabase/server";
import { getTeacherLessonView } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
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

  // Промт 6: раньше оба catch(() => null) сливались в один notFound() —
  // реальный сбой запроса (throw) неотличим от "урока правда нет", 404
  // вводит в заблуждение. Не глушим здесь — пусть бросает дальше.
  const [lesson, teacher] = await Promise.all([
    getTeacherLessonView(db, id),
    getMyTeacher(db),
  ]);

  if (!lesson || !teacher) notFound();

  return <TeacherLessonDetailView lesson={lesson} teacher={teacher} />;
}
