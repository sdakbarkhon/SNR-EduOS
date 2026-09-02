import { createClient } from "@/lib/supabase/server";
import { loadGroupsPage } from "@/lib/study-data";
import { GroupsView } from "./GroupsView";

/**
 * 03.09.2026, срез 3c — ЗАГРУЗЧИК ПЕРЕЕХАЛ В lib/study-data.ts.
 *
 * Тот же запрос понадобился менеджеру, которому школу подставляют не правила
 * доступа, а явное условие. Школа здесь НЕ передаётся: без неё условие не
 * добавляется вовсе, запрос остаётся прежним, и админа по-прежнему сужают
 * правила.
 */
export default async function AdminGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const supabase = await createClient();
  const { groups, catalog } = await loadGroupsPage(supabase);

  return (
    <GroupsView
      groups={groups as React.ComponentProps<typeof GroupsView>["groups"]}
      catalog={catalog as React.ComponentProps<typeof GroupsView>["catalog"]}
      defaultOpenAdd={action === "add"}
    />
  );
}
