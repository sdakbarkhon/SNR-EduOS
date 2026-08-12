import { parentToday } from "@/lib/parent-queries";
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
export default async function ParentWalletOpsPage() {
  const today = await parentToday();
  return <WalletOpsView days={WALLET_OPS} totals={walletTotals()} today={today} />;
}
