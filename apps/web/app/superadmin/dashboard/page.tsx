import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

  const statCards = [
    { label: "Школ", value: stats.schools, href: "/superadmin/schools", color: "#0EA5E9" },
    { label: "Админов", value: stats.admins, href: "/superadmin/admins", color: "#8B5CF6" },
    { label: "Учеников", value: stats.students, href: null, color: "#10B981" },
    { label: "Учителей", value: stats.teachers, href: null, color: "#F59E0B" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Главная</h1>
        <p className="mt-1 text-sm text-gray-500">Обзор всех школ SNR EduOS</p>
      </div>

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

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-base font-semibold text-gray-700">Быстрые действия</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/superadmin/admins?action=add"
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-900"
          >
            + Добавить админа школы
          </Link>
        </div>
      </div>
    </div>
  );
}
