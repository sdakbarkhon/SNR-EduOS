"use server";

import { createSchoolAdmin, changeOwnPassword } from "@/lib/admin-api";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function verifySuperAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: superAdmin } = await (sb as any).from("super_admins").select("id").eq("user_id", user.id).single();
  if (!superAdmin) throw new Error("Not super admin");
  return user;
}

export async function actionCreateSchoolAdmin(formData: FormData) {
  await verifySuperAdmin();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const school_id = String(formData.get("school_id") ?? "").trim();
  if (!full_name || !username || !password || !school_id) throw new Error("Missing fields");
  const result = await createSchoolAdmin({ full_name, username, password, school_id });
  revalidatePath("/superadmin/admins");
  revalidatePath("/superadmin/dashboard");
  return result;
}

export async function actionChangeOwnPassword(formData: FormData) {
  const user = await verifySuperAdmin();
  const newPassword = String(formData.get("new_password") ?? "").trim();
  if (!newPassword || newPassword.length < 6) throw new Error("Password too short");
  await changeOwnPassword(user.id, newPassword);
}
