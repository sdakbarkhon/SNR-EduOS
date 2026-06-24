import { createClient } from "@/lib/supabase/server";
import { StudentsView } from "./StudentsView";

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const supabase = await createClient();

  const [{ data: students }, { data: groups }] = await Promise.all([
    supabase
      .from("students")
      .select(
        "id, user_id, full_name, username, created_at, student_groups(group_id, groups(id, name, subject))",
      )
      .order("full_name"),
    supabase.from("groups").select("id, name, subject").order("name"),
  ]);

  return (
    <StudentsView
      students={students ?? []}
      groups={groups ?? []}
      defaultOpenAdd={action === "add"}
    />
  );
}
