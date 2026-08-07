import { createClient } from "@supabase/supabase-js";
import { getDemoNow, getDemoNowMs } from "@/lib/demo-date";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service_role env vars not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

function generatePassword(length = 8): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** П.3 Заход 1 — security guard: getServiceClient() bypasses RLS entirely (no
 *  auth.uid(), current_school_id() resolves NULL there), so update/delete on
 *  students/teachers/groups/parents previously trusted whatever id the caller
 *  passed with no ownership check — a school admin could mutate/delete another
 *  school's row by id. callerSchoolId/callerIsSuperAdmin come from the
 *  server-action layer (app/admin/actions.ts's verifyAdmin(), which DOES have
 *  real auth.uid() via the user-scoped client) — this function can't resolve
 *  "who's calling" itself, only compare against what it's told. Super admins
 *  bypass (cross-school management is their whole purpose). */
async function assertSameSchool(
  sb: ReturnType<typeof getServiceClient>,
  // Z.2.2: + school_subjects (справочник) и subjects (назначения). Обе несут
  // school_id, поэтому проверка та же; as any на .from() нужен только потому,
  // что school_subjects (миграция 171) ещё нет в сгенерированном Database-типе
  // — он намеренно не перегенерирован, см. resheniya_2.md Z.2.1.
  table: "students" | "teachers" | "groups" | "parents" | "school_subjects" | "subjects",
  targetId: string,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
): Promise<void> {
  if (callerIsSuperAdmin) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).from(table).select("school_id").eq("id", targetId).single();
  if (error || !data) throw error ?? new Error(`${table}: запись не найдена`);
  if ((data as { school_id: string }).school_id !== callerSchoolId) {
    throw new Error("Нельзя редактировать записи чужой школы");
  }
}

/** Same guard as assertSameSchool, but keyed by auth user_id — needed for
 *  delete/reset-password calls that only ever receive the auth user's id, not
 *  the students/teachers/parents row's own id (e.g. StudentsView.tsx only
 *  tracks user_id for its reset-password button). Password reset is an
 *  account-takeover primitive if this check is skipped — same severity class
 *  as delete, found missing here in the adversarial review of Заход 1. */
async function assertSameSchoolByUserId(
  sb: ReturnType<typeof getServiceClient>,
  table: "students" | "teachers" | "parents",
  userId: string,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
): Promise<void> {
  if (callerIsSuperAdmin) return;
  const { data, error } = await sb.from(table).select("school_id").eq("user_id", userId).single();
  if (error || !data) throw error ?? new Error(`${table}: запись не найдена`);
  if ((data as { school_id: string }).school_id !== callerSchoolId) {
    throw new Error("Нельзя редактировать записи чужой школы");
  }
}

/** Adversarial review of Заход 1: assertSameSchool on the PARENT row alone
 *  doesn't stop that parent being linked to a student belonging to a
 *  different school via parent_students — this closes that FK cross-linking
 *  gap for create/update parent. */
async function assertStudentsInSchool(
  sb: ReturnType<typeof getServiceClient>,
  studentIds: string[],
  schoolId: string,
): Promise<void> {
  if (studentIds.length === 0) return;
  const { data, error } = await sb.from("students").select("id").eq("school_id", schoolId).in("id", studentIds);
  if (error) throw error;
  if ((data ?? []).length !== studentIds.length) {
    throw new Error("Нельзя привязать ученика чужой школы");
  }
}

// ── STUDENTS ─────────────────────────────────────────────────────────────────

export async function createStudent(data: {
  full_name: string;
  username: string;
  password: string;
  group_id: string;
  school_id: string;
}): Promise<{ userId: string; studentId: string }> {
  const sb = getServiceClient();
  const email = `${data.username.trim().toLowerCase()}@students.snr.local`;

  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
  });
  if (authErr || !authUser.user) throw authErr ?? new Error("Auth user creation failed");

  const userId = authUser.user.id;
  const { data: student, error: stuErr } = await sb
    .from("students")
    .insert({ user_id: userId, full_name: data.full_name, username: data.username, school_id: data.school_id })
    .select("id")
    .single();
  if (stuErr || !student) {
    await sb.auth.admin.deleteUser(userId);
    throw stuErr ?? new Error("Student insert failed");
  }

  const { error: sgErr } = await sb
    .from("student_groups")
    .insert({ student_id: (student as { id: string }).id, group_id: data.group_id, school_id: data.school_id });
  if (sgErr) throw sgErr;

  return { userId, studentId: (student as { id: string }).id };
}

export async function updateStudent(
  studentId: string,
  userId: string,
  data: { full_name: string; username: string; group_id?: string; old_group_id?: string },
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "students", studentId, callerSchoolId, callerIsSuperAdmin);

  const { error } = await sb
    .from("students")
    .update({ full_name: data.full_name, username: data.username })
    .eq("id", studentId);
  if (error) throw error;

  if (data.group_id && data.old_group_id && data.group_id !== data.old_group_id) {
    // Adversarial review (Заход 1): assertSameSchool above only confirmed the
    // STUDENT belongs to the caller's school — without this, an admin could
    // move their own student into a group belonging to a different school.
    await assertSameSchool(sb, "groups", data.group_id, callerSchoolId, callerIsSuperAdmin);
    await sb.from("student_groups").delete().eq("student_id", studentId).eq("group_id", data.old_group_id);
    await sb.from("student_groups").insert({ student_id: studentId, group_id: data.group_id, school_id: callerSchoolId });
  }

  // Update email if username changed
  await sb.auth.admin.updateUserById(userId, {
    email: `${data.username.trim().toLowerCase()}@students.snr.local`,
  });
}

export async function resetStudentPassword(
  userId: string,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
): Promise<string> {
  const sb = getServiceClient();
  await assertSameSchoolByUserId(sb, "students", userId, callerSchoolId, callerIsSuperAdmin);

  const newPassword = generatePassword();
  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw error;
  return newPassword;
}

export async function deleteStudent(userId: string, callerSchoolId: string, callerIsSuperAdmin: boolean) {
  const sb = getServiceClient();
  await assertSameSchoolByUserId(sb, "students", userId, callerSchoolId, callerIsSuperAdmin);

  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) throw error;
}

// ── TEACHERS ─────────────────────────────────────────────────────────────────

export async function createTeacher(data: {
  full_name: string;
  username: string;
  password: string;
  school_id: string;
}): Promise<{ userId: string; teacherId: string }> {
  const sb = getServiceClient();
  const email = `${data.username.trim().toLowerCase()}@teachers.snr.local`;

  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
  });
  if (authErr || !authUser.user) throw authErr ?? new Error("Auth user creation failed");

  const userId = authUser.user.id;
  const { data: teacher, error: tErr } = await sb
    .from("teachers")
    .insert({ user_id: userId, full_name: data.full_name, username: data.username, school_id: data.school_id })
    .select("id")
    .single();
  if (tErr || !teacher) {
    await sb.auth.admin.deleteUser(userId);
    throw tErr ?? new Error("Teacher insert failed");
  }

  return { userId, teacherId: (teacher as { id: string }).id };
}

export async function updateTeacher(
  teacherId: string,
  userId: string,
  data: { full_name: string; username: string },
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "teachers", teacherId, callerSchoolId, callerIsSuperAdmin);

  const { error } = await sb.from("teachers").update({ full_name: data.full_name, username: data.username }).eq("id", teacherId);
  if (error) throw error;
  await sb.auth.admin.updateUserById(userId, {
    email: `${data.username.trim().toLowerCase()}@teachers.snr.local`,
  });
}

export async function resetTeacherPassword(
  userId: string,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
): Promise<string> {
  const sb = getServiceClient();
  await assertSameSchoolByUserId(sb, "teachers", userId, callerSchoolId, callerIsSuperAdmin);

  const newPassword = generatePassword();
  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw error;
  return newPassword;
}

export async function deleteTeacher(
  teacherId: string,
  userId: string,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "teachers", teacherId, callerSchoolId, callerIsSuperAdmin);

  // Check if teacher has groups
  const { data: groups } = await sb.from("groups").select("id").eq("teacher_id", teacherId).limit(1);
  if (groups && groups.length > 0) throw new Error("BLOCKED: teacher has groups");
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) throw error;
}

// ── GROUPS ────────────────────────────────────────────────────────────────────

export async function createGroup(data: {
  name: string;
  subject: string;
  teacher_id: string;
  school_id: string;
}): Promise<string> {
  const sb = getServiceClient();
  const { data: group, error } = await sb.from("groups").insert(data).select("id").single();
  if (error || !group) throw error ?? new Error("Group insert failed");
  return (group as { id: string }).id;
}

export async function updateGroup(
  groupId: string,
  data: { name: string; subject: string; teacher_id: string },
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "groups", groupId, callerSchoolId, callerIsSuperAdmin);

  const { error } = await sb.from("groups").update(data).eq("id", groupId);
  if (error) throw error;
}

export async function deleteGroup(groupId: string, callerSchoolId: string, callerIsSuperAdmin: boolean) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "groups", groupId, callerSchoolId, callerIsSuperAdmin);

  const { error } = await sb.from("groups").delete().eq("id", groupId);
  if (error) throw error;
}

// ── ADMIN: SCHOOL SUBJECTS (справочник, Z.2.2) ───────────────────────────────
// Справочник предметов школы. Определение предмета (название/иконка/цвет)
// живёт здесь, а «предмет × группа × учитель» — в public.subjects (ниже,
// назначения). Всё пишется service-role клиентом со ЯВНЫМ school_id: до Z.2.2
// эта форма была единственной в админке, которая писала прямо из браузера и
// полагалась на DEFAULT current_school_id().

export type SchoolSubjectRow = {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_active: boolean;
  assignments: number;
};

export async function createSchoolSubject(data: {
  name: string; icon: string; color: string; school_id: string;
}): Promise<string> {
  const sb = getServiceClient();
  const { data: row, error } = await sb
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("school_subjects" as any)
    .insert({ name: data.name, icon: data.icon, color: data.color, school_id: data.school_id })
    .select("id")
    .single();
  if (error || !row) throw error ?? new Error("School subject insert failed");
  return (row as { id: string }).id;
}

/** Переименование/смена стиля. Назначения тянутся через catalog_id, поэтому
 *  переименование справочника их не ломает — но subjects.name это отдельная
 *  копия (колонка NOT NULL, осталась с до-Z.2.1 модели), и её надо держать в
 *  синхроне, иначе списки назначений покажут старое имя. */
export async function updateSchoolSubject(
  id: string,
  data: { name: string; icon: string; color: string },
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "school_subjects", id, callerSchoolId, callerIsSuperAdmin);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from("school_subjects").update(data).eq("id", id);
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: syncErr } = await (sb as any)
    .from("subjects")
    .update({ name: data.name, icon: data.icon, color: data.color })
    .eq("catalog_id", id);
  if (syncErr) throw syncErr;
}

/** Скрыть/показать. Удаления нет намеренно — решение заказчика: скрывать, а не
 *  удалять (гварды удаления — Z.2.3). Скрытый предмет исчезает из выпадающих
 *  списков при создании назначений, но существующие назначения работают. */
export async function setSchoolSubjectActive(
  id: string,
  isActive: boolean,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "school_subjects", id, callerSchoolId, callerIsSuperAdmin);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from("school_subjects").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

// ── ADMIN: SUBJECT ASSIGNMENTS (public.subjects, Z.2.2) ──────────────────────
// ВНИМАНИЕ: teacher_id здесь — это предикат is_subject_owner(), гейтящий запись
// уроков учителем, И на него висит trg_subject_teacher_direct_chats, который
// при смене значения заводит личные чаты со всеми учениками группы. Поэтому:
// одна строка за раз, никаких массовых UPDATE. Единая привязка (subjects +
// group_teachers одним действием) — отдельный шаг Z.2.4, здесь НЕ делается.

export async function createSubjectAssignment(data: {
  catalog_id: string; group_id: string; teacher_id: string | null; school_id: string;
}): Promise<string> {
  const sb = getServiceClient();

  // name/icon/color копируются из справочника: subjects.name — NOT NULL
  // (модель до Z.2.1), icon/color тоже NOT NULL.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cat, error: catErr } = await (sb as any)
    .from("school_subjects")
    .select("id, name, icon, color, school_id, is_active")
    .eq("id", data.catalog_id)
    .maybeSingle();
  if (catErr) throw catErr;
  if (!cat || cat.school_id !== data.school_id) throw new Error("Предмет не найден");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (sb as any)
    .from("subjects")
    .insert({
      catalog_id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      group_id: data.group_id,
      teacher_id: data.teacher_id,
      school_id: data.school_id,
    })
    .select("id")
    .single();
  if (error || !row) throw error ?? new Error("Assignment insert failed");
  return (row as { id: string }).id;
}

export async function updateSubjectAssignment(
  id: string,
  data: { catalog_id: string; group_id: string; teacher_id: string | null },
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "subjects", id, callerSchoolId, callerIsSuperAdmin);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cat, error: catErr } = await (sb as any)
    .from("school_subjects")
    .select("id, name, icon, color, school_id")
    .eq("id", data.catalog_id)
    .maybeSingle();
  if (catErr) throw catErr;
  if (!cat || (!callerIsSuperAdmin && cat.school_id !== callerSchoolId)) {
    throw new Error("Предмет не найден");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from("subjects")
    .update({
      catalog_id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      group_id: data.group_id,
      teacher_id: data.teacher_id,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSubjectAssignment(
  id: string,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "subjects", id, callerSchoolId, callerIsSuperAdmin);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from("subjects").delete().eq("id", id);
  if (error) throw error;
}

// ── SUPER ADMIN: демо-школа вне зоны видимости ───────────────────────────────
// Z.1, 06.08.2026. Суперадмин управляет только НЕ-демо школами. Фильтра в UI
// для этого мало: все четыре write-действия ниже принимают school_id/userId
// прямо из FormData, идут service-role клиентом (RLS не применяется вовсе), а
// у таблицы admins есть ровно одна политика — SELECT. То есть второй линии
// обороны не существует, и crafted POST мог бы удалить или перехватить
// демо-админа. Отсюда обязательные серверные проверки.
//
// Тексты ошибок намеренно нейтральные («не найдена»/«не найден»): для
// суперадмина демо-школы не существует, и сообщение не должно выдавать
// обратное.

/** Бросает, если школы нет ИЛИ она демо. Использовать для любого school_id,
 *  пришедшего от клиента. */
export async function assertSchoolIsManageable(schoolId: string): Promise<void> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("schools")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("id, is_demo" as any)
    .eq("id", schoolId)
    .maybeSingle();
  if (error) throw error;
  const row = data as { id: string; is_demo: boolean } | null;
  if (!row || row.is_demo) throw new Error("Школа не найдена");
}

/** Бросает, если админа нет ИЛИ он принадлежит демо-школе. Возвращает его
 *  school_id для последующих проверок. Принимает admins.user_id ИЛИ admins.id
 *  — оба варианта приходят из разных действий. */
export async function assertAdminIsManageable(
  ref: { userId: string } | { adminId: string },
): Promise<string> {
  const sb = getServiceClient();
  const q = sb.from("admins").select("id, user_id, school_id");
  const { data, error } = await ("userId" in ref
    ? q.eq("user_id", ref.userId)
    : q.eq("id", ref.adminId)
  ).maybeSingle();
  if (error) throw error;
  const row = data as { id: string; user_id: string | null; school_id: string } | null;
  if (!row) throw new Error("Администратор не найден");
  await assertSchoolIsManageable(row.school_id).catch(() => {
    throw new Error("Администратор не найден");
  });
  return row.school_id;
}

// ── SUPER ADMIN: SCHOOLS ──────────────────────────────────────────────────────

export async function createSchool(data: {
  name: string;
  code: string;
  autostart_enabled: boolean;
}): Promise<string> {
  const sb = getServiceClient();
  const { data: school, error } = await sb
    .from("schools")
    .insert({ name: data.name, code: data.code, autostart_enabled: data.autostart_enabled })
    .select("id")
    .single();
  if (error || !school) throw error ?? new Error("School insert failed");
  return (school as { id: string }).id;
}

// ── SUPER ADMIN: SCHOOL ADMINS ───────────────────────────────────────────────

export async function createSchoolAdmin(data: {
  full_name: string;
  username: string;
  password: string;
  school_id: string;
}): Promise<{ userId: string; adminId: string }> {
  const sb = getServiceClient();
  const email = `${data.username.trim().toLowerCase()}@admins.snr.local`;

  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
  });
  if (authErr || !authUser.user) throw authErr ?? new Error("Auth user creation failed");

  const userId = authUser.user.id;
  const { data: admin, error: aErr } = await sb
    .from("admins")
    .insert({ user_id: userId, full_name: data.full_name, school_id: data.school_id })
    .select("id")
    .single();
  if (aErr || !admin) {
    await sb.auth.admin.deleteUser(userId);
    throw aErr ?? new Error("Admin insert failed");
  }

  return { userId, adminId: (admin as { id: string }).id };
}

/** Rename and/or reassign a school admin to a different school. Super-admin
 *  only (enforced by the caller — verifySuperAdmin() in superadmin/actions.ts
 *  — this function itself has no auth context, same as the rest of this file). */
export async function updateSchoolAdmin(
  adminId: string,
  data: { full_name: string; school_id: string },
) {
  const sb = getServiceClient();
  const { error } = await sb
    .from("admins")
    .update({ full_name: data.full_name, school_id: data.school_id })
    .eq("id", adminId);
  if (error) throw error;
}

/** Hard delete — cascades to the `admins` row via ON DELETE CASCADE (migration 42). */
export async function deleteSchoolAdmin(userId: string) {
  const sb = getServiceClient();
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) throw error;
}

export async function resetSchoolAdminPassword(userId: string): Promise<string> {
  const sb = getServiceClient();
  const newPassword = generatePassword();
  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw error;
  return newPassword;
}

export async function changeOwnPassword(userId: string, newPassword: string) {
  const sb = getServiceClient();
  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw error;
}

/** admins has no username column — the login email lives only in auth.users,
 *  so the superadmin admins list resolves it via the service-role admin API. */
export async function getUserEmails(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const sb = getServiceClient();
  const results = await Promise.all(userIds.map((id) => sb.auth.admin.getUserById(id)));
  const map: Record<string, string> = {};
  results.forEach((r, i) => {
    const id = userIds[i];
    if (id && r.data.user?.email) map[id] = r.data.user.email;
  });
  return map;
}

// ── ADMIN: PARENTS ────────────────────────────────────────────────────────────

function generateInviteCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids visual ambiguity
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Creates a parents row with no user_id yet (the parent claims it later via
 *  /parent/join), links the chosen children, and issues a one-time invite code. */
export async function createParent(data: {
  full_name: string;
  phone?: string;
  student_ids: string[];
  school_id: string;
  created_by: string;
}): Promise<{ parentId: string; inviteCode: string }> {
  const sb = getServiceClient();
  const { data: parent, error: pErr } = await sb
    .from("parents")
    .insert({
      full_name: data.full_name,
      phone: data.phone || null,
      school_id: data.school_id,
      created_by: data.created_by,
    })
    .select("id")
    .single();
  if (pErr || !parent) throw pErr ?? new Error("Parent insert failed");
  const parentId = (parent as { id: string }).id;

  if (data.student_ids.length > 0) {
    try {
      await assertStudentsInSchool(sb, data.student_ids, data.school_id);
    } catch (checkErr) {
      await sb.from("parents").delete().eq("id", parentId);
      throw checkErr;
    }
    const rows = data.student_ids.map((student_id) => ({
      parent_id: parentId,
      student_id,
      school_id: data.school_id,
    }));
    const { error: psErr } = await sb.from("parent_students").insert(rows);
    if (psErr) {
      await sb.from("parents").delete().eq("id", parentId);
      throw psErr;
    }
  }

  let code = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error: inviteErr } = await sb.from("parent_invites").insert({
      code,
      parent_id: parentId,
      school_id: data.school_id,
      created_by: data.created_by,
    });
    if (!inviteErr) break;
    if (attempt === 4) throw inviteErr;
    code = generateInviteCode();
  }

  return { parentId, inviteCode: code };
}

/** Issues a fresh invite code for a parent whose previous one expired. */
export async function regenerateParentInviteCode(
  parentId: string,
  schoolId: string,
  createdBy: string,
): Promise<string> {
  const sb = getServiceClient();
  let code = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await sb
      .from("parent_invites")
      .insert({ code, parent_id: parentId, school_id: schoolId, created_by: createdBy });
    if (!error) return code;
    if (attempt === 4) throw error;
    code = generateInviteCode();
  }
  throw new Error("Failed to generate invite code");
}

export async function deleteParent(parentId: string, callerSchoolId: string, callerIsSuperAdmin: boolean) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "parents", parentId, callerSchoolId, callerIsSuperAdmin);

  const { error } = await sb.from("parents").delete().eq("id", parentId);
  if (error) throw error;
}

/** Renames/re-phones a parent and fully replaces their linked children
 *  (delete-then-insert — simplest correct way to reconcile an arbitrary
 *  add/remove diff against parent_students without a separate diff step). */
export async function updateParent(
  parentId: string,
  data: { full_name: string; phone?: string; student_ids: string[]; school_id: string },
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "parents", parentId, callerSchoolId, callerIsSuperAdmin);

  const { error: pErr } = await sb
    .from("parents")
    .update({ full_name: data.full_name, phone: data.phone || null })
    .eq("id", parentId);
  if (pErr) throw pErr;

  if (data.student_ids.length > 0) {
    await assertStudentsInSchool(sb, data.student_ids, data.school_id);
  }

  const { error: delErr } = await sb.from("parent_students").delete().eq("parent_id", parentId);
  if (delErr) throw delErr;

  if (data.student_ids.length > 0) {
    const rows = data.student_ids.map((student_id) => ({
      parent_id: parentId,
      student_id,
      school_id: data.school_id,
    }));
    const { error: insErr } = await sb.from("parent_students").insert(rows);
    if (insErr) throw insErr;
  }
}

/** Only meaningful once the parent has claimed their invite (user_id set) —
 *  caller (actionResetParentPassword) checks isRegistered before calling this. */
export async function resetParentPassword(
  userId: string,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
): Promise<string> {
  const sb = getServiceClient();
  await assertSameSchoolByUserId(sb, "parents", userId, callerSchoolId, callerIsSuperAdmin);

  const newPassword = generatePassword();
  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw error;
  return newPassword;
}

// ── PARENT JOIN (public, unauthenticated invite-claim flow) ───────────────────

export type ParentInviteCheck =
  | { valid: true; fullName: string; children: { id: string; full_name: string }[] }
  | { valid: false; reason: "not_found" | "used" | "expired" };

export async function verifyParentInvite(code: string): Promise<ParentInviteCheck> {
  const sb = getServiceClient();
  const { data: invite } = await sb
    .from("parent_invites")
    .select("id, parent_id, used_at, expires_at")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (!invite) return { valid: false, reason: "not_found" };
  if (invite.used_at) return { valid: false, reason: "used" };
  if (new Date(invite.expires_at).getTime() < getDemoNowMs()) return { valid: false, reason: "expired" };

  const { data: parent } = await sb
    .from("parents")
    .select("id, full_name")
    .eq("id", invite.parent_id)
    .single();
  if (!parent) return { valid: false, reason: "not_found" };

  const { data: links } = await sb
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", invite.parent_id);
  const studentIds = (links ?? []).map((l: { student_id: string }) => l.student_id);

  let children: { id: string; full_name: string }[] = [];
  if (studentIds.length > 0) {
    const { data: students } = await sb.from("students").select("id, full_name").in("id", studentIds);
    children = (students ?? []) as { id: string; full_name: string }[];
  }

  return { valid: true, fullName: parent.full_name, children };
}

export type ParentJoinResult =
  | { success: true }
  | { success: false; error: "invalid_code" | "username_taken" | "server_error" };

export async function completeParentJoin(data: {
  code: string;
  username: string;
  password: string;
}): Promise<ParentJoinResult> {
  const sb = getServiceClient();
  const { data: invite } = await sb
    .from("parent_invites")
    .select("id, parent_id, used_at, expires_at")
    .eq("code", data.code.trim().toUpperCase())
    .maybeSingle();

  if (!invite || invite.used_at || new Date(invite.expires_at).getTime() < getDemoNowMs()) {
    return { success: false, error: "invalid_code" };
  }

  const email = `${data.username.trim().toLowerCase()}@parents.snr.local`;
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
  });
  if (authErr || !authUser.user) {
    return { success: false, error: "username_taken" };
  }

  const userId = authUser.user.id;
  const { error: updErr } = await sb.from("parents").update({ user_id: userId }).eq("id", invite.parent_id);
  if (updErr) {
    await sb.auth.admin.deleteUser(userId);
    return { success: false, error: "server_error" };
  }

  await sb.from("parent_invites").update({ used_at: getDemoNow().toISOString() }).eq("id", invite.id);

  return { success: true };
}
