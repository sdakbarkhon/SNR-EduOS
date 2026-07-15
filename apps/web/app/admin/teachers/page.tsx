import { createClient } from "@/lib/supabase/server";
import { TeachersView } from "./TeachersView";

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const supabase = await createClient();

  const { data: teachers, error: teachersError } = await supabase
    .from("teachers")
    .select("id, user_id, full_name, username, created_at")
    .order("full_name");
  if (teachersError) console.error("[AdminTeachersPage] teachers query failed:", teachersError.message);

  return (
    <TeachersView teachers={teachers ?? []} defaultOpenAdd={action === "add"} />
  );
}
