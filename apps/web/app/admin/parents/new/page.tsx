import { createClient } from "@/lib/supabase/server";
import { NewParentForm } from "./NewParentForm";

export default async function NewParentPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: students } = await (supabase as any)
    .from("students")
    .select("id, full_name, username")
    .order("full_name");

  return <NewParentForm students={(students ?? []) as { id: string; full_name: string; username: string }[]} />;
}
