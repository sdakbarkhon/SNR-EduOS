"use server";

import { createParent, regenerateParentInviteCode, deleteParent } from "@/lib/admin-api";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function verifyAdmin(): Promise<{ schoolId: string; userId: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admin } = await (sb as any).from("admins").select("id, school_id").eq("user_id", user.id).single();
  if (!admin) throw new Error("Not admin");
  return { schoolId: admin.school_id as string, userId: user.id };
}

export async function actionCreateParent(formData: FormData) {
  const { schoolId, userId } = await verifyAdmin();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const student_ids = formData.getAll("student_ids").map((v) => String(v));
  if (!full_name || student_ids.length === 0) throw new Error("Missing fields");
  const result = await createParent({
    full_name,
    phone: phone || undefined,
    student_ids,
    school_id: schoolId,
    created_by: userId,
  });
  revalidatePath("/admin/parents");
  return result;
}

export async function actionRegenerateInviteCode(parentId: string) {
  const { schoolId, userId } = await verifyAdmin();
  const code = await regenerateParentInviteCode(parentId, schoolId, userId);
  revalidatePath("/admin/parents");
  return code;
}

export async function actionDeleteParent(parentId: string) {
  await verifyAdmin();
  await deleteParent(parentId);
  revalidatePath("/admin/parents");
}
