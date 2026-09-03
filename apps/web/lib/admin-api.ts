import { createClient } from "@supabase/supabase-js";
import {
  getSubjectKeyByLabel, groupNameKey, GROUP_BULK_MAX, normalizeUzPhone, parentAuthEmail,
  usernameToEmail, MANAGER_EMAIL_DOMAIN,
} from "@snr/core";

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

/**
 * Z.2.10 — учётная запись со школьным адресом, если простой уже занят.
 *
 * ЧТО БЫЛО. Логин превращается в служебный адрес `ivanov@students.snr.local`
 * БЕЗ участия школы, а `auth.users.email` уникален глобально. В базе
 * уникальность правильная — `UNIQUE(school_id, username)`, — но завести
 * «ivanov» во второй школе было нельзя: адрес уже занят первой.
 *
 * КАК СТАЛО. Сначала пробуем простой адрес: сегодня он свободен в 100%
 * случаев, и ничего не меняется. Если занят — дописываем код школы:
 * `ivanov.snr-real@students.snr.local`. Существующие адреса при этом НЕ
 * мигрируются: школьный компонент получают только новые записи, и только
 * те, кому иначе не хватило бы места.
 *
 * Вход разбирается в app/actions/auth.ts: обычная попытка по простому
 * адресу, а если не вышла — резолвер по имени пользователя.
 */
async function createSchoolScopedUser(
  sb: ReturnType<typeof getServiceClient>,
  data: { username: string; password: string; domain: string; school_id: string },
): Promise<{ userId: string; email: string }> {
  const login = data.username.trim().toLowerCase();
  const plain = `${login}@${data.domain}`;

  const first = await sb.auth.admin.createUser({
    email: plain, password: data.password, email_confirm: true,
  });
  if (first.data?.user) return { userId: first.data.user.id, email: plain };

  const taken = /already.*(registered|exists)|email_exists|duplicate/i.test(first.error?.message ?? "");
  if (!taken) throw first.error ?? new Error("Auth user creation failed");

  const { data: school } = await sb.from("schools").select("code").eq("id", data.school_id).maybeSingle();
  const code = String((school as { code?: string } | null)?.code ?? "")
    .toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!code) throw first.error ?? new Error("Auth user creation failed");

  const scoped = `${login}.${code}@${data.domain}`;
  const second = await sb.auth.admin.createUser({
    email: scoped, password: data.password, email_confirm: true,
  });
  if (!second.data?.user) throw second.error ?? new Error("Auth user creation failed");
  return { userId: second.data.user.id, email: scoped };
}

// ── STUDENTS ─────────────────────────────────────────────────────────────────

/**
 * Личные сведения ученика — колонки students, заведённые миграцией 232
 * (плюс phone, который был всегда и до сих пор ни разу не заполнялся).
 * Все необязательные: обязательными остаются ФИО, логин, пароль и группа.
 */
export type StudentPersonal = {
  birth_date?: string | null;
  gender?: string | null;
  phone?: string | null;
  file_no?: string | null;
};

/** Медицинские сведения — ОТДЕЛЬНАЯ таблица student_medical. Почему не
 *  колонки в students: строку ученика обязан читать учитель, а это он
 *  видеть не должен, и поколоночно в Supabase не спрятать (миграция 232). */
export type StudentMedical = {
  allergies?: string | null;
  medical_notes?: string | null;
};

/** Пустая строка из формы — это «не заполнено», а не пустое значение. */
function orNull(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
}

/**
 * Записать медицинские сведения ученика.
 *
 * СТРОКА ЗАВОДИТСЯ ТОЛЬКО ЕСЛИ ЕСТЬ ЧТО ЗАПИСАТЬ. Пустая строка на каждого
 * ученика — это тридцать одна запись «ничего не известно», которую потом
 * никто не отличит от «не заполняли». Если оба поля очистили, а строка
 * была — удаляем: отсутствие сведений и есть отсутствие строки.
 */
async function saveStudentMedical(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  studentId: string,
  schoolId: string,
  med: StudentMedical,
  updatedBy: string | null,
): Promise<void> {
  const allergies = orNull(med.allergies);
  const medical_notes = orNull(med.medical_notes);

  if (allergies === null && medical_notes === null) {
    const { error } = await sb.from("student_medical").delete().eq("student_id", studentId);
    if (error) throw error;
    return;
  }

  const { error } = await sb.from("student_medical").upsert(
    {
      student_id: studentId,
      school_id: schoolId,
      allergies,
      medical_notes,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "student_id" },
  );
  if (error) throw error;
}

export async function createStudent(data: {
  full_name: string;
  username: string;
  password: string;
  group_id: string;
  school_id: string;
  /** Почта Google для входа. Необязательна: без неё вход только по логину и
   *  паролю, как раньше. Нормализуется той же функцией, что у родителей. */
  google_email?: string | null;
  /** Личные сведения — все необязательные (миграция 232). */
  personal?: StudentPersonal;
  /** Медицинские сведения — уедут в student_medical, и только если
   *  админ что-то ввёл. */
  medical?: StudentMedical;
  /** Кто вносит — для отметки в student_medical.updated_by. */
  actor_user_id?: string | null;
}): Promise<{ userId: string; studentId: string }> {
  const sb = getServiceClient();
  // Z.2.10 — школьный адрес, если простой логин уже занят другой школой.
  const { userId } = await createSchoolScopedUser(sb, {
    username: data.username, password: data.password,
    domain: "students.snr.local", school_id: data.school_id,
  });
  const { data: student, error: stuErr } = await sb
    .from("students")
    .insert({
      user_id: userId,
      full_name: data.full_name,
      username: data.username,
      school_id: data.school_id,
      google_email: normalizeSocialEmail(data.google_email),
      birth_date: orNull(data.personal?.birth_date),
      gender: orNull(data.personal?.gender),
      phone: orNull(data.personal?.phone),
      file_no: orNull(data.personal?.file_no),
    })
    .select("id")
    .single();
  if (stuErr || !student) {
    await sb.auth.admin.deleteUser(userId);
    throw stuErr ?? new Error("Student insert failed");
  }

  // Z.2.7 — откат третьего шага. У первых двух он был, у этого нет: при сбое
  // привязки ученик оставался в базе без группы, а логин — занятым навсегда,
  // потому что учётная запись уже создана и username уникален. Админ видел
  // ошибку, повторял с тем же логином и получал «логин занят» от собственной
  // неудачной попытки.
  const { error: sgErr } = await sb
    .from("student_groups")
    .insert({ student_id: (student as { id: string }).id, group_id: data.group_id, school_id: data.school_id });
  if (sgErr) {
    await sb.from("students").delete().eq("id", (student as { id: string }).id);
    await sb.auth.admin.deleteUser(userId);
    throw sgErr;
  }

  // Медицинские сведения — последним шагом и только если их ввели. Своего
  // отката у него нет намеренно: ученик уже заведён и работает, а сбой
  // записи медкарты не повод его сносить. Ошибка доедет до админа текстом.
  if (data.medical) {
    await saveStudentMedical(
      sb,
      (student as { id: string }).id,
      data.school_id,
      data.medical,
      data.actor_user_id ?? null,
    );
  }

  return { userId, studentId: (student as { id: string }).id };
}

export async function updateStudent(
  studentId: string,
  userId: string,
  data: {
    full_name: string;
    username: string;
    group_id?: string;
    old_group_id?: string;
    google_email?: string | null;
    /** Личные сведения. В отличие от почты пишутся ВСЕГДА: форма рисует их
     *  текущим значением, поэтому пустое поле — это «очистить», а не «не
     *  трогали». Для почты приём другой (см. lib/form-patch.ts), потому что
     *  там пустота однажды затирала настоящий адрес при каждом сохранении. */
    personal?: StudentPersonal;
    medical?: StudentMedical;
    actor_user_id?: string | null;
  },
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "students", studentId, callerSchoolId, callerIsSuperAdmin);

  // google_email пишется, только если ключ ПРИСУТСТВУЕТ. Без этого условия
  // отсутствие поля в объекте означало бы undefined → normalizeSocialEmail
  // вернул бы null → почта затиралась бы при каждом сохранении. Вызывающий
  // передаёт ключ лишь тогда, когда поле действительно правили
  // (см. lib/form-patch.ts). Тот же приём, что в updateSchoolAdmin.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = { full_name: data.full_name, username: data.username };
  if ("google_email" in data) patch.google_email = normalizeSocialEmail(data.google_email);
  if (data.personal) {
    patch.birth_date = orNull(data.personal.birth_date);
    patch.gender = orNull(data.personal.gender);
    patch.phone = orNull(data.personal.phone);
    patch.file_no = orNull(data.personal.file_no);
  }

  const { error } = await sb
    .from("students")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch as any)
    .eq("id", studentId);
  if (error) throw error;

  // Z.2.7 — смена группы. Раньше здесь стояло
  //   if (group_id && old_group_id && group_id !== old_group_id)
  // и оба «И» делали операцию молчаливой пустышкой в двух случаях:
  //   • у ученика группы НЕ БЫЛО (old_group_id пуст) — назначить не удавалось;
  //   • группу УБИРАЮТ (group_id пуст) — исключить не удавалось.
  // Форма при этом рапортовала успех: ошибки нет, значит сохранилось.
  //
  // Теперь состав читается из базы, а не берётся из скрытого поля формы:
  // именно это поле и врало. old_group_id больше не нужен, параметр оставлен
  // ради совместимости вызовов.
  //
  // UI работает ровно с одной группой (решение заказчика 6.5), поэтому
  // приводим состав к одной строке; схема при этом остаётся способной на
  // несколько — PK у student_groups стоит на паре, ничего не сужаем.
  //
  // На student_groups висит trg_student_group_added_direct_chats: вставка
  // заводит личные чаты РЕАЛЬНОГО ученика с учителями группы. Здесь это одна
  // строка на действие админа — штатно.
  if (data.group_id !== undefined) {
    const desired = data.group_id.trim() || null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anySb = sb as any;
    const { data: current, error: curErr } = await anySb
      .from("student_groups").select("group_id").eq("student_id", studentId);
    if (curErr) throw curErr;
    const currentIds = ((current ?? []) as Array<{ group_id: string }>).map((r) => r.group_id);

    if (desired === null) {
      if (currentIds.length > 0) {
        const { error: delErr } = await anySb.from("student_groups").delete().eq("student_id", studentId);
        if (delErr) throw delErr;
      }
    } else if (!(currentIds.length === 1 && currentIds[0] === desired)) {
      // Заход 1: assertSameSchool выше подтвердил школу УЧЕНИКА; без этой
      // проверки админ мог бы перевести своего ученика в группу чужой школы.
      await assertSameSchool(sb, "groups", desired, callerSchoolId, callerIsSuperAdmin);
      const stale = currentIds.filter((id) => id !== desired);
      if (stale.length > 0) {
        const { error: delErr } = await anySb
          .from("student_groups").delete().eq("student_id", studentId).in("group_id", stale);
        if (delErr) throw delErr;
      }
      if (!currentIds.includes(desired)) {
        const { error: insErr } = await anySb
          .from("student_groups").insert({ student_id: studentId, group_id: desired, school_id: callerSchoolId });
        if (insErr) throw insErr;
      }
    }
  }

  // Медицинские сведения. Школа берётся у САМОГО ученика, а не у
  // вызывающего: суперадмин правит чужую школу, и его собственной у него нет.
  if (data.medical) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: owner, error: ownErr } = await (sb as any)
      .from("students").select("school_id").eq("id", studentId).single();
    if (ownErr) throw ownErr;
    await saveStudentMedical(
      sb,
      studentId,
      (owner as { school_id: string }).school_id,
      data.medical,
      data.actor_user_id ?? null,
    );
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

/** Пара «предмет справочника × группа» — одна строка блока «Предметы». */
export type TeacherAssignment = { catalog_id: string; group_id: string };

/**
 * Назначить учителю предметы ТОЙ ЖЕ функцией, что и экран «Назначения».
 *
 * Своей копии логики здесь нет намеренно: одно назначение трогает ТРИ
 * поверхности — subjects.teacher_id (право вести), group_teachers (право
 * видеть группу) и teachers.subject_slug (предметник или куратор). Вторая
 * копия рано или поздно забудет одну из них, и учитель получит право вести
 * уроки, не видя группы, — это уже было (Z.2.4).
 *
 * ПОЧЕМУ ОТКАЗ НЕ БРОСАЕТСЯ НАРУЖУ. Живая проверка показала беду: пара
 * «предмет × группа» уникальна, и если у группы уже есть учитель по этому
 * предмету, назначение падает. Учитель к этому моменту УЖЕ ЗАВЕДЁН — а
 * админ видел только «Этот предмет уже назначен этой группе» и читал это
 * как «ничего не создано». Повторная попытка упиралась в занятый логин.
 * Поэтому причина возвращается значением рядом с числом удавшихся, и окно
 * говорит обе правды сразу: человек заведён, предмет — нет, и почему.
 */
async function assignSubjectsToTeacher(
  teacherId: string,
  schoolId: string,
  assignments: TeacherAssignment[],
): Promise<{ assigned: number; failed: string[] }> {
  let сделано = 0;
  const отказы: string[] = [];
  for (const a of assignments) {
    if (!a.catalog_id || !a.group_id) continue;
    try {
      await createSubjectAssignment({
        catalog_id: a.catalog_id,
        group_id: a.group_id,
        teacher_id: teacherId,
        school_id: schoolId,
      });
      сделано += 1;
    } catch (e) {
      отказы.push(errorText(e));
    }
  }
  return { assigned: сделано, failed: отказы };
}

/** Текст отказа из чего угодно. Ошибка Supabase — обычный объект, а не
 *  Error, и String() дал бы «[object Object]»; имя нарушенного
 *  ограничения лежит в details — по нему экран и узнаёт причину. */
function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    const parts = [o.message, o.details, o.hint, o.code]
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    if (parts.length) return parts.join(" | ");
  }
  return String(e);
}

export async function createTeacher(data: {
  full_name: string;
  username: string;
  password: string;
  school_id: string;
  google_email?: string | null;
  /** Телефон и описание — колонки были всегда, заполнить их было негде. */
  phone?: string | null;
  bio?: string | null;
  /** Предметы прямо из окна создания: раньше это был отдельный экран, и
   *  пропустить его было легко — учитель есть, уроков не видит. */
  assignments?: TeacherAssignment[];
}): Promise<{ userId: string; teacherId: string; assigned: number; failed: string[] }> {
  const sb = getServiceClient();
  // Z.2.10 — школьный адрес, если простой логин уже занят другой школой.
  const { userId } = await createSchoolScopedUser(sb, {
    username: data.username, password: data.password,
    domain: "teachers.snr.local", school_id: data.school_id,
  });
  const { data: teacher, error: tErr } = await sb
    .from("teachers")
    .insert({
      user_id: userId,
      full_name: data.full_name,
      username: data.username,
      school_id: data.school_id,
      google_email: normalizeSocialEmail(data.google_email),
      phone: orNull(data.phone),
      bio: orNull(data.bio),
    })
    .select("id")
    .single();
  if (tErr || !teacher) {
    await sb.auth.admin.deleteUser(userId);
    throw tErr ?? new Error("Teacher insert failed");
  }

  // Назначения — последним шагом. Отката у них нет НАМЕРЕННО: учитель без
  // предмета — законное состояние (куратор), и сносить заведённого человека
  // из-за сбоя на предмете неправильно. Причина сбоя доедет до админа
  // текстом, а предмет можно доназначить на экране «Назначения».
  const итог = data.assignments?.length
    ? await assignSubjectsToTeacher((teacher as { id: string }).id, data.school_id, data.assignments)
    : { assigned: 0, failed: [] as string[] };

  return {
    userId,
    teacherId: (teacher as { id: string }).id,
    assigned: итог.assigned,
    failed: итог.failed,
  };
}

export async function updateTeacher(
  teacherId: string,
  userId: string,
  data: {
    full_name: string;
    username: string;
    google_email?: string | null;
    /** Пишутся всегда: форма рисует их текущим значением, значит пустое
     *  поле — это «очистить». Для почты приём другой, см. updateStudent. */
    phone?: string | null;
    bio?: string | null;
    /** ДОБАВЛЯЕМЫЕ назначения. Существующие снимаются списком под учителем
     *  и правятся на экране «Назначения» — здесь только новые. */
    assignments?: TeacherAssignment[];
  },
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
): Promise<{ assigned: number; failed: string[] }> {
  const sb = getServiceClient();
  await assertSameSchool(sb, "teachers", teacherId, callerSchoolId, callerIsSuperAdmin);

  // Почта — только если ключ присутствует, см. пояснение в updateStudent.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = { full_name: data.full_name, username: data.username };
  if ("google_email" in data) patch.google_email = normalizeSocialEmail(data.google_email);
  if ("phone" in data) patch.phone = orNull(data.phone);
  if ("bio" in data) patch.bio = orNull(data.bio);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await sb.from("teachers").update(patch as any).eq("id", teacherId);
  if (error) throw error;
  await sb.auth.admin.updateUserById(userId, {
    email: `${data.username.trim().toLowerCase()}@teachers.snr.local`,
  });

  // Школа берётся у САМОГО учителя: суперадмин правит чужую, своей у него нет.
  let итог = { assigned: 0, failed: [] as string[] };
  if (data.assignments?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: owner, error: ownErr } = await (sb as any)
      .from("teachers").select("school_id").eq("id", teacherId).single();
    if (ownErr) throw ownErr;
    итог = await assignSubjectsToTeacher(
      teacherId,
      (owner as { school_id: string }).school_id,
      data.assignments,
    );
  }

  return итог;
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
  /** Две поверхности привязки: назначения предметов и строки
   *  group_teachers. Снимаются вместе с учителем.
   *
   *  30.08.2026 — третьей, кураторства над группами, больше нет: роль
   *  убрана из продукта, groups.teacher_id пуст у всех групп. */
  assignments: number;
  groupLinks: number;
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

  const [lessons, plansBySubject, groupLinks, plansByTeacher, announcements,
    lessonGrades, hwApproved, leaveDecided, stageGraded] = await Promise.all([
    countOf("lessons", "subject_id", subjectIds),
    countOf("curriculum_plans", "subject_id", subjectIds),
    countOf("group_teachers", "teacher_id", teacherId),
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
    assignments: subjects.length, groupLinks,
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
 *   - строки `group_teachers` — удаляются.
 * Формально первое сделал бы сам FK (SET NULL), но явный шаг оставляет след
 * в логе и не зависит от того, что кто-то поменяет правило.
 *
 * 30.08.2026 — третьего шага, `groups.teacher_id → NULL`, здесь больше нет:
 * роль куратора убрана из продукта, колонка пуста у всех групп и заполнить
 * её неоткуда — поля в форме группы не осталось. Сам FK по-прежнему стоит
 * на SET NULL, то есть страховка никуда не делась.
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

// Z.2.6 — куратор (`groups.teacher_id`) стал НЕОБЯЗАТЕЛЬНЫМ: в реальных школах
// такой роли нет вовсе (решение заказчика 6.1), форма поле не показывает и
// присылает null. В демо-школе поле осталось и работает как раньше. Колонка
// nullable и была — схему не трогаем. Разделение ПРАВ куратора — это Z.4;
// здесь только форма.

/** Z.2.9 — две группы с одинаковым именем в школе неразличимы в каждом
 *  выпадающем списке приложения: расписание, назначения, перевод ученика.
 *  Ограничения в базе нет (добавление UNIQUE — отдельная миграция, здесь не
 *  делается: номер 180 уже занят родителями), поэтому проверяем в коде.
 *  Сравнение без учёта регистра и краевых пробелов — «7-А» и «7-а » для
 *  человека одно и то же. */
async function assertGroupNameFree(
  sb: ReturnType<typeof getServiceClient>,
  name: string,
  schoolId: string,
  exceptId?: string,
): Promise<void> {
  const { data, error } = await sb.from("groups").select("id, name").eq("school_id", schoolId);
  if (error) throw error;
  const needle = name.trim().toLowerCase();
  const clash = (data ?? []).some(
    (g) => g.id !== exceptId && (g.name ?? "").trim().toLowerCase() === needle,
  );
  if (clash) throw new Error("GROUP_NAME_TAKEN");
}

export async function createGroup(data: {
  name: string;
  subject: string;
  teacher_id: string | null;
  school_id: string;
  /** Заход 2 по платежам. undefined — формы без поля цены: тогда за значение
   *  отвечает DEFAULT 0 в базе, а не мы. */
  course_price?: number;
}): Promise<string> {
  const sb = getServiceClient();
  await assertGroupNameFree(sb, data.name, data.school_id);
  const { data: group, error } = await sb
    .from("groups")
    .insert({ ...data, teacher_id: data.teacher_id || null })
    .select("id")
    .single();
  if (error || !group) throw error ?? new Error("Group insert failed");
  return (group as { id: string }).id;
}

// ═══════════════════════════════════════════════════════════════════════════
// МАССОВОЕ СОЗДАНИЕ ГРУПП. Пункт 227, 03.09.2026.
//
// ЗАЧЕМ. «Создать классы с первого по двенадцатый разом, а не по одному».
// Сегодня группа заводится за 6 нажатий, и окно закрывается после каждого
// сохранения: двенадцать классов — двенадцать заходов.
//
// ═══ ПОЧЕМУ НЕ «ДИАПАЗОН С 1 ПО 12» ═══════════════════════════════════════
//
// Живые имена групп 03.09.2026 распадаются на три семейства, и диапазон
// покрывает только первое:
//
//   3-А класс, 7-А класс, 10-А класс          школьные классы
//   Science 1-класс, SNR Робототехника         предметные группы центра
//   G-7, W-5, Test Group                       короткие коды
//
// Поэтому основа формы — ПРАВИМЫЙ СПИСОК ИМЁН, а диапазон с шаблоном лишь
// его заполняет. Школа жмёт «Подставить», центр печатает или вставляет своё.
// Сам список и есть показ до согласия: видно не «будет создано 24», а
// двадцать четыре имени.
//
// ═══ ЧТО ВЫНЕСЕНО ИЗ ЦИКЛА ════════════════════════════════════════════════
//
// createGroup на каждую группу вызывает assertGroupNameFree, а та вычитывает
// ВСЕ группы школы целиком — плюс actionCreateGroup делает после каждой
// вставки два revalidatePath. Тридцать групп по одной — тридцать полных
// чтений и тридцать сбросов кэша.
//
//   было:  30 × (чтение всех групп + вставка) + 60 сбросов кэша
//   стало: 1 чтение + 30 вставок + 2 сброса
//
// И это не только про скорость. Чтение из базы НЕ ВИДИТ повторов внутри
// самой пачки: двенадцать имён, среди которых два одинаковых, пройдут
// проверку все двенадцать раз. Множество имён живёт здесь, в памяти, и
// пополняется по ходу — поэтому повтор внутри пачки ловится тоже.
//
// Вторая линия — уникальный индекс из миграции 249. Он ловит и гонку, и
// двойной клик; проверка здесь остаётся первой, потому что умеет назвать,
// какое именно имя занято, а индекс умеет только отказать.

/** Имя, которое делать не будем, и почему. */
export type BulkGroupBlocked = {
  name: string;
  /** `taken` — такая группа в школе уже есть; `dup` — имя повторяется внутри
   *  самого списка. Для человека это разные новости. */
  reason: "taken" | "dup";
};

export type BulkGroupsResult = {
  created: number;
  /** Пары, не прошедшие запись. Частичный отказ не теряет созданного — то же
   *  правило, что у assignSubjectsToTeacher и массового назначения. */
  failed: Array<{ name: string; reason: string }>;
  /** Отсеянные ДО записи: занятые и повторы внутри списка. */
  blocked: BulkGroupBlocked[];
};

// groupNameKey сюда НЕ дублируется. Она живёт в ядре
// (packages/core/src/utils/groupNames.ts) и зовётся оттуда и формой, и этим
// слоем: форма считает занятость на клиенте, сервер — при записи, и считать
// они обязаны одинаково. В этом проекте копии правил расходились семь раз.

/**
 * Завести несколько групп разом.
 *
 * ОДНО ЧТЕНИЕ НА ВСЮ ПАЧКУ. Дальше только вставки; множество занятых имён
 * пополняется по ходу, поэтому повтор внутри списка ловится без похода в
 * базу.
 *
 * Предмет и цена — одни на всю пачку. Решение заказчика: живые цены внутри
 * каждой школы одинаковы (1 500 000 / 800 000 / 0), а правка цены отдельной
 * группы и так в одном клике. Двенадцать полей цены в форме — это двенадцать
 * шансов промахнуться.
 */
export async function createGroupsBulk(input: {
  names: string[];
  subject: string;
  coursePrice: number;
  schoolId: string;
}): Promise<BulkGroupsResult> {
  // ПОТОЛОК ТОТ ЖЕ, ЧТО У ПОДСТАНОВКИ ШАБЛОНА. Форма не даст набрать больше,
  // но она не единственный способ сюда попасть: действие открыто любому
  // админу школы, и список приходит JSON-строкой. Отказ внятный, а не
  // молчаливое обрезание — обрезать пачку наполовину хуже, чем не начать.
  if (input.names.length > GROUP_BULK_MAX) throw new Error("TOO_MANY_GROUPS");

  const sb = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;

  // ── постоянная часть: одно чтение ──
  const { data: сущ, error: readErr } = await anySb
    .from("groups").select("id, name").eq("school_id", input.schoolId);
  if (readErr) throw readErr;

  const занято = new Set<string>(
    ((сущ ?? []) as Array<{ name: string | null }>).map((g) => groupNameKey(g.name ?? "")),
  );

  const итог: BulkGroupsResult = { created: 0, failed: [], blocked: [] };
  // Внутри пачки повтор — отдельная новость: человек мог опечататься в
  // списке, и сказать ему «занято» было бы неправдой.
  const встречалось = new Set<string>();

  for (const сырое of input.names) {
    const name = сырое.trim();
    if (!name) continue;
    const ключ = groupNameKey(name);

    if (встречалось.has(ключ)) {
      итог.blocked.push({ name, reason: "dup" });
      continue;
    }
    встречалось.add(ключ);

    if (занято.has(ключ)) {
      итог.blocked.push({ name, reason: "taken" });
      continue;
    }

    try {
      const { error } = await anySb.from("groups").insert({
        name,
        subject: input.subject,
        teacher_id: null,
        // school_id ЯВНО. Служебный ключ обходит RLS, auth.uid() там пуст, и
        // умолчание current_school_id() дало бы NULL против NOT NULL. Та же
        // ловушка, что уже ловила нас на lesson_stages и quiz_questions.
        school_id: input.schoolId,
        course_price: input.coursePrice,
      });
      if (error) throw error;
      итог.created += 1;
      // Занимаем имя сразу: следующая строка списка должна видеть эту.
      занято.add(ключ);
    } catch (e) {
      итог.failed.push({ name, reason: errorText(e) });
    }
  }

  return итог;
}

// ═══════════════════════════════════════════════════════════════════════════
// ЕДИНОЕ ОКНО СОЗДАНИЯ. Пункт 228, 03.09.2026.
//
// ЗАЧЕМ. «Создать группу, завести предметы и назначить учителя — в одном
// месте, а не ходить по трём экранам». Экранов на деле ЧЕТЫРЕ: учителя
// заводятся только на /admin/teachers, и без него связка неполная.
//
// Счёт для сценария «новая школа, один класс, три предмета, один учитель»:
//
//   учитель уже есть   27 нажатий + 2 перехода = 29 действий
//   учителя нет        31 нажатие  + 3 перехода = 34 действия
//
// ═══ ПОРЯДОК НА ЭКРАНЕ И ПОРЯДОК ВНУТРИ — РАЗНЫЕ ══════════════════════════
//
// Человек видит: группа → предметы → учитель, как и просил заказчик.
//
// Записывается наоборот: СПРАВОЧНИК → ГРУППА → НАЗНАЧЕНИЯ. Иначе нельзя:
// groups.subject объявлен NOT NULL и заполняется записью справочника, а
// назначение требует готовую группу. Окно прячет этот порядок, а не спорит
// с ним.
//
// ═══ groups.subject НЕ СПРАШИВАЕТСЯ ═══════════════════════════════════════
//
// Колонка досталась от модели «группа = один курс» и сегодня декоративна:
// она держит слаг ради цвета и значка, а настоящая связка живёт в subjects.
// Спрашивать у человека «какой предмет у класса», когда предметов у класса
// будет три, — значит задавать вопрос, ответ на который ни на что не влияет.
// Подставляем первый выбранный.
//
// ═══ ЧТО ПЕРЕИСПОЛЬЗУЕТСЯ, А ЧТО НЕТ ══════════════════════════════════════
//
//   createSchoolSubject   — один круг, отдаёт id;
//   createGroup           — отдаёт id (он нам нужен для назначений) и сам
//                           зовёт assertGroupNameFree;
//   applyBulkAssignment   — вчерашняя, с одним разбором пар на план и запись.
//
// createGroupsBulk НЕ подходит: она не возвращает идентификаторов созданных
// групп (тип BulkGroupsResult — только числа), а нам нужен id, чтобы завести
// назначения. Плюс предмет у неё один на всю пачку.

/** Что просит единое окно. */
export type QuickStartInput = {
  groupName: string;
  coursePrice: number;
  /** Записи справочника, выбранные галочками. */
  catalogIds: string[];
  /** Имена предметов, которых в справочнике ещё нет — заведём по дороге. */
  newSubjectNames: string[];
  teacherId: string | null;
  schoolId: string;
};

export type QuickStartResult = {
  groupId: string;
  groupName: string;
  /** Сколько записей справочника завели по дороге. */
  subjectsCreated: number;
  /** Имена, которые завести не вышло, с причиной. Частичный отказ не теряет
   *  прошедшего: группа создаётся даже если один предмет не завёлся. */
  subjectsFailed: Array<{ name: string; reason: string }>;
  /** Итог назначений — тот же тип, что у массового назначения. */
  assignments: BulkAssignResult;
};

/** Списки для единого окна: справочник, группы и учителя одним походом.
 *
 *  ГРУЗИТСЯ ПО ОТКРЫТИЮ ОКНА, А НЕ НА КАЖДЫЙ ЗАХОД НА ДАШБОРД. Дашборд и без
 *  того делает одиннадцать счётных запросов; вешать на него три списка ради
 *  окна, которое открывают раз в жизни школы, было бы платой ни за что. */
export async function getQuickStartData(schoolId: string): Promise<{
  catalog: Array<{ id: string; name: string; is_active: boolean }>;
  groups: Array<{ id: string; name: string }>;
  teachers: Array<{ id: string; full_name: string }>;
}> {
  const sb = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;
  const [cat, grp, tch] = await Promise.all([
    anySb.from("school_subjects").select("id, name, is_active").eq("school_id", schoolId).order("name"),
    anySb.from("groups").select("id, name").eq("school_id", schoolId).order("name"),
    anySb.from("teachers").select("id, full_name").eq("school_id", schoolId).order("full_name"),
  ]);
  if (cat.error) throw cat.error;
  if (grp.error) throw grp.error;
  if (tch.error) throw tch.error;
  return { catalog: cat.data ?? [], groups: grp.data ?? [], teachers: tch.data ?? [] };
}

/**
 * Завести группу, предметы и назначения одним действием.
 *
 * ЧАСТИЧНЫЙ ОТКАЗ НЕ ТЕРЯЕТ ПРОШЕДШЕГО. Предмет, который не завёлся, уезжает
 * в subjectsFailed, а группа всё равно создаётся: терять её из-за одного
 * названия было бы хуже, чем сказать правду про оба.
 *
 * ОТКАЗ ГРУППЫ — ДРУГОЕ ДЕЛО. Без неё назначать нечего, поэтому он бросается
 * наружу и доезжает до человека фразой (GROUP_NAME_TAKEN или
 * groups_school_name_unique_idx — humanizeAdminError знает оба).
 */
export async function quickStartGroup(input: QuickStartInput): Promise<QuickStartResult> {
  const sb = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;

  // ── 1. СПРАВОЧНИК ─────────────────────────────────────────────────────
  //
  // Одно чтение на всю пачку, а не по чтению на имя. Заодно оно и даёт
  // сравнение без регистра: в базе на school_subjects стоит UNIQUE
  // (school_id, name) — С УЧЁТОМ регистра, и «робототехника» спокойно
  // ложится рядом с «Робототехника» (проверено прогоном с откатом
  // 03.09.2026). Два почти одинаковых предмета в списке — это загадка для
  // следующего человека, поэтому регистр отбиваем ЗДЕСЬ. Уникальность в
  // базе не трогаем: это отдельная миграция, заказчик записал.
  const { data: existingCat, error: catErr } = await anySb
    .from("school_subjects").select("id, name").eq("school_id", input.schoolId);
  if (catErr) throw catErr;

  // Две карты сразу: по ключу без регистра — чтобы отбить двойника, и по
  // идентификатору — чтобы потом подставить имя в groups.subject, не ходя за
  // ним второй раз.
  const поКлючу = new Map<string, string>();
  const имяПоId = new Map<string, string>();
  for (const r of ((existingCat ?? []) as Array<{ id: string; name: string }>)) {
    поКлючу.set(r.name.trim().toLowerCase(), r.id);
    имяПоId.set(r.id, r.name);
  }

  const catalogIds = [...input.catalogIds];
  const subjectsFailed: QuickStartResult["subjectsFailed"] = [];
  let subjectsCreated = 0;

  for (const сырое of input.newSubjectNames) {
    const name = сырое.trim();
    if (!name) continue;
    const ключ = name.toLowerCase();

    // Уже есть под другим регистром — берём существующую запись, а не
    // заводим двойника. Молча: человек хотел этот предмет, он его и получит.
    const было = поКлючу.get(ключ);
    if (было) {
      if (!catalogIds.includes(было)) catalogIds.push(было);
      continue;
    }

    try {
      const id = await createSchoolSubject({
        name,
        // Значок и цвет — те же умолчания, что у формы справочника при
        // неизвестном названии. Известные названия получат своё оформление
        // на экране справочника при первой правке.
        icon: "BookOpen",
        color: "#64748B",
        school_id: input.schoolId,
      });
      поКлючу.set(ключ, id);
      имяПоId.set(id, name);
      catalogIds.push(id);
      subjectsCreated += 1;
    } catch (e) {
      subjectsFailed.push({ name, reason: errorText(e) });
    }
  }

  // ── 2. ГРУППА ─────────────────────────────────────────────────────────
  //
  // groups.subject подставляется первым выбранным предметом, а не
  // спрашивается. Если предметов не выбрано вовсе — пустая строка: колонка
  // NOT NULL, но пустоту она допускает (у всех десяти живых групп там слаг,
  // но ограничения на непустоту нет).
  const первый = catalogIds[0] ? (имяПоId.get(catalogIds[0]) ?? "") : "";
  const groupId = await createGroup({
    name: input.groupName.trim(),
    subject: первый ? (getSubjectKeyByLabel(первый) ?? первый) : "",
    teacher_id: null,
    school_id: input.schoolId,
    course_price: input.coursePrice,
  });

  // ── 3. НАЗНАЧЕНИЯ ─────────────────────────────────────────────────────
  //
  // Вчерашняя функция целиком: она сама разложит пары, сама поставит
  // group_teachers один раз на группу и сама вернёт частичный отказ по
  // каждой паре. Группа только что создана, значит занятых пар в ней быть
  // не может — но проверку она всё равно сделает, и это правильно: между
  // созданием и назначением кто-то мог успеть.
  const assignments = catalogIds.length
    ? await applyBulkAssignment({
        catalogIds,
        groupIds: [groupId],
        teacherId: input.teacherId,
        schoolId: input.schoolId,
      })
    : { created: 0, assigned: 0, failed: [] };

  return {
    groupId,
    groupName: input.groupName.trim(),
    subjectsCreated,
    subjectsFailed,
    assignments,
  };
}

export async function updateGroup(
  groupId: string,
  data: { name: string; subject: string; teacher_id?: string | null; course_price?: number },
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "groups", groupId, callerSchoolId, callerIsSuperAdmin);
  await assertGroupNameFree(sb, data.name, callerSchoolId, groupId);

  // teacher_id пишется, только если форма его прислала. Для реальных школ
  // поля в форме нет — и существующий куратор (если он там откуда-то есть)
  // не должен молча обнуляться при переименовании группы.
  const patch: Record<string, unknown> = { name: data.name, subject: data.subject };
  if (data.teacher_id !== undefined) patch.teacher_id = data.teacher_id || null;
  // Цена — по тому же правилу, что куратор: пишем, только если форма её
  // прислала. Пустое поле формы — это ноль и он приедет числом; молчание
  // формы не должно обнулять уже заданную цену.
  if (data.course_price !== undefined) patch.course_price = data.course_price;

  const { error } = await sb.from("groups").update(patch).eq("id", groupId);
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

/** Демо-школа. Отличается от реальных двумя вещами, важными для админки:
 *  в ней есть роль куратора группы (в реальных школах её нет, решение 6.1) и
 *  в ней НЕ трогается teachers.subject_slug. */
/**
 * Демо ли школа — по признаку `schools.is_demo`, а не по вписанному
 * идентификатору. Признак в проекте один; вписанный номер молча разошёлся бы
 * со второй демо-школой или с переездом идентификатора.
 *
 * Читает служебным клиентом: вызывается из серверных действий админки, где
 * пользовательский клиент видит только свою школу (миграция 190).
 */
export async function isDemoSchool(schoolId: string): Promise<boolean> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("schools")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("is_demo" as any)
    .eq("id", schoolId)
    .maybeSingle();
  if (error) throw error;
  return Boolean((data as { is_demo: boolean } | null)?.is_demo);
}

export type TeacherBinding = {
  assignmentId: string;
  subjectName: string;
  groupId: string;
  groupName: string;
  /** Куратор группы — отдельная роль, показывается рядом для полноты картины. */
  // 30.08.2026 — поля isCurator больше нет: роль куратора убрана из продукта.
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
    seesGroup: seen.has(a.group_id),
    lessons: lessonsBy.get(a.id) ?? 0,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// МАССОВОЕ НАЗНАЧЕНИЕ: предмет(ы) × группы × один учитель. 03.09.2026.
//
// ЗАЧЕМ. Учитель ведёт математику с первого по шестой класс. Сегодня его
// привязывают к каждой группе отдельно: восемь нажатий на одно назначение,
// сорок восемь на шесть групп, причём предмет и учитель выбираются заново
// каждый раз.
//
// ═══ ДВЕ ОПЕРАЦИИ, А НЕ ОДНА ══════════════════════════════════════════════
//
// В просьбе «назначить на несколько групп» спрятаны две разные вещи, и живые
// числа 03.09.2026 показали, что нужны обе:
//
//   A. проставить учителя там, где предмет в группе УЖЕ заведён без него;
//   B. завести предмет в группе, где его ещё нет, сразу с учителем.
//
// Свободных назначений (случай A) на всю базу было 14, и ВСЕ в демо-школе.
// В боевых школах — ноль: там любое новое назначение это создание строки.
// Форма только для A досталась бы витрине и никому больше.
//
// ═══ ЗАНЯТЫЕ ЧУЖИМ УЧИТЕЛЕМ НЕ ПЕРЕБИВАЮТСЯ ═══════════════════════════════
//
// Решение заказчика. Перебивка одним махом — это тихая потеря доступа у
// прежнего учителя: setAssignmentTeacher на такое умеет отвечать («предмет
// снят, доступ к группе потерян»), а пачка на тридцать строк не сумеет
// рассказать это про каждую. Занятые показываются занятыми, с именем.
//
// ═══ ПОЧЕМУ ЭТО НЕ ОДИН UPDATE ════════════════════════════════════════════
//
// На subjects.teacher_id висят два чат-триггера. Замер 03.09.2026 на живой
// базе, всё в транзакциях с откатом:
//
//   одно назначение, группа из 10 учеников → +10 веток, +21 участник
//   ВТОРОЙ предмет тому же учителю в той же группе → +0, +0
//   три группы по 10 одному учителю → +30 веток, +63 участника
//
// Ветка заводится на пару «ученик + учитель», а не на назначение, и всё
// идемпотентно. Сами триггеры дёшевы: по часам базы 2,5 мс при нуле учеников
// и 4,8 мс при десяти.
//
// ═══ ЧТО ЗДЕСЬ ВЫНЕСЕНО ИЗ ЦИКЛА ══════════════════════════════════════════
//
// Настоящая опасность не в чатах, а в кругах до базы. createSubjectAssignment
// делает на КАЖДОЕ назначение 4 обращения в демо-школе и до 6 в боевой:
// чтение справочника, вставка, group_teachers, isDemoSchool, чтение и запись
// subject_slug. Тридцать назначений — 120–180 последовательных кругов, и
// упрётся в потолок функции именно это.
//
// Здесь постоянная часть прочитана ОДИН раз на всю пачку, а group_teachers
// пишется один раз на группу, а не на пару:
//
//   было:  30 пар × 4 (демо) или × 5..6 (боевая)   = 120..180 кругов
//   стало: 3 постоянных + 30 пар + 6 групп + до 2   = 41 круг
//
// Счёт «стало» проверен по коду: три чтения в разложитьПары, по одной записи
// на пару, по одной на задетую группу и до двух на subject_slug — он у
// учителя один, поэтому пишется однажды на всю пачку, а не на каждый предмет.
//
// Второй копии логики это не заводит: пары раскладывает один разбор
// (разложитьПары), и план, и запись зовут его же.

export type BulkAssignPair = { catalogId: string; groupId: string };

/** Пара, которую делать не будем, и почему. Имя занявшего нужно человеку:
 *  «занято» без имени не говорит, к кому идти. */
export type BulkAssignBlocked = {
  catalogId: string;
  groupId: string;
  subjectName: string;
  groupName: string;
  /** Кто уже ведёт. null — строка есть, но учителя у неё нет (такого сюда не
   *  попадает) либо имя не прочиталось. */
  teacherName: string | null;
  reason: "occupied" | "already_this_teacher";
};

export type BulkAssignPlan = {
  /** Новых строк subjects (случай B). */
  willCreate: number;
  /** Существующих строк без учителя, которым он проставится (случай A). */
  willAssign: number;
  blocked: BulkAssignBlocked[];
  chats: {
    /** Новых личных веток: ученики выбранных групп, у кого ветки с этим
     *  учителем ещё нет. */
    newThreads: number;
    /** Две строки на ветку плюс до одной в классной ветке каждой задетой
     *  группы. */
    newParticipants: number;
    /**
     * ТИХИЙ НОЛЬ. fn_ensure_direct_chat молча выходит, если у ученика или у
     * учителя нет user_id, — ни ошибки, ни следа. Значит показать «заведётся
     * 300 чатов» и завести ноль можно совершенно незаметно.
     *
     * Такие ученики посчитаны отдельно и из newThreads ИСКЛЮЧЕНЫ: заказчик
     * просил, чтобы число было честным.
     */
    silentStudents: number;
    /** У учителя нет учётной записи — не заведётся НИ ОДНОГО чата. */
    teacherHasNoAccount: boolean;
  };
};

export type BulkAssignResult = {
  created: number;
  assigned: number;
  /** Пары, которые не прошли, с причиной у каждой. Частичный отказ не теряет
   *  прошедшего — то же правило, что у assignSubjectsToTeacher. */
  failed: Array<{ subjectName: string; groupName: string; reason: string }>;
};

type РазборПар = {
  создать: Array<{ catalogId: string; groupId: string; name: string; icon: string; color: string }>;
  проставить: Array<{ subjectId: string; catalogId: string; groupId: string; name: string }>;
  blocked: BulkAssignBlocked[];
  /** Группы, которых коснёмся: по одной строке group_teachers на каждую. */
  группы: string[];
  имена: { предметы: Map<string, string>; группы: Map<string, string> };
};

/**
 * Разложить выбранное на «создать», «проставить» и «занято».
 *
 * ОДИН разбор на план и на запись. Если бы их было два, показанное число и
 * сделанное разошлись бы — ровно та беда, из-за которой массовое создание
 * уроков считает предпросмотр тем же кодом, которым потом создаёт.
 */
async function разложитьПары(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  catalogIds: string[],
  groupIds: string[],
  teacherId: string | null,
  schoolId: string,
): Promise<РазборПар> {
  // ── постоянная часть: читается один раз на всю пачку, а не на каждую пару ──
  const { data: catRows, error: catErr } = await sb
    .from("school_subjects")
    .select("id, name, icon, color, school_id")
    .in("id", catalogIds);
  if (catErr) throw catErr;
  const справочник = new Map<string, { id: string; name: string; icon: string; color: string }>();
  for (const c of (catRows ?? []) as Array<{ id: string; name: string; icon: string; color: string; school_id: string }>) {
    // Чужая школа отсеивается здесь, а не проверкой на каждую пару.
    if (c.school_id !== schoolId) continue;
    справочник.set(c.id, { id: c.id, name: c.name, icon: c.icon, color: c.color });
  }

  const { data: grpRows, error: grpErr } = await sb
    .from("groups").select("id, name, school_id").in("id", groupIds);
  if (grpErr) throw grpErr;
  const группыИмена = new Map<string, string>();
  for (const g of (grpRows ?? []) as Array<{ id: string; name: string; school_id: string }>) {
    if (g.school_id === schoolId) группыИмена.set(g.id, g.name);
  }

  // Что уже стоит в этих группах. Одно чтение на всю пачку.
  const { data: сущ, error: сущErr } = await sb
    .from("subjects")
    .select("id, name, catalog_id, group_id, teacher_id, teacher:teachers(full_name)")
    .in("group_id", [...группыИмена.keys()]);
  if (сущErr) throw сущErr;

  type Строка = {
    id: string; name: string; catalog_id: string | null; group_id: string;
    teacher_id: string | null; teacher: { full_name: string } | null;
  };
  // ЗАНЯТОСТЬ ИЩЕТСЯ ПО ИМЕНИ, А НЕ ПО catalog_id. Уникальность в базе —
  // UNIQUE (name, group_id), проверено на живой схеме 03.09.2026. Строка,
  // заведённая до появления справочника, имеет catalog_id = null, но имя
  // занимает, и вставка на неё упадёт. Ключ по catalog_id такую пару
  // проглядел бы, и «создастся 6» превратилось бы в «создалось 4».
  const поИмени = new Map<string, Строка>();
  for (const r of (сущ ?? []) as Строка[]) поИмени.set(`${r.group_id}::${r.name}`, r);

  const разбор: РазборПар = {
    создать: [], проставить: [], blocked: [], группы: [],
    имена: { предметы: new Map(), группы: группыИмена },
  };
  const задетые = new Set<string>();

  for (const catalogId of catalogIds) {
    const cat = справочник.get(catalogId);
    if (!cat) continue;
    разбор.имена.предметы.set(catalogId, cat.name);
    for (const groupId of группыИмена.keys()) {
      const было = поИмени.get(`${groupId}::${cat.name}`);
      if (!было) {
        разбор.создать.push({ catalogId, groupId, name: cat.name, icon: cat.icon, color: cat.color });
        задетые.add(groupId);
        continue;
      }
      if (было.teacher_id === null) {
        разбор.проставить.push({ subjectId: было.id, catalogId, groupId, name: cat.name });
        задетые.add(groupId);
        continue;
      }
      // Занято. Своим же учителем — это «уже сделано», а не отказ; чужим —
      // показываем имя и не трогаем.
      разбор.blocked.push({
        catalogId,
        groupId,
        subjectName: cat.name,
        groupName: группыИмена.get(groupId) ?? "—",
        teacherName: было.teacher?.full_name ?? null,
        reason: было.teacher_id === teacherId ? "already_this_teacher" : "occupied",
      });
    }
  }
  разбор.группы = [...задетые];
  return разбор;
}

/**
 * Посчитать, что произойдёт, НИЧЕГО НЕ ЗАПИСЫВАЯ.
 *
 * Тот же приём, что у массового создания уроков: предпросмотр считает тем же
 * кодом, которым потом пишет.
 *
 * ПОЧЕМУ СЧЁТ ЧАТОВ НЕ НА КЛИЕНТЕ, хотя собирались именно так. Точное число
 * требует трёх вещей, которых на странице нет и быть не должно: сколько
 * учеников в каждой группе, с кем из них у этого учителя ветка уже есть, и
 * есть ли у всех учётные записи. Первое можно было бы дотащить; второе — это
 * «ученики × учителя» строк, в боевой школе тысячи; третье клиенту не видно
 * вовсе. Заказчик просил, чтобы число было честным, — а честным на клиенте
 * оно быть не может.
 */
export async function planBulkAssignment(input: {
  catalogIds: string[];
  groupIds: string[];
  teacherId: string | null;
  schoolId: string;
}): Promise<BulkAssignPlan> {
  const sb = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;
  const разбор = await разложитьПары(anySb, input.catalogIds, input.groupIds, input.teacherId, input.schoolId);

  const план: BulkAssignPlan = {
    willCreate: разбор.создать.length,
    willAssign: разбор.проставить.length,
    blocked: разбор.blocked,
    chats: { newThreads: 0, newParticipants: 0, silentStudents: 0, teacherHasNoAccount: false },
  };
  // Без учителя чатов не бывает вовсе: оба триггера выходят первой строкой
  // при teacher_id IS NULL. Это же делает массовое СНЯТИЕ бесплатным.
  if (!input.teacherId || разбор.группы.length === 0) return план;

  const { data: teacher } = await anySb
    .from("teachers").select("user_id").eq("id", input.teacherId).maybeSingle();
  const учительБезАккаунта = !(teacher as { user_id: string | null } | null)?.user_id;
  план.chats.teacherHasNoAccount = учительБезАккаунта;

  const { data: зачисления } = await anySb
    .from("student_groups").select("student_id, group_id").in("group_id", разбор.группы);
  const ученики = [...new Set(((зачисления ?? []) as Array<{ student_id: string }>).map((r) => r.student_id))];
  if (ученики.length === 0) return план;

  const { data: рядыУчеников } = await anySb
    .from("students").select("id, user_id").in("id", ученики);
  const безАккаунта = new Set(
    ((рядыУчеников ?? []) as Array<{ id: string; user_id: string | null }>)
      .filter((r) => !r.user_id).map((r) => r.id),
  );

  // С кем ветка уже есть — ровно те, за кого платить не придётся. Это и есть
  // причина, по которой второй предмет тому же учителю в той же группе стоит
  // ноль: все ветки уже стоят.
  const { data: ветки } = await anySb
    .from("chat_threads").select("student_id")
    .eq("kind", "direct").eq("teacher_id", input.teacherId).in("student_id", ученики);
  const ужеЕсть = new Set(((ветки ?? []) as Array<{ student_id: string | null }>).map((r) => r.student_id));

  const новые = ученики.filter((id) => !ужеЕсть.has(id) && !безАккаунта.has(id));
  план.chats.silentStudents = ученики.filter((id) => безАккаунта.has(id)).length;
  план.chats.newThreads = учительБезАккаунта ? 0 : новые.length;
  // Две строки участников на ветку плюс до одной на классную ветку каждой
  // задетой группы: там ON CONFLICT DO NOTHING, поэтому «до».
  план.chats.newParticipants = учительБезАккаунта ? 0 : новые.length * 2 + разбор.группы.length;
  return план;
}

/**
 * Применить массовое назначение.
 *
 * ЧАСТИЧНЫЙ ОТКАЗ НЕ ТЕРЯЕТ ПРОШЕДШЕГО — то же правило, что у
 * assignSubjectsToTeacher и у массовой переклички: каждая пара идёт своим
 * запросом, прошедшие остаются, о непрошедших человеку говорят числом и
 * причиной. Одной пачкой INSERT сделать нельзя именно поэтому: одна занятая
 * пара уронила бы все тридцать.
 */
export async function applyBulkAssignment(input: {
  catalogIds: string[];
  groupIds: string[];
  teacherId: string | null;
  schoolId: string;
}): Promise<BulkAssignResult> {
  const sb = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySb = sb as any;
  const разбор = await разложитьПары(anySb, input.catalogIds, input.groupIds, input.teacherId, input.schoolId);

  const итог: BulkAssignResult = { created: 0, assigned: 0, failed: [] };
  const имяГруппы = (id: string) => разбор.имена.группы.get(id) ?? "—";

  for (const строка of разбор.создать) {
    try {
      const { error } = await anySb.from("subjects").insert({
        catalog_id: строка.catalogId,
        name: строка.name,
        icon: строка.icon,
        color: строка.color,
        group_id: строка.groupId,
        teacher_id: input.teacherId,
        school_id: input.schoolId,
      });
      if (error) throw error;
      итог.created += 1;
    } catch (e) {
      итог.failed.push({ subjectName: строка.name, groupName: имяГруппы(строка.groupId), reason: errorText(e) });
    }
  }

  for (const строка of разбор.проставить) {
    try {
      // Условие «teacher_id is null» в самом UPDATE — защита от гонки: если
      // между разбором и записью пару занял кто-то другой, мы обновим ноль
      // строк и НЕ перебьём чужого учителя. Молча пропустить такое нельзя,
      // поэтому случай уезжает в failed своей строкой.
      const { data, error } = await anySb
        .from("subjects").update({ teacher_id: input.teacherId })
        .eq("id", строка.subjectId).is("teacher_id", null).select("id");
      if (error) throw error;
      if (!((data ?? []) as unknown[]).length) {
        итог.failed.push({
          subjectName: строка.name,
          groupName: имяГруппы(строка.groupId),
          reason: "Пару занял другой учитель, пока шло сохранение",
        });
        continue;
      }
      итог.assigned += 1;
    } catch (e) {
      итог.failed.push({ subjectName: строка.name, groupName: имяГруппы(строка.groupId), reason: errorText(e) });
    }
  }

  // ── вторая и третья поверхности: по одному разу, а не на каждую пару ──
  if (input.teacherId && (итог.created > 0 || итог.assigned > 0)) {
    for (const groupId of разбор.группы) {
      try {
        await linkTeacherToGroup(anySb, groupId, input.teacherId, input.schoolId);
      } catch (e) {
        итог.failed.push({ subjectName: "—", groupName: имяГруппы(groupId), reason: errorText(e) });
      }
    }
    // subject_slug ставится ОДИН раз на всю пачку: он у учителя один, и
    // ensureSubjectSlug всё равно пишет только в пустое. Проверка на
    // демо-школу внутри неё же, поэтому isDemoSchool здесь не дублируется.
    const первыйСоСлагом = [...разбор.имена.предметы.values()].find((n) => getSubjectKeyByLabel(n));
    if (первыйСоСлагом) {
      try {
        await ensureSubjectSlug(anySb, input.teacherId, первыйСоСлагом, input.schoolId);
      } catch {
        // Слаг — украшение карточки, а не право. Ронять из-за него пачку,
        // которая уже прошла, нельзя.
      }
    }
  }
  return итог;
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
): Promise<boolean> {
  const { count: others } = await sb
    .from("subjects").select("id", { count: "exact", head: true })
    .eq("group_id", groupId).eq("teacher_id", teacherId);
  if ((others ?? 0) > 0) return false;

  const { data: group } = await sb.from("groups").select("teacher_id").eq("id", groupId).maybeSingle();
  if (group?.teacher_id === teacherId) return false;

  // 03.09.2026, пункт 103. Возвращаем ФАКТ, а не намерение: строки в
  // group_teachers могло и не быть вовсе, и тогда доступ никто не терял.
  // Считается это бесплатно — удаление и так выполняется, просто раньше его
  // результат выбрасывался.
  const { data: удалено, error } = await sb
    .from("group_teachers").delete()
    .eq("group_id", groupId).eq("teacher_id", teacherId)
    .select("teacher_id");
  if (error) throw error;
  return ((удалено ?? []) as unknown[]).length > 0;
}

/**
 * Проставляет subject_slug при первом назначении — только в реальных школах и
 * только поверх пустого значения. Разбор почему так — в шапке блока.
 *
 * ═══ НЕЗНАКОМОЕ НАЗВАНИЕ БОЛЬШЕ НЕ ИСЧЕЗАЕТ МОЛЧА (04.09.2026) ════════════
 *
 * Здесь стояло `if (!slug) return;` — и это был корень всей истории: предмет
 * с названием вне словаря (например «Science») слага не получал, учитель
 * оставался без кафедры, и НИ ОДНОГО СЛЕДА об этом не оставалось. Три учителя
 * так и жили, пока заказчик не пожаловался.
 *
 * ПОЧЕМУ НЕ ОТКАЗ. Уронить назначение из-за подписи было бы хуже болезни:
 * учитель не получил бы ни группы, ни уроков, ни доступа — ради поля, которое
 * влияет ровно на одну вкладку. Поэтому назначение проходит, а случай
 * называется вслух: строка в журнале сервера с точным названием предмета, и
 * вызывающий получает исход, который может показать человеку.
 */
type ИсходСлага = "написан" | "уже-был" | "демо-школа" | "нет-в-справочнике";

async function ensureSubjectSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  teacherId: string,
  subjectName: string,
  schoolId: string,
): Promise<ИсходСлага> {
  if (await isDemoSchool(schoolId)) return "демо-школа";
  const slug = getSubjectKeyByLabel(subjectName);
  if (!slug) {
    console.warn(
      `[subject-slug] предмета «${subjectName}» нет в справочнике packages/core/src/config/subjects.ts — `
      + `учитель ${teacherId} остался без кафедры: библиотека кафедры ему недоступна, пока название не добавят.`,
    );
    return "нет-в-справочнике";
  }
  const { data: teacher } = await sb
    .from("teachers").select("subject_slug").eq("id", teacherId).maybeSingle();
  if (!teacher || teacher.subject_slug) return "уже-был";
  const { error } = await sb.from("teachers").update({ subject_slug: slug }).eq("id", teacherId);
  if (error) throw error;
  return "написан";
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
): Promise<{ changed: boolean; groupId: string; lostGroupAccess: boolean }> {
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
  if (previous === teacherId) {
    return { changed: false, groupId: row.group_id as string, lostGroupAccess: false };
  }

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
  // 03.09.2026, пункт 103. Потерял ли прежний учитель доступ к группе —
  // теперь это ЗНАЮТ, а не догадываются: unlinkTeacherFromGroupIfUnused
  // выполняет удаление и отдаёт его результат. Ни одного лишнего запроса.
  let lostGroupAccess = false;
  if (previous) {
    lostGroupAccess = await unlinkTeacherFromGroupIfUnused(anySb, row.group_id as string, previous);
  }

  return { changed: true, groupId: row.group_id as string, lostGroupAccess };
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

/**
 * Последнего администратора школы удалять нельзя — школа осталась бы без
 * управления, а завести нового умеет только суперадмин.
 *
 * ПЕРВЫЙ РУБЕЖ, И ОН ЗДЕСЬ РАДИ ТЕКСТА. Само правило держит база (миграция
 * 228, триггер на `admins`), но её отказ до человека доедет плохо: удаление
 * идёт через Auth API, а он подменяет ошибку базы своим «Database error
 * deleting user». Отсюда же отказ уходит машинным кодом, который
 * humanizeAdminError превращает во фразу, и доезжает через guard()/unwrap().
 *
 * Признака активности у администраторов нет — в `admins` нет ни `is_active`,
 * ни `archived_at`, — поэтому «последний» значит последний вообще.
 */
export async function assertNotLastSchoolAdmin(userId: string): Promise<void> {
  const sb = getServiceClient();
  const { data: me, error: meErr } = await sb
    .from("admins").select("id, school_id").eq("user_id", userId).maybeSingle();
  if (meErr) throw meErr;
  const row = me as { id: string; school_id: string } | null;
  // Строки нет — удалять нечего, и это не наша забота: пусть отвечает
  // вызывающий, у него своя проверка «администратор не найден».
  if (!row) return;

  const { count, error } = await sb
    .from("admins")
    .select("id", { count: "exact", head: true })
    .eq("school_id", row.school_id)
    .neq("id", row.id);
  if (error) throw error;
  if ((count ?? 0) === 0) throw new Error("LAST_SCHOOL_ADMIN");
}

// ── SUPER ADMIN: SCHOOLS ──────────────────────────────────────────────────────

export async function createSchool(data: {
  name: string;
  code: string;
  autostart_enabled: boolean;
  /** Длительность урока (миграция 246). Не передали — сработает умолчание
   *  колонки, те же 45 минут. Пустой она быть не может: NOT NULL. */
  lesson_duration_minutes?: number;
}): Promise<string> {
  const sb = getServiceClient();
  const { data: school, error } = await sb
    .from("schools")
    .insert({
      name: data.name,
      code: data.code,
      autostart_enabled: data.autostart_enabled,
      ...(data.lesson_duration_minutes !== undefined
        ? { lesson_duration_minutes: data.lesson_duration_minutes }
        : {}),
    })
    .select("id")
    .single();
  if (error || !school) throw error ?? new Error("School insert failed");
  return (school as { id: string }).id;
}

/** Обновить карточку школы. Принимает ЧАСТИЧНЫЙ набор полей: вызывающий шлёт
 *  только то, что менял, и не обязан знать про остальные колонки. Пустой набор
 *  ничего не делает — это законный случай (правка без единого изменения). */
export async function updateSchoolCard(
  schoolId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const sb = getServiceClient();
  const { error } = await sb
    .from("schools")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch as any)
    .eq("id", schoolId);
  if (error) throw error;
}

// ── СУПЕРАДМИН: МЕНЕДЖЕРЫ ────────────────────────────────────────────────────
//
// Роль менеджера — заход 1, миграция 250. «Админ школы, но во всех школах
// сразу»: следит за учителями и за деньгами, школ и администраторов не
// заводит.
//
// ═══ ЧЕМ ОТЛИЧАЕТСЯ ОТ АДМИНИСТРАТОРА ШКОЛЫ ══════════════════════════════
//
// Одним, и это главное: у менеджера НЕТ ШКОЛЫ. Отсюда всё остальное —
//
//   * адрес учётной записи собирается напрямую, без createSchoolScopedUser:
//     та функция при столкновении логинов дописывает КОД ШКОЛЫ, а брать его
//     неоткуда. Столкновений и не будет: логин менеджера уникален на всю базу
//     (индекс managers_username_uniq), а домен у роли свой;
//   * в форме нет поля школы и нет перевода в другую школу;
//   * нет заслона «последнего не удалять»: он про то, чтобы школа не осталась
//     без управления, а менеджер ничьей школой не управляет.
//
// ═══ ДОМЕН АДРЕСА: managers.snr.local ════════════════════════════════════
//
// У каждой роли свой: students.snr.local, teachers.snr.local,
// admins.snr.local, parents.snr.local. Суперадмин сидит на admins.snr.local
// под именем superadmin@ — это наследство миграции 71, и повторять его не
// надо: менеджеров будет много, и класть их в чужой домен значит однажды
// столкнуться логинами со школьным админом.

export type ManagerRow = {
  id: string;
  user_id: string;
  full_name: string;
  username: string | null;
  google_email: string | null;
  created_at: string;
  /** Адрес учётной записи. Берётся из Auth, в таблице его нет. */
  email: string | null;
};

/** Список менеджеров для экрана суперадмина. Адреса подтягиваются одним
 *  походом в Auth — тем же getUserEmails, что и у администраторов школ. */
export async function listManagers(): Promise<ManagerRow[]> {
  const sb = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("managers")
    .select("id, user_id, full_name, username, google_email, created_at")
    .order("full_name");
  if (error) throw error;

  const rows = (data ?? []) as Array<Omit<ManagerRow, "email">>;
  if (rows.length === 0) return [];
  // getUserEmails отдаёт обычный объект, а не Map — как у экрана
  // администраторов школ.
  const emails = await getUserEmails(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, email: emails[r.user_id] ?? null }));
}

/**
 * Завести менеджера.
 *
 * ПОРЯДОК ТОТ ЖЕ, ЧТО У АДМИНИСТРАТОРА ШКОЛЫ: сперва учётная запись, потом
 * строка роли, и если вторая половина не удалась — учётная запись сносится.
 * Иначе в Auth оседали бы висячие пользователи, которых никто не видит.
 */
export async function createManager(data: {
  full_name: string;
  username: string;
  password: string;
  google_email?: string | null;
}): Promise<{ userId: string; managerId: string }> {
  const sb = getServiceClient();
  const login = data.username.trim().toLowerCase();
  // Домен берётся из ядра, а не пишется строкой: этот же домен перебирает
  // вход (signInWithUsername). Две копии разошлись бы, и менеджер завёлся
  // бы под адресом, по которому его потом не находят.
  const email = usernameToEmail(login, MANAGER_EMAIL_DOMAIN);

  const created = await sb.auth.admin.createUser({
    email, password: data.password, email_confirm: true,
  });
  if (!created.data?.user) {
    // Занятый адрес — самая частая беда, и она должна доехать фразой, а не
    // английской заглушкой Auth.
    if (/already.*(registered|exists)|email_exists|duplicate/i.test(created.error?.message ?? "")) {
      throw new Error("MANAGER_LOGIN_TAKEN");
    }
    throw created.error ?? new Error("Auth user creation failed");
  }
  const userId = created.data.user.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (sb as any)
    .from("managers")
    .insert({
      user_id: userId,
      full_name: data.full_name.trim(),
      username: login,
      google_email: normalizeSocialEmail(data.google_email),
    })
    .select("id")
    .single();
  if (error || !row) {
    await sb.auth.admin.deleteUser(userId);
    // Уникальность логина держит ещё и индекс в базе: два человека могли
    // нажать «Создать» одновременно, и Auth пропустил бы обоих по разным
    // адресам, а индекс — нет.
    if (/managers_username_uniq/i.test(String((error as { message?: string } | null)?.message ?? ""))) {
      throw new Error("MANAGER_LOGIN_TAKEN");
    }
    throw error ?? new Error("Manager insert failed");
  }
  return { userId, managerId: (row as { id: string }).id };
}

/** Переименовать менеджера и поправить ему почту Google.
 *
 *  Почта пишется, ТОЛЬКО если ключ присутствует — то же правило, что у
 *  администратора школы: без него отсутствие поля означало бы undefined и
 *  затирало бы почту при каждом сохранении. */
export async function updateManager(
  managerId: string,
  data: { full_name: string; google_email?: string | null },
) {
  const sb = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = { full_name: data.full_name.trim() };
  if ("google_email" in data) patch.google_email = normalizeSocialEmail(data.google_email);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from("managers").update(patch).eq("id", managerId);
  if (error) throw error;
}

/**
 * Удалить менеджера вместе с учётной записью.
 *
 * Строка managers уходит каскадом от auth.users (ON DELETE CASCADE в миграции
 * 250) — как у администратора школы.
 *
 * ЗАСЛОНА «ПОСЛЕДНЕГО НЕ УДАЛЯТЬ» ЗДЕСЬ НЕТ, и это не забывчивость. У
 * администраторов он стоит потому, что без последнего админа школа остаётся
 * без управления. Менеджер ничьей школой не управляет: удали всех — и просто
 * не станет менеджеров.
 *
 * Причину отказа спрашиваем ЗАРАНЕЕ, тем же приёмом, что у администратора:
 * Auth подменяет ошибку базы своим «Database error deleting user», и человек
 * увидел бы английскую заглушку вместо ссылок на живые записи.
 */
export async function deleteManager(userId: string) {
  const sb = getServiceClient();
  const blockers = await getUserDeletionBlockers(userId);
  if (blockers.length > 0) {
    const total = blockers.reduce((sum, b) => sum + b.rows, 0);
    const where = blockers.map((b) => `${b.table} (${b.rows})`).join("; ");
    throw new Error(`BLOCKED_USER_REFS:${total}:${where}`);
  }
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) throw error;
}

/** Новый пароль менеджеру. Возвращается один раз — показать и забыть. */
export async function resetManagerPassword(userId: string): Promise<string> {
  const sb = getServiceClient();
  const newPassword = generatePassword();
  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw error;
  return newPassword;
}

// ── SUPER ADMIN: SCHOOL ADMINS ───────────────────────────────────────────────

export async function createSchoolAdmin(data: {
  full_name: string;
  username: string;
  password: string;
  school_id: string;
  /** Почта Google для входа. Вписывает суперадминистратор — сам себе
   *  администратор её не назначит. */
  google_email?: string | null;
}): Promise<{ userId: string; adminId: string }> {
  const sb = getServiceClient();
  // Z.2.10 — школьный адрес, если простой логин уже занят другой школой.
  const { userId } = await createSchoolScopedUser(sb, {
    username: data.username, password: data.password,
    domain: "admins.snr.local", school_id: data.school_id,
  });
  const { data: admin, error: aErr } = await sb
    .from("admins")
    // Миграция 194: логин пишем в саму строку, а не только в адрес учётной
    // записи. Иначе при столкновении логинов адрес уедет в школьный вид, и
    // резолвер входа этого админа не найдёт.
    .insert({
      user_id: userId,
      full_name: data.full_name,
      username: data.username.trim().toLowerCase(),
      school_id: data.school_id,
      google_email: normalizeSocialEmail(data.google_email),
    })
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
  data: { full_name: string; school_id: string; google_email?: string | null },
) {
  const sb = getServiceClient();

  // google_email пишется, только если ключ ПРИСУТСТВУЕТ. Без этого условия
  // отсутствие поля в объекте означало бы undefined → normalizeSocialEmail
  // вернул бы null → почта затиралась бы при каждом сохранении. Ровно это и
  // происходило до 19.08.2026; вызывающий теперь передаёт ключ лишь тогда,
  // когда поле действительно правили (см. lib/form-patch.ts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = { full_name: data.full_name, school_id: data.school_id };
  if ("google_email" in data) patch.google_email = normalizeSocialEmail(data.google_email);

  const { error } = await sb
    .from("admins")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch as any)
    .eq("id", adminId);
  if (error) throw error;
}

/** Hard delete — cascades to the `admins` row via ON DELETE CASCADE (migration 42). */
/**
 * Пополнение баланса ученика рукой администратора. Заход 3 по платежам.
 *
 * ПОЧЕМУ ВИД ДВИЖЕНИЯ — `adjustment`, А НЕ `topup`. Ограничение
 * `balance_entries_topup_shape` из миграции 227 требует у `topup` ссылку на
 * транзакцию провайдера: `topup` означает «деньги пришли из кассы». У
 * пополнения рукой такой транзакции нет и быть не может. Вид `adjustment`
 * заведён ровно для движений, у которых источник — решение человека, а не
 * платёж; причина обязана быть записана в `note`, иначе через месяц никто не
 * вспомнит, откуда на балансе сумма.
 *
 * Баланс в `students` меняет не этот код, а триггер `trg_apply_balance_entry`
 * из 227: здесь пишется только строка журнала. Так баланс и журнал не могут
 * разойтись.
 */
export async function topUpStudentBalance(data: {
  studentId: string;
  amount: number;
  note: string;
  callerSchoolId: string;
  callerIsSuperAdmin: boolean;
}): Promise<void> {
  if (!Number.isFinite(data.amount) || data.amount <= 0) throw new Error("BAD_TOPUP_AMOUNT");
  if (!data.note.trim()) throw new Error("TOPUP_REASON_REQUIRED");

  const sb = getServiceClient();
  await assertSameSchool(sb, "students", data.studentId, data.callerSchoolId, data.callerIsSuperAdmin);

  // school_id берём у самого ученика, а не у вызывающего: у суперадмина
  // school_id нет вовсе, а колонка обязательна и без умолчания (227).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: readErr } = await (sb as any)
    .from("students").select("school_id").eq("id", data.studentId).single();
  if (readErr || !row) throw readErr ?? new Error("students: запись не найдена");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from("balance_entries").insert({
    school_id: (row as { school_id: string }).school_id,
    student_id: data.studentId,
    amount: data.amount,
    kind: "adjustment",
    note: data.note.trim(),
  });
  if (error) throw error;
}

/**
 * ЧТО МЕШАЕТ УДАЛИТЬ УЧЁТНУЮ ЗАПИСЬ. Миграция 237.
 *
 * Спрашивает у базы, какие внешние ключи на `auth.users` не дадут удалить
 * этого пользователя, и сколько строк за каждым. Список НЕ зашит в код
 * намеренно: его забыли бы пополнить ровно в тот день, когда он
 * понадобится, — а понадобится он при заведении новой таблицы со ссылкой
 * `created_by` без действия при удалении.
 *
 * Сегодня список пуст: три такие ссылки сняты миграцией 237.
 *
 * Функции ещё может не быть (миграция не применена) — тогда возвращаем
 * пустой список, и поведение ровно прежнее. Отсутствие подсказки не повод
 * запретить удаление.
 */
export async function getUserDeletionBlockers(
  userId: string,
): Promise<{ table: string; column: string; rows: number }[]> {
  const sb = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("fn_user_delete_blockers", { p_user_id: userId });
  if (error) {
    console.warn("[getUserDeletionBlockers] подсказка недоступна:", error.message);
    return [];
  }
  return ((data ?? []) as { table_name: string; column_name: string; row_count: number }[])
    .map((r) => ({ table: r.table_name, column: r.column_name, rows: Number(r.row_count) }));
}

export async function deleteSchoolAdmin(userId: string) {
  const sb = getServiceClient();
  // Проверка стоит ЗДЕСЬ, а не в действии: так её получает любой вызывающий,
  // включая тот, которого ещё нет. Второй рубеж — триггер из миграции 228.
  await assertNotLastSchoolAdmin(userId);

  // РАДИ ТЕКСТА, А НЕ РАДИ ЗАПРЕТА. Удаление идёт через Auth API, а он
  // подменяет ошибку базы своим «Database error deleting user» — и человек
  // видит английскую заглушку вместо причины. Спрашиваем причину заранее,
  // пока она ещё читается, и отдаём машинным кодом с числами: фразу соберёт
  // humanizeAdminError. Тот же приём, что у удаления учителя
  // (BLOCKED_TEACHER_LESSONS).
  const blockers = await getUserDeletionBlockers(userId);
  if (blockers.length > 0) {
    const total = blockers.reduce((sum, b) => sum + b.rows, 0);
    const where = blockers.map((b) => `${b.table} (${b.rows})`).join("; ");
    throw new Error(`BLOCKED_USER_REFS:${total}:${where}`);
  }

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

/**
 * Заводит родителя вместе с учётной записью. Z.2.8.
 *
 * ЧТО БЫЛО. Строка `parents` с `user_id = NULL` и одноразовый код в
 * `parent_invites`, который родитель должен был погасить на странице
 * `/parent/join`. Страницы не существует, `verifyParentInvite` и
 * `completeParentJoin` имели ноль вызовов, в базе ноль приглашений — поток
 * был мёртв целиком. Приглашения больше не выдаются, мёртвый код удалён.
 *
 * КАК СТАЛО. Телефон обязателен и уникален (миграция 180) — это ключ входа.
 * Сразу создаётся учётная запись с паролем: он нужен мобильному приложению
 * и как запасной путь, а на вебе родитель входит телефоном и одноразовым
 * кодом. Пароль возвращается вызывающему и показывается админу один раз, как
 * это уже сделано для админов школ.
 *
 * Порядок обратный прежнему — сначала пользователь, потом строка: у
 * `parents.phone` теперь UNIQUE, и при занятом номере лучше упасть до
 * создания учётной записи, чем откатывать её следом.
 */
/**
 * Почта под вход через Google/Apple: приводим к тому виду, который требует
 * база (миграция 201 — нижний регистр, без пробелов по краям). Пусто и одни
 * пробелы означают «не указана»: поля необязательные.
 *
 * Приводим ЗДЕСЬ, а не в форме: форм две (создание и правка), и обе могли бы
 * разойтись. База при этом всё равно проверяет вид значения сама — на случай,
 * если строка придёт не из формы.
 */
function normalizeSocialEmail(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toLowerCase();
  return v.length > 0 ? v : null;
}

export async function createParent(data: {
  full_name: string;
  phone: string;
  student_ids: string[];
  school_id: string;
  created_by: string;
  /** Необязательные — родитель сможет входить через Google вместо кода. */
  google_email?: string | null;
  apple_email?: string | null;
}): Promise<{ parentId: string; userId: string; password: string }> {
  const sb = getServiceClient();

  const phone = normalizeUzPhone(data.phone);
  if (!phone) throw new Error("BAD_PHONE");

  const { data: taken } = await sb.from("parents").select("id").eq("phone", phone).maybeSingle();
  if (taken) throw new Error("duplicate key value violates unique constraint \"parents_phone_key\"");

  const password = generatePassword();
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email: parentAuthEmail(phone),
    password,
    email_confirm: true,
  });
  if (authErr || !authUser.user) throw authErr ?? new Error("Auth user creation failed");
  const userId = authUser.user.id;

  const { data: parent, error: pErr } = await sb
    .from("parents")
    .insert({
      user_id: userId,
      full_name: data.full_name,
      phone,
      school_id: data.school_id,
      created_by: data.created_by,
      google_email: normalizeSocialEmail(data.google_email),
      apple_email: normalizeSocialEmail(data.apple_email),
    })
    .select("id")
    .single();
  if (pErr || !parent) {
    await sb.auth.admin.deleteUser(userId);
    throw pErr ?? new Error("Parent insert failed");
  }
  const parentId = (parent as { id: string }).id;

  // Откат теперь снимает и учётную запись: без неё родитель остался бы с
  // занятым номером и невозможностью войти.
  const rollback = async () => {
    await sb.from("parents").delete().eq("id", parentId);
    await sb.auth.admin.deleteUser(userId);
  };

  if (data.student_ids.length > 0) {
    try {
      await assertStudentsInSchool(sb, data.student_ids, data.school_id);
    } catch (checkErr) {
      await rollback();
      throw checkErr;
    }
    const rows = data.student_ids.map((student_id) => ({
      parent_id: parentId,
      student_id,
      school_id: data.school_id,
    }));
    const { error: psErr } = await sb.from("parent_students").insert(rows);
    if (psErr) {
      await rollback();
      throw psErr;
    }
  }

  return { parentId, userId, password };
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
  data: {
    full_name: string;
    phone?: string;
    student_ids: string[];
    school_id: string;
    google_email?: string | null;
    apple_email?: string | null;
  },
  callerSchoolId: string,
  callerIsSuperAdmin: boolean,
) {
  const sb = getServiceClient();
  await assertSameSchool(sb, "parents", parentId, callerSchoolId, callerIsSuperAdmin);

  // Обе почты пишутся, ТОЛЬКО если ключ присутствует — тот же приём, что у
  // ученика, учителя и администратора школы.
  //
  // 20.08.2026 — apple_email ЗАТИРАЛАСЬ ПРИ КАЖДОМ СОХРАНЕНИИ. Колонки нет ни
  // в запросе страницы, ни в типе ParentsView, ни в форме — Apple ID убрали с
  // экрана 18.08.2026, а строку в этом UPDATE оставили. Значит data.apple_email
  // всегда undefined, normalizeSocialEmail превращает его в null, и любая
  // правка ФИО стирала родителю вход через Apple. Ровно та же механика, что у
  // почты Google в коммите 6b57543, только без единого экрана, где это можно
  // было бы заметить.
  //
  // google_email здесь подставляется честно (страница переименовывает колонку
  // явно), но запись была безусловной — теперь и она под защитой.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {
    full_name: data.full_name,
    phone: data.phone || null,
  };
  if ("google_email" in data) patch.google_email = normalizeSocialEmail(data.google_email);
  if ("apple_email" in data) patch.apple_email = normalizeSocialEmail(data.apple_email);

  const { error: pErr } = await sb
    .from("parents")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch as any)
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

