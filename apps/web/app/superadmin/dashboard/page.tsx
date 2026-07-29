import { createClient } from "@/lib/supabase/server";
import { SuperAdminDashboardView } from "./SuperAdminDashboardView";

async function getStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [{ count: schools }, { count: admins }, { count: students }, { count: teachers }] =
    await Promise.all([
      sb.from("schools").select("id", { count: "exact", head: true }),
      sb.from("admins").select("id", { count: "exact", head: true }),
      sb.from("students").select("id", { count: "exact", head: true }),
      sb.from("teachers").select("id", { count: "exact", head: true }),
    ]);
  return {
    schools: schools ?? 0,
    admins: admins ?? 0,
    students: students ?? 0,
    teachers: teachers ?? 0,
  };
}

export default async function SuperAdminDashboardPage() {
  const supabase = await createClient();
  const stats = await getStats(supabase);

  return <SuperAdminDashboardView stats={stats} />;
}
