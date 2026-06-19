"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  Search,
  Star,
  X,
} from "lucide-react";
import {
  getDictionary,
  getHomeworkWithSubmissions,
  homeworkCategory,
  homeworkCounts,
  getSubjectStyle,
  type HomeworkWithSubmission,
  type HomeworkTab,
  type ContentType,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { SubjectIcon, useLocale } from "@/components";
import { HomeworkStatsDonut } from "./HomeworkStatsDonut";
import { AiTipCard } from "./AiTipCard";

type SortMode = "deadline" | "created";
type ViewTab = null | "all" | HomeworkTab;
type CardZone = "overdue" | "urgent" | "normal" | "review" | "completed";

function isUrgent(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate).setHours(23, 59, 59, 999);
  const diff = due - Date.now();
  return diff > 0 && diff <= 24 * 3_600_000;
}

function sortHw(arr: HomeworkWithSubmission[], sortBy: SortMode): HomeworkWithSubmission[] {
  return [...arr].sort((a, b) => {
    if (sortBy === "created") return b.created_at.localeCompare(a.created_at);
    if (!a.due_date && !b.due_date) return b.created_at.localeCompare(a.created_at);
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    const cmp = a.due_date.localeCompare(b.due_date);
    return cmp !== 0 ? cmp : b.created_at.localeCompare(a.created_at);
  });
}

function TypeBadge({ contentType, locale }: { contentType: ContentType; locale: Locale }) {
  const d = getDictionary(locale);
  if (contentType === "test") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700 whitespace-nowrap">
        <ClipboardList className="h-2.5 w-2.5" /> {d.homework.typeTest}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 whitespace-nowrap">
      <FileText className="h-2.5 w-2.5" /> {d.homework.typeFile}
    </span>
  );
}

function ZoneBadge({ zone }: { zone: CardZone }) {
  if (zone === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 whitespace-nowrap shrink-0">
        <AlertTriangle className="h-3 w-3" /> Просрочено
      </span>
    );
  }
  if (zone === "urgent") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-600 whitespace-nowrap shrink-0">
        <Clock className="h-3 w-3" /> Скоро дедлайн
      </span>
    );
  }
  if (zone === "review") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-600 whitespace-nowrap shrink-0">
        <Clock className="h-3 w-3" /> На проверке
      </span>
    );
  }
  return null;
}

function GradeBadge({ grade }: { grade: number }) {
  const cls =
    grade >= 8 ? "bg-green-100 text-green-700" :
    grade >= 6 ? "bg-amber-100 text-amber-700" :
                 "bg-red-100 text-red-600";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap shrink-0", cls)}>
      <Star className="h-3 w-3 fill-current" /> {grade}
    </span>
  );
}

const ZONE_CARD: Record<CardZone, string> = {
  overdue:   "bg-red-50 border-l-4 border-red-400",
  urgent:    "bg-orange-50 border-l-4 border-orange-400",
  normal:    "bg-white/70 border border-white/80",
  review:    "bg-white/70 border border-white/80",
  completed: "bg-white/70 border border-white/80",
};

function HomeworkListCard({ hw, zone }: { hw: HomeworkWithSubmission; zone: CardZone }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const subj = hw.group.subject;
  const style = getSubjectStyle(subj);

  const dueLabel = hw.due_date
    ? "до " + new Date(hw.due_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
    : null;

  const dueLabelCls =
    zone === "overdue" ? "text-red-500 font-bold" :
    zone === "urgent"  ? "text-orange-500 font-bold" :
                         "text-slate-500 font-semibold";

  return (
    <div
      className={cn(
        "group rounded-[16px] shadow-[0_4px_16px_0_rgba(31,38,135,0.05)] backdrop-blur-xl",
        "transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_0_rgba(31,38,135,0.09)]",
        "px-4 py-3 flex items-center gap-3",
        ZONE_CARD[zone],
      )}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${style.color}1A` }}
      >
        <SubjectIcon subject={subj} size={20} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <span className="text-sm font-bold text-slate-800 truncate max-w-[200px]">{hw.title}</span>
          <TypeBadge contentType={hw.content_type} locale={locale as Locale} />
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-medium" style={{ color: style.color }}>{style.label}</span>
          {dueLabel && (
            <>
              <span className="text-slate-300">·</span>
              <span className={cn("text-xs", dueLabelCls)}>{dueLabel}</span>
            </>
          )}
          {hw.description && (
            <>
              <span className="text-slate-300">·</span>
              <span className="truncate max-w-[150px] text-slate-500">{hw.description}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {zone === "completed" && hw.submission?.grade != null ? (
          <GradeBadge grade={hw.submission.grade} />
        ) : (
          <ZoneBadge zone={zone} />
        )}
        <Link
          href={`/homework/${hw.id}`}
          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg font-semibold text-xs transition-all"
        >
          {d.homework.open}
        </Link>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<HomeworkTab, string> = {
  active:    "#2D5BFF",
  review:    "#F5A623",
  completed: "#2DBE7E",
  overdue:   "#F0556B",
};

export function HomeworkView({ initialRows }: { initialRows: HomeworkWithSubmission[] }) {
  const sb = createClient();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  const [rows, setRows] = useState<HomeworkWithSubmission[]>(initialRows);
  const [tab, setTab] = useState<ViewTab>(null);
  const [typeFilter, setTypeFilter] = useState<ContentType | "all">("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortMode>("deadline");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => homeworkCounts(rows), [rows]);

  const subjectKeys = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((r) => seen.add(r.group.subject));
    return Array.from(seen).sort();
  }, [rows]);

  // Apply subject / type / search filters (tab handled in zoning step)
  const baseFiltered = useMemo(() => {
    let result = rows;
    if (subjectFilter !== "all") result = result.filter((r) => r.group.subject === subjectFilter);
    if (typeFilter !== "all")    result = result.filter((r) => r.content_type === typeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (r) => r.title.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [rows, subjectFilter, typeFilter, query]);

  const zonedItems = useMemo(() => {
    const overdueBucket: HomeworkWithSubmission[] = [];
    const urgentBucket: HomeworkWithSubmission[] = [];
    const normalBucket: HomeworkWithSubmission[] = [];
    const reviewBucket: HomeworkWithSubmission[] = [];
    const completedBucket: HomeworkWithSubmission[] = [];

    for (const r of baseFiltered) {
      const cat = homeworkCategory(r, r.submission);
      if (cat === "overdue")        overdueBucket.push(r);
      else if (cat === "review")    reviewBucket.push(r);
      else if (cat === "completed") completedBucket.push(r);
      else if (isUrgent(r.due_date)) urgentBucket.push(r);
      else                           normalBucket.push(r);
    }

    const s = (arr: HomeworkWithSubmission[]) => sortHw(arr, sortBy);

    if (tab === "review")    return s(reviewBucket).map((hw) => ({ hw, zone: "review"    as CardZone }));
    if (tab === "completed") return s(completedBucket).map((hw) => ({ hw, zone: "completed" as CardZone }));
    if (tab === "overdue")   return s(overdueBucket).map((hw) => ({ hw, zone: "overdue"  as CardZone }));

    if (tab === "all") {
      return [
        ...s(overdueBucket).map((hw)   => ({ hw, zone: "overdue"   as CardZone })),
        ...s(urgentBucket).map((hw)    => ({ hw, zone: "urgent"    as CardZone })),
        ...s(normalBucket).map((hw)    => ({ hw, zone: "normal"    as CardZone })),
        ...s(reviewBucket).map((hw)    => ({ hw, zone: "review"    as CardZone })),
        ...s(completedBucket).map((hw) => ({ hw, zone: "completed" as CardZone })),
      ];
    }

    // null or "active" → default: overdue + urgent + normal only
    return [
      ...s(overdueBucket).map((hw)  => ({ hw, zone: "overdue" as CardZone })),
      ...s(urgentBucket).map((hw)   => ({ hw, zone: "urgent"  as CardZone })),
      ...s(normalBucket).map((hw)   => ({ hw, zone: "normal"  as CardZone })),
    ];
  }, [baseFiltered, tab, sortBy]);

  const hasSearchFilters = typeFilter !== "all" || subjectFilter !== "all" || query.trim() !== "";
  // True empty: no active/overdue in the entire dataset, not just this filter slice
  const noActiveWork =
    (tab === null || tab === "active") &&
    zonedItems.length === 0 &&
    !hasSearchFilters &&
    counts.active === 0 &&
    counts.overdue === 0;

  function clearFilters() {
    setTab(null);
    setTypeFilter("all");
    setSubjectFilter("all");
    setQuery("");
  }

  useEffect(() => {
    const channel = sb
      .channel("homework-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "homework" },
        async () => { setRows(await getHomeworkWithSubmissions(sb)); })
      .on("postgres_changes", { event: "*", schema: "public", table: "homework_submissions" },
        async () => { setRows(await getHomeworkWithSubmissions(sb)); })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [sb]);

  const filterPanel: { key: ViewTab; label: string; count: number; color: string }[] = [
    { key: "all",       label: "Все",               count: rows.length,                    color: "#64748b" },
    { key: "active",    label: d.homework.active,    count: counts.active + counts.overdue, color: STATUS_COLORS.active },
    { key: "review",    label: d.homework.onReview,  count: counts.review,                  color: STATUS_COLORS.review },
    { key: "completed", label: d.homework.done,      count: counts.completed,               color: STATUS_COLORS.completed },
    { key: "overdue",   label: d.homework.overdue,   count: counts.overdue,                 color: STATUS_COLORS.overdue },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <header className="mb-6">
        <h2 className="text-blue-600 font-bold text-xs tracking-widest uppercase mb-1">
          {d.homework.eyebrow}
        </h2>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 text-white rounded-[12px] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <BookOpen size={18} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{d.nav.homework}</h1>
        </div>
      </header>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию или описанию…"
          className="w-full pl-9 pr-9 py-2.5 rounded-[14px] border border-white/80 bg-white/70 backdrop-blur-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/10"
          style={{ boxShadow: "0 2px 12px rgba(31,38,135,0.06)" }}
        />
        {query && (
          <button type="button" onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Subject pills */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 select-none no-scrollbar">
        <button
          type="button"
          onClick={() => setSubjectFilter("all")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs whitespace-nowrap transition-all shrink-0",
            subjectFilter === "all"
              ? "bg-blue-600 text-white shadow shadow-blue-500/30"
              : "bg-white/70 text-slate-500 border border-white/80 hover:bg-white",
          )}
        >
          Все предметы
        </button>
        {subjectKeys.map((key) => {
          const s = getSubjectStyle(key);
          const active = subjectFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSubjectFilter(active ? "all" : key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs whitespace-nowrap transition-all shrink-0",
                active
                  ? "text-white shadow shadow-blue-500/30"
                  : "bg-white/70 text-slate-500 border border-white/80 hover:bg-white",
              )}
              style={active ? { backgroundColor: s.color } : undefined}
            >
              <SubjectIcon subject={key} size={12} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Type + Sort row */}
      <div className="flex items-center gap-2 mb-6">
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ContentType | "all")}
            className="appearance-none pl-3 pr-8 py-2 rounded-[12px] border border-white/80 bg-white/70 backdrop-blur-xl text-xs font-semibold text-slate-600 focus:outline-none cursor-pointer"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
          >
            <option value="all">Все типы</option>
            <option value="file">{d.homework.typeFile}</option>
            <option value="test">{d.homework.typeTest}</option>
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative ml-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortMode)}
            className="appearance-none pl-3 pr-8 py-2 rounded-[12px] border border-white/80 bg-white/70 backdrop-blur-xl text-xs font-semibold text-slate-600 focus:outline-none cursor-pointer"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
          >
            <option value="deadline">По дедлайну</option>
            <option value="created">По дате создания</option>
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: zoned homework list */}
        <div className="lg:col-span-2 flex flex-col gap-2 min-h-[200px]">
          {zonedItems.length > 0 ? (
            zonedItems.map(({ hw, zone }) => (
              <HomeworkListCard key={hw.id} hw={hw} zone={zone} />
            ))
          ) : noActiveWork ? (
            <div
              className="rounded-[20px] border border-white/80 bg-white/70 backdrop-blur-xl flex flex-col items-center justify-center py-16 px-6 text-center"
              style={{ boxShadow: "0 4px 24px rgba(31,38,135,0.05)" }}
            >
              <CheckCircle className="h-14 w-14 text-green-400 mb-3" />
              <p className="text-slate-700 font-bold mb-1 text-base">У тебя нет активных заданий!</p>
              <p className="text-slate-400 text-sm mb-5">
                Все работы либо проверены, либо ожидают оценки учителя.
              </p>
              <div className="flex gap-2 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={() => setTab("completed")}
                  className="px-4 py-2 rounded-xl bg-green-100 text-green-700 text-xs font-semibold hover:bg-green-200 transition-colors"
                >
                  Посмотреть выполненные ({counts.completed})
                </button>
                <button
                  type="button"
                  onClick={() => setTab("review")}
                  className="px-4 py-2 rounded-xl bg-amber-100 text-amber-700 text-xs font-semibold hover:bg-amber-200 transition-colors"
                >
                  Посмотреть на проверке ({counts.review})
                </button>
              </div>
            </div>
          ) : (
            <div
              className="rounded-[20px] border border-white/80 bg-white/70 backdrop-blur-xl flex flex-col items-center justify-center py-16 px-6 text-center"
              style={{ boxShadow: "0 4px 24px rgba(31,38,135,0.05)" }}
            >
              <ClipboardList className="h-14 w-14 text-slate-400 mb-3" />
              <p className="text-slate-600 font-semibold mb-1">Заданий не найдено</p>
              <p className="text-slate-400 text-sm mb-4">Попробуй изменить фильтры</p>
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Очистить фильтры
              </button>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <HomeworkStatsDonut
            counts={counts}
            statsLabel={d.homework.statsTitle}
            totalLabel={d.homework.statsTotal}
          />

          {/* Status filter panel */}
          <div
            className="rounded-[20px] border border-dashed border-slate-200 bg-white/60 backdrop-blur-xl p-4"
            style={{ boxShadow: "0 2px 12px rgba(31,38,135,0.04)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Фильтр по статусу
            </p>
            <div className="flex flex-col gap-1">
              {filterPanel.map((item) => {
                const isActive = tab === item.key;
                return (
                  <button
                    key={String(item.key)}
                    type="button"
                    onClick={() => setTab(isActive ? null : item.key)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all w-full text-left",
                      isActive ? "bg-brand-blue text-white" : "text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: isActive ? "rgba(255,255,255,0.7)" : item.color }}
                    />
                    <span className="flex-1">{item.label}</span>
                    <span
                      className={cn(
                        "text-xs font-bold px-1.5 py-0.5 rounded-full",
                        isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <AiTipCard tipLabel={d.homework.tipTitle} />
        </div>
      </div>
    </div>
  );
}
