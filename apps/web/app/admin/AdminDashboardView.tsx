"use client";

import Link from "next/link";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

type RecentStudent = { id: string; full_name: string; username: string; created_at: string };

/** Шесть шагов заведения школы. Порядок не декоративный: форма группы требует
 *  предмет из справочника, форма ученика — группу, форма родителя — ученика. */
export type SetupProgress = {
  subjects: number; teachers: number; groups: number;
  assignments: number; students: number; parents: number;
};

export function AdminDashboardView({
  stats,
  recentStudents,
  setup,
}: {
  stats: { students: number; teachers: number; groups: number; lessons: number };
  recentStudents: RecentStudent[];
  setup: SetupProgress;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.admin;

  const steps = [
    { key: "subjects",    done: setup.subjects > 0,    label: t.setupSubjects,    hint: t.setupSubjectsHint,    href: "/admin/subjects" },
    { key: "teachers",    done: setup.teachers > 0,    label: t.setupTeachers,    hint: t.setupTeachersHint,    href: "/admin/teachers" },
    { key: "groups",      done: setup.groups > 0,      label: t.setupGroups,      hint: t.setupGroupsHint,      href: "/admin/groups" },
    { key: "assignments", done: setup.assignments > 0, label: t.setupAssignments, hint: t.setupAssignmentsHint, href: "/admin/subject-assignments" },
    { key: "students",    done: setup.students > 0,    label: t.setupStudents,    hint: t.setupStudentsHint,    href: "/admin/students" },
    { key: "parents",     done: setup.parents > 0,     label: t.setupParents,     hint: t.setupParentsHint,     href: "/admin/parents" },
  ];
  // Чек-лист заменяет сводку, пока в школе нет ни одного ученика: до этого
  // момента все четыре числа сводки — нули, и смотреть на них незачем.
  const showSetup = setup.students === 0;
  const nextIdx = steps.findIndex((s) => !s.done);

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

      {showSetup && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-lg font-bold text-gray-800">{t.setupTitle}</h2>
          <p className="mt-1 text-sm text-gray-500">{t.setupSubtitle}</p>
          <ol className="mt-5 space-y-2">
            {steps.map((step, i) => {
              const isNext = i === nextIdx;
              return (
                <li
                  key={step.key}
                  className={
                    "flex items-start gap-3 rounded-xl border p-3 " +
                    (step.done
                      ? "border-emerald-200 bg-emerald-50/50"
                      : isNext
                        ? "border-violet-300 bg-violet-50/60"
                        : "border-gray-100")
                  }
                >
                  <span
                    className={
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
                      (step.done
                        ? "bg-emerald-500 text-white"
                        : isNext
                          ? "bg-violet-600 text-white"
                          : "bg-gray-100 text-gray-400")
                    }
                  >
                    {step.done ? "✓" : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{step.label}</span>
                      {step.done && <span className="text-xs font-medium text-emerald-600">{t.setupDone}</span>}
                      {!step.done && isNext && <span className="text-xs font-medium text-violet-600">{t.setupNow}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{step.hint}</p>
                  </div>
                  <Link
                    href={step.href}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50"
                  >
                    {t.setupOpen}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}

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
