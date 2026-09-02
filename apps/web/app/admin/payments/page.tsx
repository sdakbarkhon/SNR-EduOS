import { createClient } from "@/lib/supabase/server";
import { loadPaymentsPage } from "@/lib/money-data";
import { PaymentsAdminView } from "./PaymentsAdminView";

/**
 * «Оплаты» — раздел админа школы. Заход 5 по платежам.
 *
 * 03.09.2026, срез 3d — ЧТЕНИЕ ПЕРЕЕХАЛО В lib/money-data.ts.
 *
 * Тот же экран понадобился менеджеру, у которого школа приходит адресом, а не
 * из собственной строки. Школа здесь НЕ передаётся: загрузчик берёт её у
 * вошедшего админа ровно так же, как этот файл брал её сам, и запросы
 * остаются прежними.
 */
export default async function AdminPaymentsPage() {
  const sb = await createClient();
  const { invoices, blockers } = await loadPaymentsPage(sb);
  return <PaymentsAdminView invoices={invoices} blockers={blockers} />;
}
