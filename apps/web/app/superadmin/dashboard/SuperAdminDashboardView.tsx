"use client";

import Link from "next/link";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

export function SuperAdminDashboardView({
  stats,
}: {
  stats: { schools: number; admins: number; students: number; teachers: number };
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.superadmin;

  const statCards = [
    { label: t.statSchools, value: stats.schools, href: "/superadmin/schools", color: "#0EA5E9" },
    { label: t.statAdmins, value: stats.admins, href: "/superadmin/admins", color: "#8B5CF6" },
    { label: t.statStudents, value: stats.students, href: null, color: "#10B981" },
    { label: t.statTeachers, value: stats.teachers, href: null, color: "#F59E0B" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t.dashboardTitle}</h1>
        <p className="mt-1 text-sm text-gray-500">{t.dashboardSubtitle}</p>
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
        <h2 className="mb-4 text-base font-semibold text-gray-700">{t.quickActionsTitle}</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/superadmin/admins?action=add"
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-900"
          >
            {t.addSchoolAdminQuick}
          </Link>
        </div>
      </div>
    </div>
  );
}
