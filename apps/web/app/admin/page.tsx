import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

  const statCards = [
    { label: "Учеников", value: stats.students, href: "/admin/students", color: "#3B82F6" },
    { label: "Учителей", value: stats.teachers, href: "/admin/teachers", color: "#10B981" },
    { label: "Групп", value: stats.groups, href: "/admin/groups", color: "#F59E0B" },
    { label: "Уроков", value: stats.lessons, href: null, color: "#8B5CF6" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Главная</h1>
        <p className="mt-1 text-sm text-gray-500">Обзор системы SNR EduOS</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => {
          const inner = (
            <div
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition-all hover:shadow-md"
              style={{ borderTop: `3px solid ${card.color}` }}
            >
              <div className="text-3xl font-bold" style={{ color: card.color }}>
                {card.value}
              </div>
              <div className="mt-1 text-sm font-medium text-gray-600">{card.label}</div>
            </div>
          );
          return card.href ? (
            <Link key={card.label} href={card.href}>
              {inner}
            </Link>
          ) : (
            <div key={card.label}>{inner}</div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-base font-semibold text-gray-700">Быстрые действия</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/students?action=add"
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
          >
            + Добавить ученика
          </Link>
          <Link
            href="/admin/teachers?action=add"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            + Добавить учителя
          </Link>
          <Link
            href="/admin/groups?action=add"
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600"
          >
            + Создать группу
          </Link>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-base font-semibold text-gray-700">Последние добавленные ученики</h2>
        {recentStudents.length === 0 ? (
          <p className="text-sm text-gray-400">Действий пока нет</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentStudents.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.full_name}</p>
                  <p className="text-xs text-gray-400">@{s.username}</p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(s.created_at).toLocaleDateString("ru-RU")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
