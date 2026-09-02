"use server";

import { createParent, deleteParent, updateParent, resetParentPassword } from "@/lib/admin-api";
import { changedFields, GOOGLE_EMAIL_FIELDS } from "@/lib/form-patch";
import { pendingCodeFor } from "@/lib/parent-sms";
import { guard } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { verifyStaff, type StaffRole } from "@/lib/verify-staff";

/** П.3 Заход 1: also resolves isSuperAdmin — see app/admin/actions.ts's
 *  verifyAdmin() for the full rationale (same pattern, duplicated here since
 *  this file already had its own copy). */
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
  return { schoolId: s.schoolId, userId: s.userId, isSuperAdmin: s.isSuperAdmin, role: s.role };
}

export async function actionCreateParent(formData: FormData) {
  return guard(async () => {
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет (WRONG_SCHOOL). Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId, userId } = await verifyAdmin(школаИзФормы);
    const full_name = String(formData.get("full_name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const student_ids = formData.getAll("student_ids").map((v) => String(v));
    // Z.2.8 — телефон стал ключом входа, поэтому обязателен.
    if (!full_name || !phone || student_ids.length === 0) throw new Error("Missing fields");
    const result = await createParent({
      full_name,
      phone,
      student_ids,
      school_id: schoolId,
      created_by: userId,
      // Необязательный: под вход через Google (миграция 201). Apple ID убран
      // 18.08.2026 — колонка осталась, но форма её больше не шлёт.
      google_email: String(formData.get("google_email") ?? ""),
    });
    revalidatePath("/admin/parents");
    return result;
  });
}

/** Z.2.8 — действующий код входа, чтобы админ мог продиктовать его родителю.
 *  Временно, пока нет SMS-провайдера; снимается вместе с заглушкой доставки.
 *  Школа проверяется здесь: таблица кодов закрыта от браузера (RLS без
 *  политик), и без этой проверки админ одной школы увидел бы код чужой. */
export async function actionParentPendingCode(parentId: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    const sb = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: parent } = await (sb as any)
      .from("parents").select("phone, school_id").eq("id", parentId).maybeSingle();
    if (!parent) return null;
    if (!isSuperAdmin && parent.school_id !== schoolId) return null;
    return pendingCodeFor(parent.phone as string);
  });
}

export async function actionDeleteParent(parentId: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    await deleteParent(parentId, schoolId, isSuperAdmin);
    revalidatePath("/admin/parents");
  });
}

export async function actionUpdateParent(formData: FormData) {
  return guard(async () => {
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет (WRONG_SCHOOL). Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId, isSuperAdmin } = await verifyAdmin(школаИзФормы);
    const parent_id = String(formData.get("parent_id") ?? "");
    const full_name = String(formData.get("full_name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const student_ids = formData.getAll("student_ids").map((v) => String(v));
    if (!full_name) throw new Error("Missing fields");
    await updateParent(
      parent_id,
      {
        full_name,
        phone: phone || undefined,
        student_ids,
        school_id: schoolId,
        // Почта пишется, только если её правда меняли (lib/form-patch.ts) — как
        // у ученика, учителя и администратора. apple_email сюда не попадает
        // вовсе: её нет на экране, а значит и трогать её нечем.
        ...changedFields(formData, GOOGLE_EMAIL_FIELDS),
      },
      schoolId,
      isSuperAdmin,
    );
    revalidatePath("/admin/parents");
  });
}

export async function actionResetParentPassword(userId: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    const newPassword = await resetParentPassword(userId, schoolId, isSuperAdmin);
    revalidatePath("/admin/parents");
    return newPassword;
  });
}
