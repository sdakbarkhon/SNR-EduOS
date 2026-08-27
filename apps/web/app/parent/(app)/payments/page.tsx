import { childInvoices, childPaymentsSummary, getSelectedChild } from "@/lib/parent-queries";
import { PaymentsView } from "./PaymentsView";

/**
 * «Оплаты» (П17).
 *
 * 27.08.2026, ЗАХОД 4 ПО ПЛАТЕЖАМ — СУММЫ СТАЛИ НАСТОЯЩИМИ. Баланс, счета,
 * долг и переплата приходят из `students.balance` и `tuition_invoices`
 * (миграции 227/229). Раньше здесь стояла заготовка из `v2/data`: «ОБЩИЙ
 * БАЛАНС 1 250 000» и долг 4 950 000 — числа, которых нет ни в одной таблице.
 *
 * Три запроса идут вместе, но КАЖДЫЙ ловит свою ошибку сам (safeQuery внутри
 * аксессоров) и возвращает признак `failed`. Поэтому `Promise.all` здесь
 * безопасен: упавший запрос не отменяет соседние и не роняет экран — в этих
 * файлах уже находили Promise.all без защиты, и он уносил всю страницу.
 *
 * Что осталось заготовкой: кошелёк на питание — под него в схеме нет ни одной
 * таблицы. Карточка помечена прямо на экране.
 *
 * Авторизация/редирект — на уровне layout.tsx этого сегмента.
 */
export default async function ParentPaymentsPage() {
  const [child, summary, invoices] = await Promise.all([
    getSelectedChild(),
    childPaymentsSummary(),
    childInvoices(),
  ]);

  return (
    <PaymentsView
      childName={child?.full_name ?? null}
      childClassName={child?.className ?? null}
      summary={summary}
      invoices={invoices.items}
    />
  );
}
