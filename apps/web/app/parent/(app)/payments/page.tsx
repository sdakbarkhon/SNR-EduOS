import { cookies } from "next/headers";
import { getParentContext, SELECTED_CHILD_COOKIE, resolveSelectedChild } from "@/lib/parent-context";
import { PaymentsView } from "./PaymentsView";

/**
 * «Оплаты» — 1:1 по составу с apps/mobile-parent PaymentsScreen.tsx, но
 * ПОЛНОСТЬЮ мок (как в самой мобилке — getPaymentsOverview/getDueBills/
 * getDueTotal — всё фикстура, ни одного core-запроса к payments/charges).
 * Старый веб-портал с реальными getPayments/getCharges снесён (Заход 1
 * этой серии) и сознательно не переиспользуется — задача явно просит не
 * подключать реальные payments/charges в этом заходе.
 *
 * Активный ребёнок — из cookie/каркаса, только для имени в карточке
 * «Кошелёк ребёнка» (сама сумма — мок).
 */
export default async function ParentPaymentsPage() {
  const ctx = await getParentContext();
  if (!ctx) return null;

  const cookieStore = await cookies();
  const child = resolveSelectedChild(ctx.children, cookieStore.get(SELECTED_CHILD_COOKIE)?.value ?? null);

  return <PaymentsView childName={child?.full_name ?? null} />;
}
