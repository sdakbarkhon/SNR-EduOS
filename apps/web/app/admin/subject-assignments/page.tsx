import { createClient } from "@/lib/supabase/server";
import { loadAssignmentsPage } from "@/lib/study-data";
import { AssignmentsView } from "./AssignmentsView";

/**
 * 03.09.2026, срез 3c — ЗАГРУЗЧИК ПЕРЕЕХАЛ В lib/study-data.ts.
 *
 * Тот же запрос понадобился менеджеру, которому школу подставляют не правила
 * доступа, а явное условие. Школа здесь НЕ передаётся: без неё условие не
 * добавляется вовсе, запрос остаётся прежним, и админа по-прежнему сужают
 * правила.
 */
export default async function AdminSubjectAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const supabase = await createClient();
  const { assignments, catalog, groups, teachers } = await loadAssignmentsPage(supabase);

  return (
    <AssignmentsView
      assignments={assignments as React.ComponentProps<typeof AssignmentsView>["assignments"]}
      catalog={catalog as React.ComponentProps<typeof AssignmentsView>["catalog"]}
      groups={groups as React.ComponentProps<typeof AssignmentsView>["groups"]}
      teachers={teachers as React.ComponentProps<typeof AssignmentsView>["teachers"]}
      defaultOpenAdd={action === "add"}
    />
  );
}
