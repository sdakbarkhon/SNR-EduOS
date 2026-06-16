"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import {
  getDictionary,
  getHomeworkWithSubmissions,
  homeworkCategory,
  homeworkCounts,
  deadlineUrgency,
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
import { DailyTipCard } from "./DailyTipCard";

function getDeadlineColor(dueDate: string | null): string {
  const u = deadlineUrgency(dueDate);
  if (u === "overdue") return "text-rose-500";
  if (u === "soon") return "text-amber-500";
  return "text-slate-600";
}

function TypeBadge({ contentType, locale }: { contentType: ContentType; locale: Locale }) {
  const d = getDictionary(locale);
  if (contentType === "test") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-700">
        ✦ {d.homework.typeTest}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">
      ⬇ {d.homework.typeFile}
    </span>
  );
}

function HomeworkListCard({ hw, showSource }: { hw: HomeworkWithSubmission; showSource: boolean }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const subj = hw.group.subject;
  const style = getSubjectStyle(subj);
  const deadlineColor = getDeadlineColor(hw.due_date);

  const dueLabel = hw.due_date
    ? "до " +
      new Date(hw.due_date).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
      })
    : null;

  return (
    <div className="group rounded-[20px] border-[1.5px] border-white/80 bg-white/70 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_0_rgba(31,38,135,0.1)] p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
      <div className="flex items-start gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${style.color}1A` }}
        >
          <SubjectIcon subject={subj} size={28} />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-extrabold text-slate-800 text-lg leading-tight">{subj}</h3>
            <TypeBadge contentType={hw.content_type} locale={locale as Locale} />
            {showSource && hw.source === "teacher" && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
                {d.homework.sourceTeacher}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-500">{hw.title}</p>
          {hw.description && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-1">{hw.description}</p>
          )}
        </div>
      </div>

      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 shrink-0">
        {dueLabel && (
          <span className={cn("text-sm font-bold", deadlineColor)}>{dueLabel}</span>
        )}
        <Link
          href={`/homework/${hw.id}`}
          className="px-6 py-2 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-xl font-semibold text-sm transition-all shadow-sm active:scale-95"
        >
          {d.homework.open}
        </Link>
      </div>
    </div>
  );
}

function SleepingRobot() {
  return (
    <div className="relative w-20 h-20 mb-6 opacity-75">
      <div
        className="absolute inset-0 bg-blue-100 rounded-full animate-bounce"
        style={{ animationDuration: "3s" }}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-10 rounded-2xl"
          style={{ background: "linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)" }}
        >
          <div className="absolute top-3 left-2 w-3 h-1 bg-white rounded-full opacity-60" />
          <div className="absolute top-3 right-2 w-3 h-1 bg-white rounded-full opacity-60" />
          <span className="absolute -top-3 -right-3 text-blue-400 font-black text-base animate-pulse">
            Z
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyTabState({ message }: { message: string }) {
  return (
    <div className="rounded-[20px] border-[1.5px] border-white/80 bg-white/70 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] backdrop-blur-2xl flex flex-col items-center justify-center py-20 px-6 text-center">
      <SleepingRobot />
      <h3 className="text-xl font-bold text-slate-800 mb-2">{message}</h3>
      <p className="text-slate-500 text-sm max-w-xs">Проверь другие вкладки.</p>
    </div>
  );
}

export function HomeworkView({ initialRows }: { initialRows: HomeworkWithSubmission[] }) {
  const sb = createClient();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  const TABS: { key: HomeworkTab; label: string }[] = [
    { key: "active", label: d.homework.active },
    { key: "review", label: d.homework.onReview },
    { key: "completed", label: d.homework.done },
    { key: "overdue", label: d.homework.overdue },
  ];

  const EMPTY_MESSAGES: Record<HomeworkTab, string> = {
    active: d.homework.emptyActive,
    review: d.homework.emptyReview,
    completed: d.homework.emptyCompleted,
    overdue: d.homework.emptyOverdue,
  };

  const CONTENT_FILTERS: { key: ContentType | "all"; label: string }[] = [
    { key: "all", label: d.homework.filterAll },
    { key: "file", label: d.homework.filterFiles },
    { key: "test", label: d.homework.filterTests },
  ];

  const [rows, setRows] = useState<HomeworkWithSubmission[]>(initialRows);
  const [tab, setTab] = useState<HomeworkTab>("active");
  const [contentFilter, setContentFilter] = useState<ContentType | "all">("all");

  const counts = useMemo(() => homeworkCounts(rows), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (contentFilter !== "all" && r.content_type !== contentFilter) return false;
        return homeworkCategory(r, r.submission) === tab;
      }),
    [rows, tab, contentFilter],
  );

  useEffect(() => {
    const channel = sb
      .channel("homework-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "homework" },
        async () => { setRows(await getHomeworkWithSubmissions(sb)); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "homework_submissions" },
        async () => { setRows(await getHomeworkWithSubmissions(sb)); },
      )
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [sb]);

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <h2 className="text-blue-600 font-bold text-sm tracking-widest uppercase mb-1 drop-shadow-sm">
          {d.homework.eyebrow}
        </h2>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 text-white rounded-[14px] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <BookOpen size={22} strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight drop-shadow-sm">
            {d.nav.homework}
          </h1>
        </div>
      </header>

      {/* Content-type pills */}
      <div className="flex items-center gap-2 mb-8 select-none flex-wrap">
        {CONTENT_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setContentFilter(f.key)}
            className={cn(
              "px-5 py-2 rounded-full font-semibold text-sm transition-all duration-200",
              contentFilter === f.key
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                : "bg-white/60 text-slate-500 hover:bg-white hover:text-slate-700 border border-white/80",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Список заданий */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-[400px]">
          {filtered.length > 0 ? (
            filtered.map((hw) => (
              <HomeworkListCard key={hw.id} hw={hw} showSource={contentFilter === "all"} />
            ))
          ) : (
            <EmptyTabState message={EMPTY_MESSAGES[tab]} />
          )}
        </div>

        {/* Правая колонка */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <HomeworkStatsDonut
            counts={counts}
            statsLabel={d.homework.statsTitle}
            totalLabel={d.homework.statsTotal}
          />

          {/* Статусные табы (вертикально) */}
          <div className="rounded-[20px] border-[1.5px] border-white/80 bg-white/70 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] backdrop-blur-2xl p-4 flex flex-col gap-1">
            {TABS.map((t) => {
              const count = counts[t.key];
              const isActive = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex items-center justify-between px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 w-full text-left",
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <span>{t.label}</span>
                  <span
                    className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded-full",
                      isActive ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <DailyTipCard tipLabel={d.homework.tipTitle} />
        </div>
      </div>
    </div>
  );
}
