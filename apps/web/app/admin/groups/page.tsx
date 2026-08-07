import { createClient } from "@/lib/supabase/server";
import { GroupsView } from "./GroupsView";

export default async function AdminGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const supabase = await createClient();

  // Z.2.2: справочник школы вместо захардкоженного списка предметов в форме.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = supabase as any;
  const [
    { data: groups, error: groupsError },
    { data: teachers, error: teachersError },
    { data: catalog, error: catalogError },
  ] = await Promise.all([
    supabase
      .from("groups")
      .select(
        "id, name, subject, teacher_id, teachers(id, full_name), student_groups(student_id)",
      )
      .order("name"),
    supabase.from("teachers").select("id, full_name").order("full_name"),
    sbAny.from("school_subjects").select("id, name, is_active").order("name"),
  ]);
  if (groupsError) console.error("[AdminGroupsPage] groups query failed:", groupsError.message);
  if (teachersError) console.error("[AdminGroupsPage] teachers query failed:", teachersError.message);
  if (catalogError) console.error("[AdminGroupsPage] catalog query failed:", catalogError.message);

  return (
    <GroupsView
      groups={groups ?? []}
      teachers={teachers ?? []}
      catalog={catalog ?? []}
      defaultOpenAdd={action === "add"}
    />
  );
}
