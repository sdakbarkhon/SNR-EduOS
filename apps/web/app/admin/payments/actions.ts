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
 * ═══ ДЕНЬГИ МЕНЯЕТ ТОЛЬКО МЕНЕДЖЕР. Заход «отобрать деньги», 03.09.2026 ════
 *
 * Решение заказчика: на первое время деньгами школ управляют менеджеры.
 * Админ школы деньги ВИДИТ — счета, суммы, состояния, балансы, причины
 * прошлых правок, список «кому счёт выставить нельзя», — но не меняет.
 *
 * ПОЧЕМУ ПРОСМОТР ОСТАВЛЕН, А НЕ УБРАН РАЗДЕЛ ЦЕЛИКОМ. Школа обязана видеть
 * свои деньги, даже если ими не управляет: без этого администратор не сможет
 * ответить родителю на вопрос «за что счёт», не позвонив менеджеру.
 *
 * ЗАСЛОН СТОИТ ДВАЖДЫ, И ЭТО НЕ ИЗБЫТОК:
 *   на экране — кнопок нет вовсе, чтобы не было мёртвых кнопок;
 *   здесь     — отказ, потому что действие можно вызвать в обход экрана.
 * Первое — вежливость, второе — собственно запрет.
 *
 * ЗЕРКАЛО ПРЕЖНЕГО. Ровно здесь до среза 3d стоял `assertMoneyAllowed`,
 * отбивавший менеджера. Теперь тот же заслон развёрнут в другую сторону —
 * и это ровно та причина, по которой права решаются В КОДЕ, а не в правилах
 * доступа: разворот занял одну функцию, а не миграцию.
 *
 * ШКОЛА. Админу она не нужна — она в его строке; менеджеру обязательна —
 * своей у него нет. Формы несут её полем `school_id`, действия без формы —
 * необязательным доводом.
 */
function assertMoneyWriter(role: StaffRole): void {
  if (role !== "manager") throw new Error("MONEY_MANAGER_ONLY");
}

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
    const { schoolId, role } = await verifyAdmin(requestedSchoolId);
    assertMoneyWriter(role);
    return issueInvoicesPreview(schoolId);
  });
}

/** Выставить счета своей школе. Граница школы — в функции базы (миграция 230). */
export async function actionIssueInvoicesNow(requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, role } = await verifyAdmin(requestedSchoolId);
    assertMoneyWriter(role);
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
    assertMoneyWriter(role);
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
    assertMoneyWriter(role);
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
    const { schoolId, isSuperAdmin, role } = await verifyAdmin(requestedSchoolId);
    assertMoneyWriter(role);
    await restoreInvoice({ invoiceId, callerSchoolId: schoolId, callerIsSuperAdmin: isSuperAdmin });
    revalidatePath("/admin/payments");
  });
}
