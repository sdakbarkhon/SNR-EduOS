"use server";

import {
  adjustInvoiceAmount,
  cancelInvoice,
  issueInvoicesNow,
  issueInvoicesPreview,
  restoreInvoice,
  type IssuePreview,
} from "@/lib/admin-payments";
import { parseCoursePrice } from "@/lib/course-price";
import { createClient } from "@/lib/supabase/server";
import { guard, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { verifyStaff, type StaffRole } from "@/lib/verify-staff";

/**
 * Кто перед нами. Своя копия — как в `admin/parents/actions.ts`: этому разделу
 * нужен ещё и `admins.id`, он идёт в `adjusted_by` у поправленного счёта, а
 * общая версия возвращает только школу.
 */
/**
 * Кто действует и в какой школе.
 *
 * 03.09.2026, заход 3 по роли менеджера — ТЕЛО ПЕРЕЕХАЛО В lib/verify-staff.ts.
 * Раньше эта функция жила ТРЕМЯ ОДИНАКОВЫМИ КОПИЯМИ в трёх файлах действий, и
 * учить пускать менеджера пришлось бы все три. Здесь осталась только оболочка,
 * сохраняющая прежнюю подпись, — поэтому ни один из вызывающих не тронут.
 *
 * Довод `requestedSchoolId` — школа, названная снаружи. Админу она не нужна
 * (его школа в его строке) и при несовпадении отвергается; менеджеру она
 * обязательна, потому что своей школы у него нет.
 */
async function verifyAdmin(
  requestedSchoolId?: string | null,
): Promise<{ schoolId: string; adminId: string | null; isSuperAdmin: boolean; role: StaffRole }> {
  const s = await verifyStaff(requestedSchoolId);
  // adminId у менеджера null: своей строки в admins у него нет и быть не
  // может. Деньги на него сегодня не смотрят, а если посмотрят — отказ
  // должен быть громким, а не тихой подстановкой чужого идентификатора.
  return { schoolId: s.schoolId, adminId: s.adminId, isSuperAdmin: s.isSuperAdmin, role: s.role };
}

/**
 * ДЕНЬГИ МЕНЕДЖЕРУ ПОКА ЗАКРЫТЫ, И ЭТО УПОР В СХЕМУ, А НЕ РЕШЕНИЕ.
 *
 * `tuition_invoices.adjusted_by` объявлен как
 * `REFERENCES admins(id) ON DELETE SET NULL` — то есть автором правки счёта
 * может быть только строка из `admins`. У менеджера её нет и быть не может:
 * он не привязан ни к какой школе, в этом вся роль.
 *
 * Пропустить его с `adjusted_by = null` можно было бы одной строкой, но тогда
 * правка суммы счёта потеряла бы автора молча. Деньги — последнее место, где
 * такое допустимо.
 *
 * Значит переезд денег требует миграции: либо `adjusted_by` перестаёт
 * указывать на `admins`, либо рядом появляется колонка роли. Миграций в этом
 * заходе нет по условию, поэтому здесь честный отказ, а не тихая потеря.
 */
function assertMoneyAllowed(role: StaffRole): void {
  if (role === "manager") throw new Error("MANAGER_MONEY_NOT_READY");
}

/**
 * Что случится, если нажать «Выставить счета».
 *
 * Отдельным действием, а не свойством страницы: подтверждение обязано
 * показывать числа НА МОМЕНТ НАЖАТИЯ. Между открытием экрана и нажатием админ
 * мог вписать цену классу — и счётов стало бы больше, чем обещала страница.
 */
export async function actionIssuePreview(): Promise<ActionResult<IssuePreview>> {
  return guard(async () => {
    const { schoolId, role } = await verifyAdmin();
    assertMoneyAllowed(role);
    return issueInvoicesPreview(schoolId);
  });
}

/** Выставить счета своей школе. Граница школы — в функции базы (миграция 230). */
export async function actionIssueInvoicesNow() {
  return guard(async () => {
    const { schoolId, role } = await verifyAdmin();
    assertMoneyAllowed(role);
    const result = await issueInvoicesNow(schoolId);
    revalidatePath("/admin/payments");
    return result;
  });
}

/** Правка суммы открытого счёта. Сумма читается тем же кодом, что цена группы
 *  и пополнение баланса: правило чтения денег в проекте одно. */
export async function actionAdjustInvoice(formData: FormData) {
  return guard(async () => {
    const { schoolId, adminId, isSuperAdmin, role } = await verifyAdmin();
    assertMoneyAllowed(role);
    await adjustInvoiceAmount({
      invoiceId: String(formData.get("invoice_id") ?? ""),
      amount: parseCoursePrice(String(formData.get("amount") ?? "")),
      reason: String(formData.get("reason") ?? ""),
      // Заслон assertMoneyAllowed выше пропускает сюда только админа школы,
      // а у него строка в admins есть всегда.
      adminId: adminId as string,
      callerSchoolId: schoolId,
      callerIsSuperAdmin: isSuperAdmin,
    });
    revalidatePath("/admin/payments");
  });
}

/** Отмена открытого счёта. */
export async function actionCancelInvoice(formData: FormData) {
  return guard(async () => {
    const { schoolId, adminId, isSuperAdmin, role } = await verifyAdmin();
    assertMoneyAllowed(role);
    await cancelInvoice({
      invoiceId: String(formData.get("invoice_id") ?? ""),
      reason: String(formData.get("reason") ?? ""),
      // Заслон assertMoneyAllowed выше пропускает сюда только админа школы,
      // а у него строка в admins есть всегда.
      adminId: adminId as string,
      callerSchoolId: schoolId,
      callerIsSuperAdmin: isSuperAdmin,
    });
    revalidatePath("/admin/payments");
  });
}

/** Вернуть отменённый счёт в работу. */
export async function actionRestoreInvoice(invoiceId: string) {
  return guard(async () => {
    const { schoolId, isSuperAdmin, role } = await verifyAdmin();
    assertMoneyAllowed(role);
    await restoreInvoice({ invoiceId, callerSchoolId: schoolId, callerIsSuperAdmin: isSuperAdmin });
    revalidatePath("/admin/payments");
  });
}
