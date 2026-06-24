import { createClient } from "@/lib/supabase/server";
import { TeachersView } from "./TeachersView";

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const supabase = await createClient();

  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, user_id, full_name, username, created_at")
    .order("full_name");

  return (
    <TeachersView teachers={teachers ?? []} defaultOpenAdd={action === "add"} />
  );
}
