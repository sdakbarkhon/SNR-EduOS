"use server";

import { createParent, deleteParent, updateParent, resetParentPassword } from "@/lib/admin-api";
import { pendingCodeFor } from "@/lib/parent-sms";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** П.3 Заход 1: also resolves isSuperAdmin — see app/admin/actions.ts's
 *  verifyAdmin() for the full rationale (same pattern, duplicated here since
 *  this file already had its own copy). */
async function verifyAdmin(): Promise<{ schoolId: string; userId: string; isSuperAdmin: boolean }> {
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
  return { schoolId: admin.school_id as string, userId: user.id, isSuperAdmin: !!superAdmin };
}

export async function actionCreateParent(formData: FormData) {
  const { schoolId, userId } = await verifyAdmin();
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
  });
  revalidatePath("/admin/parents");
  return result;
}

/** Z.2.8 — действующий код входа, чтобы админ мог продиктовать его родителю.
 *  Временно, пока нет SMS-провайдера; снимается вместе с заглушкой доставки.
 *  Школа проверяется здесь: таблица кодов закрыта от браузера (RLS без
 *  политик), и без этой проверки админ одной школы увидел бы код чужой. */
export async function actionParentPendingCode(parentId: string) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  const sb = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: parent } = await (sb as any)
    .from("parents").select("phone, school_id").eq("id", parentId).maybeSingle();
  if (!parent) return null;
  if (!isSuperAdmin && parent.school_id !== schoolId) return null;
  return pendingCodeFor(parent.phone as string);
}

export async function actionDeleteParent(parentId: string) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  await deleteParent(parentId, schoolId, isSuperAdmin);
  revalidatePath("/admin/parents");
}

export async function actionUpdateParent(formData: FormData) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  const parent_id = String(formData.get("parent_id") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const student_ids = formData.getAll("student_ids").map((v) => String(v));
  if (!full_name) throw new Error("Missing fields");
  await updateParent(parent_id, { full_name, phone: phone || undefined, student_ids, school_id: schoolId }, schoolId, isSuperAdmin);
  revalidatePath("/admin/parents");
}

export async function actionResetParentPassword(userId: string) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  const newPassword = await resetParentPassword(userId, schoolId, isSuperAdmin);
  revalidatePath("/admin/parents");
  return newPassword;
}
