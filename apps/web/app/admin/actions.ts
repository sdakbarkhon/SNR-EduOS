"use server";

import {
  createStudent, updateStudent, resetStudentPassword, deleteStudent,
  createTeacher, updateTeacher, resetTeacherPassword, deleteTeacher,
  createGroup, updateGroup, deleteGroup,
} from "@/lib/admin-api";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function verifyAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admin } = await (sb as any).from("admins").select("id").eq("user_id", user.id).single();
  if (!admin) throw new Error("Not admin");
}

// ── STUDENTS ─────────────────────────────────────────────────────────────────

export async function actionCreateStudent(formData: FormData) {
  await verifyAdmin();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const group_id = String(formData.get("group_id") ?? "").trim();
  if (!full_name || !username || !password || !group_id) throw new Error("Missing fields");
  const result = await createStudent({ full_name, username, password, group_id });
  revalidatePath("/admin/students");
  revalidatePath("/admin");
  return result;
}

export async function actionUpdateStudent(formData: FormData) {
  await verifyAdmin();
  const student_id = String(formData.get("student_id") ?? "");
  const user_id = String(formData.get("user_id") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const group_id = String(formData.get("group_id") ?? "").trim();
  const old_group_id = String(formData.get("old_group_id") ?? "").trim();
  await updateStudent(student_id, user_id, { full_name, username, group_id, old_group_id });
  revalidatePath("/admin/students");
}

export async function actionResetStudentPassword(userId: string) {
  await verifyAdmin();
  const newPassword = await resetStudentPassword(userId);
  revalidatePath("/admin/students");
  return newPassword;
}

export async function actionDeleteStudent(userId: string) {
  await verifyAdmin();
  await deleteStudent(userId);
  revalidatePath("/admin/students");
  revalidatePath("/admin");
}

// ── TEACHERS ─────────────────────────────────────────────────────────────────

export async function actionCreateTeacher(formData: FormData) {
  await verifyAdmin();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  if (!full_name || !username || !password) throw new Error("Missing fields");
  const result = await createTeacher({ full_name, username, password });
  revalidatePath("/admin/teachers");
  revalidatePath("/admin");
  return result;
}

export async function actionUpdateTeacher(formData: FormData) {
  await verifyAdmin();
  const teacher_id = String(formData.get("teacher_id") ?? "");
  const user_id = String(formData.get("user_id") ?? "");
  const full_name = String(formData.get("full_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  await updateTeacher(teacher_id, user_id, { full_name, username });
  revalidatePath("/admin/teachers");
}

export async function actionResetTeacherPassword(userId: string) {
  await verifyAdmin();
  const newPassword = await resetTeacherPassword(userId);
  revalidatePath("/admin/teachers");
  return newPassword;
}

export async function actionDeleteTeacher(teacherId: string, userId: string) {
  await verifyAdmin();
  await deleteTeacher(teacherId, userId);
  revalidatePath("/admin/teachers");
  revalidatePath("/admin");
}

// ── GROUPS ────────────────────────────────────────────────────────────────────

export async function actionCreateGroup(formData: FormData) {
  await verifyAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const teacher_id = String(formData.get("teacher_id") ?? "").trim();
  if (!name || !subject || !teacher_id) throw new Error("Missing fields");
  const id = await createGroup({ name, subject, teacher_id });
  revalidatePath("/admin/groups");
  revalidatePath("/admin");
  return id;
}

export async function actionUpdateGroup(formData: FormData) {
  await verifyAdmin();
  const group_id = String(formData.get("group_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const teacher_id = String(formData.get("teacher_id") ?? "").trim();
  await updateGroup(group_id, { name, subject, teacher_id });
  revalidatePath("/admin/groups");
}

export async function actionDeleteGroup(groupId: string) {
  await verifyAdmin();
  await deleteGroup(groupId);
  revalidatePath("/admin/groups");
  revalidatePath("/admin");
}
