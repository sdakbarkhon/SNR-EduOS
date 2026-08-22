import { createClient } from "@/lib/supabase/server";
import { TeachersView, type TeacherBindingRow } from "./TeachersView";

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const supabase = await createClient();

  // google_email добавлена 20.08.2026 — та же беда, что на экране учеников:
  // колонки не было в запросе, поле почты рисовалось пустым, и сохранение
  // писало пустоту поверх настоящей почты.
  //
  // 22.08.2026 — приведение к any отсюда убрано: типы пересобраны из живой
  // базы, колонка в них есть.
  const { data: teachers, error: teachersError } = await supabase
    .from("teachers")
    .select("id, user_id, full_name, username, google_email, created_at")
    .order("full_name");
  if (teachersError) console.error("[AdminTeachersPage] teachers query failed:", teachersError.message);

  // Z.2.4 — «Предметы и группы» под каждым учителем. Собирается здесь одним
  // проходом на всех, а не запросом на карточку: учителей в школе десятки, а
  // назначений у каждого единицы.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [{ data: assignments }, { data: links }, { data: groups }, { data: lessons }] = await Promise.all([
    sb.from("subjects").select("id, name, group_id, teacher_id").not("teacher_id", "is", null),
    sb.from("group_teachers").select("group_id, teacher_id"),
    sb.from("groups").select("id, name, teacher_id"),
    sb.from("lessons").select("subject_id"),
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
      isCurator: group?.teacher_id === a.teacher_id,
      seesGroup: seenGroups.has(`${a.teacher_id}|${a.group_id}`),
      lessons: lessonsBySubject.get(a.id) ?? 0,
    });
  }
  for (const list of Object.values(bindings)) {
    list.sort((x, y) => x.groupName.localeCompare(y.groupName) || x.subjectName.localeCompare(y.subjectName));
  }

  return (
    <TeachersView teachers={teachers ?? []} bindings={bindings} defaultOpenAdd={action === "add"} />
  );
}
