import { InnerHeader } from "../../_ui/screen-kit";
import { PayMethodsView } from "./PayMethodsView";

/**
 * «Способы оплаты» (d33) — веб-порт
 * apps/mobile-parent/src/screens/payments/PayMethodsScreen.tsx.
 *
 * Данных с сервера нет и быть не может: карт и привязок платёжных систем в БД
 * не существует (реальные реквизиты хранятся у провайдера, которого проект ещё
 * не подключил). Весь список — мок из _demo/demo-data.ts; основная карта
 * совпадает с той, что названа картой автоплатежа на /parent/payments.
 */
export default function ParentPayMethodsPage() {
  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="Способы оплаты" backHref="/parent/payments" />
      <PayMethodsView />
    </div>
  );
}
