import { childInvoices, parentIsDemo } from "@/lib/parent-queries";
import { InnerHeader } from "../../_ui/screen-kit";
import { InvoicesView } from "./InvoicesView";
import { RealInvoicesView } from "./RealInvoicesView";

/**
 * «Счета и чеки» (d21) — РАЗВИЛКА ДЕМО/НАСТОЯЩИЙ. Заход 3 по оплатам,
 * 30.08.2026.
 *
 * Демо-гость получает витрину: два таба «Чеки»/«Счета», шесть выдуманных
 * документов, кнопки скачивания. Настоящий родитель — свои счета из
 * `tuition_invoices`.
 *
 * ЗАГОЛОВОК У НИХ РАЗНЫЙ, и поэтому шапку рисует не страница, а каждая ветка
 * сама. У витрины «Счета и чеки» — как было. У настоящего просто «Счета»:
 * чеков там нет, вкладка с ними убрана целиком (решение заказчика — чек
 * выдаёт платёжная система, которой у школы нет), и заголовок «и чеки» над
 * экраном без чеков обещал бы ровно то же, что и пустая вкладка. Настоящая
 * шапка живёт внутри RealInvoicesView, где доступен словарь: остальные шапки
 * раздела зашиты по-русски, а новую заводить такой же не хотелось.
 *
 * Развилка стоит здесь, а не внутри компонента, — чтобы файл витрины не
 * пришлось трогать вовсе.
 */
export default async function ParentInvoicesPage() {
  const isDemo = await parentIsDemo();

  if (isDemo) {
    return (
      <div className="mx-auto w-full max-w-[430px]">
        <InnerHeader title="Счета и чеки" backHref="/parent/payments" />
        <InvoicesView isDemo={isDemo} />
      </div>
    );
  }

  const invoices = await childInvoices();

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <RealInvoicesView invoices={invoices.items} failed={invoices.failed} />
    </div>
  );
}
