import { InnerHeader } from "../../_ui/screen-kit";
import { InvoicesView } from "./InvoicesView";

/**
 * «Счета и чеки» (d21) — веб-порт
 * apps/mobile-parent/src/screens/payments/ReceiptsScreen.tsx.
 *
 * Данных с сервера экрану не нужно: чеков и счетов в БД нет вовсе, весь
 * список — мок из _demo/demo-data.ts, согласованный по суммам и датам
 * с /parent/payments и /parent/payments/history. Имя ребёнка в строках не
 * фигурирует (в макете его там тоже нет — только предмет счёта и номер).
 */
export default function ParentInvoicesPage() {
  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="Счета и чеки" backHref="/parent/payments" />
      <InvoicesView />
    </div>
  );
}
