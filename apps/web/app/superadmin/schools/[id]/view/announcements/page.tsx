import { schoolViewContext } from "@/lib/school-view";
import { TableClient } from "../TableClient";

export const dynamic = "force-dynamic";

/**
 * Объявления только на чтение. Экран объявлений из админки НЕ
 * переиспользуется: там удаление и закрепление идут прямо из браузера, а
 * правила доступа суперадмина пропускают.
 */
export default async function SchoolAnnouncementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school } = await schoolViewContext(id);

  const { data } = await db
    .from("announcements")
    .select("id, title, scope, category, is_pinned, created_at")
    .eq("school_id", school.id).order("created_at", { ascending: false }).limit(200);

  const rows = (data ?? []).map((a: {
    id: string; title: string; scope: string | null; category: string | null;
    is_pinned: boolean; created_at: string;
  }) => ({
    id: a.id,
    title: a.title,
    scope: a.scope,
    category: a.category,
    pinned: a.is_pinned ? "📌" : "—",
    at: new Date(a.created_at).toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" }),
  }));

  return (
    <TableClient
      titleKey="svTabAnnouncements"
      columns={[
        { key: "title", labelKey: "svColTitle" },
        { key: "scope", labelKey: "svColScope", narrow: true },
        { key: "category", labelKey: "svColCategory", narrow: true },
        { key: "pinned", labelKey: "svColPinned", narrow: true, right: true },
        { key: "at", labelKey: "svColDate", right: true, narrow: true },
      ]}
      rows={rows}
    />
  );
}
