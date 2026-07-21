"use client";

import { useState } from "react";
import { Star, BookOpen, ClipboardCheck, Trophy, ChevronRight, CheckCircle2, ArrowUpDown } from "lucide-react";
import { getDictionary, getSubjectConfig, gradeCategory } from "@snr/core";
import type { Dictionary, Locale, StudentGradeItem } from "@snr/core";
import { resolveSubjectIcon } from "@/components/SubjectIcon";
import { useLocale } from "@/components/LocaleProvider";
import { SubjectIcon } from "@/components/SubjectIcon";
import { cn } from "@/lib/cn";
import { GradeFilterDropdown } from "./GradeFilterDropdown";
import { GradeDistributionDonut } from "./GradeDistributionDonut";
import { GradeDetailModal } from "./GradeDetailModal";

interface Props {
  grades: StudentGradeItem[];
}

type TypeFilter = "all" | StudentGradeItem["kind"];
type PeriodFilter = "all" | "week" | "month" | "semester";
type CategoryFilter = "all" | "assignment" | "lesson";
type SortValue = "date_desc" | "date_asc" | "grade_desc" | "grade_asc" | "subject";
type Tier = 5 | 4 | 3 | 2 | 1;

function gradeColor(g5: number | null): string {
  if (g5 == null) return "text-slate-400";
  const pct = g5 / 5;
  if (pct >= 0.8) return "text-emerald-600";
  if (pct >= 0.5) return "text-amber-600";
  return "text-red-500";
}

export function kindLabel(kind: StudentGradeItem["kind"], d: Dictionary): string {
  switch (kind) {
    case "test": return d.homework.typeTest;
    case "programming": return d.homework.typeProgramming;
    case "classwork": return d.classwork.title;
    case "project": return d.projects.badge;
    case "quiz": return d.lesson.quiz.kindQuiz;
    case "kahoot": return d.lesson.quiz.kindKahoot;
    case "external": return d.lesson.quiz.kindExternal;
    case "lesson": return d.lesson.kindLesson;
    default: return d.homework.typeFile;
  }
}

export const KIND_BADGE: Record<StudentGradeItem["kind"], string> = {
  classwork: "bg-purple-100 text-purple-700",
  test: "bg-violet-100 text-violet-700",
  programming: "bg-emerald-100 text-emerald-700",
  project: "bg-orange-100 text-orange-700",
  quiz: "bg-indigo-100 text-indigo-700",
  kahoot: "bg-amber-100 text-amber-700",
  external: "bg-cyan-100 text-cyan-700",
  lesson: "bg-violet-100 text-violet-700",
  file: "bg-blue-100 text-blue-700",
};

function withinPeriod(dateStr: string, period: PeriodFilter): boolean {
  if (period === "all" || !dateStr) return true;
  const days = period === "week" ? 7 : period === "month" ? 30 : 120;
  return new Date(dateStr).getTime() >= Date.now() - days * 86400000;
}

function sortGrades(items: StudentGradeItem[], sort: SortValue): StudentGradeItem[] {
  const arr = [...items];
  switch (sort) {
    case "date_asc": arr.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")); break;
    case "grade_desc": arr.sort((a, b) => (b.grade5 ?? -1) - (a.grade5 ?? -1)); break;
    case "grade_asc": arr.sort((a, b) => (a.grade5 ?? -1) - (b.grade5 ?? -1)); break;
    case "subject": arr.sort((a, b) => getSubjectConfig(a.subject).label.localeCompare(getSubjectConfig(b.subject).label)); break;
    default: arr.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")); break;
  }
  return arr;
}

function buildSparkline(values: number[], w = 240, h = 40) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / span) * (h - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return { line: pts.join(" "), area: `0,${h} ${pts.join(" ")} ${w},${h}` };
}

function DynamicsChart({ points, locale }: { points: StudentGradeItem[]; locale: string }) {
  if (points.length < 2) return <p className="py-10 text-center text-[13px] text-slate-400">—</p>;

  const W = 272, H = 130, PAD_L = 6, PAD_R = 26, PAD_B = 20;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_B;
  const stepX = plotW / (points.length - 1);
  const y = (v: number) => plotH - ((v - 1) / 4) * (plotH - 10) - 5;
  const coords = points.map((p, i) => ({ x: PAD_L + i * stepX, y: y(p.grade5 ?? 1) }));
  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${PAD_L},${plotH} ${line} ${PAD_L + plotW},${plotH}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="block overflow-visible">
      {[1, 3, 5].map((v) => (
        <g key={v}>
          <line x1={PAD_L} y1={y(v)} x2={PAD_L + plotW} y2={y(v)} stroke="#EEF0F5" strokeWidth={1} />
          <text x={PAD_L + plotW + 6} y={y(v) + 4} fontSize={11} fontWeight={700} fill="#B6BCC9">{v}</text>
        </g>
      ))}
      <polygon points={area} fill="rgba(139,92,246,0.12)" />
      <polyline points={line} fill="none" stroke="#8B5CF6" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 5 : 4} fill="#8B5CF6" stroke="#fff" strokeWidth={i === coords.length - 1 ? 2.5 : 2} />
      ))}
      <text x={PAD_L} y={H - 4} textAnchor="start" fontSize={10.5} fontWeight={600} fill="#9AA1B1">
        {new Date(points[0]!.date).toLocaleDateString(locale, { day: "numeric", month: "short" })}
      </text>
      <text x={PAD_L + plotW} y={H - 4} textAnchor="end" fontSize={10.5} fontWeight={600} fill="#9AA1B1">
        {new Date(points[points.length - 1]!.date).toLocaleDateString(locale, { day: "numeric", month: "short" })}
      </text>
    </svg>
  );
}

function pillClass(active: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all",
    active
      ? "bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/25"
      : "border border-slate-200 bg-white text-slate-500 hover:text-slate-800",
  );
}

export function GradesView({ grades }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.grades;

  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [sortValue, setSortValue] = useState<SortValue>("date_desc");
  const [selected, setSelected] = useState<StudentGradeItem | null>(null);

  if (grades.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <h1 className="flex items-center gap-2.5 text-3xl font-extrabold tracking-tight text-slate-900">
          {t.title} <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
        </h1>
        <div className="flex flex-col items-center justify-center gap-3 rounded-[24px] border border-white bg-white/80 py-24 text-center shadow-md backdrop-blur-xl">
          <BookOpen className="h-12 w-12 text-slate-300" />
          <p className="text-lg font-extrabold text-slate-800">{t.emptyTitle}</p>
          <p className="max-w-xs text-sm text-slate-500">{t.emptySubtitle}</p>
        </div>
      </div>
    );
  }

  const subjects = Array.from(new Set(grades.map((g) => g.subject)));
  const availableKinds = Array.from(new Set(grades.map((g) => g.kind)));

  const scoredAll = grades.filter((g) => g.grade5 != null);
  const avgAll = scoredAll.length ? scoredAll.reduce((s, g) => s + (g.grade5 ?? 0), 0) / scoredAll.length : null;

  const bySubject = new Map<string, { sum: number; n: number }>();
  scoredAll.forEach((g) => {
    const cur = bySubject.get(g.subject) ?? { sum: 0, n: 0 };
    cur.sum += g.grade5 ?? 0;
    cur.n += 1;
    bySubject.set(g.subject, cur);
  });
  const subjectAverages = Array.from(bySubject.entries())
    .map(([subject, v]) => ({ subject, avg: v.sum / v.n }))
    .sort((a, b) => b.avg - a.avg);
  const bestSubject = subjectAverages[0] ?? null;

  const distribution: Record<Tier, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  scoredAll.forEach((g) => {
    const tier = Math.min(5, Math.max(1, Math.round(g.grade5 ?? 0))) as Tier;
    distribution[tier]++;
  });

  const chronological = [...scoredAll].filter((g) => g.date).sort((a, b) => a.date.localeCompare(b.date));
  const dynamicsPoints = chronological.slice(-10);
  const sparkValues = chronological.slice(-7).map((g) => g.grade5 ?? 0);
  const spark = buildSparkline(sparkValues);
  const barValues = chronological.slice(-5).map((g) => g.grade5 ?? 0);

  const filtered = grades.filter((g) => {
    if (categoryFilter !== "all" && gradeCategory(g.sourceTable) !== categoryFilter) return false;
    if (subjectFilter !== "all" && g.subject !== subjectFilter) return false;
    if (typeFilter !== "all" && g.kind !== typeFilter) return false;
    if (!withinPeriod(g.date, periodFilter)) return false;
    return true;
  });
  const sorted = sortGrades(filtered, sortValue);

  const typeOptions = [{ value: "all" as TypeFilter, label: t.allTypes }, ...availableKinds.map((k) => ({ value: k as TypeFilter, label: kindLabel(k, d) }))];
  const periodOptions: { value: PeriodFilter; label: string }[] = [
    { value: "all", label: t.allPeriods },
    { value: "week", label: t.periodWeek },
    { value: "month", label: t.periodMonth },
    { value: "semester", label: t.periodSemester },
  ];
  const sortOptions: { value: SortValue; label: string }[] = [
    { value: "date_desc", label: t.sortNewest },
    { value: "date_asc", label: t.sortOldest },
    { value: "grade_desc", label: t.sortGradeDesc },
    { value: "grade_asc", label: t.sortGradeAsc },
    { value: "subject", label: t.sortSubject },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <h1 className="flex items-center gap-2.5 text-3xl font-extrabold tracking-tight text-slate-900">
        {t.title} <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
      </h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="flex flex-col gap-3 rounded-[22px] p-5" style={{ background: "linear-gradient(180deg,#F6F2FF,#EFE8FD)", boxShadow: "0 6px 20px rgba(124,58,237,0.07)" }}>
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#A78BFA,#7C3AED)", boxShadow: "0 8px 18px rgba(124,58,237,0.35)" }}>
              <Star className="h-7 w-7" fill="currentColor" />
            </div>
            <div>
              <p className="text-[32px] font-black leading-none text-slate-900">{avgAll != null ? avgAll.toFixed(1) : "—"}</p>
              <p className="mt-1 text-[13px] font-bold text-slate-500">{t.avgScoreLabel}</p>
            </div>
          </div>
          {spark && (
            <svg viewBox="0 0 240 40" width="100%" height={40} preserveAspectRatio="none" className="block overflow-visible">
              <polygon points={spark.area} fill="rgba(124,58,237,0.10)" />
              <polyline points={spark.line} fill="none" stroke="#8B5CF6" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-[22px] bg-white p-5" style={{ boxShadow: "0 6px 20px rgba(30,40,80,0.05)" }}>
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#60A5FA,#2563EB)", boxShadow: "0 8px 18px rgba(37,99,235,0.32)" }}>
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[32px] font-black leading-none text-slate-900">{scoredAll.length}</p>
              <p className="mt-1 text-[13px] font-bold text-slate-500">{t.completedLabel}</p>
            </div>
          </div>
          {barValues.length > 0 && (
            <div className="flex h-10 items-end gap-2">
              {barValues.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-[5px]"
                  style={{ height: `${Math.max(14, (v / 5) * 100)}%`, background: i === barValues.length - 1 ? "#3B82F6" : "#BCD4FF" }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 rounded-[22px] p-5" style={{ background: "linear-gradient(180deg,#EFFBF4,#E5F8EE)", boxShadow: "0 6px 20px rgba(16,185,129,0.08)" }}>
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#34D399,#10B981)", boxShadow: "0 8px 18px rgba(16,185,129,0.35)" }}>
            <Trophy className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-black leading-tight text-slate-900">
              {bestSubject ? getSubjectConfig(bestSubject.subject).label : t.noSubjectYet}
            </p>
            <p className="mt-1 text-[13px] font-bold text-slate-500">{t.bestSubjectLabel}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Table card */}
        <div className="min-w-0 flex-1 rounded-[24px] border border-white bg-white/80 p-6 shadow-md backdrop-blur-xl">
          {/* Все / За задания / За урок — сегментированный переключатель,
              стиль как у "Сегодня/Неделя" в расписании (rounded-full
              bg-white p-1 shadow-sm контейнер + пилюли внутри). */}
          <div className="mb-4 flex w-fit rounded-full bg-white p-1 shadow-sm">
            {([
              { value: "all", label: t.filterAll },
              { value: "assignment", label: t.filterAssignment },
              { value: "lesson", label: t.filterLesson },
            ] as { value: CategoryFilter; label: string }[]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setCategoryFilter(opt.value)}
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-bold transition-all",
                  categoryFilter === opt.value
                    ? "bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/25"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button onClick={() => setSubjectFilter("all")} className={pillClass(subjectFilter === "all")}>{t.allSubjects}</button>
            {subjects.map((s) => {
              const cfg = getSubjectConfig(s);
              const { Icon: SubjIcon } = resolveSubjectIcon(s);
              return (
                <button key={s} onClick={() => setSubjectFilter(s)} className={pillClass(subjectFilter === s)}>
                  <SubjIcon className="h-3.5 w-3.5" />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <GradeFilterDropdown value={typeFilter} onChange={setTypeFilter} options={typeOptions} label={typeOptions.find((o) => o.value === typeFilter)?.label ?? t.allTypes} />
            <GradeFilterDropdown value={periodFilter} onChange={setPeriodFilter} options={periodOptions} label={periodOptions.find((o) => o.value === periodFilter)?.label ?? t.allPeriods} />
            <div className="ml-auto">
              <GradeFilterDropdown
                align="right"
                value={sortValue}
                onChange={setSortValue}
                options={sortOptions}
                label={sortOptions.find((o) => o.value === sortValue)?.label ?? t.sortNewest}
                icon={<ArrowUpDown className="h-4 w-4 text-slate-400" />}
              />
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="px-4 py-14 text-center text-sm text-slate-400">{t.emptyFiltered}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th colSpan={2} className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.tableAssignment}</th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.tableType}</th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.tableDate}</th>
                    <th className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.tableGrade}</th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.tableStatus}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((g) => (
                    <tr key={g.id} onClick={() => setSelected(g)} className="cursor-pointer border-b border-slate-50 transition-colors last:border-0 hover:bg-violet-50/40">
                      <td className="w-[56px] px-3 py-3"><SubjectIcon subject={g.subject} size={44} /></td>
                      <td className="min-w-0 px-2 py-3">
                        <p className="truncate text-[14.5px] font-extrabold text-slate-900">
                          {g.kind === "lesson" ? `${d.lesson.kindLesson}: ${g.title}` : g.title}
                        </p>
                        <p className="mt-0.5 truncate text-[12.5px] font-semibold text-slate-400">{getSubjectConfig(g.subject).label}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className={cn("inline-flex rounded-[9px] px-2.5 py-1 text-[11.5px] font-bold", KIND_BADGE[g.kind])}>{kindLabel(g.kind, d)}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-[13px] font-semibold text-slate-500">
                        {g.date ? new Date(g.date).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "Asia/Tashkent" }) : "—"}
                      </td>
                      <td className={cn("whitespace-nowrap px-3 py-3 text-right text-[16px] font-black", gradeColor(g.grade5))}>{g.display}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-emerald-100 px-2.5 py-1 text-[11.5px] font-bold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t.statusDone}
                        </span>
                      </td>
                      <td className="px-3 py-3"><ChevronRight className="h-5 w-5 text-slate-300" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column */}
        <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-[320px]">
          <div className="rounded-[24px] border border-white bg-white/80 p-5 shadow-md backdrop-blur-xl">
            <h3 className="text-[17px] font-extrabold text-slate-900">{t.distributionTitle}</h3>
            <div className="mt-4">
              <GradeDistributionDonut
                counts={distribution}
                totalLabel={t.totalWorksLabel}
                tierLabels={{ 5: t.gradeTierExcellent, 4: t.gradeTierGood, 3: t.gradeTierSatisfactory, 2: t.gradeTierPoor, 1: t.gradeTierVeryPoor }}
              />
            </div>
          </div>

          {subjectAverages.length > 0 && (
            <div className="rounded-[24px] border border-white bg-white/80 p-5 shadow-md backdrop-blur-xl">
              <h3 className="text-[17px] font-extrabold text-slate-900">{t.avgBySubjectTitle}</h3>
              <div className="mt-4 flex flex-col gap-4">
                {subjectAverages.map(({ subject, avg }) => {
                  const cfg = getSubjectConfig(subject);
                  return (
                    <div key={subject}>
                      <div className="mb-2 flex items-center gap-2.5">
                        <SubjectIcon subject={subject} size={30} />
                        <span className="flex-1 truncate text-[13.5px] font-bold text-slate-700">{cfg.label}</span>
                        <span className="text-[14px] font-black text-slate-900">{avg.toFixed(1)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${(avg / 5) * 100}%`, background: `linear-gradient(90deg, ${cfg.color}99, ${cfg.color})` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-[24px] border border-white bg-white/80 p-5 shadow-md backdrop-blur-xl">
            <h3 className="text-[17px] font-extrabold text-slate-900">{t.dynamicsTitle}</h3>
            <div className="mt-3">
              <DynamicsChart points={dynamicsPoints} locale={locale} />
            </div>
          </div>
        </aside>
      </div>

      {selected && (
        <GradeDetailModal
          grade={selected}
          locale={locale}
          t={t.detailModal}
          kindLabelText={kindLabel(selected.kind, d)}
          kindBadgeClass={KIND_BADGE[selected.kind]}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
