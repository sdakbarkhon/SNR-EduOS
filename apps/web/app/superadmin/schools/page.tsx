import { createClient } from "@/lib/supabase/server";
import { SchoolsView } from "./SchoolsView";

export default async function SuperAdminSchoolsPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: schools } = await (supabase as any)
    .from("schools")
    .select("id, name, code, autostart_enabled, created_at")
    .order("created_at");

  const rows = (schools ?? []) as {
    id: string; name: string; code: string | null; autostart_enabled: boolean; created_at: string;
  }[];

  return <SchoolsView schools={rows} />;
}
