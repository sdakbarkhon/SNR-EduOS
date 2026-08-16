import { createClient } from "@/lib/supabase/server";
import { SchoolsView } from "./SchoolsView";

export default async function SuperAdminSchoolsPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Z.1: демо-школа не показывается суперадмину (schools.is_demo, миграция 170).
  // Без фильтра она шла ПЕРВОЙ строкой — создана 04.07 против 29.07 у реальной.
  const { data: schools } = await (supabase as any)
    .from("schools")
    .select("id, name, code, autostart_enabled, created_at, is_active")
    .eq("is_demo", false)
    .order("created_at");

  const rows = (schools ?? []) as {
    id: string; name: string; code: string | null; autostart_enabled: boolean; created_at: string;
    is_active: boolean;
  }[];

  return <SchoolsView schools={rows} />;
}
