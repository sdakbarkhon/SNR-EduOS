"use server";

import {
  createStudent, updateStudent, resetStudentPassword, deleteStudent,
  createTeacher, updateTeacher, resetTeacherPassword, deleteTeacher,
  createGroup, updateGroup, deleteGroup,
  createSchoolSubject, updateSchoolSubject, setSchoolSubjectActive,
  createSubjectAssignment, updateSubjectAssignment, deleteSubjectAssignment,
  deleteSchoolSubject, getSchoolSubjectImpact, getSubjectAssignmentImpact,
  getTeacherDeletionImpact, setAssignmentTeacher, topUpStudentBalance,
} from "@/lib/admin-api";
import type {
  SchoolSubjectDeletionImpact, SubjectDeletionImpact, TeacherDeletionImpact,
} from "@/lib/admin-api";
import { createClient } from "@/lib/supabase/server";
import { changedFields, GOOGLE_EMAIL_FIELDS } from "@/lib/form-patch";
import { parseCoursePrice } from "@/lib/course-price";
import { guard, type ActionResult } from "@/lib/action-result";
import { getSubjectKeyByLabel } from "@snr/core";
import { revalidatePath } from "next/cache";

/** Returns the calling admin's school_id — the service-role client used by
 *  admin-api.ts has no auth.uid(), so current_school_id() resolves to NULL
 *  there; every insert on a school_id NOT NULL table must get it from here.
 *  Also resolves isSuperAdmin (existence in super_admins) — П.3 Заход 1:
 *  admin-api.ts's update/delete functions need this to allow the cross-school
 *  bypass for super admins, since they can't check auth.uid() themselves. */
async function verifyAdmin(): Promise<{ schoolId: string; isSuperAdmin: boolean; userId: string }> {
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
  return { schoolId: admin.school_id as string, isSuperAdmin: !!superAdmin, userId: user.id };
}

/**
 * Личные и медицинские сведения ученика из формы (миграция 232).
 *
 * ВСЁ НЕОБЯЗАТЕЛЬНОЕ. Обязательными остаются ФИО, логин, пароль и группа —
 * иначе класс из тридцати человек не завести за один присест.
 *
 * Дата рождения проверяется здесь, а не только браузером: поле типа date
 * можно обойти запросом мимо формы, а «родился в 1830-м» в базе потом
 * ищется годами. Отказы уходят машинным кодом — фразу подставит
 * humanizeAdminError на языке администратора.
 */
function readStudentExtras(formData: FormData): {
  personal: { birth_date: string | null; gender: string | null; phone: string | null; file_no: string | null };
  medical: { allergies: string | null; medical_notes: string | null };
} {
  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;

  const birth = str("birth_date");
  if (birth !== null) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
    if (!m) throw new Error("BAD_BIRTH_DATE");
    const d = new Date(birth + "T12:00:00Z");
    if (Number.isNaN(d.getTime())) throw new Error("BAD_BIRTH_DATE");
    const now = new Date();
    if (d.getTime() > now.getTime()) throw new Error("BIRTH_DATE_FUTURE");
    // Сто лет — не медицинская истина, а граница здравого смысла: школьник
    // старше ста лет означает опечатку в годе, а не долгожителя.
    if (now.getUTCFullYear() - Number(m[1]) > 100) throw new Error("BIRTH_DATE_TOO_OLD");
  }

  const gender = str("gender");
  if (gender !== null && gender !== "male" && gender !== "female") {
    throw new Error("BAD_GENDER");
  }

  return {
    personal: { birth_date: birth, gender, phone: str("phone"), file_no: str("file_no") },
    medical: { allergies: str("allergies"), medical_notes: str("medical_notes") },
  };
}

// ── STUDENTS ─────────────────────────────────────────────────────────────────

export async function actionCreateStudent(formData: FormData) {
  return guard(async () => {
    const { schoolId, userId } = await verifyAdmin();
    const full_name = String(formData.get("full_name") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();
    const group_id = String(formData.get("group_id") ?? "").trim();
    if (!full_name || !username || !password || !group_id) throw new Error("Missing fields");
    const google_email = String(formData.get("google_email") ?? "").trim() || null;
    const { personal, medical } = readStudentExtras(formData);
    const result = await createStudent({
      full_name, username, password, group_id, school_id: schoolId, google_email,
      personal, medical, actor_user_id: userId,
    });
    revalidatePath("/admin/students");
    revalidatePath("/admin");
    return result;
  });
}

export async function actionUpdateStudent(formData: FormData) {
  return guard(async () => {
    const { schoolId, isSuperAdmin, userId } = await verifyAdmin();
    const student_id = String(formData.get("student_id") ?? "");
    const user_id = String(formData.get("user_id") ?? "");
    const full_name = String(formData.get("full_name") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim();
    const group_id = String(formData.get("group_id") ?? "").trim();
    const old_group_id = String(formData.get("old_group_id") ?? "").trim();
    // Почта пишется, ТОЛЬКО если её правда меняли. Разбор — lib/form-patch.ts.
    // Раньше здесь пустая строка превращалась в null и уезжала в базу поверх
    // заполненной почты при каждом сохранении.
    const changed = changedFields(formData, GOOGLE_EMAIL_FIELDS);
    const { personal, medical } = readStudentExtras(formData);
    await updateStudent(
      student_id,
      user_id,
      { full_name, username, group_id, old_group_id, ...changed, personal, medical, actor_user_id: userId },
      schoolId,
      isSuperAdmin,
    );
    revalidatePath("/admin/students");
  });
}

export async function actionResetStudentPassword(userId: string) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    const newPassword = await resetStudentPassword(userId, schoolId, isSuperAdmin);
    revalidatePath("/admin/students");
    return newPassword;
  });
}

/**
 * Пополнение баланса ученика рукой админа. Заход 3 по платежам: это
 * единственный способ наполнить баланс, пока кассы нет, и им же проверяется
 * вся цепочка «цена → счёт → погашение».
 *
 * Сумма разбирается тем же кодом, что цена группы (lib/course-price.ts):
 * человек пишет деньги с пробелами, и правило чтения должно быть одно.
 */
export async function actionTopUpStudentBalance(formData: FormData) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    const studentId = String(formData.get("student_id") ?? "");
    const amount = parseCoursePrice(String(formData.get("amount") ?? ""));
    const note = String(formData.get("note") ?? "");
    await topUpStudentBalance({
      studentId, amount, note, callerSchoolId: schoolId, callerIsSuperAdmin: isSuperAdmin,
    });
    revalidatePath("/admin/students");
  });
}

export async function actionDeleteStudent(userId: string) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    await deleteStudent(userId, schoolId, isSuperAdmin);
    revalidatePath("/admin/students");
    revalidatePath("/admin");
  });
}

// ── TEACHERS ─────────────────────────────────────────────────────────────────

/**
 * Строки блока «Предметы» из формы учителя.
 *
 * Поля называются одинаково у всех строк (assign_catalog / assign_group), и
 * читаются getAll() парами по порядку — так браузер и шлёт повторяющиеся
 * имена. Нумерованные assign_catalog_0/_1 потребовали бы знать заранее,
 * сколько строк добавил админ.
 *
 * Неполные строки (выбран предмет, но не группа) молча пропускаются: это
 * недозаполненная строка, а не ошибка, — админ мог нажать «добавить ещё» и
 * передумать.
 */
function readTeacherAssignments(formData: FormData): Array<{ catalog_id: string; group_id: string }> {
  const cats = formData.getAll("assign_catalog").map((v) => String(v).trim());
  const grps = formData.getAll("assign_group").map((v) => String(v).trim());
  const out: Array<{ catalog_id: string; group_id: string }> = [];
  for (let i = 0; i < Math.max(cats.length, grps.length); i += 1) {
    const catalog_id = cats[i] ?? "";
    const group_id = grps[i] ?? "";
    if (catalog_id && group_id) out.push({ catalog_id, group_id });
  }
  return out;
}

export async function actionCreateTeacher(formData: FormData) {
  return guard(async () => {
    const { schoolId } = await verifyAdmin();
    const full_name = String(formData.get("full_name") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();
    if (!full_name || !username || !password) throw new Error("Missing fields");
    const google_email = String(formData.get("google_email") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const bio = String(formData.get("bio") ?? "").trim() || null;
    const result = await createTeacher({
      full_name, username, password, school_id: schoolId, google_email,
      phone, bio, assignments: readTeacherAssignments(formData),
    });
    revalidatePath("/admin/teachers");
    revalidatePath("/admin");
    revalidatePath("/admin/subject-assignments");
    return result;
  });
}

export async function actionUpdateTeacher(formData: FormData) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    const teacher_id = String(formData.get("teacher_id") ?? "");
    const user_id = String(formData.get("user_id") ?? "");
    const full_name = String(formData.get("full_name") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim();
    // То же, что у ученика: пишем почту, только если её правда меняли.
    const changed = changedFields(formData, GOOGLE_EMAIL_FIELDS);
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const bio = String(formData.get("bio") ?? "").trim() || null;
    const result = await updateTeacher(
      teacher_id,
      user_id,
      { full_name, username, ...changed, phone, bio, assignments: readTeacherAssignments(formData) },
      schoolId,
      isSuperAdmin,
    );
    revalidatePath("/admin/teachers");
    // Назначение трогает subjects и group_teachers — экран «Назначения»
    // обязан увидеть новое сразу, иначе два экрана разъедутся на глазах.
    revalidatePath("/admin/subject-assignments");
    return result;
  });
}

export async function actionResetTeacherPassword(userId: string) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    const newPassword = await resetTeacherPassword(userId, schoolId, isSuperAdmin);
    revalidatePath("/admin/teachers");
    return newPassword;
  });
}

/** Что удаление затронет — для честного текста в подтверждении. Z.2.3. */
export async function actionTeacherDeletionImpact(teacherId: string): Promise<ActionResult<TeacherDeletionImpact>> {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    return getTeacherDeletionImpact(teacherId, schoolId, isSuperAdmin);
  });
}

export async function actionDeleteTeacher(teacherId: string, userId: string) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    await deleteTeacher(teacherId, userId, schoolId, isSuperAdmin);
    revalidatePath("/admin/teachers");
    revalidatePath("/admin/subject-assignments");
    revalidatePath("/admin/groups");
    revalidatePath("/admin");
  });
}

/** Z.2.4 — назначить или снять учителя одним действием: subjects.teacher_id,
 *  group_teachers и (в реальных школах) subject_slug. */
export async function actionSetAssignmentTeacher(assignmentId: string, teacherId: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    const result = await setAssignmentTeacher(assignmentId, teacherId, schoolId, isSuperAdmin);
    revalidatePath("/admin/teachers");
    revalidatePath("/admin/subject-assignments");
    return result;
  });
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

// 30.08.2026 — ФУНКЦИИ readCuratorId ЗДЕСЬ БОЛЬШЕ НЕТ.
//
// Она доставала куратора из формы группы. Роль убрана из продукта, поля в
// форме не осталось, и читать нечего. Создание группы теперь всегда пишет
// teacher_id: null, обновление колонку не трогает вовсе — так группа,
// заведённая до снятия роли, не поменяется молча при первом же
// редактировании названия.

/**
 * Цена из формы — заход 2 по платежам.
 *
 * Возвращает undefined, если поля в FormData НЕТ вовсе. Это не то же самое,
 * что пустое поле: пустое — осознанный ноль («цена не задана»), отсутствие —
 * форма, которая про цену не знает, и её молчание не должно обнулять уже
 * заданную цену.
 */
function readCoursePrice(formData: FormData): number | undefined {
  const raw = formData.get("course_price");
  return raw === null ? undefined : parseCoursePrice(String(raw));
}

export async function actionCreateGroup(formData: FormData) {
  return guard(async () => {
    const { schoolId } = await verifyAdmin();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) throw new Error("Missing fields");
    const subject = await resolveGroupSubject(formData, schoolId);
    const id = await createGroup({
      name, subject, teacher_id: null, school_id: schoolId,
      course_price: readCoursePrice(formData),
    });
    revalidatePath("/admin/groups");
    revalidatePath("/admin");
    return id;
  });
}

export async function actionUpdateGroup(formData: FormData) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    const group_id = String(formData.get("group_id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const subject = await resolveGroupSubject(formData, schoolId);
    await updateGroup(
      group_id,
      { name, subject, course_price: readCoursePrice(formData) },
      schoolId,
      isSuperAdmin,
    );
    revalidatePath("/admin/groups");
  });
}

export async function actionDeleteGroup(groupId: string) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    await deleteGroup(groupId, schoolId, isSuperAdmin);
    revalidatePath("/admin/groups");
    revalidatePath("/admin");
  });
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
  return guard(async () => {
    const { schoolId } = await verifyAdmin();
    const name = String(formData.get("name") ?? "").trim();
    const icon = String(formData.get("icon") ?? "").trim() || "BookOpen";
    const color = String(formData.get("color") ?? "").trim() || "#64748B";
    if (!name) throw new Error("Missing fields");
    const id = await createSchoolSubject({ name, icon, color, school_id: schoolId });
    revalidateSubjects();
    return id;
  });
}

export async function actionUpdateSchoolSubject(formData: FormData) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const icon = String(formData.get("icon") ?? "").trim() || "BookOpen";
    const color = String(formData.get("color") ?? "").trim() || "#64748B";
    if (!id || !name) throw new Error("Missing fields");
    await updateSchoolSubject(id, { name, icon, color }, schoolId, isSuperAdmin);
    revalidateSubjects();
  });
}

export async function actionSetSchoolSubjectActive(id: string, isActive: boolean) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    await setSchoolSubjectActive(id, isActive, schoolId, isSuperAdmin);
    revalidateSubjects();
  });
}

/** Z.2.3 — что мешает удалить предмет справочника. Питает диалог, который
 *  вместо «вы уверены» показывает числа и предлагает скрыть. */
export async function actionSchoolSubjectImpact(id: string): Promise<ActionResult<SchoolSubjectDeletionImpact>> {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    return getSchoolSubjectImpact(id, schoolId, isSuperAdmin);
  });
}

export async function actionDeleteSchoolSubject(id: string) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    await deleteSchoolSubject(id, schoolId, isSuperAdmin);
    revalidateSubjects();
  });
}

// ── SUBJECT ASSIGNMENTS: предмет × группа × учитель (Z.2.2) ──────────────────
// Назначение учителя будит trg_subject_teacher_direct_chats — личные чаты со
// всеми учениками группы. Это штатно, но по одной строке за раз; в UI об этом
// есть подсказка под полем учителя.

export async function actionCreateSubjectAssignment(formData: FormData) {
  return guard(async () => {
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
  });
}

export async function actionUpdateSubjectAssignment(formData: FormData) {
  return guard(async () => {
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
  });
}

export async function actionSubjectAssignmentImpact(id: string): Promise<ActionResult<SubjectDeletionImpact>> {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    return getSubjectAssignmentImpact(id, schoolId, isSuperAdmin);
  });
}

export async function actionDeleteSubjectAssignment(id: string) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin();
    await deleteSubjectAssignment(id, schoolId, isSuperAdmin);
    revalidateSubjects();
  });
}
