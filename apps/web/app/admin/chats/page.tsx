import { createClient } from "@/lib/supabase/server";
import { AdminChatsView } from "./AdminChatsView";

export default async function AdminChatsPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [{ data: teachers }, { data: groups }] = await Promise.all([
    sb.from("teachers").select("id, full_name").order("full_name"),
    sb.from("groups").select("id, name").order("name"),
  ]);

  return (
    <AdminChatsView
      teachers={(teachers ?? []) as Array<{ id: string; full_name: string }>}
      groups={(groups ?? []) as Array<{ id: string; name: string }>}
    />
  );
}
