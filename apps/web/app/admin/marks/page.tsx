import { createClient } from "@/lib/supabase/server";
import { loadMarksPage } from "@/lib/study-data";
import { MarksView } from "./MarksView";

/**
 * 03.09.2026, срез 3c — ЗАГРУЗЧИК ПЕРЕЕХАЛ В lib/study-data.ts.
 *
 * Тот же запрос понадобился менеджеру, которому школу подставляют не правила
 * доступа, а явное условие. Школа здесь НЕ передаётся: без неё условие не
 * добавляется вовсе, запрос остаётся прежним, и админа по-прежнему сужают
 * правила.
 */
export default async function AdminMarksPage() {
  const sb = await createClient();
  const { rows, groups, subjects } = await loadMarksPage(sb);
  return <MarksView rows={rows} groups={groups} subjects={subjects} />;
}
