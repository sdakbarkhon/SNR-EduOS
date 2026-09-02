import { createClient } from "@/lib/supabase/server";
import { loadTeachersPage } from "@/lib/people-data";
import { TeachersView } from "./TeachersView";

/**
 * 03.09.2026, срез 3b — ЗАГРУЗЧИК ПЕРЕЕХАЛ В lib/people-data.ts.
 *
 * Тот же запрос понадобился менеджеру, которому школу подставляют не правила
 * доступа, а явное условие. Копия разошлась бы с оригиналом на первой правке.
 *
 * ШКОЛА ЗДЕСЬ НЕ ПЕРЕДАЁТСЯ, и это принципиально: без неё условие по школе не
 * добавляется вовсе, запрос остаётся прежним, и админа по-прежнему сужают
 * правила доступа. Ни одного лишнего условия у него не появилось.
 */
export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const supabase = await createClient();
  const { teachers, bindings, catalog, groups } = await loadTeachersPage(supabase);

  return (
    <TeachersView
      teachers={teachers as React.ComponentProps<typeof TeachersView>["teachers"]}
      bindings={bindings}
      catalog={catalog}
      groups={groups}
      defaultOpenAdd={action === "add"}
    />
  );
}
