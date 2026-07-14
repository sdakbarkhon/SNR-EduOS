"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  CheckCircle2,
  ClipboardList,
  MessageCircleQuestion,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  getDictionary,
  getHomeworkWithSubmissions,
  getSubjectStyle,
  homeworkCategory,
  homeworkCounts,
  deadlineUrgency,
  type HomeworkWithSubmission,
  type ContentType,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { useLocale, useToast } from "@/components";
import { LessonSubjectIcon } from "@/components/LessonSubjectIcon";
import { HomeworkStatsDonut } from "./HomeworkStatsDonut";
import { HomeworkHero } from "./HomeworkHero";
import { HomeworkCalendarCard } from "./HomeworkCalendarCard";
import { HomeworkCard } from "./HomeworkCard";
import { FilterDropdown } from "./FilterDropdown";

type SubjectFilter = "all" | string;
type TypeFilter = "all" | ContentType;
type DeadlineFilter = "all" | "overdue" | "soon";
type SortMode = "deadline" | "deadlineDesc" | "title" | "subject";

function matchesDeadlineFilter(hw: HomeworkWithSubmission, filter: DeadlineFilter): boolean {
  if (filter === "all") return true;
  const cat = homeworkCategory(hw, hw.submission);
  if (filter === "overdue") return cat === "overdue";
  // "soon": ещё активно (не сдано/не оценено/не просрочено) и дедлайн < 2 дней
  return cat !== "overdue" && cat !== "completed" && cat !== "review" && deadlineUrgency(hw.due_date) === "soon";
}

function cmpDue(a: HomeworkWithSubmission, b: HomeworkWithSubmission): number {
  if (!a.due_date && !b.due_date) return 0;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date.localeCompare(b.due_date);
}

// subject_id (migration 107) is the real subject; group.subject is a legacy
// placeholder ("programming" for every group) kept only as a fallback key
// for the handful of pre-migration rows that still have no subject_id.
function subjectKeyOf(hw: HomeworkWithSubmission): string {
  return hw.subject_id ?? hw.group.subject;
}
function subjectStyleOf(hw: HomeworkWithSubmission): { label: string; color: string; icon?: string } {
  if (hw.subject_id && hw.subjectName) {
    return { label: hw.subjectName, color: hw.subjectColor ?? "#64748b", icon: hw.subjectIcon ?? undefined };
  }
  const fallback = getSubjectStyle(hw.group.subject);
  return { label: fallback.label, color: fallback.color, icon: undefined };
}

export function HomeworkView({
  initialRows,
  initialSubject = "all",
}: {
  initialRows: HomeworkWithSubmission[];
  initialSubject?: string;
}) {
  const sb = createClient();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const showToast = useToast();

  const [rows, setRows] = useState<HomeworkWithSubmission[]>(initialRows);
  const [now] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>(initialSubject);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("all");
  const [sortBy, setSortBy] = useState<SortMode>("deadline");

  const counts = useMemo(() => homeworkCounts(rows), [rows]);

  const subjectStyles = useMemo(() => {
    const map = new Map<string, { label: string; color: string; icon?: string }>();
    rows.forEach((r) => map.set(subjectKeyOf(r), subjectStyleOf(r)));
    return map;
  }, [rows]);

  const subjectKeys = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((r) => seen.add(subjectKeyOf(r)));
    return Array.from(seen).sort((a, b) =>
      (subjectStyles.get(a)?.label ?? "").localeCompare(subjectStyles.get(b)?.label ?? "", "ru"),
    );
  }, [rows, subjectStyles]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  const filtered = useMemo(() => {
    let items = rows;
    if (subjectFilter !== "all") items = items.filter((r) => subjectKeyOf(r) === subjectFilter);
    if (typeFilter !== "all") items = items.filter((r) => r.content_type === typeFilter);
    if (deadlineFilter !== "all") items = items.filter((r) => matchesDeadlineFilter(r, deadlineFilter));
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.trim().toLowerCase();
      items = items.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q) ||
          subjectStyleOf(r).label.toLowerCase().includes(q),
      );
    }
    return items;
  }, [rows, subjectFilter, typeFilter, deadlineFilter, debouncedQuery]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === "title") arr.sort((a, b) => a.title.localeCompare(b.title, "ru"));
    else if (sortBy === "subject") {
      arr.sort((a, b) => subjectStyleOf(a).label.localeCompare(subjectStyleOf(b).label, "ru"));
    } else if (sortBy === "deadlineDesc") arr.sort((a, b) => cmpDue(b, a));
    else arr.sort(cmpDue);
    return arr;
  }, [filtered, sortBy]);

  const hasActiveFilters =
    subjectFilter !== "all" || typeFilter !== "all" || deadlineFilter !== "all" || query.trim() !== "";
  const nothingLeftToDo = counts.active === 0 && counts.overdue === 0 && counts.review === 0;

  function resetFilters() {
    setSubjectFilter("all");
    setTypeFilter("all");
    setDeadlineFilter("all");
    setQuery("");
    setDebouncedQuery("");
  }

  useEffect(() => {
    const channel = sb
      .channel("homework-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "homework" }, async () => {
        setRows(await getHomeworkWithSubmissions(sb));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "homework_submissions" }, async () => {
        setRows(await getHomeworkWithSubmissions(sb));
      })
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [sb]);

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: "all", label: d.homework.typeAll },
    { value: "file", label: d.homework.typeFile },
    { value: "test", label: d.homework.typeTest },
    { value: "programming", label: d.homework.typeProgrammingShort },
  ];
  const deadlineOptions: { value: DeadlineFilter; label: string }[] = [
    { value: "all", label: d.homework.deadlineAll },
    { value: "overdue", label: d.homework.overdue },
    { value: "soon", label: d.homework.deadlineSoon },
  ];
  const sortOptions: { value: SortMode; label: string }[] = [
    { value: "deadline", label: d.homework.sortDeadlineAsc },
    { value: "deadlineDesc", label: d.homework.sortDeadlineDesc },
    { value: "title", label: d.homework.sortTitle },
    { value: "subject", label: d.homework.sortSubject },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* MAIN */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <header>
            <h2 className="text-violet-600 font-extrabold text-xs tracking-widest uppercase mb-1.5">
              {d.homework.eyebrow}
            </h2>
            <div className="flex items-center gap-3">
              <h1 className="text-[34px] font-extrabold text-slate-900 tracking-tight leading-none">
                {d.nav.homework}
              </h1>
              <ClipboardList className="h-7 w-7 text-slate-400" />
            </div>
          </header>

          {/* Search */}
          <div className="flex items-center gap-3 h-[54px] pl-4 pr-1.5 bg-white border border-slate-100 rounded-2xl shadow-[0_2px_10px_rgba(24,20,50,0.04)]">
            <Search className="h-5 w-5 text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={d.homework.searchPlaceholder}
              className="flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] font-semibold text-slate-800 placeholder:text-slate-400 h-full"
            />
            <button
              type="button"
              onClick={() => showToast(d.auth.comingSoon)}
              className="w-10 h-10 rounded-[11px] flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-violet-600 transition-colors shrink-0"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </div>

          {/* Subject chips — grid с auto-fill/minmax вместо flex-wrap:
              Промт 6.2, чипы распределяются равномерно по строкам (без
              "кривых" неровных рядов) и никогда не сжимаются уже 150px,
              так текст ("Робототехника" и т.п.) не обрезается. */}
          {subjectKeys.length > 0 && (
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
              <button
                type="button"
                onClick={() => setSubjectFilter("all")}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-center text-sm font-bold transition-all",
                  subjectFilter === "all"
                    ? "text-white shadow-[0_8px_18px_rgba(108,78,230,0.30)]"
                    : "bg-white text-slate-700 border border-slate-100 hover:border-slate-200",
                )}
                style={subjectFilter === "all" ? { background: "linear-gradient(135deg,#8E72F8,#6C4EE6)" } : undefined}
              >
                {d.schedule.allSubjects}
              </button>
              {subjectKeys.map((key) => {
                const style = subjectStyles.get(key);
                const active = subjectFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSubjectFilter(active ? "all" : key)}
                    className={cn(
                      "inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-center text-sm font-bold transition-all",
                      active
                        ? "text-white shadow-[0_8px_18px_rgba(108,78,230,0.30)]"
                        : "bg-white text-slate-700 border border-slate-100 hover:border-slate-200",
                    )}
                    style={active ? { background: "linear-gradient(135deg,#8E72F8,#6C4EE6)" } : undefined}
                  >
                    <LessonSubjectIcon icon={style?.icon} color={active ? "#ffffff" : (style?.color ?? "#64748b")} size={18} />
                    {style?.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-3">
            <FilterDropdown value={typeFilter} onChange={setTypeFilter} options={typeOptions} label={typeOptions.find((o) => o.value === typeFilter)!.label} />
            <FilterDropdown
              value={deadlineFilter}
              onChange={setDeadlineFilter}
              options={deadlineOptions}
              label={deadlineOptions.find((o) => o.value === deadlineFilter)!.label}
            />
            <div className="flex-1" />
            <FilterDropdown
              value={sortBy}
              onChange={setSortBy}
              options={sortOptions}
              label={sortOptions.find((o) => o.value === sortBy)!.label}
              icon={<ArrowUpDown className="h-4 w-4 text-slate-400" />}
              align="right"
            />
          </div>

          {/* Cards grid / empty states */}
          {/* Промт 6.2: было sm:grid-cols-2 (640px, привязано к ширине
              вьюпорта) — при открытом сайдбаре (210-266px) на планшете 768
              реальная ширина колонки под карточки намного меньше 640px,
              карточки зажимались. lg:grid-cols-2 (1024) — безопасный порог,
              на >=1024 колонки те же, что были. */}
          {sorted.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 mt-0.5">
              {sorted.map((hw) => (
                <HomeworkCard key={hw.id} hw={hw} />
              ))}
              <button
                type="button"
                onClick={() => showToast(d.auth.comingSoon)}
                className="sm:col-span-2 flex items-center gap-5 p-5 rounded-[20px] border-[1.5px] border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="w-[58px] h-[58px] rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                  <MessageCircleQuestion className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="text-base font-extrabold text-slate-800 mb-0.5">{d.homework.notFoundTitle}</div>
                  <div className="text-sm font-semibold text-slate-400">{d.homework.notFoundBody}</div>
                </div>
                <span className="px-5 py-2.5 rounded-xl bg-violet-100 text-violet-600 font-extrabold text-sm whitespace-nowrap">
                  {d.homework.notFoundBtn}
                </span>
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-[20px] border border-slate-100 bg-white flex flex-col items-center justify-center py-16 px-6 text-center shadow-[0_2px_12px_rgba(24,20,50,0.04)]">
              <ClipboardList className="h-14 w-14 text-slate-300 mb-3" />
              <p className="text-slate-700 font-bold mb-1 text-base">{d.homework.noTasks}</p>
              <p className="text-slate-400 text-sm">{d.homework.noTasksBody}</p>
            </div>
          ) : !hasActiveFilters && nothingLeftToDo ? (
            <div className="rounded-[20px] border border-slate-100 bg-white flex flex-col items-center justify-center py-16 px-6 text-center shadow-[0_2px_12px_rgba(24,20,50,0.04)]">
              <CheckCircle2 className="h-14 w-14 text-green-400 mb-3" />
              <p className="text-slate-700 font-bold mb-1 text-base">{d.homework.allDoneTitle}</p>
              <p className="text-slate-400 text-sm">{d.homework.allDoneBody}</p>
            </div>
          ) : (
            <div className="rounded-[20px] border border-slate-100 bg-white flex flex-col items-center gap-3 py-14 px-6 text-center shadow-[0_2px_12px_rgba(24,20,50,0.04)]">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <Search className="h-7 w-7" />
              </div>
              <p className="text-slate-700 font-extrabold">{d.homework.noResultsTitle}</p>
              <p className="text-slate-400 text-sm">{d.homework.noResultsBody}</p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-1 px-5 py-2.5 rounded-xl bg-violet-100 text-violet-600 font-extrabold text-sm hover:bg-violet-200 transition-colors"
              >
                {d.homework.resetFilters}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT RAIL */}
        <div className="w-full xl:w-[372px] shrink-0 flex flex-col gap-5">
          <HomeworkHero label={d.homework.heroAlt} />
          <HomeworkStatsDonut
            counts={counts}
            statsLabel={d.homework.statsTitle}
            totalLabel={d.homework.statsTotal}
            segmentLabels={{
              active: d.homework.active,
              completed: d.homework.done,
              overdue: d.homework.overdue,
              review: d.homework.onReview,
            }}
          />
          <HomeworkCalendarCard rows={rows} now={now} />
        </div>
      </div>
    </div>
  );
}
