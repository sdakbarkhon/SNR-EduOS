"use server";

import {
  createStudent, updateStudent, resetStudentPassword, deleteStudent,
  createTeacher, updateTeacher, resetTeacherPassword, deleteTeacher,
  createGroup, updateGroup, deleteGroup,
} from "@/lib/admin-api";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** Returns the calling admin's school_id — the service-role client used by
 *  admin-api.ts has no auth.uid(), so current_school_id() resolves to NULL
 *  there; every insert on a school_id NOT NULL table must get it from here.
 *  Also resolves isSuperAdmin (existence in super_admins) — П.3 Заход 1:
 *  admin-api.ts's update/delete functions need this to allow the cross-school
 *  bypass for super admins, since they can't check auth.uid() themselves. */
async function verifyAdmin(): Promise<{ schoolId: string; isSuperAdmin: boolean }> {
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
  return { schoolId: admin.school_id as string, isSuperAdmin: !!superAdmin };
}

// ── STUDENTS ─────────────────────────────────────────────────────────────────

export async function actionCreateStudent(formData: FormData) {
  const { schoolId } = await verifyAdmin();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const group_id = String(formData.get("group_id") ?? "").trim();
  if (!full_name || !username || !password || !group_id) throw new Error("Missing fields");
  const result = await createStudent({ full_name, username, password, group_id, school_id: schoolId });
  revalidatePath("/admin/students");
  revalidatePath("/admin");
  return result;
}

export async function actionUpdateStudent(formData: FormData) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  const student_id = String(formData.get("student_id") ?? "");
  const user_id = String(formData.get("user_id") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const group_id = String(formData.get("group_id") ?? "").trim();
  const old_group_id = String(formData.get("old_group_id") ?? "").trim();
  await updateStudent(student_id, user_id, { full_name, username, group_id, old_group_id }, schoolId, isSuperAdmin);
  revalidatePath("/admin/students");
}

export async function actionResetStudentPassword(userId: string) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  const newPassword = await resetStudentPassword(userId, schoolId, isSuperAdmin);
  revalidatePath("/admin/students");
  return newPassword;
}

export async function actionDeleteStudent(userId: string) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  await deleteStudent(userId, schoolId, isSuperAdmin);
  revalidatePath("/admin/students");
  revalidatePath("/admin");
}

// ── TEACHERS ─────────────────────────────────────────────────────────────────

export async function actionCreateTeacher(formData: FormData) {
  const { schoolId } = await verifyAdmin();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  if (!full_name || !username || !password) throw new Error("Missing fields");
  const result = await createTeacher({ full_name, username, password, school_id: schoolId });
  revalidatePath("/admin/teachers");
  revalidatePath("/admin");
  return result;
}

export async function actionUpdateTeacher(formData: FormData) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  const teacher_id = String(formData.get("teacher_id") ?? "");
  const user_id = String(formData.get("user_id") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  await updateTeacher(teacher_id, user_id, { full_name, username }, schoolId, isSuperAdmin);
  revalidatePath("/admin/teachers");
}

export async function actionResetTeacherPassword(userId: string) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  const newPassword = await resetTeacherPassword(userId, schoolId, isSuperAdmin);
  revalidatePath("/admin/teachers");
  return newPassword;
}

export async function actionDeleteTeacher(teacherId: string, userId: string) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  await deleteTeacher(teacherId, userId, schoolId, isSuperAdmin);
  revalidatePath("/admin/teachers");
  revalidatePath("/admin");
}

// ── GROUPS ────────────────────────────────────────────────────────────────────

export async function actionCreateGroup(formData: FormData) {
  const { schoolId } = await verifyAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const teacher_id = String(formData.get("teacher_id") ?? "").trim();
  if (!name || !subject || !teacher_id) throw new Error("Missing fields");
  const id = await createGroup({ name, subject, teacher_id, school_id: schoolId });
  revalidatePath("/admin/groups");
  revalidatePath("/admin");
  return id;
}

export async function actionUpdateGroup(formData: FormData) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  const group_id = String(formData.get("group_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const teacher_id = String(formData.get("teacher_id") ?? "").trim();
  await updateGroup(group_id, { name, subject, teacher_id }, schoolId, isSuperAdmin);
  revalidatePath("/admin/groups");
}

export async function actionDeleteGroup(groupId: string) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  await deleteGroup(groupId, schoolId, isSuperAdmin);
  revalidatePath("/admin/groups");
  revalidatePath("/admin");
}
