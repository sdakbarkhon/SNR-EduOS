import { schoolViewContext } from "@/lib/school-view";
import { loadSubjectsPage } from "@/lib/study-data";
import { listDepartments } from "@/lib/admin-api";
import { loadSubjectServices } from "@/lib/subject-services";
import { AdminSubjectsView } from "@/app/admin/subjects/AdminSubjectsView";

/** Справочник предметов школы глазами менеджера. Экран тот же, что у админа. */
export const dynamic = "force-dynamic";

export default async function ManagerSubjectsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school, actor } = await schoolViewContext(id);
  const [rows, departments, services] = await Promise.all([
    loadSubjectsPage(db, school.id),
    listDepartments(school.id),
    loadSubjectServices(db),
  ]);
  const withServices = rows.map((r) => ({ ...r, services: services.get(r.id) }));

  return (
    <AdminSubjectsView
      subjects={withServices}
      departments={departments}
      schoolId={actor.role === "manager" ? school.id : undefined}
    />
  );
}
