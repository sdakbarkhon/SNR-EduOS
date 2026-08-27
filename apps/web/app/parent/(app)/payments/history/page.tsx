import { childBalanceEntries, getSelectedChild } from "@/lib/parent-queries";
import { InnerHeader } from "../../_ui/screen-kit";
import { PaymentHistoryView } from "./PaymentHistoryView";
import { whoLabel } from "../../_demo/demo-data";

/**
 * «История оплат» (d20).
 *
 * 27.08.2026, заход 4 по платежам: история настоящая — журнал движений по
 * балансу ребёнка (`balance_entries`). Раньше здесь были выдуманные платежи.
 * Ребёнок как был настоящим, так и остался: его имя подставляется в подписи
 * строк, чтобы у родителя с двумя детьми было видно, чей это журнал.
 */
export default async function ParentPaymentHistoryPage() {
  const [child, entries] = await Promise.all([getSelectedChild(), childBalanceEntries()]);

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="История оплат" backHref="/parent/payments" />
      <PaymentHistoryView
        entries={entries.items}
        failed={entries.failed}
        who={whoLabel(child?.full_name ?? null, child?.className ?? null)}
      />
    </div>
  );
}
