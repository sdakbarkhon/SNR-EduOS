import { createClient } from "@/lib/supabase/server";
import { listInvoiceBlockers, listSchoolInvoices } from "@/lib/admin-payments";
import { safeQuery } from "@/lib/safe-query";
import { PaymentsAdminView } from "./PaymentsAdminView";

/**
 * «Оплаты» — раздел админа школы. Заход 5 по платежам.
 *
 * Два списка читаются НЕЗАВИСИМО и каждый ловит свою ошибку сам: упавший
 * запрос счетов не должен уносить список «без счёта», и наоборот. `Promise.all`
 * без такой защиты в этом проекте уже дважды ронял целые экраны.
 *
 * Школа берётся у вошедшего админа, а не из адреса: у супер-админа школы нет
 * вовсе, и он сюда не попадает — middleware уводит его в свою панель.
 */
export default async function AdminPaymentsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admin } = await (sb as any)
    .from("admins").select("school_id").eq("user_id", user?.id ?? "").maybeSingle();
  const schoolId = (admin as { school_id: string } | null)?.school_id ?? null;

  if (!schoolId) {
    return <PaymentsAdminView invoices={[]} blockers={[]} />;
  }

  const [invoices, blockers] = await Promise.all([
    safeQuery(listSchoolInvoices(schoolId), [], "admin listSchoolInvoices"),
    safeQuery(listInvoiceBlockers(schoolId), [], "admin listInvoiceBlockers"),
  ]);

  return <PaymentsAdminView invoices={invoices.data} blockers={blockers.data} />;
}
