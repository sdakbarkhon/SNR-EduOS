import { createClient } from "@/lib/supabase/server";
import { StudentsView } from "./StudentsView";

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const supabase = await createClient();

  const [{ data: students, error: studentsError }, { data: groups, error: groupsError }] = await Promise.all([
    supabase
      .from("students")
      .select(
        "id, user_id, full_name, username, created_at, student_groups(group_id, groups(id, name, subject))",
      )
      .order("full_name"),
    supabase.from("groups").select("id, name, subject").order("name"),
  ]);
  if (studentsError) console.error("[AdminStudentsPage] students query failed:", studentsError.message);
  if (groupsError) console.error("[AdminStudentsPage] groups query failed:", groupsError.message);

  return (
    <StudentsView
      students={students ?? []}
      groups={groups ?? []}
      defaultOpenAdd={action === "add"}
    />
  );
}
