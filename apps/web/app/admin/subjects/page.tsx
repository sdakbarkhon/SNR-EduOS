import { createClient } from "@/lib/supabase/server";
import { loadSubjectsPage } from "@/lib/study-data";
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
  const rows = await loadSubjectsPage(supabase);
  return <AdminSubjectsView subjects={rows} />;
}
