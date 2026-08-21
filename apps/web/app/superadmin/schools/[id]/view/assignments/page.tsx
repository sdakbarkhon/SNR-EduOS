import { schoolViewContext } from "@/lib/school-view";
import { TableClient } from "../TableClient";

export const dynamic = "force-dynamic";

/** Назначения: какой предмет в какой группе ведёт какой учитель. */
export default async function SchoolAssignmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school } = await schoolViewContext(id);

  const [{ data: rowsRaw }, { data: groups }, { data: teachers }] = await Promise.all([
    db.from("subjects").select("id, name, group_id, teacher_id, is_active").eq("school_id", school.id).order("name"),
    db.from("groups").select("id, name").eq("school_id", school.id),
    db.from("teachers").select("id, full_name").eq("school_id", school.id),
  ]);

  const гр = new Map<string, string>((groups ?? []).map((g: { id: string; name: string }) => [g.id, g.name] as const));
  const уч = new Map<string, string>((teachers ?? []).map((t: { id: string; full_name: string }) => [t.id, t.full_name] as const));

  const rows = (rowsRaw ?? []).map((s: {
    id: string; name: string; group_id: string | null; teacher_id: string | null; is_active: boolean;
  }) => ({
    id: s.id,
    name: s.name,
    group: s.group_id ? гр.get(s.group_id) ?? null : null,
    teacher: s.teacher_id ? уч.get(s.teacher_id) ?? null : null,
    active: s.is_active ? "✓" : "—",
  }));

  return (
    <TableClient
      titleKey="svTabAssignments"
      columns={[
        { key: "name", labelKey: "svColSubject" },
        { key: "group", labelKey: "svColGroup" },
        { key: "teacher", labelKey: "svColTeacher" },
        { key: "active", labelKey: "svColActive", narrow: true, right: true },
      ]}
      rows={rows}
    />
  );
}
