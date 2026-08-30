import { getSelectedChild, parentIsDemo, parentToday } from "@/lib/parent-queries";
import { WALLET_BALANCE, WALLET_OPS, walletTotals } from "../../_demo/demo-data";
import { WalletView } from "./WalletView";

/**
 * «Кошелёк ребёнка» — веб-порт
 * apps/mobile-parent/src/screens/payments/ChildWalletScreen.tsx.
 *
 * ДАННЫХ НЕТ: кошелька, его операций и терминала столовой в схеме не
 * существует ни одной таблицей. Всё выдумано и лежит в общем файле раздела
 * (`_demo/demo-data.ts`); экран говорит об этом сам плашкой над списком.
 * Настоящие здесь только имя ребёнка и даты — они берутся у школы.
 *
 * Баланс 185 000 сум — то же число, что главная показывает в плитке
 * «КОШЕЛЁК»: два экрана не должны спорить друг с другом.
 */
export default async function ParentWalletPage() {
  const [child, today, isDemo] = await Promise.all([getSelectedChild(), parentToday(), parentIsDemo()]);
  const totals = walletTotals();

  return (
    <WalletView
      isDemo={isDemo}
      balance={WALLET_BALANCE}
      days={WALLET_OPS.slice(0, 2)}
      totals={totals}
      childName={child?.full_name ?? null}
      today={today}
    />
  );
}
