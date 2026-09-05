"use server";

import {
  createStudent, updateStudent, resetStudentPassword, deleteStudent,
  createTeacher, updateTeacher, resetTeacherPassword, deleteTeacher,
  findTeacherByLogin, addTeacherToSchool, dismissTeacherFromSchool,
  getStudentGroupLossImpact,
  createGroup, updateGroup, deleteGroup, createGroupsBulk,
  quickStartGroup, getQuickStartData,
  createSchoolSubject, updateSchoolSubject, setSchoolSubjectActive,
  createDepartment, renameDepartment, getDepartmentImpact,
  mergeDepartments, deleteDepartment, type DepartmentImpact,
  createSubjectAssignment, updateSubjectAssignment, deleteSubjectAssignment,
  deleteSchoolSubject, getSchoolSubjectImpact, getSubjectAssignmentImpact,
  getTeacherDeletionImpact, setAssignmentTeacher, topUpStudentBalance,
  planBulkAssignment, applyBulkAssignment,
} from "@/lib/admin-api";
import type {
  SchoolSubjectDeletionImpact, SubjectDeletionImpact, TeacherDeletionImpact,
  BulkAssignPlan, BulkAssignResult, BulkGroupsResult, QuickStartResult,
} from "@/lib/admin-api";
import { createClient } from "@/lib/supabase/server";
import { changedFields, GOOGLE_EMAIL_FIELDS } from "@/lib/form-patch";
import { parseCoursePrice } from "@/lib/course-price";
import { guard, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { verifyStaff, type StaffRole } from "@/lib/verify-staff";

/** Returns the calling admin's school_id — the service-role client used by
 *  admin-api.ts has no auth.uid(), so current_school_id() resolves to NULL
 *  there; every insert on a school_id NOT NULL table must get it from here.
 *  Also resolves isSuperAdmin (existence in super_admins) — П.3 Заход 1:
 *  admin-api.ts's update/delete functions need this to allow the cross-school
 *  bypass for super admins, since they can't check auth.uid() themselves. */
/**
 * Кто действует и в какой школе.
 *
 * 03.09.2026, заход 3 по роли менеджера — ТЕЛО ПЕРЕЕХАЛО В lib/verify-staff.ts.
 * Раньше эта функция жила ТРЕМЯ ОДИНАКОВЫМИ КОПИЯМИ в трёх файлах действий, и
 * учить пускать менеджера пришлось бы все три. Здесь осталась только оболочка,
 * сохраняющая прежнюю подпись, — поэтому ни один из вызывающих не тронут.
 *
 * Довод `requestedSchoolId` — школа, названная снаружи. Админу она не нужна
 * (его школа в его строке) и при несовпадении отвергается; менеджеру она
 * обязательна, потому что своей школы у него нет.
 */
async function verifyAdmin(
  requestedSchoolId?: string | null,
): Promise<{ schoolId: string; isSuperAdmin: boolean; userId: string; role: StaffRole }> {
  const s = await verifyStaff(requestedSchoolId);
  return { schoolId: s.schoolId, isSuperAdmin: s.isSuperAdmin, userId: s.userId, role: s.role };
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
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет (WRONG_SCHOOL). Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId, userId } = await verifyAdmin(школаИзФормы);
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
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет (WRONG_SCHOOL). Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId, isSuperAdmin, userId } = await verifyAdmin(школаИзФормы);
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

export async function actionResetStudentPassword(userId: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
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
    // Срез 3d: пополнение баланса переехало к менеджеру вместе с остальными
    // деньгами, хотя лежит не в разделе оплат, а среди действий с учениками.
    // Школа приходит формой — как у шести соседних действий.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId, isSuperAdmin, role } = await verifyAdmin(школаИзФормы);
    // ДЕНЬГИ МЕНЯЕТ ТОЛЬКО МЕНЕДЖЕР. Пополнение баланса лежит среди действий
    // с учениками, но это деньги — и уезжает вместе с разделом оплат, иначе
    // половина денежной работы осталась бы у админа. Тот же отказ, что в
    // app/admin/payments/actions.ts; кнопка кошелька у админа при этом
    // убрана, так что в отказ ведёт только вызов в обход экрана.
    if (role !== "manager") throw new Error("MONEY_MANAGER_ONLY");
    const studentId = String(formData.get("student_id") ?? "");
    const amount = parseCoursePrice(String(formData.get("amount") ?? ""));
    const note = String(formData.get("note") ?? "");
    await topUpStudentBalance({
      studentId, amount, note, callerSchoolId: schoolId, callerIsSuperAdmin: isSuperAdmin,
    });
    revalidatePath("/admin/students");
  });
}

/** Что потеряет ученик, если снять его с группы. Пункт 105: числа ДО действия. */
export async function actionStudentGroupLossImpact(studentId: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    return getStudentGroupLossImpact(studentId, schoolId, isSuperAdmin);
  });
}

export async function actionDeleteStudent(userId: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
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
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет (WRONG_SCHOOL). Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId } = await verifyAdmin(школаИзФормы);
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
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет (WRONG_SCHOOL). Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId, isSuperAdmin } = await verifyAdmin(школаИзФормы);
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

export async function actionResetTeacherPassword(userId: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    const newPassword = await resetTeacherPassword(userId, schoolId, isSuperAdmin);
    revalidatePath("/admin/teachers");
    return newPassword;
  });
}

/** Что удаление затронет — для честного текста в подтверждении. Z.2.3. */
export async function actionTeacherDeletionImpact(teacherId: string, requestedSchoolId?: string | null): Promise<ActionResult<TeacherDeletionImpact>> {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    return getTeacherDeletionImpact(teacherId, schoolId, isSuperAdmin);
  });
}

export async function actionDeleteTeacher(teacherId: string, userId: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    await deleteTeacher(teacherId, userId, schoolId, isSuperAdmin);
    revalidatePath("/admin/teachers");
    revalidatePath("/admin/subject-assignments");
    revalidatePath("/admin/groups");
    revalidatePath("/admin");
  });
}

/** Z.2.4 — назначить или снять учителя одним действием: subjects.teacher_id,
 *  group_teachers и (в реальных школах) subject_slug. */
/**
 * УЧИТЕЛЬ, КОТОРЫЙ УЖЕ ГДЕ-ТО РАБОТАЕТ: найти по логину. 06.09.2026.
 *
 * Школа берётся у вызывающего и уходит в поиск только затем, чтобы ответить
 * «а у нас он уже есть?». Ни один довод не позволяет спросить про чужую школу.
 */
export async function actionFindTeacherByLogin(login: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId } = await verifyAdmin(requestedSchoolId);
    return findTeacherByLogin(login, schoolId);
  });
}

/** Добавить найденного учителя в СВОЮ школу — связью, а не вторым человеком. */
export async function actionAddTeacherToSchool(teacherId: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId } = await verifyAdmin(requestedSchoolId);
    const итог = await addTeacherToSchool(teacherId, schoolId);
    revalidatePath("/admin/teachers");
    revalidatePath("/admin");
    revalidatePath("/admin/subject-assignments");
    return итог;
  });
}

/**
 * Уволить из СВОЕЙ школы. Человека не трогает: снимается связь.
 *
 * Это НЕ замена удалению. Удаление сносит учётную запись и строку целиком и
 * упирается в уроки и оценки; увольнение оставляет всё на месте и потому
 * запретов не имеет.
 */
export async function actionDismissTeacherFromSchool(teacherId: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId } = await verifyAdmin(requestedSchoolId);
    const итог = await dismissTeacherFromSchool(teacherId, schoolId);
    revalidatePath("/admin/teachers");
    revalidatePath("/admin");
    revalidatePath("/admin/subject-assignments");
    revalidatePath("/admin/groups");
    return итог;
  });
}

export async function actionSetAssignmentTeacher(assignmentId: string, teacherId: string | null, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    const result = await setAssignmentTeacher(assignmentId, teacherId, schoolId, isSuperAdmin);
    revalidatePath("/admin/teachers");
    revalidatePath("/admin/subject-assignments");
    return result;
  });
}

// ── GROUPS ────────────────────────────────────────────────────────────────────

/**
 * ЧТО КЛАДЁТСЯ В groups.subject. 05.09.2026.
 *
 * Пустая строка. Колонка декоративна: она осталась от модели «группа = один
 * курс», а настоящая связь «группа — предметы» живёт в назначениях
 * (`subjects.group_id`). У трёх демо-классов в ней лежит 'programming', хотя
 * предметов у каждого пять-шесть, — то есть она не просто бесполезна, она
 * врёт.
 *
 * ЧИТАТЕЛЕЙ У НЕЁ БОЛЬШЕ НЕТ. Экраны задания и урока спрашивают справочник
 * (`subject_id`), и строк без него в базе ноль: 0 из 60 заданий, 0 из 130
 * уроков (замер 05.09.2026). Список групп показывает назначения. Помощник ИИ
 * берёт предмет из назначения урока.
 *
 * ПОЧЕМУ ПУСТАЯ СТРОКА, А НЕ ОТСУТСТВИЕ ПОЛЯ. Колонка `text NOT NULL` без
 * умолчания: пропустить её сегодня нельзя. Миграция 256 даёт ей умолчание и
 * помечает устаревшей — после неё поле можно будет не передавать вовсе, а
 * сама колонка уходит в конце цепочки заходов. Пустая строка работает и до
 * миграции, и после: порядок выкатки ничего не ломает.
 */
const ПУСТОЙ_ПРЕДМЕТ_ГРУППЫ = "";

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
 *
 * ═══ 03.09.2026 — ЦЕНУ ЗАДАЁТ ТОЛЬКО МЕНЕДЖЕР ═════════════════════════════
 *
 * Решение заказчика, продолжение переезда денег. Счёт выставляется ПО ЦЕНЕ
 * ГРУППЫ — это видно прямо в `fn_issue_monthly_invoices`, которая берёт
 * `g.course_price`. Значит тот, кто задаёт цену, задаёт и сумму счёта, и
 * оставлять её админу, отобрав у него счета, значило бы отобрать замок, но
 * оставить ключ.
 *
 * ОТКАЗ, А НЕ ТИХОЕ ПРЕНЕБРЕЖЕНИЕ. Молча выбросить присланную цену было бы
 * мягче, но тогда подделанный запрос выглядел бы как удавшийся. Здесь то же
 * правило, что и у школы в verifyStaff: чужое — отказ, а не подстановка.
 *
 * ПОЛЯ У АДМИНА НЕТ ВОВСЕ — ни в форме группы, ни в массовом создании, ни в
 * едином окне. Значит сюда отказ доходит, ТОЛЬКО если действие вызвали в
 * обход экрана. Мёртвых полей не осталось, как не осталось мёртвых кнопок.
 */
function readCoursePrice(formData: FormData, role: StaffRole): number | undefined {
  const raw = formData.get("course_price");
  if (raw === null) return undefined;
  if (role !== "manager") throw new Error("PRICE_MANAGER_ONLY");
  return parseCoursePrice(String(raw));
}

export async function actionCreateGroup(formData: FormData) {
  return guard(async () => {
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет. Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId, role } = await verifyAdmin(школаИзФормы);
    const name = String(formData.get("name") ?? "").trim();
    if (!name) throw new Error("Missing fields");
    const id = await createGroup({
      name, subject: ПУСТОЙ_ПРЕДМЕТ_ГРУППЫ, teacher_id: null, school_id: schoolId,
      // Админ цену не шлёт — значит undefined, и колонка берёт своё
      // умолчание: `course_price integer NOT NULL DEFAULT 0`. Ноль означает
      // «цена не задана», и ученик такой группы виден менеджеру в помехах
      // раздела оплат с причиной no_price. Тихой выдуманной цены не будет.
      course_price: readCoursePrice(formData, role),
    });
    revalidatePath("/admin/groups");
    revalidatePath("/admin");
    return id;
  });
}

/**
 * МАССОВОЕ СОЗДАНИЕ ГРУПП. Пункт 227.
 *
 * Список имён приходит JSON-строкой: это не поля браузерной формы, а
 * содержимое одного текстового поля, разобранного на строки. Предмет и цена —
 * одни на всю пачку, читаются теми же функциями, что и у одиночной формы
 * (resolveGroupSubject, readCoursePrice), поэтому понимаются одинаково.
 *
 * Два revalidatePath на всю пачку, а не на каждую группу.
 */
export async function actionCreateGroupsBulk(
  formData: FormData,
): Promise<ActionResult<BulkGroupsResult>> {
  return guard(async () => {
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет. Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId, role } = await verifyAdmin(школаИзФормы);

    let разобрано: unknown;
    try {
      разобрано = JSON.parse(String(formData.get("names") ?? "[]"));
    } catch {
      throw new Error("Missing fields");
    }
    if (!Array.isArray(разобрано)) throw new Error("Missing fields");
    const names = разобрано.map((v) => String(v).trim()).filter(Boolean);
    if (names.length === 0) throw new Error("Missing fields");

    const итог = await createGroupsBulk({
      names,
      subject: ПУСТОЙ_ПРЕДМЕТ_ГРУППЫ,
      // У менеджера поле есть всегда, пустое = 0. У админа поля нет вовсе —
      // undefined, и вся пачка заводится с нулём, то есть «цена не задана».
      coursePrice: readCoursePrice(formData, role) ?? 0,
      schoolId,
    });

    revalidatePath("/admin/groups");
    revalidatePath("/admin");
    return итог;
  });
}

/**
 * ЕДИНОЕ ОКНО, ШАГ 0 — СПИСКИ. Пункт 228.
 *
 * Справочник, группы и учителя одним походом, ПО ОТКРЫТИЮ ОКНА. Вешать их на
 * дашборд не стали: он и без того делает одиннадцать счётных запросов, а окно
 * открывают раз в жизни школы.
 *
 * Списки нужны окну, чтобы показать занятое ДО записи: имя группы против
 * существующих, предмет против справочника.
 */
export async function actionQuickStartData(
  requestedSchoolId?: string | null,
): Promise<ActionResult<{
  catalog: Array<{ id: string; name: string; is_active: boolean }>;
  groups: Array<{ id: string; name: string }>;
  teachers: Array<{ id: string; full_name: string }>;
}>> {
  return guard(async () => {
    const { schoolId } = await verifyAdmin(requestedSchoolId);
    return getQuickStartData(schoolId);
  });
}

/**
 * ЕДИНОЕ ОКНО — ЗАПИСЬ. Пункт 228.
 *
 * СБРАСЫВАЕТ ПЯТЬ ПУТЕЙ, а не два. Одно действие трогает четыре таблицы —
 * school_subjects, groups, subjects, group_teachers, — и их читают все пять
 * экранов.
 *
 * Проявиться несогласованность в списках сброса сегодня не может: admin/layout
 * зовёт createClient, тот зовёт cookies(), и все маршруты /admin/* поэтому
 * динамические — полного кэша маршрута для них не создаётся вовсе, и
 * revalidatePath там нечего инвалидировать. Но несогласованность в коде
 * остаётся несогласованностью: настройки кэширования меняются, а списки
 * переписывать потом будет некому.
 */
export async function actionQuickStart(
  formData: FormData,
): Promise<ActionResult<QuickStartResult>> {
  return guard(async () => {
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет. Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId, role } = await verifyAdmin(школаИзФормы);

    const groupName = String(formData.get("group_name") ?? "").trim();
    if (!groupName) throw new Error("Missing fields");

    const список = (имя: string): string[] => {
      let разобрано: unknown;
      try {
        разобрано = JSON.parse(String(formData.get(имя) ?? "[]"));
      } catch {
        throw new Error("Missing fields");
      }
      if (!Array.isArray(разобрано)) throw new Error("Missing fields");
      return [...new Set(разобрано.map((v) => String(v).trim()).filter(Boolean))];
    };

    const teacher = String(formData.get("teacher_id") ?? "").trim();
    const итог = await quickStartGroup({
      groupName,
      // Пустое поле цены = 0, тем же разбором, что у обеих форм группы.
      // У админа шага с ценой нет — ноль, и его видно в помехах оплат.
      coursePrice: readCoursePrice(formData, role) ?? 0,
      catalogIds: список("catalog_ids"),
      newSubjectNames: список("new_subject_names"),
      teacherId: teacher || null,
      schoolId,
    });

    revalidatePath("/admin/groups");
    revalidatePath("/admin/subjects");
    revalidatePath("/admin/subject-assignments");
    revalidatePath("/admin/teachers");
    revalidatePath("/admin");
    return итог;
  });
}

export async function actionUpdateGroup(formData: FormData) {
  return guard(async () => {
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет. Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId, isSuperAdmin, role } = await verifyAdmin(школаИзФормы);
    const group_id = String(formData.get("group_id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    await updateGroup(
      group_id,
      // Админ правит только имя: предмета у группы в форме больше нет, цену
      // он не шлёт — undefined, и updateGroup её НЕ ТРОГАЕТ (см.
      // lib/admin-api.ts). Заданная менеджером цена переживает любую правку
      // группы админом, а декоративная колонка не переписывается вовсе.
      { name, course_price: readCoursePrice(formData, role) },
      schoolId,
      isSuperAdmin,
    );
    revalidatePath("/admin/groups");
  });
}

export async function actionDeleteGroup(groupId: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    await deleteGroup(groupId, schoolId, isSuperAdmin);
    revalidatePath("/admin/groups");
    revalidatePath("/admin");
  });
}

// ── SCHOOL SUBJECTS: справочник (Z.2.2) ──────────────────────────────────────
// school_id всегда берётся из verifyAdmin() на сервере, из FormData НЕ читается
// — до Z.2.2 эта форма была единственной в админке, писавшей прямо из браузера
// и полагавшейся на DEFAULT current_school_id().

/**
 * Внешние сервисы предмета из формы (миграция 258).
 *
 * Поля нет вовсе — null, и запись не трогает колонку: у создания сработает
 * умолчание (все четырнадцать), у правки набор останется прежним. Пустой
 * список — это ОСОЗНАННЫЙ выбор «ни одного», и он должен доехать, поэтому
 * отсутствие поля и пустой список — разные вещи.
 */
function readServices(formData: FormData): string[] | null {
  const raw = formData.get("services");
  if (raw === null) return null;
  try {
    const list = JSON.parse(String(raw));
    if (!Array.isArray(list)) return null;
    return list.map((v) => String(v));
  } catch {
    return null;
  }
}

function revalidateSubjects() {
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/subject-assignments");
  revalidatePath("/admin/groups");
}

export async function actionCreateSchoolSubject(formData: FormData) {
  return guard(async () => {
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет. Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId } = await verifyAdmin(школаИзФормы);
    const name = String(formData.get("name") ?? "").trim();
    const icon = String(formData.get("icon") ?? "").trim() || "BookOpen";
    const color = String(formData.get("color") ?? "").trim() || "#64748B";
    if (!name) throw new Error("Missing fields");
    // Кафедра: выбранная в списке либо названная тут же. Не пришло ничего —
    // createSchoolSubject заведёт кафедру по названию предмета (запасной путь).
    const departmentId = String(formData.get("department_id") ?? "").trim() || null;
    const departmentName = String(formData.get("department_name") ?? "").trim() || null;
    const id = await createSchoolSubject({
      name, icon, color, school_id: schoolId,
      department_id: departmentId, department_name: departmentName,
      services: readServices(formData),
    });
    revalidateSubjects();
    return id;
  });
}

export async function actionUpdateSchoolSubject(formData: FormData) {
  return guard(async () => {
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет. Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId, isSuperAdmin } = await verifyAdmin(школаИзФормы);
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const icon = String(formData.get("icon") ?? "").trim() || "BookOpen";
    const color = String(formData.get("color") ?? "").trim() || "#64748B";
    if (!id || !name) throw new Error("Missing fields");
    await updateSchoolSubject(id, { name, icon, color, services: readServices(formData) }, schoolId, isSuperAdmin);
    revalidateSubjects();
  });
}

export async function actionSetSchoolSubjectActive(id: string, isActive: boolean, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    await setSchoolSubjectActive(id, isActive, schoolId, isSuperAdmin);
    revalidateSubjects();
  });
}

/** Z.2.3 — что мешает удалить предмет справочника. Питает диалог, который
 *  вместо «вы уверены» показывает числа и предлагает скрыть. */
export async function actionSchoolSubjectImpact(id: string, requestedSchoolId?: string | null): Promise<ActionResult<SchoolSubjectDeletionImpact>> {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    return getSchoolSubjectImpact(id, schoolId, isSuperAdmin);
  });
}

export async function actionDeleteSchoolSubject(id: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
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
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет. Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId } = await verifyAdmin(школаИзФормы);
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

/**
 * МАССОВОЕ НАЗНАЧЕНИЕ, ШАГ 1 — ПОСЧИТАТЬ И НИЧЕГО НЕ ЗАПИСАТЬ.
 *
 * Тот же приём, что у массового создания уроков: предпросмотр считает тем
 * же кодом, которым потом пишет, поэтому показанное число и сделанное не
 * могут разойтись.
 *
 * Списки приходят JSON-строками, а не getAll(): здесь не форма браузера, а
 * прямой вызов из клиента — и порядок пар нам не нужен, нужны два множества.
 */
export async function actionPlanBulkAssignment(
  formData: FormData,
): Promise<ActionResult<BulkAssignPlan>> {
  return guard(async () => {
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет. Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId } = await verifyAdmin(школаИзФормы);
    const { catalogIds, groupIds, teacherId } = readBulkInput(formData);
    return planBulkAssignment({ catalogIds, groupIds, teacherId, schoolId });
  });
}

/** МАССОВОЕ НАЗНАЧЕНИЕ, ШАГ 2 — записать. Частичный отказ не теряет
 *  прошедшего: результат несёт числа и причину по каждой непрошедшей паре. */
export async function actionApplyBulkAssignment(
  formData: FormData,
): Promise<ActionResult<BulkAssignResult>> {
  return guard(async () => {
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет. Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId } = await verifyAdmin(школаИзФормы);
    const { catalogIds, groupIds, teacherId } = readBulkInput(formData);
    const итог = await applyBulkAssignment({ catalogIds, groupIds, teacherId, schoolId });
    revalidateSubjects();
    revalidatePath("/admin/teachers");
    return итог;
  });
}

/** Разбор входа обоих массовых действий. Один на два, чтобы шаг «посчитать»
 *  и шаг «записать» не могли понять запрос по-разному. */
function readBulkInput(formData: FormData): {
  catalogIds: string[]; groupIds: string[]; teacherId: string | null;
} {
  const список = (имя: string): string[] => {
    const raw = String(formData.get(имя) ?? "[]");
    let разобрано: unknown;
    try {
      разобрано = JSON.parse(raw);
    } catch {
      throw new Error("Missing fields");
    }
    if (!Array.isArray(разобрано)) throw new Error("Missing fields");
    // Пустые и повторы отсеиваем здесь: дальше они дали бы лишние круги до
    // базы и задвоенные строки в отчёте.
    return [...new Set(разобрано.map((v) => String(v).trim()).filter(Boolean))];
  };
  const catalogIds = список("catalog_ids");
  const groupIds = список("group_ids");
  if (catalogIds.length === 0 || groupIds.length === 0) throw new Error("Missing fields");
  const teacher = String(formData.get("teacher_id") ?? "").trim();
  return { catalogIds, groupIds, teacherId: teacher || null };
}

export async function actionUpdateSubjectAssignment(formData: FormData) {
  return guard(async () => {
    // Школа приходит снаружи ТОЛЬКО у менеджера: своей у него нет.
    // Админ её не шлёт, а пришлёт свою — verifyStaff примет, чужую
    // отвергнет. Подделать нечего.
    const школаИзФормы = String(formData.get("school_id") ?? "").trim() || null;
    const { schoolId, isSuperAdmin } = await verifyAdmin(школаИзФормы);
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

export async function actionSubjectAssignmentImpact(id: string, requestedSchoolId?: string | null): Promise<ActionResult<SubjectDeletionImpact>> {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    return getSubjectAssignmentImpact(id, schoolId, isSuperAdmin);
  });
}

export async function actionDeleteSubjectAssignment(id: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    await deleteSubjectAssignment(id, schoolId, isSuperAdmin);
    revalidateSubjects();
  });
}

// ── КАФЕДРЫ (миграция 255) ───────────────────────────────────────────────────
// Школа — из verifyAdmin, как у справочника предметов: у админа своя, у
// менеджера приходит снаружи и проверяется. Суперадмин без строки админа сюда
// не проходит вовсе — его экран школы читающий, как и по предметам.

function revalidateDepartments() {
  revalidatePath("/admin/departments");
  revalidatePath("/admin/subjects");
}

export async function actionCreateDepartment(name: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId } = await verifyAdmin(requestedSchoolId);
    const чистое = name.trim();
    if (!чистое) throw new Error("Missing fields");
    const id = await createDepartment(чистое, schoolId);
    revalidateDepartments();
    return id;
  });
}

export async function actionRenameDepartment(id: string, name: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    const чистое = name.trim();
    if (!id || !чистое) throw new Error("Missing fields");
    await renameDepartment(id, чистое, schoolId, isSuperAdmin);
    revalidateDepartments();
  });
}

/** Что держит кафедру. Питает два диалога: «что переедет при слиянии» и
 *  «что мешает удалить». Числа спрашиваются заново перед каждым действием —
 *  счётчик на карточке мог устареть, пока админ смотрел на список. */
export async function actionDepartmentImpact(
  id: string,
  requestedSchoolId?: string | null,
): Promise<ActionResult<DepartmentImpact>> {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    return getDepartmentImpact(id, schoolId, isSuperAdmin);
  });
}

export async function actionMergeDepartments(
  fromId: string,
  toId: string,
  requestedSchoolId?: string | null,
) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    const итог = await mergeDepartments(fromId, toId, schoolId, isSuperAdmin);
    revalidateDepartments();
    revalidatePath("/teacher/knowledge-base");
    return итог;
  });
}

export async function actionDeleteDepartment(id: string, requestedSchoolId?: string | null) {
  return guard(async () => {
    const { schoolId, isSuperAdmin } = await verifyAdmin(requestedSchoolId);
    await deleteDepartment(id, schoolId, isSuperAdmin);
    revalidateDepartments();
  });
}
