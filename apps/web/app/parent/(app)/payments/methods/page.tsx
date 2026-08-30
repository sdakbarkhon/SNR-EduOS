import { parentIsDemo } from "@/lib/parent-queries";
import { RealSectionSoon } from "../RealSectionSoon";
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
// Заход 1 по оплатам: экран стал async только ради признака демо. Сети это
// не добавляет — getParentContext уже вызван layout-ом того же запроса.
/**
 * ЗАХОД 7. У настоящего родителя раздела больше нет — решение заказчика.
 * Карт и привязок платёжных систем не существует до подключения кассы, а
 * реквизиты будет принимать сама касса, а не приложение.
 */
export default async function ParentPayMethodsPage() {
  const isDemo = await parentIsDemo();
  if (!isDemo) return <RealSectionSoon sectionKey="payMethods" />;

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="Способы оплаты" backHref="/parent/payments" />
      <PayMethodsView isDemo={isDemo} />
    </div>
  );
}
