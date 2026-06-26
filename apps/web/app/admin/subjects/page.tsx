import { createClient } from "@/lib/supabase/server";
import { AdminSubjectsView } from "./AdminSubjectsView";

export default async function AdminSubjectsPage() {
  const supabase = await createClient();

  const [groupsRes, teachersRes] = await Promise.all([
    supabase.from("groups").select("id, name, subject").order("name"),
    supabase.from("teachers").select("id, full_name").order("full_name"),
  ]);

  return (
    <AdminSubjectsView
      groups={groupsRes.data ?? []}
      teachers={teachersRes.data ?? []}
    />
  );
}
