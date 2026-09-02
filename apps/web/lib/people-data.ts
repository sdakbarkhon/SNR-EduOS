import "server-only";
import { getMySchoolNowMs } from "@/lib/school-time-server";
import type { TeacherBindingRow } from "@/app/admin/teachers/TeachersView";

/**
 * ЧТЕНИЕ ЭКРАНОВ «ЛЮДИ»: ученики, учителя, родители. Срез 3b, 03.09.2026.
 *
 * ═══ ЗАЧЕМ ═══════════════════════════════════════════════════════════════
 *
 * Три экрана админки читают под токеном человека, и школу им подставляют
 * правила доступа. У менеджера правил доступа к школьным данным нет ни
 * одного, и заводить их запрещено — значит ему нужно читать служебным
 * ключом с ЯВНЫМ условием по школе, тем же приёмом, что в просмотре школы.
 *
 * Скопировать три загрузчика было бы проще всего и хуже всего: у родителей
 * там счёт свежести приглашений, у учителей — сборка привязок одним проходом.
 * Копия разошлась бы с оригиналом на первой правке.
 *
 * ═══ ПОЧЕМУ ШКОЛА НЕОБЯЗАТЕЛЬНА ══════════════════════════════════════════
 *
 * `schoolId` не передан — условие по школе НЕ добавляется вовсе, и запрос
 * получается байт в байт прежним. Так читает админ: его сужают правила
 * доступа, как сужали всегда, и ни одного лишнего условия у него не
 * появилось.
 *
 * `schoolId` передан — условие добавляется. Так читает менеджер служебным
 * ключом, который правила обходит и без явного условия показал бы все школы
 * разом.
 *
 * Одно правило, две роли, ноль копий.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Добавить условие по школе, если она задана. */
function поШколе<T>(q: T, schoolId?: string | null): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return schoolId ? ((q as any).eq("school_id", schoolId) as T) : q;
}

// ── УЧЕНИКИ ────────────────────────────────────────────────────────────────

export async function loadStudentsPage(db: Db, schoolId?: string | null) {
  const [{ data: students, error: studentsError }, { data: groups, error: groupsError }] = await Promise.all([
    поШколе(
      db
        .from("students")
        .select(
          // balance — заход 3 по платежам: админ видит баланс ребёнка.
          // Миграция 232: личные сведения — колонками students, медицинские —
          // связанной таблицей student_medical.
          "id, user_id, full_name, username, google_email, balance, created_at, "
          + "birth_date, gender, phone, file_no, "
          + "student_medical(allergies, medical_notes), "
          + "student_groups(group_id, groups(id, name, subject))",
        ),
      schoolId,
    ).order("full_name"),
    поШколе(db.from("groups").select("id, name, subject"), schoolId).order("name"),
  ]);
  if (studentsError) console.error("[people] students query failed:", studentsError.message);
  if (groupsError) console.error("[people] groups query failed:", groupsError.message);
  return { students: students ?? [], groups: groups ?? [] };
}

// ── УЧИТЕЛЯ ────────────────────────────────────────────────────────────────

export async function loadTeachersPage(db: Db, schoolId?: string | null) {
  const { data: teachers, error: teachersError } = await поШколе(
    db.from("teachers").select("id, user_id, full_name, username, google_email, created_at, phone, bio"),
    schoolId,
  ).order("full_name");
  if (teachersError) console.error("[people] teachers query failed:", teachersError.message);

  // Z.2.4 — «Предметы и группы» под каждым учителем. Собирается одним
  // проходом на всех, а не запросом на карточку.
  const [{ data: assignments }, { data: links }, { data: groups }, { data: lessons }, { data: catalog }] =
    await Promise.all([
      поШколе(db.from("subjects").select("id, name, group_id, teacher_id").not("teacher_id", "is", null), schoolId),
      поШколе(db.from("group_teachers").select("group_id, teacher_id"), schoolId),
      поШколе(db.from("groups").select("id, name, teacher_id"), schoolId),
      поШколе(db.from("lessons").select("subject_id"), schoolId),
      поШколе(db.from("school_subjects").select("id, name, is_active").eq("is_active", true), schoolId).order("name"),
    ]);

  const groupById = new Map<string, { name: string; teacher_id: string | null }>(
    ((groups ?? []) as Array<{ id: string; name: string; teacher_id: string | null }>)
      .map((g) => [g.id, { name: g.name, teacher_id: g.teacher_id }]),
  );
  const seenGroups = new Set(
    ((links ?? []) as Array<{ group_id: string; teacher_id: string }>).map((l) => `${l.teacher_id}|${l.group_id}`),
  );
  const lessonsBySubject = new Map<string, number>();
  for (const l of (lessons ?? []) as Array<{ subject_id: string | null }>) {
    if (!l.subject_id) continue;
    lessonsBySubject.set(l.subject_id, (lessonsBySubject.get(l.subject_id) ?? 0) + 1);
  }

  const bindings: Record<string, TeacherBindingRow[]> = {};
  for (const a of (assignments ?? []) as Array<{ id: string; name: string; group_id: string; teacher_id: string }>) {
    const group = groupById.get(a.group_id);
    (bindings[a.teacher_id] ??= []).push({
      assignmentId: a.id,
      subjectName: a.name,
      groupName: group?.name ?? "—",
      seesGroup: seenGroups.has(`${a.teacher_id}|${a.group_id}`),
      lessons: lessonsBySubject.get(a.id) ?? 0,
    });
  }
  for (const list of Object.values(bindings)) {
    list.sort((x, y) => x.groupName.localeCompare(y.groupName) || x.subjectName.localeCompare(y.subjectName));
  }

  return {
    teachers: teachers ?? [],
    bindings,
    catalog: (catalog ?? []) as Array<{ id: string; name: string }>,
    groups: (groups ?? []) as Array<{ id: string; name: string }>,
  };
}

// ── РОДИТЕЛИ ───────────────────────────────────────────────────────────────

export type ParentPageRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string | null;
  googleEmail: string | null;
  isRegistered: boolean;
  created_at: string;
  children: string[];
  childIds: string[];
  inviteCode: string | null;
  inviteExpired: boolean;
};

/**
 * `nowMs` — «сейчас» ТОЙ школы, чьи родители читаются.
 *
 * Z.3: свежесть приглашения считается от школьного времени, а оно у школ
 * разное — демо живёт с замороженной датой. Админ передаёт своё,
 * менеджер — время школы, в которую вошёл. Иначе приглашения чужой школы
 * выглядели бы просроченными или вечными.
 */
export async function loadParentsPage(db: Db, nowMs: number, schoolId?: string | null) {
  const [
    { data: parents, error: parentsError },
    { data: links, error: linksError },
    { data: invites, error: invitesError },
    { data: allStudents, error: studentsError },
  ] = await Promise.all([
    поШколе(db.from("parents").select("id, full_name, phone, user_id, created_at, google_email"), schoolId).order("full_name"),
    поШколе(db.from("parent_students").select("parent_id, student_id"), schoolId),
    поШколе(
      db.from("parent_invites").select("id, parent_id, code, expires_at, used_at, created_at"),
      schoolId,
    ).order("created_at", { ascending: false }),
    поШколе(db.from("students").select("id, full_name, username"), schoolId).order("full_name"),
  ]);
  if (parentsError) console.error("[people] parents query failed:", parentsError.message);
  if (linksError) console.error("[people] parent_students query failed:", linksError.message);
  if (invitesError) console.error("[people] parent_invites query failed:", invitesError.message);
  if (studentsError) console.error("[people] students query failed:", studentsError.message);

  type ParentRow = {
    id: string; full_name: string; phone: string | null; user_id: string | null;
    created_at: string; google_email: string | null;
  };
  type LinkRow = { parent_id: string; student_id: string };
  type InviteRow = { id: string; parent_id: string; code: string; expires_at: string; used_at: string | null; created_at: string };
  type StudentRow = { id: string; full_name: string; username: string };

  const parentRows = (parents ?? []) as ParentRow[];
  const linkRows = (links ?? []) as LinkRow[];
  const inviteRows = (invites ?? []) as InviteRow[];
  const studentRows = (allStudents ?? []) as StudentRow[];

  const studentMap = new Map(studentRows.map((s) => [s.id, s.full_name]));

  const childrenByParent = new Map<string, string[]>();
  const childIdsByParent = new Map<string, string[]>();
  for (const l of linkRows) {
    const arr = childrenByParent.get(l.parent_id) ?? [];
    arr.push(studentMap.get(l.student_id) ?? "?");
    childrenByParent.set(l.parent_id, arr);

    const idArr = childIdsByParent.get(l.parent_id) ?? [];
    idArr.push(l.student_id);
    childIdsByParent.set(l.parent_id, idArr);
  }

  // inviteRows уже отсортированы по created_at убыванием, поэтому первое
  // совпадение по parent_id — самое свежее приглашение этого родителя.
  const latestInviteByParent = new Map<string, InviteRow>();
  for (const inv of inviteRows) {
    if (!latestInviteByParent.has(inv.parent_id)) latestInviteByParent.set(inv.parent_id, inv);
  }

  const rows: ParentPageRow[] = parentRows.map((p) => {
    const invite = latestInviteByParent.get(p.id);
    return {
      id: p.id,
      user_id: p.user_id,
      full_name: p.full_name,
      phone: p.phone,
      googleEmail: p.google_email,
      isRegistered: !!p.user_id,
      created_at: p.created_at,
      children: childrenByParent.get(p.id) ?? [],
      childIds: childIdsByParent.get(p.id) ?? [],
      inviteCode: invite?.code ?? null,
      inviteExpired: invite ? new Date(invite.expires_at).getTime() < nowMs : true,
    };
  });

  return { rows, allStudents: studentRows };
}

/** «Сейчас» школы админа — прежним способом, для его же экрана. */
export async function schoolNowMsFor(db: Db): Promise<number> {
  return getMySchoolNowMs(db);
}
