import { childInvoices } from "@/lib/parent-queries";
import { InnerHeader } from "../../_ui/screen-kit";
import { InvoicesView } from "./InvoicesView";

/**
 * «Счета» (d21).
 *
 * 27.08.2026, заход 4 по платежам: счета настоящие, из `tuition_invoices`.
 * Заголовок раньше был «Счета и чеки» — чеков на экране больше нет, они
 * появятся вместе с онлайн-оплатой, и обещать их в названии нечестно.
 */
export default async function ParentInvoicesPage() {
  const invoices = await childInvoices();

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="Счета" backHref="/parent/payments" />
      <InvoicesView invoices={invoices.items} failed={invoices.failed} />
    </div>
  );
}
