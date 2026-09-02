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
): Promise<{ schoolId: string; userId: string; isSuperAdmin: boolean; role: StaffRole }> {
  const s = await verifyStaff(requestedSchoolId);
  // УЧЁТНАЯ ЗАПИСЬ, А НЕ СТРОКА АДМИНА. До миграции 251 отсюда отдавался
  // `adminId`, потому что автор правки ссылался на `admins`. Теперь он
  // ссылается на `auth.users`, и `userId` есть у любой роли — включая
  // менеджера, у которого строки в admins нет и быть не может.
  return { schoolId: s.schoolId, userId: s.userId, isSuperAdmin: s.isSuperAdmin, role: s.role };
}

/**
 * ═══ ДЕНЬГИ ОТКРЫТЫ МЕНЕДЖЕРУ. Срез 3d, 03.09.2026 ════════════════════════
 *
 * Здесь стоял `assertMoneyAllowed`, отбивавший менеджера от всех пяти
 * действий. Он был не решением, а честным отказом на месте упора в схему:
 * `tuition_invoices.adjusted_by` ссылался на `admins`, строки в которых у
 * менеджера нет и быть не может.
 *
 * Пропустить его пустотой было нельзя даже при желании: проверка
 * `tuition_invoices_adjusted_has_author` требует автора и время всегда, когда
 * сумма помечена правленой. База отбила бы такую запись сама.
 *
 * Миграция 251 перевела `adjusted_by` на `auth.users` и завела рядом
 * `adjusted_by_role`. Автор теперь записывается у любой роли, и в истории
 * видно не только КТО, но и В КАКОМ КАЧЕСТВЕ.
 *
 * ШКОЛА. Админу она не нужна — она в его строке; менеджеру обязательна —
 * своей у него нет. Формы несут её полем `school_id`, действия без формы —
 * необязательным доводом. Подделать нечего: менеджеру и так разрешены все
 * школы, а у админа чужая школа отвергается, а не подставляется молча.
 */

/**
 * Что случится, если нажать «Выставить счета».
 *
 * Отдельным действием, а не свойством страницы: подтверждение обязано
 * показывать числа НА МОМЕНТ НАЖАТИЯ. Между открытием экрана и нажатием админ
 * мог вписать цену классу — и счётов стало бы больше, чем обещала страница.
 */
export async function actionIssuePreview(
  requestedSchoolId?: string | null,
): Promise<ActionResult<IssuePreview>> {
  return guard(async () => {
    const { schoolId } = await verifyAdmin(requestedSchoolId);
    return issueInvoicesPreview(schoolId);
  });
}

/** Выставить счета своей школе. Граница школы — в функции базы (миграция 230). */
export async function actionIssueInvoicesNow(requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId } = await verifyAdmin(requestedSchoolId);
    const result = await issueInvoicesNow(schoolId);
    revalidatePath("/admin/payments");
    return result;
  });
}

/** Правка суммы открытого счёта. Сумма читается тем же кодом, что цена группы
 *  и пополнение баланса: правило чтения денег в проекте одно. */
export async function actionAdjustInvoice(formData: FormData) {
  const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
  return guard(async () => {
    const { schoolId, userId, isSuperAdmin, role } = await verifyAdmin(школаИзФормы);
    await adjustInvoiceAmount({
      invoiceId: String(formData.get("invoice_id") ?? ""),
      amount: parseCoursePrice(String(formData.get("amount") ?? "")),
      reason: String(formData.get("reason") ?? ""),
      // Учётная запись, а не строка админа: миграция 251. У менеджера строки
      // в admins нет, а учётная запись есть у любого вошедшего.
      actorUserId: userId,
      actorRole: role,
      callerSchoolId: schoolId,
      callerIsSuperAdmin: isSuperAdmin,
    });
    revalidatePath("/admin/payments");
  });
}

/** Отмена открытого счёта. */
export async function actionCancelInvoice(formData: FormData) {
  const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
  return guard(async () => {
    const { schoolId, userId, isSuperAdmin, role } = await verifyAdmin(школаИзФормы);
    await cancelInvoice({
      invoiceId: String(formData.get("invoice_id") ?? ""),
      reason: String(formData.get("reason") ?? ""),
      actorUserId: userId,
      actorRole: role,
      callerSchoolId: schoolId,
      callerIsSuperAdmin: isSuperAdmin,
    });
    revalidatePath("/admin/payments");
  });
}

/** Вернуть отменённый счёт в работу. */
export async function actionRestoreInvoice(invoiceId: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    await restoreInvoice({ invoiceId, callerSchoolId: schoolId, callerIsSuperAdmin: isSuperAdmin });
    revalidatePath("/admin/payments");
  });
}
