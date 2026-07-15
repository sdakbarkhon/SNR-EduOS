import { createClient } from "@/lib/supabase/server";
import { NewParentForm } from "./NewParentForm";

export default async function NewParentPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: students, error: studentsError } = await (supabase as any)
    .from("students")
    .select("id, full_name, username")
    .order("full_name");
  if (studentsError) console.error("[NewParentPage] students query failed:", studentsError.message);

  return <NewParentForm students={(students ?? []) as { id: string; full_name: string; username: string }[]} />;
}
