"use client";

import { getDictionary, getSubjectStyle } from "@snr/core";
import type { Locale, StudentGradeItem } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { ParentChild } from "@/lib/parent-child";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function average(items: StudentGradeItem[]): number | null {
  const values = items.map((i) => i.grade5).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function GradesView({ child, grades }: { child: ParentChild; grades: StudentGradeItem[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.parentUi;

  const bySubject = new Map<string, StudentGradeItem[]>();
  for (const g of grades) {
    const key = g.subject || "—";
    const arr = bySubject.get(key) ?? [];
    arr.push(g);
    bySubject.set(key, arr);
  }
  const subjectGroups = [...bySubject.entries()].sort(([a], [b]) => a.localeCompare(b));
  const overallAvg = average(grades);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t.gradesTitle}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {child.full_name}
          {child.className ? ` · ${child.className}` : ""}
        </p>
      </div>

      {grades.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-sm text-gray-400">{t.noGrades}</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t.overallAverage}</p>
            <p className="mt-1 text-4xl font-black text-pink-600">{overallAvg?.toFixed(2) ?? "—"}</p>
          </div>

          {subjectGroups.map(([subject, items]) => {
            const style = getSubjectStyle(subject);
            const avg = average(items);
            return (
              <div key={subject} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: style.color }}
                    />
                    <h2 className="text-base font-semibold text-gray-700">{style.label}</h2>
                  </div>
                  <span className="text-xs font-semibold text-gray-400">
                    {t.subjectAverage}: <span className="text-sm font-bold text-gray-700">{avg?.toFixed(2) ?? "—"}</span>
                  </span>
                </div>
                <ul className="divide-y divide-gray-100">
                  {items.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">{g.title}</p>
                        <p className="truncate text-xs text-gray-400">{formatDate(g.date)}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-pink-50 px-2.5 py-1 text-sm font-bold text-pink-700">
                        {g.display}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
