"use server";

import {
  createSchoolAdmin, changeOwnPassword, createSchool,
  updateSchoolAdmin, deleteSchoolAdmin, resetSchoolAdminPassword,
  assertSchoolIsManageable, assertAdminIsManageable,
} from "@/lib/admin-api";
import {
  deleteSchoolForever, getSchoolWipePreview, setSchoolArchived,
  type SchoolWipePreview, type WipeResult,
} from "@/lib/school-lifecycle";
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

// ── SCHOOLS ──────────────────────────────────────────────────────────────────

export async function actionCreateSchool(formData: FormData) {
  await verifySuperAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const autostart_enabled = formData.get("autostart_enabled") === "on";
  if (!name || !code) throw new Error("Missing fields");
  const id = await createSchool({ name, code, autostart_enabled });
  revalidatePath("/superadmin/schools");
  revalidatePath("/superadmin/dashboard");
  return id;
}

/**
 * Что уйдёт при удалении школы. Показывается в диалоге до подтверждения.
 * Доступно только суперадмину: админ школы своей школы удалить не может.
 */
export async function actionSchoolWipePreview(schoolId: string): Promise<SchoolWipePreview | null> {
  await verifySuperAdmin();
  return getSchoolWipePreview(schoolId);
}

/** Архивировать школу или вернуть из архива. Обратимо. */
export async function actionSetSchoolArchived(schoolId: string, archived: boolean) {
  await verifySuperAdmin();
  await assertSchoolIsManageable(schoolId);
  await setSchoolArchived(schoolId, archived);
  revalidatePath("/superadmin/schools");
  revalidatePath("/superadmin/dashboard");
}

/**
 * Удалить школу насовсем.
 *
 * Подтверждение — НАЗВАНИЕ школы, набранное вручную. Слово «УДАЛИТЬ» набирается
 * механически и одинаково для любой строки списка; название заставляет
 * посмотреть, ту ли школу удаляешь. Сверка идёт ЗДЕСЬ, на сервере: проверка
 * только в форме обходится вызовом действия напрямую.
 */
export async function actionDeleteSchoolForever(
  schoolId: string,
  confirmation: string,
): Promise<WipeResult> {
  await verifySuperAdmin();
  await assertSchoolIsManageable(schoolId);

  const preview = await getSchoolWipePreview(schoolId);
  if (!preview) throw new Error("Школа не найдена");
  if (preview.isDemo) throw new Error("demo_school_cannot_be_deleted");
  if (confirmation.trim() !== preview.name.trim()) throw new Error("school_name_mismatch");

  const result = await deleteSchoolForever(schoolId);
  revalidatePath("/superadmin/schools");
  revalidatePath("/superadmin/dashboard");
  return result;
}

// ── SCHOOL ADMINS ────────────────────────────────────────────────────────────

export async function actionCreateSchoolAdmin(formData: FormData) {
  await verifySuperAdmin();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const school_id = String(formData.get("school_id") ?? "").trim();
  if (!full_name || !username || !password || !school_id) throw new Error("Missing fields");
  // Z.1: school_id приходит из FormData — фильтр в <select> ничего не гарантирует.
  await assertSchoolIsManageable(school_id);
  const result = await createSchoolAdmin({ full_name, username, password, school_id });
  revalidatePath("/superadmin/admins");
  revalidatePath("/superadmin/dashboard");
  return result;
}

export async function actionUpdateSchoolAdmin(formData: FormData) {
  await verifySuperAdmin();
  const admin_id = String(formData.get("admin_id") ?? "").trim();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const school_id = String(formData.get("school_id") ?? "").trim();
  if (!admin_id || !full_name || !school_id) throw new Error("Missing fields");
  // Z.1: проверяем ОБА конца — нельзя ни тронуть демо-админа, ни перенести
  // кого-либо В демо-школу.
  await assertAdminIsManageable({ adminId: admin_id });
  await assertSchoolIsManageable(school_id);
  await updateSchoolAdmin(admin_id, { full_name, school_id });
  revalidatePath("/superadmin/admins");
}

export async function actionDeleteSchoolAdmin(userId: string) {
  await verifySuperAdmin();
  // Z.1: hard delete через auth.admin.deleteUser — без этой проверки crafted
  // POST сносит демо-админа (admin/admin123) вместе с auth-пользователем.
  await assertAdminIsManageable({ userId });
  await deleteSchoolAdmin(userId);
  revalidatePath("/superadmin/admins");
  revalidatePath("/superadmin/dashboard");
}

export async function actionResetSchoolAdminPassword(userId: string) {
  await verifySuperAdmin();
  // Z.1: иначе можно молча сменить пароль демо-админу.
  await assertAdminIsManageable({ userId });
  const newPassword = await resetSchoolAdminPassword(userId);
  revalidatePath("/superadmin/admins");
  return newPassword;
}

export async function actionChangeOwnPassword(formData: FormData) {
  const user = await verifySuperAdmin();
  const newPassword = String(formData.get("new_password") ?? "").trim();
  if (!newPassword || newPassword.length < 6) throw new Error("Password too short");
  await changeOwnPassword(user.id, newPassword);
}
