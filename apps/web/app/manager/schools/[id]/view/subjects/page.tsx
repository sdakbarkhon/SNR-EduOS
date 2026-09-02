import { schoolViewContext } from "@/lib/school-view";
import { loadSubjectsPage } from "@/lib/study-data";
import { AdminSubjectsView } from "@/app/admin/subjects/AdminSubjectsView";

/** Справочник предметов школы глазами менеджера. Экран тот же, что у админа. */
export const dynamic = "force-dynamic";

export default async function ManagerSubjectsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school, actor } = await schoolViewContext(id);
  const rows = await loadSubjectsPage(db, school.id);

  return (
    <AdminSubjectsView
      subjects={rows}
      schoolId={actor.role === "manager" ? school.id : undefined}
    />
  );
}
