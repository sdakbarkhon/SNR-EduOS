import { getSelectedChild, parentIsDemo, parentToday } from "@/lib/parent-queries";
import { RealSectionSoon } from "../RealSectionSoon";
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
/**
 * ЗАХОД 7. У настоящего родителя раздела больше нет — решение заказчика.
 * Таблицы школьного кошелька в схеме не существует ни одной, столовая не
 * заведена: показывать нечего и неоткуда.
 */
export default async function ParentWalletPage() {
  const isDemo = await parentIsDemo();
  if (!isDemo) return <RealSectionSoon sectionKey="wallet" />;

  const [child, today] = await Promise.all([getSelectedChild(), parentToday()]);
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
