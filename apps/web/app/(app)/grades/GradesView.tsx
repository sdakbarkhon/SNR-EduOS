"use client";

import { useState } from "react";
import { getDictionary, getSubjectConfig } from "@snr/core";
import type { Locale, StudentGradeItem } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { cn } from "@/lib/cn";
import { ArrowDown, ArrowUp } from "lucide-react";
import { AiGradesCard } from "./AiGradesCard";

interface Props {
  grades: StudentGradeItem[];
}

type TypeFilter = "all" | "file" | "test" | "classwork";
type SortKey = "subject" | "date" | "grade";

/** Цвет оценки по проценту: >=80% зелёный, 50-79% жёлтый, <50% красный. */
function gradeColor(g5: number | null): string {
  if (g5 == null) return "text-slate-400";
  const pct = g5 / 5;
  if (pct >= 0.8) return "text-emerald-600";
  if (pct >= 0.5) return "text-amber-600";
  return "text-red-500";
}

export function GradesView({ grades }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });

  const subjects = Array.from(new Set(grades.map((g) => g.subject)));
  const showSubjectCol = subjectFilter === "all";

  const filtered = grades.filter((g) => {
    if (subjectFilter !== "all" && g.subject !== subjectFilter) return false;
    if (typeFilter !== "all" && g.kind !== typeFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let r = 0;
    if (sort.key === "date") r = (a.date ?? "").localeCompare(b.date ?? "");
    else if (sort.key === "grade") r = (a.grade5 ?? -1) - (b.grade5 ?? -1);
    else r = getSubjectConfig(a.subject).label.localeCompare(getSubjectConfig(b.subject).label);
    return r * sort.dir;
  });

  // KPI: avg + count follow the filter; best subject stays global.
  const scored = filtered.filter((g) => g.grade5 != null);
  const avgScore = scored.length
    ? (scored.reduce((s, g) => s + (g.grade5 ?? 0), 0) / scored.length).toFixed(1)
    : "—";
  const doneCount = filtered.length;

  let bestSubject = "—";
  const allScored = grades.filter((g) => g.grade5 != null);
  if (allScored.length) {
    const bySub = new Map<string, { sum: number; n: number }>();
    allScored.forEach((g) => {
      const cur = bySub.get(g.subject) ?? { sum: 0, n: 0 };
      cur.sum += g.grade5 ?? 0; cur.n += 1;
      bySub.set(g.subject, cur);
    });
    let bestAvg = -1;
    bySub.forEach((v, sub) => {
      const a = v.sum / v.n;
      if (a > bestAvg) { bestAvg = a; bestSubject = getSubjectConfig(sub).label; }
    });
  }

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { key, dir: key === "subject" ? 1 : -1 }));
  }

  function SortHead({ k, label, align }: { k: SortKey; label: string; align?: "right" }) {
    const active = sort.key === k;
    return (
      <th className={cn("px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400", align === "right" ? "text-right" : "text-left")}>
        <button onClick={() => toggleSort(k)} className={cn("inline-flex items-center gap-1 transition-colors hover:text-brand-ink", align === "right" && "flex-row-reverse")}>
          {label}
          {active && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
        </button>
      </th>
    );
  }

  const kpis = [
    { label: "Средний балл", value: avgScore },
    { label: "Выполнено работ", value: doneCount },
    { label: "Лучший предмет", value: bestSubject },
  ];

  const typePills: { key: TypeFilter; label: string }[] = [
    { key: "all", label: "Все типы" },
    { key: "file", label: d.homework.typeFile },
    { key: "test", label: d.homework.typeTest },
    { key: "classwork", label: d.classwork.title },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-[22px] font-bold text-brand-ink">Мои оценки</h1>

      <AiGradesCard grades={grades} />

      {/* KPI — compact (~80px) */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-col justify-center rounded-[16px] border border-white/80 bg-white/70 px-4 py-3 backdrop-blur-xl"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
            <div className="truncate text-[22px] font-bold leading-tight text-brand-ink">{k.value}</div>
            <div className="truncate text-[12px] font-medium text-brand-ink-muted">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Subject pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setSubjectFilter("all")}
          className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all",
            subjectFilter === "all" ? "bg-brand-blue text-white shadow" : "border border-white/80 bg-white/70 text-brand-ink-muted hover:text-brand-ink")}>
          Все предметы
        </button>
        {subjects.map((s) => {
          const cfg = getSubjectConfig(s);
          const active = subjectFilter === s;
          return (
            <button key={s} onClick={() => setSubjectFilter(s)}
              className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all",
                active ? "bg-brand-blue text-white shadow" : "border border-white/80 bg-white/70 text-brand-ink-muted hover:text-brand-ink")}>
              <span className="text-[14px]">{cfg.emoji}</span>
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Type filter — secondary */}
      <div className="flex items-center gap-1.5">
        {typePills.map((p) => (
          <button key={p.key} onClick={() => setTypeFilter(p.key)}
            className={cn("rounded-[8px] px-3 py-1 text-[12px] font-medium transition-all",
              typeFilter === p.key ? "bg-slate-200/80 text-brand-ink" : "text-brand-ink-muted hover:bg-slate-100")}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[20px] border border-white/80 bg-white/70 p-2 backdrop-blur-xl"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        {sorted.length === 0 ? (
          <div className="px-4 py-12 text-center text-[14px] text-brand-ink-muted">
            По этому предмету пока нет оценённых работ
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  {showSubjectCol && <SortHead k="subject" label="Предмет" />}
                  <SortHead k="date" label="Дата" />
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Тип</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Работа</th>
                  <SortHead k="grade" label="Оценка" align="right" />
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((g) => {
                  const cfg = getSubjectConfig(g.subject);
                  return (
                    <tr key={g.id} className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-brand-blue/5">
                      {showSubjectCol && (
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-[12px] font-medium text-brand-ink-muted">
                            <span className="text-[14px]">{cfg.emoji}</span>
                            {cfg.label}
                          </span>
                        </td>
                      )}
                      <td className="whitespace-nowrap px-4 py-3 text-[12px] text-slate-400">
                        {new Date(g.date).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "Asia/Tashkent" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          g.kind === "classwork"
                            ? "bg-purple-100 text-purple-700"
                            : g.kind === "test"
                            ? "bg-violet-100 text-violet-700"
                            : g.kind === "programming"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-blue-100 text-blue-700")}>
                          {g.kind === "classwork"
                            ? d.classwork.title
                            : g.kind === "test"
                            ? d.homework.typeTest
                            : g.kind === "programming"
                            ? d.homework.typeProgramming
                            : d.homework.typeFile}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[14px] font-semibold text-brand-ink">{g.title}</td>
                      <td className={cn("whitespace-nowrap px-4 py-3 text-right text-[18px] font-bold", gradeColor(g.grade5))}>
                        {g.display}
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        {g.comment ? (
                          <span title={g.comment} className="block truncate text-[13px] italic text-brand-ink-muted">«{g.comment}»</span>
                        ) : (
                          <span className="text-[13px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
