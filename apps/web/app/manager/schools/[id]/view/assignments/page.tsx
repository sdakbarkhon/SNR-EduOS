import { schoolViewContext } from "@/lib/school-view";
import { loadAssignmentsPage } from "@/lib/study-data";
import { AssignmentsView } from "@/app/admin/subject-assignments/AssignmentsView";

/** Назначения «предмет — группа — учитель» глазами менеджера. Экран тот же.
 *  Массовое назначение считает число чатов ТЕМ ЖЕ planBulkAssignment, что и у
 *  админа, — значит менеджер видит до согласия ровно то же число. */
export const dynamic = "force-dynamic";

export default async function ManagerAssignmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school, actor } = await schoolViewContext(id);
  const { assignments, catalog, groups, teachers } = await loadAssignmentsPage(db, school.id);

  return (
    <AssignmentsView
      assignments={assignments as React.ComponentProps<typeof AssignmentsView>["assignments"]}
      catalog={catalog as React.ComponentProps<typeof AssignmentsView>["catalog"]}
      groups={groups as React.ComponentProps<typeof AssignmentsView>["groups"]}
      teachers={teachers as React.ComponentProps<typeof AssignmentsView>["teachers"]}
      schoolId={actor.role === "manager" ? school.id : undefined}
    />
  );
}
