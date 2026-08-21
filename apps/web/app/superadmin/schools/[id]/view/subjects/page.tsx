import { schoolViewContext } from "@/lib/school-view";
import { TableClient } from "../TableClient";

export const dynamic = "force-dynamic";

export default async function SchoolSubjectsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school } = await schoolViewContext(id);

  const { data } = await db
    .from("school_subjects").select("id, name, is_active").eq("school_id", school.id).order("name");

  const rows = (data ?? []).map((s: { id: string; name: string; is_active: boolean }) => ({
    id: s.id, name: s.name, active: s.is_active ? "✓" : "—",
  }));

  return (
    <TableClient
      titleKey="svTabSubjects"
      columns={[
        { key: "name", labelKey: "svColName" },
        { key: "active", labelKey: "svColActive", narrow: true, right: true },
      ]}
      rows={rows}
    />
  );
}
