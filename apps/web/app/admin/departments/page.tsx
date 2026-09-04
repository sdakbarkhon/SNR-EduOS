import { verifyStaff } from "@/lib/verify-staff";
import { listDepartments } from "@/lib/admin-api";
import { AdminDepartmentsView } from "./AdminDepartmentsView";

/** Кафедры школы (миграция 255). Список читается служебным ключом: считать
 *  материалы под сессией админа нечем — правила библиотеки пускают учителя
 *  кафедры, не админа. Границу школы держит verifyStaff. */
export const dynamic = "force-dynamic";

export default async function AdminDepartmentsPage() {
  const { schoolId } = await verifyStaff();
  const departments = await listDepartments(schoolId);
  return <AdminDepartmentsView departments={departments} />;
}
