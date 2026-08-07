import { createClient } from "@/lib/supabase/server";
import { SuperAdminDashboardView } from "./SuperAdminDashboardView";

// Z.1, 06.08.2026 — демо-школа невидима для суперадмина. Счётчики раньше
// считали ВСЮ базу (2 школы / 1 админ / 30 учеников / 7 учителей), из которых
// всё кроме школ на 100% принадлежит демо-школе, а реальная вносила нули.
// Теперь: сначала берём id не-демо школ (schools.is_demo, миграция 170), затем
// считаем только по ним. Пустой список -> нули без лишних запросов.
async function getStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: schoolRows } = await sb.from("schools").select("id").eq("is_demo", false);
  const schoolIds = ((schoolRows ?? []) as { id: string }[]).map((s) => s.id);

  if (schoolIds.length === 0) {
    return { schools: 0, admins: 0, students: 0, teachers: 0 };
  }

  const [{ count: admins }, { count: students }, { count: teachers }] = await Promise.all([
    sb.from("admins").select("id", { count: "exact", head: true }).in("school_id", schoolIds),
    sb.from("students").select("id", { count: "exact", head: true }).in("school_id", schoolIds),
    sb.from("teachers").select("id", { count: "exact", head: true }).in("school_id", schoolIds),
  ]);

  return {
    schools: schoolIds.length,
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
