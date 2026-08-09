"use server";

import {
  createStudent, updateStudent, resetStudentPassword, deleteStudent,
  createTeacher, updateTeacher, resetTeacherPassword, deleteTeacher,
  createGroup, updateGroup, deleteGroup,
  createSchoolSubject, updateSchoolSubject, setSchoolSubjectActive,
  createSubjectAssignment, updateSubjectAssignment, deleteSubjectAssignment,
  deleteSchoolSubject, getSchoolSubjectImpact, getSubjectAssignmentImpact,
  getTeacherDeletionImpact, setAssignmentTeacher,
} from "@/lib/admin-api";
import type {
  SchoolSubjectDeletionImpact, SubjectDeletionImpact, TeacherDeletionImpact,
} from "@/lib/admin-api";
import { createClient } from "@/lib/supabase/server";
import { getSubjectKeyByLabel } from "@snr/core";
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

/** Что удаление затронет — для честного текста в подтверждении. Z.2.3. */
export async function actionTeacherDeletionImpact(teacherId: string): Promise<TeacherDeletionImpact> {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  return getTeacherDeletionImpact(teacherId, schoolId, isSuperAdmin);
}

export async function actionDeleteTeacher(teacherId: string, userId: string) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  await deleteTeacher(teacherId, userId, schoolId, isSuperAdmin);
  revalidatePath("/admin/teachers");
  revalidatePath("/admin/subject-assignments");
  revalidatePath("/admin/groups");
  revalidatePath("/admin");
}

/** Z.2.4 — назначить или снять учителя одним действием: subjects.teacher_id,
 *  group_teachers и (в реальных школах) subject_slug. */
export async function actionSetAssignmentTeacher(assignmentId: string, teacherId: string | null) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  const result = await setAssignmentTeacher(assignmentId, teacherId, schoolId, isSuperAdmin);
  revalidatePath("/admin/teachers");
  revalidatePath("/admin/subject-assignments");
  return result;
}

// ── GROUPS ────────────────────────────────────────────────────────────────────

/** Z.2.2: форма группы шлёт id записи справочника, а groups.subject — это
 *  text NOT NULL, куда исторически пишется СЛАГ ('programming' и т.п.), и по
 *  нему по всему приложению работает getSubjectStyle(). Поэтому резолвим:
 *  справочник → название → слаг. Если название не из 10 известных ключей
 *  (админ завёл свой предмет), слага нет — пишем само название: колонка
 *  NOT NULL, пустую строку туда класть хуже. Стиль такого предмета будет
 *  дефолтным серым — известный предел, зафиксирован отдельным шагом в
 *  plan-z2-admin-rebuild.md. Схему groups.subject тут НЕ трогаем (Z.2.5/Z.2.6). */
async function resolveGroupSubject(formData: FormData, schoolId: string): Promise<string> {
  const catalogId = String(formData.get("subject_catalog_id") ?? "").trim();
  if (!catalogId) throw new Error("Missing fields");
  const sb = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (sb as any)
    .from("school_subjects").select("name, school_id").eq("id", catalogId).maybeSingle();
  if (!row || row.school_id !== schoolId) throw new Error("Предмет не найден");
  return getSubjectKeyByLabel(row.name) ?? row.name;
}

/** Z.2.6 — куратора в форме реальных школ нет, поле просто не приходит.
 *  `null` означает «не прислали»: обновление такое поле не трогает, создание
 *  оставляет группу без куратора. Пустая строка от демо-формы — это
 *  осознанное «без куратора» и тоже даёт null. */
function readCuratorId(formData: FormData): string | null | undefined {
  if (!formData.has("teacher_id")) return undefined;
  return String(formData.get("teacher_id") ?? "").trim() || null;
}

export async function actionCreateGroup(formData: FormData) {
  const { schoolId } = await verifyAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Missing fields");
  const subject = await resolveGroupSubject(formData, schoolId);
  const id = await createGroup({
    name, subject, teacher_id: readCuratorId(formData) ?? null, school_id: schoolId,
  });
  revalidatePath("/admin/groups");
  revalidatePath("/admin");
  return id;
}

export async function actionUpdateGroup(formData: FormData) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  const group_id = String(formData.get("group_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const subject = await resolveGroupSubject(formData, schoolId);
  await updateGroup(group_id, { name, subject, teacher_id: readCuratorId(formData) }, schoolId, isSuperAdmin);
  revalidatePath("/admin/groups");
}

export async function actionDeleteGroup(groupId: string) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  await deleteGroup(groupId, schoolId, isSuperAdmin);
  revalidatePath("/admin/groups");
  revalidatePath("/admin");
}

// ── SCHOOL SUBJECTS: справочник (Z.2.2) ──────────────────────────────────────
// school_id всегда берётся из verifyAdmin() на сервере, из FormData НЕ читается
// — до Z.2.2 эта форма была единственной в админке, писавшей прямо из браузера
// и полагавшейся на DEFAULT current_school_id().

function revalidateSubjects() {
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subject-assignments");
  revalidatePath("/admin/groups");
}

export async function actionCreateSchoolSubject(formData: FormData) {
  const { schoolId } = await verifyAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const icon = String(formData.get("icon") ?? "").trim() || "BookOpen";
  const color = String(formData.get("color") ?? "").trim() || "#64748B";
  if (!name) throw new Error("Missing fields");
  const id = await createSchoolSubject({ name, icon, color, school_id: schoolId });
  revalidateSubjects();
  return id;
}

export async function actionUpdateSchoolSubject(formData: FormData) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const icon = String(formData.get("icon") ?? "").trim() || "BookOpen";
  const color = String(formData.get("color") ?? "").trim() || "#64748B";
  if (!id || !name) throw new Error("Missing fields");
  await updateSchoolSubject(id, { name, icon, color }, schoolId, isSuperAdmin);
  revalidateSubjects();
}

export async function actionSetSchoolSubjectActive(id: string, isActive: boolean) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  await setSchoolSubjectActive(id, isActive, schoolId, isSuperAdmin);
  revalidateSubjects();
}

/** Z.2.3 — что мешает удалить предмет справочника. Питает диалог, который
 *  вместо «вы уверены» показывает числа и предлагает скрыть. */
export async function actionSchoolSubjectImpact(id: string): Promise<SchoolSubjectDeletionImpact> {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  return getSchoolSubjectImpact(id, schoolId, isSuperAdmin);
}

export async function actionDeleteSchoolSubject(id: string) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  await deleteSchoolSubject(id, schoolId, isSuperAdmin);
  revalidateSubjects();
}

// ── SUBJECT ASSIGNMENTS: предмет × группа × учитель (Z.2.2) ──────────────────
// Назначение учителя будит trg_subject_teacher_direct_chats — личные чаты со
// всеми учениками группы. Это штатно, но по одной строке за раз; в UI об этом
// есть подсказка под полем учителя.

export async function actionCreateSubjectAssignment(formData: FormData) {
  const { schoolId } = await verifyAdmin();
  const catalog_id = String(formData.get("catalog_id") ?? "").trim();
  const group_id = String(formData.get("group_id") ?? "").trim();
  const teacher_id = String(formData.get("teacher_id") ?? "").trim();
  if (!catalog_id || !group_id) throw new Error("Missing fields");
  const id = await createSubjectAssignment({
    catalog_id, group_id, teacher_id: teacher_id || null, school_id: schoolId,
  });
  revalidateSubjects();
  return id;
}

export async function actionUpdateSubjectAssignment(formData: FormData) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  const id = String(formData.get("id") ?? "");
  const catalog_id = String(formData.get("catalog_id") ?? "").trim();
  const group_id = String(formData.get("group_id") ?? "").trim();
  const teacher_id = String(formData.get("teacher_id") ?? "").trim();
  if (!id || !catalog_id || !group_id) throw new Error("Missing fields");
  await updateSubjectAssignment(
    id, { catalog_id, group_id, teacher_id: teacher_id || null }, schoolId, isSuperAdmin,
  );
  revalidateSubjects();
}

export async function actionSubjectAssignmentImpact(id: string): Promise<SubjectDeletionImpact> {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  return getSubjectAssignmentImpact(id, schoolId, isSuperAdmin);
}

export async function actionDeleteSubjectAssignment(id: string) {
  const { schoolId, isSuperAdmin } = await verifyAdmin();
  await deleteSubjectAssignment(id, schoolId, isSuperAdmin);
  revalidateSubjects();
}
