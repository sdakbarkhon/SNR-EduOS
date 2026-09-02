import { schoolViewContext } from "@/lib/school-view";
import { loadParentsPage } from "@/lib/people-data";
import { schoolNowFrom } from "@snr/core";
import { createAdminClient } from "@/lib/supabase/admin";
import { ParentsView } from "@/app/admin/parents/ParentsView";

/**
 * Родители школы глазами менеджера. Экран тот же, что у админа.
 *
 * «СЕЙЧАС» БЕРЁТСЯ У ТОЙ ШКОЛЫ, В КОТОРУЮ ВОШЛИ, а не у смотрящего. Свежесть
 * приглашения считается от школьного времени, и у школ оно разное: под
 * замороженной датой чужой школы все приглашения выглядели бы просроченными
 * или, наоборот, вечными. У менеджера своей школы нет вовсе, поэтому взять
 * время «своей» неоткуда — только у этой.
 */
export const dynamic = "force-dynamic";

export default async function ManagerParentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { db, school, actor } = await schoolViewContext(id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: строка } = await (createAdminClient() as any)
    .from("schools").select("frozen_date").eq("id", school.id).maybeSingle();
  const nowMs = schoolNowFrom((строка as { frozen_date?: string | null } | null)?.frozen_date ?? null).getTime();

  const { rows, allStudents } = await loadParentsPage(db, nowMs, school.id);

  return (
    <ParentsView
      parents={rows}
      allStudents={allStudents}
      schoolId={actor.role === "manager" ? school.id : undefined}
    />
  );
}
