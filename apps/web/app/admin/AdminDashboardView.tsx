"use client";

import Link from "next/link";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

type RecentStudent = { id: string; full_name: string; username: string; created_at: string };

export function AdminDashboardView({
  stats,
  recentStudents,
}: {
  stats: { students: number; teachers: number; groups: number; lessons: number };
  recentStudents: RecentStudent[];
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.admin;

  const statCards = [
    { label: t.statStudents, value: stats.students, href: "/admin/students", color: "#3B82F6" },
    { label: t.statTeachers, value: stats.teachers, href: "/admin/teachers", color: "#10B981" },
    { label: t.statGroups, value: stats.groups, href: "/admin/groups", color: "#F59E0B" },
    { label: t.statLessons, value: stats.lessons, href: null, color: "#8B5CF6" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t.dashboardTitle}</h1>
        <p className="mt-1 text-sm text-gray-500">{t.dashboardSubtitle}</p>
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
        <h2 className="mb-4 text-base font-semibold text-gray-700">{t.quickActions}</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/students?action=add"
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
          >
            {t.addStudent}
          </Link>
          <Link
            href="/admin/teachers?action=add"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            {t.addTeacher}
          </Link>
          <Link
            href="/admin/groups?action=add"
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600"
          >
            {t.addGroup}
          </Link>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-base font-semibold text-gray-700">{t.recentStudentsTitle}</h2>
        {recentStudents.length === 0 ? (
          <p className="text-sm text-gray-400">{t.noActivity}</p>
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
