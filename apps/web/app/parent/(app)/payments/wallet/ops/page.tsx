import { parentIsDemo, parentToday } from "@/lib/parent-queries";
import { RealSectionSoon } from "../../RealSectionSoon";
import { WALLET_OPS, walletTotals } from "../../../_demo/demo-data";
import { WalletOpsView } from "./WalletOpsView";

/**
 * «Операции кошелька» — веб-порт
 * apps/mobile-parent/src/screens/payments/WalletOpsScreen.tsx.
 *
 * Тот же выдуманный список, что и на самом кошельке, но целиком и с фильтром
 * «все / траты / пополнения». Источник один — `_demo/demo-data.ts`, поэтому
 * итоги внизу кошелька и здесь всегда совпадают.
 */
/** ЗАХОД 7. У настоящего родителя раздела нет — вместе с самим кошельком. */
export default async function ParentWalletOpsPage() {
  const isDemo = await parentIsDemo();
  if (!isDemo) return <RealSectionSoon sectionKey="walletOps" />;

  const today = await parentToday();
  return <WalletOpsView isDemo={isDemo} days={WALLET_OPS} totals={walletTotals()} today={today} />;
}
