import { createClient } from "@/lib/supabase/server";
import { GroupsView } from "./GroupsView";

export default async function AdminGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const supabase = await createClient();

  const [{ data: groups, error: groupsError }, { data: teachers, error: teachersError }] = await Promise.all([
    supabase
      .from("groups")
      .select(
        "id, name, subject, teacher_id, teachers(id, full_name), student_groups(student_id)",
      )
      .order("name"),
    supabase.from("teachers").select("id, full_name").order("full_name"),
  ]);
  if (groupsError) console.error("[AdminGroupsPage] groups query failed:", groupsError.message);
  if (teachersError) console.error("[AdminGroupsPage] teachers query failed:", teachersError.message);

  return (
    <GroupsView
      groups={groups ?? []}
      teachers={teachers ?? []}
      defaultOpenAdd={action === "add"}
    />
  );
}
