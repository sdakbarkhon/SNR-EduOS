import { cookies } from "next/headers";
import { WALLETS } from "@snr/core";
import { getParentContext, SELECTED_CHILD_COOKIE, resolveSelectedChild } from "@/lib/parent-context";
import { PaymentsView } from "./PaymentsView";

/**
 * «Оплаты» — 1:1 по составу и данным с apps/mobile-parent PaymentsScreen.tsx:
 * BILLS/PAYMENTS_OVERVIEW/WALLETS — общий мок из packages/core/src/mocks/
 * payments.ts, тот же источник, что читает мобилка (единственный источник
 * чисел — чтобы веб и мобилка не расходились). Ничего не подключено к
 * payments/charges (старый веб-портал с реальными запросами снесён и
 * сознательно не переиспользуется).
 *
 * Активный ребёнок — из cookie/каркаса, для имени в карточке «Кошелёк
 * ребёнка» и для WALLETS[индекс] — WALLETS мок-фикстура с 6 позициями
 * (столько же, сколько демо-детей мобилки), у реальных детей нет строки в
 * этой таблице по student_id, поэтому баланс берём по ПОЗИЦИИ активного
 * ребёнка в списке ctx.children (тот же index-based приём, что и в мобильном
 * childIndex()/getWalletBalance()), а не по совпадению id.
 */
export default async function ParentPaymentsPage() {
  const ctx = await getParentContext();
  if (!ctx) return null;

  const cookieStore = await cookies();
  const child = resolveSelectedChild(ctx.children, cookieStore.get(SELECTED_CHILD_COOKIE)?.value ?? null);

  const childIdx = Math.max(0, ctx.children.findIndex((c) => c.id === child?.id));
  const wallet = WALLETS[childIdx] ?? WALLETS[0] ?? { student_id: "", balance: 0 };

  return <PaymentsView childName={child?.full_name ?? null} walletBalance={wallet.balance} />;
}
