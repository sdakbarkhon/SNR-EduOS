import { schoolViewContext } from "@/lib/school-view";
import { listDepartments } from "@/lib/admin-api";
import { AdminDepartmentsView } from "@/app/admin/departments/AdminDepartmentsView";

/** Кафедры школы глазами менеджера. Экран тот же, что у админа. */
export const dynamic = "force-dynamic";

export default async function ManagerDepartmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { school, actor } = await schoolViewContext(id);
  const departments = await listDepartments(school.id);

  return (
    <AdminDepartmentsView
      departments={departments}
      schoolId={actor.role === "manager" ? school.id : undefined}
    />
  );
}
