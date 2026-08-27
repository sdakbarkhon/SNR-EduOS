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

/**
 * Кто перед нами. Своя копия — как в `admin/parents/actions.ts`: этому разделу
 * нужен ещё и `admins.id`, он идёт в `adjusted_by` у поправленного счёта, а
 * общая версия возвращает только школу.
 */
async function verifyAdmin(): Promise<{ schoolId: string; adminId: string; isSuperAdmin: boolean }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const [{ data: admin }, { data: superAdmin }] = await Promise.all([
    sbAny.from("admins").select("id, school_id").eq("user_id", user.id).single(),
    sbAny.from("super_admins").select("id").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!admin) throw new Error("Not admin");
  return {
    schoolId: admin.school_id as string,
    adminId: admin.id as string,
    isSuperAdmin: !!superAdmin,
  };
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
    const { schoolId } = await verifyAdmin();
    return issueInvoicesPreview(schoolId);
  });
}

/** Выставить счета своей школе. Граница школы — в функции базы (миграция 230). */
export async function actionIssueInvoicesNow() {
  return guard(async () => {
    const { schoolId } = await verifyAdmin();
    const result = await issueInvoicesNow(schoolId);
    revalidatePath("/admin/payments");
    return result;
  });
}

/** Правка суммы открытого счёта. Сумма читается тем же кодом, что цена группы
 *  и пополнение баланса: правило чтения денег в проекте одно. */
export async function actionAdjustInvoice(formData: FormData) {
  return guard(async () => {
    const { schoolId, adminId, isSuperAdmin } = await verifyAdmin();
    await adjustInvoiceAmount({
      invoiceId: String(formData.get("invoice_id") ?? ""),
      amount: parseCoursePrice(String(formData.get("amount") ?? "")),
      reason: String(formData.get("reason") ?? ""),
      adminId,
      callerSchoolId: schoolId,
      callerIsSuperAdmin: isSuperAdmin,
    });
    revalidatePath("/admin/payments");
  });
}

/** Отмена открытого счёта. */
export async function actionCancelInvoice(formData: FormData) {
  return guard(async () => {
    const { schoolId, adminId, isSuperAdmin } = await verifyAdmin();
    await cancelInvoice({
      invoiceId: String(formData.get("invoice_id") ?? ""),
      reason: String(formData.get("reason") ?? ""),
      adminId,
      callerSchoolId: schoolId,
      callerIsSuperAdmin: isSuperAdmin,
    });
    revalidatePath("/admin/payments");
  });
}

/** Вернуть отменённый счёт в работу. */
export async function actionRestoreInvoice(invoiceId: string) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    await restoreInvoice({ invoiceId, callerSchoolId: schoolId, callerIsSuperAdmin: isSuperAdmin });
    revalidatePath("/admin/payments");
  });
}
