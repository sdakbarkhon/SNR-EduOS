import { schoolViewContext } from "@/lib/school-view";
import { TableClient } from "../TableClient";

export const dynamic = "force-dynamic";

export default async function SchoolStudentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school } = await schoolViewContext(id);

  const [{ data: students }, { data: groups }, { data: links }] = await Promise.all([
    db.from("students").select("id, full_name, username, grade, status").eq("school_id", school.id).order("full_name"),
    db.from("groups").select("id, name").eq("school_id", school.id),
    db.from("student_groups").select("group_id, student_id").eq("school_id", school.id),
  ]);

  const имя = new Map<string, string>((groups ?? []).map((g: { id: string; name: string }) => [g.id, g.name] as const));
  const поУченику = new Map<string, string[]>();
  for (const l of (links ?? []) as Array<{ group_id: string; student_id: string }>) {
    const n = имя.get(l.group_id);
    if (!n) continue;
    const было = поУченику.get(l.student_id);
    if (было) было.push(n); else поУченику.set(l.student_id, [n]);
  }

  const rows = (students ?? []).map((s: {
    id: string; full_name: string; username: string | null; grade: string | null; status: string | null;
  }) => ({
    id: s.id,
    full_name: s.full_name,
    username: s.username,
    grade: s.grade,
    groups: (поУченику.get(s.id) ?? []).join(", "),
    status: s.status,
  }));

  return (
    <TableClient
      titleKey="svTabStudents"
      columns={[
        { key: "full_name", labelKey: "svColName" },
        { key: "username", labelKey: "svColLogin" },
        { key: "grade", labelKey: "svColGrade", narrow: true },
        { key: "groups", labelKey: "svColGroups" },
        { key: "status", labelKey: "svColStatus", narrow: true },
      ]}
      rows={rows}
    />
  );
}
