import { schoolViewContext } from "@/lib/school-view";
import { TableClient } from "../TableClient";

export const dynamic = "force-dynamic";

export default async function SchoolGroupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school } = await schoolViewContext(id);

  const [{ data: groups }, { data: teachers }, { data: links }] = await Promise.all([
    db.from("groups").select("id, name, subject, teacher_id, schedule_days").eq("school_id", school.id).order("name"),
    db.from("teachers").select("id, full_name").eq("school_id", school.id),
    db.from("student_groups").select("group_id, student_id").eq("school_id", school.id),
  ]);

  const имя = new Map<string, string>((teachers ?? []).map((t: { id: string; full_name: string }) => [t.id, t.full_name] as const));
  const счёт = new Map<string, number>();
  for (const l of (links ?? []) as Array<{ group_id: string }>) {
    счёт.set(l.group_id, (счёт.get(l.group_id) ?? 0) + 1);
  }

  const rows = (groups ?? []).map((g: {
    id: string; name: string; subject: string | null; teacher_id: string | null;
    schedule_days: string[] | null;
  }) => ({
    id: g.id,
    name: g.name,
    subject: g.subject,
    teacher: g.teacher_id ? имя.get(g.teacher_id) ?? null : null,
    students: счёт.get(g.id) ?? 0,
    days: Array.isArray(g.schedule_days) ? g.schedule_days.join(", ") : null,
  }));

  return (
    <TableClient
      titleKey="svTabGroups"
      columns={[
        { key: "name", labelKey: "svColName" },
        { key: "subject", labelKey: "svColSubject" },
        { key: "teacher", labelKey: "svColTeacher" },
        { key: "students", labelKey: "svColStudents", right: true, narrow: true },
        { key: "days", labelKey: "svColDays" },
      ]}
      rows={rows}
    />
  );
}
