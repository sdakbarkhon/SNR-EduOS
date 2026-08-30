import { childBalanceEntries, getSelectedChild, parentIsDemo } from "@/lib/parent-queries";
import { InnerHeader } from "../../_ui/screen-kit";
import { PaymentHistoryView } from "./PaymentHistoryView";
import { RealPaymentHistoryView } from "./RealPaymentHistoryView";
import { whoLabel } from "../../_demo/demo-data";

/**
 * «История оплат» (d20) — РАЗВИЛКА ДЕМО/НАСТОЯЩИЙ. Заход 3 по оплатам,
 * 30.08.2026.
 *
 * Демо-гость получает витрину: четыре фильтра и шесть выдуманных платежей с
 * провайдерами. Настоящий родитель — журнал движений по своему балансу
 * (`balance_entries`).
 *
 * Заголовок у обоих один и тот же, поэтому шапку по-прежнему рисует страница.
 * Развилка стоит здесь, а не внутри компонента, — чтобы файл витрины не
 * пришлось трогать вовсе.
 */

/**
 * Сколько движений просим. То же число, что стоит умолчанием у
 * childBalanceEntries; названо здесь, потому что от него зависит, можно ли
 * считать итог: если пришло ровно столько, журнал может быть длиннее выборки.
 */
const ENTRIES_LIMIT = 100;

export default async function ParentPaymentHistoryPage() {
  const isDemo = await parentIsDemo();

  if (isDemo) {
    const child = await getSelectedChild();
    return (
      <div className="mx-auto w-full max-w-[430px]">
        <InnerHeader title="История оплат" backHref="/parent/payments" />
        <PaymentHistoryView
          isDemo={isDemo}
          who={whoLabel(child?.full_name ?? null, child?.className ?? null)}
        />
      </div>
    );
  }

  const entries = await childBalanceEntries(ENTRIES_LIMIT);

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="История оплат" backHref="/parent/payments" />
      <RealPaymentHistoryView
        entries={entries.items}
        failed={entries.failed}
        complete={entries.items.length < ENTRIES_LIMIT}
      />
    </div>
  );
}
