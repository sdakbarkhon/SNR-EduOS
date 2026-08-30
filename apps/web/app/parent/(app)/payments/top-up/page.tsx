import { parentIsDemo } from "@/lib/parent-queries";
import { getSelectedChild } from "@/lib/parent-queries";
import { RealSectionSoon } from "../RealSectionSoon";
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
/**
 * ЗАХОД 7. У настоящего родителя раздела больше нет.
 *
 * Экран существовал ради одного действия — положить деньги на баланс. Из
 * приложения это невозможно: кассы нет. Показать настоящий баланс сверху и
 * погасить кнопку было бы честно, но бессмысленно: тот же баланс уже стоит
 * на корне раздела, а пресеты сумм («50 000 / 100 000 / …») ведут в никуда.
 * Экран из одного мёртвого действия — хуже отсутствующего.
 *
 * Плитки «Пополнить» на корне тоже больше нет. Адрес отвечает объяснением.
 */
export default async function ParentTopUpPage() {
  const isDemo = await parentIsDemo();
  if (!isDemo) return <RealSectionSoon sectionKey="topup" />;

  const child = await getSelectedChild();
  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="Пополнение баланса" backHref="/parent/payments" />
      <TopUpView isDemo={isDemo} childName={child?.full_name ?? null} />
    </div>
  );
}
