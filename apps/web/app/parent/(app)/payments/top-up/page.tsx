import { childBalance, getSelectedChild } from "@/lib/parent-queries";
import { InnerHeader } from "../../_ui/screen-kit";
import { TopUpView } from "./TopUpView";

/**
 * «Пополнение баланса» (dtop) — веб-порт
 * apps/mobile-parent/src/screens/payments/TopUpScreen.tsx.
 *
 * 27.08.2026, заход 4 по платежам: текущий баланс настоящий, из
 * students.balance. Само пополнение невозможно — платёжной системы нет, и
 * экран говорит об этом прямо.
 * Авторизация и редирект — на уровне layout.tsx сегмента.
 */
export default async function ParentTopUpPage() {
  const [child, balance] = await Promise.all([getSelectedChild(), childBalance()]);

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="Пополнение баланса" backHref="/parent/payments" />
      <TopUpView childName={child?.full_name ?? null} balance={balance.balance} />
    </div>
  );
}
