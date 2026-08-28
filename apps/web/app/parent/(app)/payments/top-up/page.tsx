import { getSelectedChild } from "@/lib/parent-queries";
import { InnerHeader } from "../../_ui/screen-kit";
import { TopUpView } from "./TopUpView";

/**
 * «Пополнение баланса» (dtop) — веб-порт
 * apps/mobile-parent/src/screens/payments/TopUpScreen.tsx.
 *
 * Ребёнок — настоящий (имя и класс из parent-queries), суммы — мок:
 * платёжного провайдера в проекте нет (см. _demo/demo-data.ts).
 * Авторизация и редирект — на уровне layout.tsx сегмента.
 */
export default async function ParentTopUpPage() {
  const child = await getSelectedChild();

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="Пополнение баланса" backHref="/parent/payments" />
      <TopUpView childName={child?.full_name ?? null} />
    </div>
  );
}
