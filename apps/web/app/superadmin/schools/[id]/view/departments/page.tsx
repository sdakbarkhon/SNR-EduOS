import { schoolViewContext } from "@/lib/school-view";
import { listDepartments } from "@/lib/admin-api";
import { TableClient } from "../TableClient";

/** Кафедры школы у суперадмина — на чтение, как и справочник предметов:
 *  правит их админ школы или менеджер. */
export const dynamic = "force-dynamic";

export default async function SchoolDepartmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { school } = await schoolViewContext(id);
  const departments = await listDepartments(school.id);

  return (
    <TableClient
      titleKey="svTabDepartments"
      columns={[
        { key: "name", labelKey: "svColName" },
        { key: "subjects", labelKey: "svColSubjects", narrow: true, right: true },
        { key: "materials", labelKey: "svColMaterials", narrow: true, right: true },
      ]}
      rows={departments.map((d) => ({
        id: d.id, name: d.name, subjects: String(d.subjects), materials: String(d.materials),
      }))}
    />
  );
}
