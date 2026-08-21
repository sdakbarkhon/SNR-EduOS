import { schoolViewContext } from "@/lib/school-view";
import { TableClient } from "../TableClient";

export const dynamic = "force-dynamic";

export default async function SchoolTeachersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school } = await schoolViewContext(id);

  const [{ data: teachers }, { data: subjects }] = await Promise.all([
    db.from("teachers").select("id, full_name, username, subject_slug").eq("school_id", school.id).order("full_name"),
    db.from("subjects").select("teacher_id, name").eq("school_id", school.id).not("teacher_id", "is", null),
  ]);

  const поУчителю = new Map<string, Set<string>>();
  for (const s of (subjects ?? []) as Array<{ teacher_id: string; name: string }>) {
    if (!поУчителю.has(s.teacher_id)) поУчителю.set(s.teacher_id, new Set());
    поУчителю.get(s.teacher_id)!.add(s.name);
  }

  const rows = (teachers ?? []).map((t: {
    id: string; full_name: string; username: string | null; subject_slug: string | null;
  }) => ({
    id: t.id,
    full_name: t.full_name,
    username: t.username,
    subject: t.subject_slug,
    subjects: [...(поУчителю.get(t.id) ?? [])].join(", "),
  }));

  return (
    <TableClient
      titleKey="svTabTeachers"
      columns={[
        { key: "full_name", labelKey: "svColName" },
        { key: "username", labelKey: "svColLogin" },
        { key: "subject", labelKey: "svColMainSubject" },
        { key: "subjects", labelKey: "svColTeaches" },
      ]}
      rows={rows}
    />
  );
}
