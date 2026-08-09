import { createClient } from "@supabase/supabase-js";
import { getSubjectKeyByLabel } from "@snr/core";
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

/** Что удаление учителя затронет. Считается ДО показа диалога, чтобы
 *  подтверждение говорило правду, а не «вы уверены». Z.2.3. */
export type TeacherDeletionImpact = {
  /** Уроки, которые он ведёт. Есть уроки — удалять нельзя. */
  lessons: number;
  /** Оценки и решения, на которые он подписан. ON DELETE NO ACTION —
   *  удаление упало бы сырой ошибкой базы, поэтому блокируем осознанно. */
  gradedRecords: number;
  /** Три поверхности привязки: назначения предметов, строки group_teachers,
   *  кураторство над группами. Снимаются вместе с учителем. */
  assignments: number;
  groupLinks: number;
  curatorOf: number;
  /** Уходит каскадом вместе с учителем — об этом надо предупредить. */
  curriculumPlans: number;
  announcements: number;
  /** Где именно он ведёт уроки — для честного текста отказа. */
  lessonGroups: string[];
  blocked: boolean;
};

export async function getTeacherDeletionImpact(
  teacherId: string,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
): Promise<TeacherDeletionImpact> {
  const sb = getServiceClient();
  await assertSameSchool(sb, "teachers", teacherId, callerSchoolId, callerIsSuperAdmin);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;

  const { data: subjectRows } = await anySb
    .from("subjects").select("id, group_id, name, group:groups(name)").eq("teacher_id", teacherId);
  const subjects = (subjectRows ?? []) as Array<{ id: string; name: string; group: { name: string } | null }>;
  const subjectIds = subjects.map((s) => s.id);

  // Считаем ПО ТОЙ ЖЕ колонке, по которой фильтруем, а не по "id": у
  // group_teachers своего id нет вовсе (первичный ключ составной,
  // group_id + teacher_id), и select("id") там молча возвращал ноль —
  // привязки к группам выглядели пустыми, хотя строки есть.
  const countOf = async (table: string, column: string, value: string | string[]) => {
    if (Array.isArray(value) && value.length === 0) return 0;
    let q = anySb.from(table).select(column, { count: "exact", head: true });
    q = Array.isArray(value) ? q.in(column, value) : q.eq(column, value);
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  };

  const [lessons, plansBySubject, groupLinks, curatorOf, plansByTeacher, announcements,
    lessonGrades, hwApproved, leaveDecided, stageGraded] = await Promise.all([
    countOf("lessons", "subject_id", subjectIds),
    countOf("curriculum_plans", "subject_id", subjectIds),
    countOf("group_teachers", "teacher_id", teacherId),
    countOf("groups", "teacher_id", teacherId),
    countOf("curriculum_plans", "teacher_id", teacherId),
    countOf("announcements", "created_by", teacherId),
    countOf("lesson_grades", "graded_by", teacherId),
    countOf("homework_submissions", "teacher_approved_by", teacherId),
    countOf("leave_requests", "decided_by", teacherId),
    countOf("lesson_stage_progress", "graded_by", teacherId),
  ]);

  // Уроки ищем по subject_id учителя; названия групп берём из тех же строк.
  const lessonGroups = lessons > 0
    ? [...new Set(subjects.map((s) => `${s.group?.name ?? "—"} · ${s.name}`))]
    : [];

  const gradedRecords = lessonGrades + hwApproved + leaveDecided + stageGraded;

  return {
    lessons, gradedRecords,
    assignments: subjects.length, groupLinks, curatorOf,
    curriculumPlans: Math.max(plansByTeacher, plansBySubject),
    announcements, lessonGroups,
    blocked: lessons > 0 || gradedRecords > 0,
  };
}

/**
 * Удаляет учителя вместе с привязками и учётной записью. Z.2.3.
 *
 * Раньше здесь была одна проверка — «есть ли у него группы» — и один вызов
 * `auth.admin.deleteUser`. Оба места неверны:
 *   1. Кураторство (`groups.teacher_id`) — лишь ОДНА из трёх поверхностей
 *      привязки. Учитель мог вести десяток предметов, не будучи куратором
 *      ни одной группы, и удалялся без единого предупреждения.
 *   2. `teachers.user_id` → `auth.users` стоит ON DELETE **SET NULL**
 *      (проверено на живой базе), а не CASCADE. То есть удаление учётной
 *      записи оставляло строку учителя сиротой: он пропадал из входа, но
 *      оставался в списках, назначениях и фильтрах.
 *
 * Запрет вместо удаления, если учитель ведёт уроки или подписан под
 * оценками: `lesson_grades.graded_by`, `homework_submissions
 * .teacher_approved_by`, `leave_requests.decided_by`,
 * `lesson_stage_progress.graded_by` — все четыре ON DELETE NO ACTION, то
 * есть удаление всё равно упало бы, только сырой ошибкой внешнего ключа.
 *
 * Если уроков нет, снимаем привязки явно и по одной:
 *   - `subjects.teacher_id → NULL` — назначение предмета группе остаётся,
 *     просто без учителя. Строку не удаляем: на `subjects.id` висят ДЗ
 *     (SET NULL) и учебные планы (CASCADE), а терять план из-за увольнения
 *     учителя никто не просил.
 *   - строки `group_teachers` — удаляются;
 *   - `groups.teacher_id → NULL` — кураторство снимается.
 * Формально первое и третье сделал бы сам FK (оба SET NULL), но явный шаг
 * оставляет след в логе и не зависит от того, что кто-то поменяет правило.
 */
export async function deleteTeacher(
  teacherId: string,
  userId: string,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "teachers", teacherId, callerSchoolId, callerIsSuperAdmin);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;

  const impact = await getTeacherDeletionImpact(teacherId, callerSchoolId, callerIsSuperAdmin);
  if (impact.lessons > 0) {
    throw new Error(`BLOCKED_TEACHER_LESSONS:${impact.lessons}:${impact.lessonGroups.slice(0, 5).join("; ")}`);
  }
  if (impact.gradedRecords > 0) {
    throw new Error(`BLOCKED_TEACHER_GRADES:${impact.gradedRecords}`);
  }

  const { error: unassignErr } = await anySb
    .from("subjects").update({ teacher_id: null }).eq("teacher_id", teacherId);
  if (unassignErr) throw unassignErr;

  const { error: linkErr } = await anySb.from("group_teachers").delete().eq("teacher_id", teacherId);
  if (linkErr) throw linkErr;

  const { error: curatorErr } = await anySb
    .from("groups").update({ teacher_id: null }).eq("teacher_id", teacherId);
  if (curatorErr) throw curatorErr;

  // Учётная запись — чтобы уволенный не продолжал входить. user_id может
  // быть пустым у заведённых до Z.1 строк, поэтому шаг необязательный.
  if (userId) {
    const { error } = await sb.auth.admin.deleteUser(userId);
    if (error && !/not found/i.test(error.message)) throw error;
  }

  const { error: rowErr } = await anySb.from("teachers").delete().eq("id", teacherId);
  if (rowErr) throw rowErr;
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

  // Z.2.4 — вторая и третья поверхности привязки. Без этого назначенный
  // здесь учитель получал право писать уроки, но не видел саму группу.
  if (data.teacher_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anySb = sb as any;
    await linkTeacherToGroup(anySb, data.group_id, data.teacher_id, data.school_id);
    await ensureSubjectSlug(anySb, data.teacher_id, cat.name as string, data.school_id);
  }
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
  const anySb = sb as any;
  // Прежние значения нужны, чтобы понять, что именно поменялось: снятого
  // учителя надо отвязать от группы, а при переезде назначения в другую
  // группу — отвязать от старой.
  const { data: before } = await anySb
    .from("subjects").select("teacher_id, group_id, school_id").eq("id", id).maybeSingle();
  const prevTeacher = (before?.teacher_id as string | null) ?? null;
  const prevGroup = (before?.group_id as string | null) ?? null;
  const schoolId = (before?.school_id as string) ?? callerSchoolId;

  const { error } = await anySb
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

  // Z.2.4 — приводим остальные поверхности в соответствие. Порядок важен:
  // сперва добавляем новое, потом снимаем ставшее лишним, иначе учитель,
  // который просто переехал с одной группы на другую, на мгновение теряет
  // доступ к обеим.
  if (data.teacher_id) {
    await linkTeacherToGroup(anySb, data.group_id, data.teacher_id, schoolId);
    await ensureSubjectSlug(anySb, data.teacher_id, cat.name as string, schoolId);
  }
  if (prevTeacher && (prevTeacher !== data.teacher_id || prevGroup !== data.group_id)) {
    await unlinkTeacherFromGroupIfUnused(anySb, prevGroup ?? data.group_id, prevTeacher);
  }
}

/** Что удалится вместе с назначением. Z.2.3. Уроки и ДЗ отвяжутся
 *  (ON DELETE SET NULL), а учебные планы уйдут насовсем (CASCADE) — поэтому
 *  считаем всё три и при ненулевом счётчике удалять не даём. */
export type SubjectDeletionImpact = { lessons: number; homework: number; plans: number; blocked: boolean };

async function subjectImpact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  subjectIds: string[],
): Promise<SubjectDeletionImpact> {
  if (subjectIds.length === 0) return { lessons: 0, homework: 0, plans: 0, blocked: false };
  const countOf = async (table: string) => {
    const { count } = await sb.from(table).select("id", { count: "exact", head: true }).in("subject_id", subjectIds);
    return count ?? 0;
  };
  const [lessons, homework, plans] = await Promise.all([
    countOf("lessons"), countOf("homework"), countOf("curriculum_plans"),
  ]);
  return { lessons, homework, plans, blocked: lessons + homework + plans > 0 };
}

export async function getSubjectAssignmentImpact(
  id: string,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
): Promise<SubjectDeletionImpact> {
  const sb = getServiceClient();
  await assertSameSchool(sb, "subjects", id, callerSchoolId, callerIsSuperAdmin);
  return subjectImpact(sb, [id]);
}

export async function deleteSubjectAssignment(
  id: string,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "subjects", id, callerSchoolId, callerIsSuperAdmin);

  // Z.2.3 — гвард. Раньше удаление шло без единой проверки: уроки и ДЗ
  // теряли предмет (SET NULL), а учебный план исчезал целиком (CASCADE).
  const impact = await subjectImpact(sb, [id]);
  if (impact.blocked) {
    throw new Error(`BLOCKED_SUBJECT_IN_USE:${impact.lessons}:${impact.homework}:${impact.plans}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from("subjects").delete().eq("id", id);
  if (error) throw error;
}

/** Что мешает удалить предмет из справочника школы. Z.2.3. */
export type SchoolSubjectDeletionImpact = SubjectDeletionImpact & { assignments: number };

export async function getSchoolSubjectImpact(
  id: string,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
): Promise<SchoolSubjectDeletionImpact> {
  const sb = getServiceClient();
  await assertSameSchool(sb, "school_subjects", id, callerSchoolId, callerIsSuperAdmin);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;
  const { data: rows } = await anySb.from("subjects").select("id").eq("catalog_id", id);
  const ids = ((rows ?? []) as Array<{ id: string }>).map((r) => r.id);
  const impact = await subjectImpact(anySb, ids);
  return { ...impact, assignments: ids.length, blocked: impact.blocked || ids.length > 0 };
}

/**
 * Удаляет предмет из справочника школы. Z.2.3.
 *
 * До этого шага удаления не было вовсе — только «скрыть» (`is_active`), и это
 * правильное поведение для предмета, который где-то используется. Но пустой
 * предмет, заведённый по ошибке, скрывать бессмысленно: он навсегда остаётся
 * в списке выключенным. Поэтому удаление есть, но только для действительно
 * пустого: ни одного назначения в группах, а значит ни уроков, ни ДЗ, ни
 * планов. Во всех остальных случаях — отказ с числами и предложением скрыть.
 */
export async function deleteSchoolSubject(
  id: string,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
) {
  const sb = getServiceClient();
  const impact = await getSchoolSubjectImpact(id, callerSchoolId, callerIsSuperAdmin);
  if (impact.blocked) {
    throw new Error(
      `BLOCKED_CATALOG_IN_USE:${impact.assignments}:${impact.lessons}:${impact.homework}:${impact.plans}`,
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from("school_subjects").delete().eq("id", id);
  if (error) throw error;
}

// ── Z.2.4: ЕДИНАЯ ПРИВЯЗКА УЧИТЕЛЯ ───────────────────────────────────────────
//
// Связь «учитель ведёт предмет в группе» жила в трёх независимых местах, и
// админка писала только первое:
//   1. `subjects.teacher_id`   — кто ведёт. Предикат is_subject_owner(),
//                                гейтит ЗАПИСЬ уроков.
//   2. `group_teachers`        — какие группы видит. Предикат
//                                is_my_teacher_group(), гейтит ЧТЕНИЕ.
//                                В неё не писал никто, отсюда и симптом:
//                                заведённый через админку учитель не видел
//                                ни одной своей группы.
//   3. `teachers.subject_slug` — предметник или куратор. Предикат
//                                is_curator_teacher() (буквально
//                                `subject_slug IS NULL`), входит в
//                                SELECT-политику уроков и гейтит библиотеку
//                                кафедры (миграция 154).
//
// Функции ниже пишут все три за одно действие. Три правила, каждое оплачено
// разведкой:
//
//   • `group_teachers.school_id` — NOT NULL DEFAULT current_school_id(), а под
//     service-role клиентом auth.uid() пуст и дефолт даёт NULL. Школу
//     передаём явно, иначе вставка падает.
//
//   • На `subjects` висит trg_subject_teacher_direct_chats (AFTER UPDATE OF
//     teacher_id): смена учителя заводит личные чаты со всеми РЕАЛЬНЫМИ
//     учениками группы (у кого логин не начинается на `demo_`). Поэтому
//     только по одному назначению за раз и никаких массовых UPDATE. Если
//     учитель тот же — триггер сам замыкается накоротко и ничего не делает.
//
//   • `subject_slug` в ДЕМО-ШКОЛЕ не трогаем вообще. У teacher_karim слаг
//     пуст при 13 назначениях: пустой слаг делает его куратором и открывает
//     чтение всех уроков своих групп. Проставить слаг «по логике» — молча
//     сузить ему права на живой демонстрации. В реальных школах слаг
//     проставляется при первом назначении и только если он ещё пуст.

const DEMO_SCHOOL_ID = "a0a0a0a0-0000-0000-0000-000000000001";

export type TeacherBinding = {
  assignmentId: string;
  subjectName: string;
  groupId: string;
  groupName: string;
  /** Куратор группы — отдельная роль, показывается рядом для полноты картины. */
  isCurator: boolean;
  /** Есть ли строка в group_teachers, то есть видит ли он группу. */
  seesGroup: boolean;
  lessons: number;
};

/** Всё, что учитель ведёт: предмет, группа, видит ли он её, сколько уроков.
 *  Питает вкладку «Предметы и группы». Z.2.4. */
export async function getTeacherBindings(
  teacherId: string,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
): Promise<TeacherBinding[]> {
  const sb = getServiceClient();
  await assertSameSchool(sb, "teachers", teacherId, callerSchoolId, callerIsSuperAdmin);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;

  const { data: rows, error } = await anySb
    .from("subjects")
    .select("id, name, group_id, group:groups(id, name, teacher_id)")
    .eq("teacher_id", teacherId)
    .order("name");
  if (error) throw error;
  const assignments = (rows ?? []) as Array<{
    id: string; name: string; group_id: string;
    group: { id: string; name: string; teacher_id: string | null } | null;
  }>;
  if (assignments.length === 0) return [];

  const { data: links } = await anySb
    .from("group_teachers").select("group_id").eq("teacher_id", teacherId);
  const seen = new Set(((links ?? []) as Array<{ group_id: string }>).map((l) => l.group_id));

  const { data: lessonRows } = await anySb
    .from("lessons").select("subject_id").in("subject_id", assignments.map((a) => a.id));
  const lessonsBy = new Map<string, number>();
  for (const l of (lessonRows ?? []) as Array<{ subject_id: string }>) {
    lessonsBy.set(l.subject_id, (lessonsBy.get(l.subject_id) ?? 0) + 1);
  }

  return assignments.map((a) => ({
    assignmentId: a.id,
    subjectName: a.name,
    groupId: a.group_id,
    groupName: a.group?.name ?? "—",
    isCurator: a.group?.teacher_id === teacherId,
    seesGroup: seen.has(a.group_id),
    lessons: lessonsBy.get(a.id) ?? 0,
  }));
}

/** Ставит строку group_teachers, если её ещё нет. school_id — явно, дефолт
 *  под service-role даёт NULL. PK (group_id, teacher_id) делает повтор
 *  безвредным, триггеров на таблице нет. */
async function linkTeacherToGroup(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  groupId: string,
  teacherId: string,
  schoolId: string,
) {
  const { error } = await sb
    .from("group_teachers")
    .upsert({ group_id: groupId, teacher_id: teacherId, school_id: schoolId }, { onConflict: "group_id,teacher_id" });
  if (error) throw error;
}

/** Снимает строку group_teachers, но только если учитель больше ничем с этой
 *  группой не связан — не ведёт в ней других предметов и не куратор.
 *  Иначе снятие одного предмета отобрало бы доступ ко всей группе. */
async function unlinkTeacherFromGroupIfUnused(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  groupId: string,
  teacherId: string,
) {
  const { count: others } = await sb
    .from("subjects").select("id", { count: "exact", head: true })
    .eq("group_id", groupId).eq("teacher_id", teacherId);
  if ((others ?? 0) > 0) return;

  const { data: group } = await sb.from("groups").select("teacher_id").eq("id", groupId).maybeSingle();
  if (group?.teacher_id === teacherId) return;

  const { error } = await sb
    .from("group_teachers").delete().eq("group_id", groupId).eq("teacher_id", teacherId);
  if (error) throw error;
}

/** Проставляет subject_slug при первом назначении — только в реальных школах
 *  и только поверх пустого значения. Разбор почему так — в шапке блока. */
async function ensureSubjectSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  teacherId: string,
  subjectName: string,
  schoolId: string,
) {
  if (schoolId === DEMO_SCHOOL_ID) return;
  const slug = getSubjectKeyByLabel(subjectName);
  if (!slug) return;
  const { data: teacher } = await sb
    .from("teachers").select("subject_slug").eq("id", teacherId).maybeSingle();
  if (!teacher || teacher.subject_slug) return;
  const { error } = await sb.from("teachers").update({ subject_slug: slug }).eq("id", teacherId);
  if (error) throw error;
}

/**
 * Назначает (или снимает) учителя на одно назначение предмета — и приводит в
 * порядок все поверхности привязки разом. Z.2.4, ядро шага.
 *
 * Одна строка `subjects` за вызов: на ней чат-триггер. Существующие связи
 * дополняются, а не затираются — снятие учителя с одного предмета не рвёт
 * его доступ к группе, если он ведёт там что-то ещё или он её куратор.
 */
export async function setAssignmentTeacher(
  assignmentId: string,
  teacherId: string | null,
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
): Promise<{ changed: boolean; groupId: string }> {
  const sb = getServiceClient();
  await assertSameSchool(sb, "subjects", assignmentId, callerSchoolId, callerIsSuperAdmin);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;

  const { data: row, error: readErr } = await anySb
    .from("subjects").select("id, name, group_id, teacher_id, school_id").eq("id", assignmentId).maybeSingle();
  if (readErr) throw readErr;
  if (!row) throw new Error("Назначение не найдено");

  const schoolId = (row.school_id as string) ?? callerSchoolId;
  const previous = (row.teacher_id as string | null) ?? null;
  if (previous === teacherId) return { changed: false, groupId: row.group_id as string };

  if (teacherId) {
    await assertSameSchool(sb, "teachers", teacherId, callerSchoolId, callerIsSuperAdmin);
  }

  const { error: upErr } = await anySb
    .from("subjects").update({ teacher_id: teacherId }).eq("id", assignmentId);
  if (upErr) throw upErr;

  if (teacherId) {
    await linkTeacherToGroup(anySb, row.group_id as string, teacherId, schoolId);
    await ensureSubjectSlug(anySb, teacherId, row.name as string, schoolId);
  }
  if (previous) {
    await unlinkTeacherFromGroupIfUnused(anySb, row.group_id as string, previous);
  }

  return { changed: true, groupId: row.group_id as string };
}
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

/**
 * Удаляет родителя вместе с учётной записью. Z.2.3.
 *
 * Раньше удалялась только строка `parents`, а учётная запись оставалась жить
 * и продолжала пускать в систему — «удалённый» родитель входил как ни в чём
 * не бывало. `parents.user_id` → `auth.users` стоит ON DELETE **CASCADE**
 * (проверено на живой базе), поэтому правильный порядок обратный: удаляем
 * пользователя, а строка родителя уходит сама, вместе с `parent_students` и
 * `parent_invites` (обе CASCADE от parents).
 *
 * Дети не затрагиваются: `parent_students` — таблица связи, каскад забирает
 * только её строки, `students` там ни при чём.
 */
export async function deleteParent(parentId: string, callerSchoolId: string, callerIsSuperAdmin: boolean) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "parents", parentId, callerSchoolId, callerIsSuperAdmin);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;

  const { data: parent, error: readErr } = await anySb
    .from("parents").select("user_id").eq("id", parentId).maybeSingle();
  if (readErr) throw readErr;

  if (parent?.user_id) {
    const { error } = await sb.auth.admin.deleteUser(parent.user_id as string);
    if (error && !/not found/i.test(error.message)) throw error;
  }

  // Каскад срабатывает только если user_id был заполнен; у заведённых до
  // Z.1 строк его нет, поэтому добиваем явно. Повторное удаление безвредно.
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
