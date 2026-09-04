import { createClient } from "@/lib/supabase/server";
import { loadSubjectsPage } from "@/lib/study-data";
import { verifyStaff } from "@/lib/verify-staff";
import { listDepartments } from "@/lib/admin-api";
import { AdminSubjectsView } from "./AdminSubjectsView";

/**
 * 03.09.2026, срез 3c — ЗАГРУЗЧИК ПЕРЕЕХАЛ В lib/study-data.ts.
 *
 * Тот же запрос понадобился менеджеру, которому школу подставляют не правила
 * доступа, а явное условие. Школа здесь НЕ передаётся: без неё условие не
 * добавляется вовсе, запрос остаётся прежним, и админа по-прежнему сужают
 * правила.
 */
export default async function AdminSubjectsPage() {
  const supabase = await createClient();
  const { schoolId } = await verifyStaff();
  const [rows, departments] = await Promise.all([
    loadSubjectsPage(supabase),
    listDepartments(schoolId),
  ]);
  return <AdminSubjectsView subjects={rows} departments={departments} />;
}
