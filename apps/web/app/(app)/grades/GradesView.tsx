"use client";

import { useState } from "react";
import { getDictionary, getSubjectConfig } from "@snr/core";
import type { Locale, StudentGradeItem } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { cn } from "@/lib/cn";

interface Props {
  grades: StudentGradeItem[];
}

type TypeFilter = "all" | "file" | "test";

function gradeColor(g5: number | null): string {
  if (g5 == null) return "text-slate-400";
  if (g5 >= 4.5) return "text-emerald-600";
  if (g5 >= 3.0) return "text-amber-600";
  return "text-red-500";
}

export function GradesView({ grades }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const subjects = Array.from(new Set(grades.map((g) => g.subject)));

  // KPI (over all graded works)
  const scored = grades.filter((g) => g.grade5 != null);
  const avgScore = scored.length
    ? (scored.reduce((a, g) => a + (g.grade5 ?? 0), 0) / scored.length).toFixed(1)
    : "—";
  const doneCount = grades.length;
  // Best subject by average grade5
  let bestSubject = "—";
  if (scored.length) {
    const bySub = new Map<string, { sum: number; n: number }>();
    scored.forEach((g) => {
      const cur = bySub.get(g.subject) ?? { sum: 0, n: 0 };
      cur.sum += g.grade5 ?? 0; cur.n += 1;
      bySub.set(g.subject, cur);
    });
    let bestAvg = -1;
    bySub.forEach((v, sub) => {
      const avg = v.sum / v.n;
      if (avg > bestAvg) { bestAvg = avg; bestSubject = getSubjectConfig(sub).label; }
    });
  }

  // Filter + group by subject
  const filtered = grades.filter((g) => {
    if (subjectFilter !== "all" && g.subject !== subjectFilter) return false;
    if (typeFilter !== "all" && g.kind !== typeFilter) return false;
    return true;
  });
  const groupsBySubject = subjects
    .map((sub) => ({ sub, items: filtered.filter((g) => g.subject === sub) }))
    .filter((grp) => grp.items.length > 0);

  const kpis = [
    { label: "Средний балл", value: avgScore },
    { label: "Выполнено работ", value: doneCount },
    { label: "Лучший предмет", value: bestSubject },
  ];

  const typePills: { key: TypeFilter; label: string }[] = [
    { key: "all", label: "Все типы" },
    { key: "file", label: d.homework.typeFile },
    { key: "test", label: d.homework.typeTest },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-bold text-brand-ink">Мои оценки</h1>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-[20px] border border-white/80 bg-white/70 p-5 backdrop-blur-xl"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
            <div className="truncate text-[26px] font-bold leading-none text-brand-ink">{k.value}</div>
            <div className="mt-1 text-[13px] font-medium text-brand-ink-muted">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}
          className="rounded-[10px] border border-white/80 bg-white/70 px-3 py-1.5 text-[13px] font-medium text-brand-ink focus:outline-none">
          <option value="all">Все предметы</option>
          {subjects.map((s) => <option key={s} value={s}>{getSubjectConfig(s).label}</option>)}
        </select>
        {typePills.map((p) => (
          <button key={p.key} onClick={() => setTypeFilter(p.key)}
            className={cn("rounded-[10px] px-4 py-1.5 text-[13px] font-semibold transition-all",
              typeFilter === p.key ? "bg-brand-blue text-white shadow" : "border border-white/80 bg-white/70 text-brand-ink-muted hover:text-brand-ink")}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {groupsBySubject.length === 0 ? (
        <div className="rounded-[20px] border border-white/80 bg-white/70 p-8 text-center text-brand-ink-muted">
          У тебя пока нет оценённых работ
        </div>
      ) : (
        <div className="space-y-5">
          {groupsBySubject.map(({ sub, items }) => {
            const cfg = getSubjectConfig(sub);
            const scoredItems = items.filter((g) => g.grade5 != null);
            const subAvg = scoredItems.length
              ? (scoredItems.reduce((a, g) => a + (g.grade5 ?? 0), 0) / scoredItems.length).toFixed(1)
              : "—";
            const sorted = [...items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

            return (
              <div key={sub} className="space-y-2">
                {/* Subject section header */}
                <div className="flex items-center gap-3 px-1">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[12px] text-[18px]"
                    style={{ background: cfg.color + "20" }}>
                    {cfg.emoji}
                  </div>
                  <h2 className="text-[16px] font-bold text-brand-ink">{cfg.label}</h2>
                  <span className="ml-auto text-[14px] font-bold text-brand-ink">{subAvg}<span className="text-[12px] font-medium text-slate-400"> / 5</span></span>
                </div>

                {/* Grade cards */}
                <div className="space-y-2">
                  {sorted.map((g) => (
                    <div key={g.id} className="flex items-start gap-3 rounded-[16px] border border-white/80 bg-white/70 p-4 backdrop-blur-xl"
                      style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            g.kind === "test" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700")}>
                            {g.kind === "test" ? d.homework.typeTest : d.homework.typeFile}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(g.date).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <div className="text-[14px] font-semibold text-brand-ink">{g.title}</div>
                        {g.comment && (
                          <div className="mt-1 text-[12px] italic text-brand-ink-muted">«{g.comment}»</div>
                        )}
                      </div>
                      <div className={cn("shrink-0 text-[22px] font-bold leading-none", gradeColor(g.grade5))}>
                        {g.display}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
