import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { JournalView, type JournalRow } from "./JournalView";

/**
 * Журнал действий суперадминистратора (миграция 220).
 *
 * ЧИТАЕТ ТОЛЬКО СУПЕРАДМИН. Админу школы экран не отдаём: половина записей к
 * школам вообще не относится (суперадмин меняет себе пароль и почту), а вторая
 * половина — действия над другими школами. «Своя часть» потребовала бы своего
 * правила видимости и своего экрана — это отдельная задача.
 *
 * ЧИТАЕМ СЛУЖЕБНЫМ КЛЮЧОМ. Таблица закрыта наглухо: правил доступа нет ни
 * одного, права отозваны у всех ролей, а служебному ключу оставлено ровно
 * чтение. Поэтому обычный клиент здесь не подойдёт, и роль проверяется выше
 * своими руками.
 */
export const dynamic = "force-dynamic";

const LIMIT = 500;

export default async function SuperAdminJournalPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; from?: string; to?: string; q?: string }>;
}) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: superAdmin } = await (sb as any)
    .from("super_admins").select("id").eq("user_id", user.id).maybeSingle();
  if (!superAdmin) redirect("/login");

  const sp = await searchParams;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (createAdminClient() as any)
    .from("superadmin_journal")
    .select("id, at, actor_name, action, outcome, target_type, target_id, target_name, details, ref")
    .order("at", { ascending: false })
    .limit(LIMIT);

  if (sp.action) q = q.eq("action", sp.action);
  if (sp.from) q = q.gte("at", `${sp.from}T00:00:00Z`);
  if (sp.to) q = q.lte("at", `${sp.to}T23:59:59Z`);
  if (sp.q) q = q.ilike("target_name", `%${sp.q}%`);

  const { data, error } = await q;

  // Миграции ещё нет — экран честно показывает пустой журнал, а не падает.
  // В этом промежутке кнопки суперадмина работают без записи (см.
  // lib/superadmin-journal.ts), и притворяться, что записи есть, нельзя.
  if (error) console.error("[SuperAdminJournalPage] journal query failed:", error.message);

  return (
    <JournalView
      rows={(data ?? []) as JournalRow[]}
      filters={{ action: sp.action ?? "", from: sp.from ?? "", to: sp.to ?? "", q: sp.q ?? "" }}
    />
  );
}
