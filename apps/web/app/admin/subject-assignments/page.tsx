import { createClient } from "@/lib/supabase/server";
import { AssignmentsView } from "./AssignmentsView";

// Z.2.2 — назначения «предмет × группа × учитель» (таблица public.subjects).
// Раньше это жило внутри /admin/subjects и требовало выбрать группу; теперь
// справочник и назначения — разные экраны. Выборки ограничивает RLS
// (subjects_select_authenticated / school_subjects_select_authenticated),
// поэтому явный фильтр по school_id тут не нужен; запись идёт через
// server action, где school_id берётся из сессии.
export default async function AdminSubjectAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [assignmentsRes, catalogRes, groupsRes, teachersRes] = await Promise.all([
    sb.from("subjects")
      .select("id, name, icon, color, catalog_id, group_id, teacher_id, group:groups(id, name), teacher:teachers(id, full_name)")
      .order("name"),
    sb.from("school_subjects").select("id, name, icon, color, is_active").order("name"),
    sb.from("groups").select("id, name").order("name"),
    sb.from("teachers").select("id, full_name").order("full_name"),
  ]);

  if (assignmentsRes.error) console.error("[AdminSubjectAssignmentsPage] subjects query failed:", assignmentsRes.error.message);
  if (catalogRes.error) console.error("[AdminSubjectAssignmentsPage] catalog query failed:", catalogRes.error.message);
  if (groupsRes.error) console.error("[AdminSubjectAssignmentsPage] groups query failed:", groupsRes.error.message);
  if (teachersRes.error) console.error("[AdminSubjectAssignmentsPage] teachers query failed:", teachersRes.error.message);

  return (
    <AssignmentsView
      assignments={assignmentsRes.data ?? []}
      catalog={catalogRes.data ?? []}
      groups={groupsRes.data ?? []}
      teachers={teachersRes.data ?? []}
      defaultOpenAdd={action === "add"}
    />
  );
}
