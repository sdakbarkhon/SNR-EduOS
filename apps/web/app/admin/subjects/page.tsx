import { createClient } from "@/lib/supabase/server";
import { AdminSubjectsView } from "./AdminSubjectsView";

// Z.2.2 — справочник предметов школы (school_subjects, миграция 171).
// Раньше эта страница была «предметы внутри группы» и требовала сперва выбрать
// группу; теперь группы и учителя здесь не участвуют вовсе — они переехали на
// /admin/subject-assignments. RLS сама ограничивает выборку своей школой
// (school_subjects_select_authenticated), поэтому явный фильтр по school_id
// здесь не нужен — в отличие от записи, которая идёт через server action.
export default async function AdminSubjectsPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: catalog, error } = await sb
    .from("school_subjects")
    .select("id, name, icon, color, is_active, subjects(count)")
    .order("is_active", { ascending: false })
    .order("name");
  if (error) console.error("[AdminSubjectsPage] catalog query failed:", error.message);

  const rows = ((catalog ?? []) as Array<{
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

  return <AdminSubjectsView subjects={rows} />;
}
