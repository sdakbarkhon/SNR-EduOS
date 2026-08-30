import { getSelectedChild, parentIsDemo } from "@/lib/parent-queries";
import { PaymentsView } from "./PaymentsView";

/**
 * «Оплаты» (П17). СУММЫ здесь намеренно остаются МОКАМИ — платёжного
 * бэкенда в проекте нет вовсе (таблицы payments/charges есть, но пустые и
 * не отражают реальных счетов), поэтому счета/кошелёк/история берутся из
 * фикстур v2/data, как в мобилке.
 *
 * А вот РЕБЁНОК — настоящий: имя и класс приходят с сервера из
 * parent-queries. Раньше экран брал ребёнка из DEFAULT_CHILD_INDEX фикстур
 * и показывал чужую семью (Малику Каримову) — при том, что у нашего
 * родителя ребёнок один и это Исмаилов Шерзод.
 *
 * Авторизация/редирект — на уровне layout.tsx этого сегмента.
 */
export default async function ParentPaymentsPage() {
  // Заход 1 по оплатам: признак демо доезжает до экрана, но ничем пока не
  // управляет. Обе величины — попадания в кеш запроса (cache()), сети не
  // добавляют; Promise.all вместо двух await, чтобы порядок не намекал на
  // зависимость между ними.
  const [child, isDemo] = await Promise.all([getSelectedChild(), parentIsDemo()]);
  return (
    <PaymentsView
      isDemo={isDemo}
      childName={child?.full_name ?? null}
      childClassName={child?.className ?? null}
    />
  );
}
