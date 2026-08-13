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

/** Чек-лист первого запуска. Пустая школа раньше встречала сводкой из четырёх
 *  нулей — она ничего не подсказывала, а порядок заведения приходилось угадывать
 *  перебором. Считаем ровно шесть шагов; RLS сама сужает всё до своей школы. */
async function getSetupProgress(supabase: Awaited<ReturnType<typeof createClient>>) {
  // school_subjects (миграция 171) в сгенерированные типы не попал — здесь тот
  // же приём, что в admin/groups/page.tsx: явное расширение на один запрос.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = supabase as any;
  const [subjects, teachers, groups, assignments, students, parents] = await Promise.all([
    sbAny.from("school_subjects").select("id", { count: "exact", head: true }),
    supabase.from("teachers").select("id", { count: "exact", head: true }),
    supabase.from("groups").select("id", { count: "exact", head: true }),
    supabase.from("subjects").select("id", { count: "exact", head: true }),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("parents").select("id", { count: "exact", head: true }),
  ]);
  return {
    subjects: subjects.count ?? 0,
    teachers: teachers.count ?? 0,
    groups: groups.count ?? 0,
    assignments: assignments.count ?? 0,
    students: students.count ?? 0,
    parents: parents.count ?? 0,
  };
}

export default async function AdminPage() {
  const supabase = await createClient();
  const [stats, recentStudents, setup] = await Promise.all([
    getAdminStats(supabase),
    getRecentActivity(supabase),
    getSetupProgress(supabase),
  ]);

  return <AdminDashboardView stats={stats} recentStudents={recentStudents} setup={setup} />;
}
