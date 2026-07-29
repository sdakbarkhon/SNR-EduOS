import { createClient } from "@/lib/supabase/server";
import { AdminDashboardView } from "./AdminDashboardView";

async function getAdminStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ count: students }, { count: teachers }, { count: groups }, { count: lessons }] =
    await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }),
      supabase.from("teachers").select("id", { count: "exact", head: true }),
      supabase.from("groups").select("id", { count: "exact", head: true }),
      supabase.from("lessons").select("id", { count: "exact", head: true }),
    ]);
  return {
    students: students ?? 0,
    teachers: teachers ?? 0,
    groups: groups ?? 0,
    lessons: lessons ?? 0,
  };
}

async function getRecentActivity(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: recentStudents } = await supabase
    .from("students")
    .select("id, full_name, username, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  return recentStudents ?? [];
}

export default async function AdminPage() {
  const supabase = await createClient();
  const [stats, recentStudents] = await Promise.all([
    getAdminStats(supabase),
    getRecentActivity(supabase),
  ]);

  return <AdminDashboardView stats={stats} recentStudents={recentStudents} />;
}
