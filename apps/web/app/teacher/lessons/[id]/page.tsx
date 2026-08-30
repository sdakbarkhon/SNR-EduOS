import { createClient } from "@/lib/supabase/server";
import { getTeacherLessonView } from "@snr/core";
import { getMyTeacher } from "@/lib/cached-queries";
import { notFound, redirect } from "next/navigation";
import { ensureMorningCycleRan } from "@/lib/ensureMorningCycleRan";
import { TeacherLessonDetailView } from "./TeacherLessonDetailView";

export default async function TeacherLessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createClient();

  // Фолбэк утреннего цикла — см. apps/web/app/(app)/lessons/[id]/page.tsx.
  try { await ensureMorningCycleRan(); } catch { /* noop */ }

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

  // Ручные «Начать урок» / «Закончить урок» нужны только там, где уроки НЕ
  // открываются сами. Признак берём у школы — schools.autostart_enabled, тот
  // же самый, по которому решает крон (fn_auto_start_lessons фильтрует уроки
  // ровно по нему). Не по флагу демо-сессии: школа может быть настоящей и с
  // выключенным автозапуском, и тогда кнопки ей по-прежнему нужны.
  // Школу берём у самого зрителя: RLS и так сузит выборку до его школы, а у
  // TeacherLessonView поля school_id наружу нет.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: school } = await (db as any)
    .from("schools").select("autostart_enabled").maybeSingle();
  const autostart = school?.autostart_enabled === true;

  return (
    <TeacherLessonDetailView
      lesson={lesson}
      teacher={teacher}
      autostartEnabled={autostart}
    />
  );
}
