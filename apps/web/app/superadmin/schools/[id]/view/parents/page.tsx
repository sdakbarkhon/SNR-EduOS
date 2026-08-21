import { schoolViewContext, maskPhone } from "@/lib/school-view";
import { TableClient } from "../TableClient";

export const dynamic = "force-dynamic";

/**
 * Родители. Телефон показывается ХВОСТОМ НОМЕРА — решение заказчика: он
 * нужен, чтобы отличить одну строку от другой, а не чтобы позвонить, и он же
 * служит ключом входа в кабинет родителя. Код входа (parent_phone_codes) не
 * показывается здесь никогда и ни в каком виде.
 */
export default async function SchoolParentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school } = await schoolViewContext(id);

  const [{ data: parents }, { data: links }, { data: students }] = await Promise.all([
    db.from("parents").select("id, full_name, phone, user_id").eq("school_id", school.id).order("full_name"),
    db.from("parent_students").select("parent_id, student_id").eq("school_id", school.id),
    db.from("students").select("id, full_name").eq("school_id", school.id),
  ]);

  const имя = new Map<string, string>((students ?? []).map((s: { id: string; full_name: string }) => [s.id, s.full_name] as const));
  const дети = new Map<string, string[]>();
  for (const l of (links ?? []) as Array<{ parent_id: string; student_id: string }>) {
    const n = имя.get(l.student_id);
    if (!n) continue;
    const было = дети.get(l.parent_id);
    if (было) было.push(n); else дети.set(l.parent_id, [n]);
  }

  const rows = (parents ?? []).map((p: {
    id: string; full_name: string; phone: string | null; user_id: string | null;
  }) => ({
    id: p.id,
    full_name: p.full_name,
    phone: maskPhone(p.phone),
    children: (дети.get(p.id) ?? []).join(", "),
    registered: p.user_id ? "✓" : "—",
  }));

  return (
    <TableClient
      titleKey="svTabParents"
      noteKey="svParentsNote"
      columns={[
        { key: "full_name", labelKey: "svColName" },
        { key: "phone", labelKey: "svColPhone", narrow: true },
        { key: "children", labelKey: "svColChildren" },
        { key: "registered", labelKey: "svColRegistered", narrow: true, right: true },
      ]}
      rows={rows}
    />
  );
}
