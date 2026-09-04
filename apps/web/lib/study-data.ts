import "server-only";
import type { MarkRow } from "@/app/admin/marks/MarksView";

/**
 * ЧТЕНИЕ ЭКРАНОВ «УЧЁБА»: группы, справочник предметов, назначения, оценки.
 * Срез 3c, 03.09.2026.
 *
 * Правило то же, что у экранов «люди» (lib/people-data.ts):
 *
 *   школа НЕ передана — условие по школе не добавляется вовсе, запрос
 *     остаётся байт в байт прежним. Так читает админ: его сужают правила
 *     доступа, как сужали всегда.
 *
 *   школа передана — условие добавляется. Так читает менеджер служебным
 *     ключом, который правила обходит и без явного условия показал бы все
 *     школы разом.
 *
 * Одно правило, две роли, ноль копий.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

function поШколе<T>(q: T, schoolId?: string | null): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return schoolId ? ((q as any).eq("school_id", schoolId) as T) : q;
}

// ── ГРУППЫ ─────────────────────────────────────────────────────────────────

export async function loadGroupsPage(db: Db, schoolId?: string | null) {
  const [{ data: groups, error: groupsError }, { data: catalog, error: catalogError }] = await Promise.all([
    поШколе(
      db.from("groups").select(
        // 30.08.2026 — связь teachers из выборки убрана вместе с колонкой
        // «Куратор»: между groups и teachers два пути, и PostgREST валил
        // весь запрос ошибкой PGRST201.
        //
        // 05.09.2026 — предметы группы берутся из НАЗНАЧЕНИЙ, а не из
        // колонки groups.subject. Колонка хранит один слаг от модели «группа
        // = один курс»: у трёх демо-классов там 'programming', хотя предметов
        // у каждого пять-шесть. Список назначений говорит правду.
        "id, name, subject, teacher_id, course_price, student_groups(student_id), "
        + "subjects(id, name, is_active, is_stub)",
      ),
      schoolId,
    ).order("name"),
    поШколе(db.from("school_subjects").select("id, name, is_active"), schoolId).order("name"),
  ]);
  if (groupsError) console.error("[study] groups query failed:", groupsError.message);
  if (catalogError) console.error("[study] catalog query failed:", catalogError.message);
  return { groups: groups ?? [], catalog: catalog ?? [] };
}

// ── СПРАВОЧНИК ПРЕДМЕТОВ ───────────────────────────────────────────────────

export async function loadSubjectsPage(db: Db, schoolId?: string | null) {
  const { data: catalog, error } = await поШколе(
    db.from("school_subjects").select("id, name, icon, color, is_active, subjects(count)"),
    schoolId,
  ).order("is_active", { ascending: false }).order("name");
  if (error) console.error("[study] school_subjects query failed:", error.message);

  return ((catalog ?? []) as Array<{
    id: string; name: string; icon: string; color: string; is_active: boolean;
    subjects: { count: number }[] | null;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    is_active: r.is_active,
    assignments: r.subjects?.[0]?.count ?? 0,
  }));
}

// ── НАЗНАЧЕНИЯ ─────────────────────────────────────────────────────────────

export async function loadAssignmentsPage(db: Db, schoolId?: string | null) {
  const [assignmentsRes, catalogRes, groupsRes, teachersRes] = await Promise.all([
    поШколе(
      db.from("subjects").select(
        "id, name, icon, color, catalog_id, group_id, teacher_id, "
        + "group:groups(id, name), teacher:teachers(id, full_name)",
      ),
      schoolId,
    ).order("name"),
    поШколе(db.from("school_subjects").select("id, name, icon, color, is_active"), schoolId).order("name"),
    поШколе(db.from("groups").select("id, name"), schoolId).order("name"),
    поШколе(db.from("teachers").select("id, full_name"), schoolId).order("full_name"),
  ]);
  if (assignmentsRes.error) console.error("[study] subjects query failed:", assignmentsRes.error.message);
  if (catalogRes.error) console.error("[study] catalog query failed:", catalogRes.error.message);
  if (groupsRes.error) console.error("[study] groups query failed:", groupsRes.error.message);
  if (teachersRes.error) console.error("[study] teachers query failed:", teachersRes.error.message);
  return {
    assignments: assignmentsRes.data ?? [],
    catalog: catalogRes.data ?? [],
    groups: groupsRes.data ?? [],
    teachers: teachersRes.data ?? [],
  };
}

// ── ОЦЕНКИ ─────────────────────────────────────────────────────────────────

/**
 * Четыре вида записей в одном списке, отсортированные по времени.
 *
 * ПОТОЛОК В 500 СТРОК НА ВИД — прежний, из экрана админа. Экран показывает
 * последние правки, а не всю историю школы; без потолка запрос вырос бы
 * вместе со школой и однажды перестал бы открываться.
 */
export async function loadMarksPage(db: Db, schoolId?: string | null) {
  const [{ data: grades }, { data: attendance }, { data: hw }, { data: tests }, { data: groups }] =
    await Promise.all([
      поШколе(
        db.from("lesson_grades").select(
          "id, grade, comment, graded_at, student:students(full_name), "
          + "lesson:lessons(starts_at, group:groups(id, name), subject:subjects(name))",
        ),
        schoolId,
      ).order("graded_at", { ascending: false }).limit(500),
      поШколе(
        db.from("attendance").select(
          "id, status, marked_at, student:students(full_name), "
          + "lesson:lessons(starts_at, group:groups(id, name), subject:subjects(name))",
        ),
        schoolId,
      ).order("marked_at", { ascending: false }).limit(500),
      поШколе(
        db.from("homework_submissions").select(
          "id, grade, graded_at, student:students(full_name), "
          + "homework:homework(title, group:groups(id, name), subject:subjects(name))",
        ),
        schoolId,
      ).not("graded_at", "is", null).order("graded_at", { ascending: false }).limit(500),
      поШколе(
        db.from("test_submissions").select(
          "id, score, max_score, grade, graded_at, student:students(full_name), "
          + "homework:homework(title, group:groups(id, name), subject:subjects(name))",
        ),
        schoolId,
      ).not("graded_at", "is", null).order("graded_at", { ascending: false }).limit(500),
      поШколе(db.from("groups").select("id, name"), schoolId).order("name"),
    ]);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rows: MarkRow[] = [
    ...((grades ?? []) as any[]).map((r) => ({
      id: r.id as string,
      kind: "lesson_grade" as const,
      student: r.student?.full_name ?? "—",
      groupId: r.lesson?.group?.id ?? null,
      groupName: r.lesson?.group?.name ?? null,
      subject: r.lesson?.subject?.name ?? null,
      at: (r.graded_at ?? r.lesson?.starts_at) as string,
      value: r.grade == null ? "—" : String(r.grade),
      numeric: r.grade ?? null,
    })),
    ...((attendance ?? []) as any[]).map((r) => ({
      id: r.id as string,
      kind: "attendance" as const,
      student: r.student?.full_name ?? "—",
      groupId: r.lesson?.group?.id ?? null,
      groupName: r.lesson?.group?.name ?? null,
      subject: r.lesson?.subject?.name ?? null,
      at: (r.marked_at ?? r.lesson?.starts_at) as string,
      value: String(r.status),
      numeric: null,
    })),
    ...((hw ?? []) as any[]).map((r) => ({
      id: r.id as string,
      kind: "homework" as const,
      student: r.student?.full_name ?? "—",
      groupId: r.homework?.group?.id ?? null,
      groupName: r.homework?.group?.name ?? null,
      subject: r.homework?.subject?.name ?? null,
      at: r.graded_at as string,
      value: r.grade == null ? "—" : String(r.grade),
      numeric: r.grade ?? null,
    })),
    ...((tests ?? []) as any[]).map((r) => ({
      id: r.id as string,
      kind: "test" as const,
      student: r.student?.full_name ?? "—",
      groupId: r.homework?.group?.id ?? null,
      groupName: r.homework?.group?.name ?? null,
      subject: r.homework?.subject?.name ?? null,
      at: r.graded_at as string,
      value: r.score == null ? "—" : `${r.score}${r.max_score != null ? ` / ${r.max_score}` : ""}`,
      numeric: r.score ?? null,
    })),
  ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  const subjects = [...new Set(rows.map((r) => r.subject).filter(Boolean))] as string[];
  const groupRows = ((groups ?? []) as any[]).map((g) => ({ id: g.id as string, name: g.name as string }));
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return { rows, groups: groupRows, subjects: subjects.sort() };
}
