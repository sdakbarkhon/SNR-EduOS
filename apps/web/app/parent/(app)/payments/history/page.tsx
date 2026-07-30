import { getSelectedChild } from "@/lib/parent-queries";
import { InnerHeader } from "../../_ui/screen-kit";
import { PaymentHistoryView } from "./PaymentHistoryView";
import { whoLabel } from "../mock-data";

/**
 * «История оплат» (d20) — веб-порт
 * apps/mobile-parent/src/screens/payments/PaymentHistoryScreen.tsx.
 *
 * Ребёнок настоящий (его имя и класс подставляются в подписи строк),
 * сами платежи — мок: платёжного бэкенда нет (см. payments/mock-data.ts).
 */
export default async function ParentPaymentHistoryPage() {
  const child = await getSelectedChild();

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="История оплат" backHref="/parent/payments" />
      <PaymentHistoryView who={whoLabel(child?.full_name ?? null, child?.className ?? null)} />
    </div>
  );
}
