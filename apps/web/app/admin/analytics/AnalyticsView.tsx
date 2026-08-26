"use client";

import { useMemo, useState } from "react";
import { Download, TrendingUp, TrendingDown, Award, AlertTriangle } from "lucide-react";
import {
  getDictionary,
  computeOverall, computeStudentStats, computeGroupStats, computeSubjectStats,
  filterByPeriod,
  MIN_GRADES_FOR_VERDICT, EXCELLENT_FROM, LOW_GRADE_BELOW, OVERDUE_FROM,
  TREND_DELTA, MIN_GRADES_PER_HALF, ATTENDANCE_LOW_THRESHOLD,
  subjectLabelOf,
} from "@snr/core";
import type { Locale, AnalyticsInput, RiskFlag, StudentStat } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { AiReviewBlock } from "./AiReviewBlock";

export type AnalyticsFacts = AnalyticsInput & {
  students: Array<{ id: string; name: string; groupName: string; groupId: string }>;
  /** «Сегодня» школы — от него считаются периоды и просрочка. */
  todayIso: string;
  hasSchool: boolean;
};

type Period = "30" | "90" | "all";

function fmt1(v: number | null): string {
  return v == null ? "—" : v.toFixed(2);
}
function fmtPct(v: number | null): string {
  return v == null ? "—" : `${v}%`;
}

/** Сдвиг даты на N дней назад от «YYYY-MM-DD». Строковая арифметика через UTC:
 *  часовой пояс на календарную дату не влияет. */
function minusDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

export function AnalyticsView({ facts }: { facts: AnalyticsFacts }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.admin;

  const [period, setPeriod] = useState<Period>("all");
  const [group, setGroup] = useState("");
  const [subject, setSubject] = useState("");

  const groupNames = useMemo(
    () => [...new Set(facts.students.map((s) => s.groupName).filter(Boolean))].sort(),
    [facts.students],
  );
  const subjectNames = useMemo(
    () => [...new Set([...facts.grades.map((g) => g.subject), ...facts.attendance.map((a) => a.subject)].filter(Boolean))].sort(),
    [facts.grades, facts.attendance],
  );

  /** Границы выбранного периода и предыдущего такого же — для сравнения.
   *
   *  Отсчёт идёт от «сегодня» ШКОЛЫ, а не от реальных часов. Демо-школа
   *  заморожена, и «последние 30 дней» у неё свои; считай мы от настоящей
   *  даты, окно уехало бы вперёд её данных и экран оказался бы пустым. */
  const { from, to, prevFrom, prevTo } = useMemo(() => {
    const today = facts.todayIso;
    if (period === "all") {
      const all = [...facts.grades, ...facts.attendance].map((r) => (r.date ?? "").slice(0, 10)).filter(Boolean).sort();
      const first = all[0] ?? today;
      // «Всё время» сравнивать не с чем — предыдущего периода у него нет.
      return { from: first, to: today > (all.at(-1) ?? today) ? today : (all.at(-1) ?? today), prevFrom: "", prevTo: "" };
    }
    const days = Number(period);
    return {
      from: minusDays(today, days),
      to: today,
      prevFrom: minusDays(today, days * 2),
      prevTo: minusDays(today, days + 1),
    };
  }, [period, facts.todayIso, facts.grades, facts.attendance]);

  /** Отбор фактов: период + группа + предмет. Один и тот же отбор для всех
   *  разделов экрана, чтобы числа между ними не разошлись. */
  function slice(fromD: string, toD: string): AnalyticsInput {
    const byFilters = <T extends { groupName: string; subject: string; date: string }>(rows: T[]) =>
      filterByPeriod(rows, fromD, toD).filter(
        (r) => (!group || r.groupName === group) && (!subject || r.subject === subject),
      );
    return {
      grades: byFilters(facts.grades),
      attendance: byFilters(facts.attendance),
      submitted: byFilters(facts.submitted),
      overdue: byFilters(facts.overdue),
    };
  }

  const current = useMemo(() => slice(from, to), [facts, from, to, group, subject]);
  const previous = useMemo(
    () => (prevFrom ? slice(prevFrom, prevTo) : null),
    [facts, prevFrom, prevTo, group, subject],
  );

  const overall = useMemo(() => computeOverall(current), [current]);
  const overallPrev = useMemo(() => (previous ? computeOverall(previous) : null), [previous]);

  const studentsInScope = useMemo(
    () => facts.students.filter((s) => !group || s.groupName === group),
    [facts.students, group],
  );
  const stats = useMemo(
    () => computeStudentStats(current, studentsInScope.map((s) => s.id)),
    [current, studentsInScope],
  );
  const nameOf = useMemo(
    () => new Map(facts.students.map((s) => [s.id, s])),
    [facts.students],
  );

  const excellent = useMemo(
    () => stats.filter((s) => !s.tooLittleData && s.avgGrade != null && s.avgGrade >= EXCELLENT_FROM)
      .sort((a, b) => (b.avgGrade ?? 0) - (a.avgGrade ?? 0)).slice(0, 10),
    [stats],
  );
  const atRisk = useMemo(
    () => stats.filter((s) => s.risks.length > 0)
      .sort((a, b) => b.risks.length - a.risks.length || (a.avgGrade ?? 9) - (b.avgGrade ?? 9)),
    [stats],
  );
  const moved = useMemo(
    () => stats.filter((s) => s.trend != null && Math.abs(s.trend) >= TREND_DELTA)
      .sort((a, b) => Math.abs(b.trend ?? 0) - Math.abs(a.trend ?? 0)).slice(0, 10),
    [stats],
  );
  const tooLittle = useMemo(() => stats.filter((s) => s.tooLittleData).length, [stats]);

  const studentsByGroup = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of studentsInScope) m.set(s.groupName, (m.get(s.groupName) ?? 0) + 1);
    return m;
  }, [studentsInScope]);

  const groupStats = useMemo(() => computeGroupStats(current, studentsByGroup), [current, studentsByGroup]);
  const subjectStats = useMemo(() => computeSubjectStats(current), [current]);

  const riskLabel: Record<RiskFlag, string> = {
    low_grades: t.anRiskGrades,
    low_attendance: t.anRiskAttendance,
    overdue_work: t.anRiskOverdue,
  };

  /** Выгрузка — CSV с «;» и BOM: так Excel на русской Windows открывает файл
   *  сразу, без мастера импорта. Выгружается то, что на экране: тот же отбор. */
  function exportCsv() {
    const head = [t.anColName, t.anColGroup, t.anColAvg, t.anColAttendance, t.anColGrades, t.anSubmitted, t.anOverdue, t.anColTrend, t.anColRisks];
    const rows = stats.map((s) => {
      const st = nameOf.get(s.studentId);
      return [
        st?.name ?? s.studentId,
        st?.groupName ?? "",
        s.avgGrade == null ? "" : s.avgGrade.toFixed(2),
        s.attendance == null ? "" : String(s.attendance),
        String(s.gradeCount),
        String(s.submittedCount),
        String(s.overdueCount),
        s.trend == null ? "" : s.trend.toFixed(2),
        s.risks.map((r) => riskLabel[r]).join(", "),
      ];
    });
    const csv = "﻿" + [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${facts.todayIso}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const nothing = current.grades.length === 0 && current.attendance.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t.anTitle}</h1>
        <p className="mt-1 text-sm text-gray-500">{t.anSubtitle}</p>
      </div>

      {/* Фильтры */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={period} onChange={(v) => setPeriod(v as Period)} options={[
          { value: "all", label: t.anPeriodAll },
          { value: "30", label: t.anPeriod30 },
          { value: "90", label: t.anPeriod90 },
        ]} />
        <Select value={group} onChange={setGroup} placeholder={t.anAllGroups}
          options={groupNames.map((g) => ({ value: g, label: g }))} />
        {/* 26.08.2026: в списке стояли слаги латиницей — «english», «math»,
            «programming». Значение остаётся ключом, показывается название. */}
        <Select value={subject} onChange={setSubject} placeholder={t.anAllSubjects}
          options={subjectNames.map((s) => ({ value: s, label: subjectLabelOf(s) }))} />
        <button
          onClick={exportCsv}
          disabled={stats.length === 0}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> {t.anExport}
        </button>
      </div>

      {nothing ? (
        <p className="rounded-2xl border border-violet-100 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
          {t.anEmpty}
        </p>
      ) : (
        <>
          {/* ── 1. Общая картина ─────────────────────────────────────────── */}
          <section>
            <h2 className="mb-2 text-sm font-bold text-gray-800">{t.anOverall}</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label={t.anAvgGrade} value={fmt1(overall.avgGrade)}
                delta={overallPrev ? diff(overall.avgGrade, overallPrev.avgGrade, 2) : null}
                noPrev={!overallPrev} labels={t} hint={t.anGradesCount.replace("{n}", String(overall.gradeCount))} />
              <Stat label={t.anAttendance} value={fmtPct(overall.attendance)}
                delta={overallPrev ? diff(overall.attendance, overallPrev.attendance, 0, "%") : null}
                noPrev={!overallPrev} labels={t} />
              <Stat label={t.anSubmitted} value={String(overall.submitted)}
                delta={overallPrev ? diff(overall.submitted, overallPrev.submitted, 0) : null}
                noPrev={!overallPrev} labels={t} />
              <Stat label={t.anOverdue} value={String(overall.overdue)}
                delta={overallPrev ? diff(overall.overdue, overallPrev.overdue, 0) : null}
                noPrev={!overallPrev} labels={t} danger={overall.overdue > 0} />
            </div>
          </section>

          {/* Разбор от ИИ — сразу после чисел: сначала факты, потом что они
              значат. Сам не грузится, см. AiReviewBlock. */}
          <AiReviewBlock />

          {/* ── 2. Ученики ───────────────────────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-gray-800">{t.anStudents}</h2>

            <StudentBlock
              title={t.anExcellent} icon={<Award className="h-4 w-4 text-emerald-600" />}
              rows={excellent} nameOf={nameOf} labels={t} riskLabel={riskLabel} tone="good"
            />

            <StudentBlock
              title={t.anAtRisk} icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
              rows={atRisk} nameOf={nameOf} labels={t} riskLabel={riskLabel} tone="warn"
            />

            {/* Мало данных — отдельной строкой, а не молчанием: директор должен
                знать, что часть учеников просто не попала в выводы. */}
            {tooLittle > 0 && (
              <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-500">
                <span className="font-semibold">{t.anTooLittle.replace("{n}", String(tooLittle))}.</span>{" "}
                {t.anTooLittleHint.replace("{n}", String(MIN_GRADES_FOR_VERDICT))}
              </p>
            )}

            <StudentBlock
              title={t.anMoved} icon={<TrendingUp className="h-4 w-4 text-violet-600" />}
              rows={moved} nameOf={nameOf} labels={t} riskLabel={riskLabel} tone="neutral" showTrend
            />
          </section>

          {/* ── 3. Группы ────────────────────────────────────────────────── */}
          <Table
            title={t.anGroups} firstCol={t.anColGroup} labels={t}
            rows={groupStats.map((g) => ({
              key: g.groupName, name: g.groupName,
              cells: [fmt1(g.avgGrade), fmtPct(g.attendance), String(g.gradeCount), String(g.studentCount)],
            }))}
            cols={[t.anColAvg, t.anColAttendance, t.anColGrades, t.anColStudents]}
          />

          {/* ── 4. Предметы. Отсортированы по возрастанию среднего: то, где
                 хуже всего, оказывается сверху — за этим сюда и приходят. ── */}
          <Table
            title={t.anSubjects} firstCol={t.anFilterSubject} labels={t}
            rows={subjectStats.map((s) => ({
              key: s.subject, name: subjectLabelOf(s.subject),
              cells: [fmt1(s.avgGrade), fmtPct(s.attendance), String(s.gradeCount), ""],
            }))}
            cols={[t.anColAvg, t.anColAttendance, t.anColGrades, ""]}
          />
        </>
      )}

      {/* Подпись: из чего считается. Внизу, мелко — как на экранах навыков и
          освоения тем. Директор должен иметь возможность проверить число. */}
      <div className="space-y-1.5 border-t border-gray-200 pt-4 text-[11px] leading-relaxed text-gray-400">
        <p className="font-semibold text-gray-500">{t.anFormulaTitle}</p>
        <p>{t.anFormulaAvg}</p>
        <p>{t.anFormulaAttendance}</p>
        <p>{t.anFormulaOverdue}</p>
        <p>
          {t.anFormulaRisk
            .replace("{grade}", String(LOW_GRADE_BELOW))
            .replace("{att}", String(ATTENDANCE_LOW_THRESHOLD))
            .replace("{overdue}", String(OVERDUE_FROM))}
        </p>
        <p>
          {t.anFormulaTrend
            .replace("{half}", String(MIN_GRADES_PER_HALF))
            .replace("{delta}", String(TREND_DELTA))}
        </p>
        <p>{t.anFormulaToday.replace("{date}", facts.todayIso)}</p>
      </div>
    </div>
  );
}

/** Разница с прошлым периодом. null, если сравнивать не с чем. */
function diff(now: number | null, prev: number | null, digits: number, suffix = ""): string | null {
  if (now == null || prev == null) return null;
  const delta = now - prev;
  if (Math.abs(delta) < (digits === 0 ? 1 : 0.01)) return `0${suffix}`;
  return `${delta > 0 ? "+" : ""}${delta.toFixed(digits)}${suffix}`;
}

function Stat({
  label, value, delta, noPrev, labels, hint, danger,
}: {
  label: string; value: string; delta: string | null; noPrev: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  labels: any; hint?: string; danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${danger ? "text-amber-600" : "text-gray-900"}`}>{value}</p>
      {/* Пустого сравнения не показываем: «+0%» там, где сравнивать не с чем,
          выглядит как настоящее число и вводит в заблуждение. */}
      <p className="mt-1 text-[11px] text-gray-500">
        {noPrev || delta == null
          ? labels.anNoPrev
          : <><span className={delta.startsWith("-") ? "font-semibold text-red-600" : delta.startsWith("+") ? "font-semibold text-emerald-600" : ""}>{delta}</span> {labels.anVsPrev}</>}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

function StudentBlock({
  title, icon, rows, nameOf, labels, riskLabel, tone, showTrend,
}: {
  title: string;
  icon: React.ReactNode;
  rows: StudentStat[];
  nameOf: Map<string, { name: string; groupName: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  labels: any;
  riskLabel: Record<RiskFlag, string>;
  tone: "good" | "warn" | "neutral";
  showTrend?: boolean;
}) {
  const border = tone === "good" ? "border-emerald-100" : tone === "warn" ? "border-amber-100" : "border-violet-100";
  return (
    <div className={`overflow-hidden rounded-2xl border ${border} bg-white shadow-sm`}>
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5">
        {icon}
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        <span className="text-xs text-gray-400">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400">{labels.anNoData}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2">{labels.anColName}</th>
                <th className="px-4 py-2">{labels.anColGroup}</th>
                <th className="px-4 py-2">{labels.anColAvg}</th>
                <th className="px-4 py-2">{labels.anColAttendance}</th>
                <th className="px-4 py-2">{labels.anColGrades}</th>
                <th className="px-4 py-2">{showTrend ? labels.anColTrend : labels.anColRisks}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const st = nameOf.get(s.studentId);
                return (
                  <tr key={s.studentId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                    <td className="px-4 py-2 font-medium text-gray-900">{st?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-500">{st?.groupName || "—"}</td>
                    <td className="px-4 py-2 font-semibold text-gray-900">{fmt1(s.avgGrade)}</td>
                    <td className="px-4 py-2 text-gray-600">{fmtPct(s.attendance)}</td>
                    <td className="px-4 py-2 text-gray-500">{s.gradeCount}</td>
                    <td className="px-4 py-2">
                      {showTrend ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${(s.trend ?? 0) > 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {(s.trend ?? 0) > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {(s.trend ?? 0) > 0 ? "+" : ""}{(s.trend ?? 0).toFixed(2)}
                          <span className="font-normal text-gray-400">
                            {(s.trend ?? 0) > 0 ? labels.anImproved : labels.anWorsened}
                          </span>
                        </span>
                      ) : (
                        // Признаки перечислены по отдельности намеренно: одна
                        // цифра «риска» скрыла бы, ЧТО именно не так.
                        <span className="flex flex-wrap gap-1">
                          {s.risks.map((r) => (
                            <span key={r} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              {riskLabel[r]}
                            </span>
                          ))}
                        </span>
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
  );
}

function Table({
  title, firstCol, cols, rows, labels,
}: {
  title: string; firstCol: string; cols: string[];
  rows: Array<{ key: string; name: string; cells: string[] }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  labels: any;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-gray-800">{title}</h2>
      <div className="overflow-x-auto rounded-2xl border border-violet-100 bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-violet-100 bg-violet-50/60 text-left text-[11px] font-semibold uppercase tracking-wide text-violet-700">
              <th className="px-4 py-2.5">{firstCol}</th>
              {cols.map((c, i) => <th key={i} className="px-4 py-2.5">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-violet-50 last:border-0 hover:bg-violet-50/40">
                <td className="px-4 py-2 font-medium text-gray-900">{r.name || "—"}</td>
                {r.cells.map((c, i) => <td key={i} className="px-4 py-2 text-gray-600">{c}</td>)}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={cols.length + 1} className="px-4 py-6 text-center text-sm text-gray-400">{labels.anNoData}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Select({
  value, onChange, placeholder, options,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-violet-300"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
