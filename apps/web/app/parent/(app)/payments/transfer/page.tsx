import { getSelectedChild } from "@/lib/parent-queries";
import { TRANSFER_PRESETS, WALLET_BALANCE } from "../../_demo/demo-data";
import { TransferView } from "./TransferView";

/**
 * «Перевод между кошельками» — веб-порт
 * apps/mobile-parent/src/screens/payments/TransferScreen.tsx.
 *
 * Переводить нечего и некуда: кошельков в базе нет, платёжного провайдера
 * тоже. Экран показывает форму целиком — откуда, куда, сумма, пресеты — но
 * кнопка «Перевести» НЕ делает вид, что деньги ушли: она показывает
 * пояснение. Проверка «недостаточно средств» при этом настоящая, чтобы форма
 * вела себя предсказуемо.
 */
export default async function ParentTransferPage() {
  const child = await getSelectedChild();
  return (
    <TransferView
      balance={WALLET_BALANCE}
      presets={TRANSFER_PRESETS}
      childName={child?.full_name ?? null}
    />
  );
}
