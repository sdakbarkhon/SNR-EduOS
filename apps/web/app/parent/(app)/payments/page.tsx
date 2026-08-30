import { getParentContext } from "@/lib/parent-context";
import {
  childInvoices,
  childPaymentsSummary,
  getSelectedChild,
  parentIsDemo,
  parentSchoolContacts,
  parentUnreadCount,
} from "@/lib/parent-queries";
import { PaymentsView } from "./PaymentsView";
import { RealPaymentsView } from "./RealPaymentsView";

/**
 * «Оплаты» (П17) — РАЗВИЛКА ДЕМО/НАСТОЯЩИЙ. Заход 2 по оплатам, 30.08.2026.
 *
 * Демо-гость получает PaymentsView — витрину, собранную дословно по макету, с
 * теми же заготовками, что и до захода. Настоящий родитель получает
 * RealPaymentsView со своими счетами и балансом.
 *
 * РАЗВИЛКА СТОИТ ЗДЕСЬ, А НЕ ВНУТРИ КОМПОНЕНТА — намеренно. Так файл витрины
 * не пришлось трогать ни одной строкой, и «демо-гость видит ровно то же»
 * доказывается составом коммита, а не чтением кода. Плюс запросы к настоящим
 * таблицам вообще не выполняются для гостя: они за развилкой.
 *
 * Признак демо — schools.is_demo (заход 1). Демо-вход на вебе идёт мимо
 * общего механизма, через зашитый номер, но выдаёт сессию настоящей строки
 * parents демо-школы — поэтому признак у гостя верный сам собой.
 */
export default async function ParentPaymentsPage() {
  const isDemo = await parentIsDemo();

  if (isDemo) {
    const child = await getSelectedChild();
    return (
      <PaymentsView
        isDemo={isDemo}
        childName={child?.full_name ?? null}
        childClassName={child?.className ?? null}
      />
    );
  }

  const [summary, invoices, ctx, school, bellCount] = await Promise.all([
    childPaymentsSummary(),
    childInvoices(),
    getParentContext(),
    parentSchoolContacts(),
    parentUnreadCount(),
  ]);

  // ТОЛЬКО ОТКРЫТЫЕ. Оплаченный счёт долгом не является, и childPaymentsSummary
  // считает долг ровно по ним же — иначе список и сумма над ним разошлись бы.
  const open = invoices.items.filter((i) => i.status === "open");

  return (
    <RealPaymentsView
      summary={summary}
      invoices={open}
      parentInitials={initialsOf(ctx?.parentName ?? "")}
      bellCount={bellCount}
      school={school}
    />
  );
}

/**
 * ФИО → две буквы для аватара: первые буквы первых двух слов.
 *
 * Именно две, а не одна: ФИО в боевой школе записано узбекским порядком
 * («BOQIJONOV SARDOR …»), первое слово — фамилия, и одна буква была бы буквой
 * фамилии. Тот же приём, что в мобильном профиле и в «Данных родителя».
 */
function initialsOf(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}
