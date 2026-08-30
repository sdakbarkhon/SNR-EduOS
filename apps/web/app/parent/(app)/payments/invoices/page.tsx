import { parentIsDemo } from "@/lib/parent-queries";
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
// Заход 1 по оплатам: экран стал async только ради признака демо. Сети это
// не добавляет — getParentContext уже вызван layout-ом того же запроса.
export default async function ParentInvoicesPage() {
  const isDemo = await parentIsDemo();
  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="Счета и чеки" backHref="/parent/payments" />
      <InvoicesView isDemo={isDemo} />
    </div>
  );
}
