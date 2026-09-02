import { schoolViewContext } from "@/lib/school-view";
import { loadPaymentsPage } from "@/lib/money-data";
import { PaymentsAdminView } from "@/app/admin/payments/PaymentsAdminView";

/**
 * Оплаты школы глазами менеджера. Срез 3d — последний по роли.
 *
 * ЭКРАН ТОТ ЖЕ, ЧТО У АДМИНА: PaymentsAdminView взят как есть, а не
 * скопирован. Отличие одно и необязательное — школа передаётся вниз, чтобы
 * каждая форма и каждый довод несли её с собой. У админа её нет, и его экран
 * работает как вчера.
 *
 * Проверка и школа — тем же schoolViewContext, что у одиннадцати соседних
 * вкладок: он же отсекает демо-школу и чужого. Второй копии правила нет.
 *
 * СУПЕРАДМИНУ ЭТОТ ЭКРАН НЕ ПОКАЗАН ВОВСЕ. Деньги ему запрещены с миграции
 * 222, и вкладки «Оплаты» в его полосе нет. Но адрес можно набрать руками,
 * поэтому здесь стоит второй рубеж: не менеджер — уходит к себе.
 */
export const dynamic = "force-dynamic";

export default async function ManagerPaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { db, school, actor } = await schoolViewContext(id);
  if (actor.role !== "manager") {
    const { redirect } = await import("next/navigation");
    redirect(`/superadmin/schools/${school.id}/view`);
  }

  const { invoices, blockers } = await loadPaymentsPage(db, school.id);
  return <PaymentsAdminView invoices={invoices} blockers={blockers} schoolId={school.id} />;
}
