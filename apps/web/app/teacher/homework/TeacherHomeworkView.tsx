"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDictionary, getSubjectConfig } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { Plus, MoreHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type Submission = { id: string; status: string };
type HomeworkItem = {
  id: string; title: string; due_date: string | null; content_type: string;
  group: { id: string; name: string; subject: string };
  submissions: Submission[];
};

interface Props {
  homework: HomeworkItem[];
  groups: Array<{ id: string; name: string; subject: string }>;
}

type TypeFilter = "all" | "file" | "test";
type StatusFilter = "all" | "active" | "pending" | "done" | "overdue";

function statusOf(hw: HomeworkItem): StatusFilter {
  const now = new Date().toISOString();
  const pending = hw.submissions.filter((s) => s.status === "submitted").length;
  if (pending > 0) return "pending";
  if (!hw.due_date || hw.due_date > now) return "active";
  const allGraded = hw.submissions.every((s) => s.status === "graded");
  if (allGraded && hw.submissions.length > 0) return "done";
  return "overdue";
}

export function TeacherHomeworkView({ homework, groups }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const router = useRouter();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  const filtered = homework.filter((hw) => {
    if (typeFilter !== "all" && hw.content_type !== typeFilter) return false;
    if (groupFilter !== "all" && hw.group.id !== groupFilter) return false;
    if (statusFilter !== "all" && statusOf(hw) !== statusFilter) return false;
    return true;
  });

  const counts = {
    active: homework.filter((h) => statusOf(h) === "active").length,
    pending: homework.filter((h) => statusOf(h) === "pending").length,
    done: homework.filter((h) => statusOf(h) === "done").length,
    overdue: homework.filter((h) => statusOf(h) === "overdue").length,
  };

  const typeButtons: { key: TypeFilter; label: string }[] = [
    { key: "all", label: d.teacher.filterAll },
    { key: "file", label: d.teacher.filterFiles },
    { key: "test", label: d.teacher.filterTests },
  ];

  const statusButtons: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: d.teacher.filterAll, count: homework.length },
    { key: "active", label: d.teacher.statsActive, count: counts.active },
    { key: "pending", label: d.teacher.statsPending, count: counts.pending },
    { key: "done", label: d.teacher.statsDone, count: counts.done },
    { key: "overdue", label: d.teacher.statsOverdue, count: counts.overdue },
  ];

  function menuClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    alert(d.teacher.menuStub);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-brand-ink">{d.teacher.homeworkTitle}</h1>
        <Link href="/teacher/homework/new"
          className="flex items-center gap-2 rounded-[12px] px-4 py-2.5 text-[14px] font-semibold text-white transition-all hover:brightness-110"
          style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)", boxShadow: "0 4px 16px rgba(29,111,245,0.4)" }}>
          <Plus size={16} />
          {d.teacher.createBtn.replace("+ ", "")}
        </Link>
      </div>

      {/* Type pills */}
      <div className="flex items-center gap-2">
        {typeButtons.map((b) => (
          <button key={b.key} onClick={() => setTypeFilter(b.key)}
            className={cn("rounded-[10px] px-4 py-1.5 text-[13px] font-semibold transition-all",
              typeFilter === b.key
                ? "bg-brand-blue text-white shadow"
                : "bg-white/70 border border-white/80 text-brand-ink-muted hover:text-brand-ink")}>
            {b.label}
          </button>
        ))}

        <div className="ml-auto">
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}
            className="rounded-[10px] border border-white/80 bg-white/70 px-3 py-1.5 text-[13px] font-medium text-brand-ink focus:outline-none">
            <option value="all">{d.teacher.allGroups}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Homework list */}
        <div className="space-y-3 lg:col-span-2">
          {filtered.length === 0 && (
            <div className="rounded-[20px] bg-white/70 border border-white/80 p-8 text-center text-brand-ink-muted">
              {d.homework.noTasks}
            </div>
          )}
          {filtered.map((hw) => {
            const cfg = getSubjectConfig(hw.group.subject);
            const totalStudents = 10; // placeholder
            const submittedCount = hw.submissions.length;
            const pendingCount = hw.submissions.filter((s) => s.status === "submitted").length;
            const pct = Math.round((submittedCount / totalStudents) * 100);
            const now = new Date().toISOString();
            const overdue = hw.due_date && hw.due_date < now;
            return (
              <Link key={hw.id} href={`/teacher/homework/${hw.id}`}
                className="flex items-start gap-4 rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-4 transition-all hover:bg-white/90"
                style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-[22px]"
                  style={{ background: cfg.color + "20" }}>
                  {cfg.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[15px] font-semibold text-brand-ink leading-snug">{hw.title}</h3>
                    <button onClick={menuClick} className="shrink-0 rounded-lg p-1 text-slate-400 hover:text-brand-ink hover:bg-slate-100">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {hw.group.name}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",
                      hw.content_type === "test" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700")}>
                      {hw.content_type === "test" ? d.homework.typeTest : d.homework.typeFile}
                    </span>
                    {pendingCount > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        {pendingCount} {d.teacher.statsPending}
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between text-[11px] text-brand-ink-muted">
                      <span>{submittedCount} / {totalStudents} {d.teacher.progressLabel}</span>
                      {hw.due_date && (
                        <span className={overdue ? "text-danger" : "text-brand-ink-muted"}>
                          {new Date(hw.due_date).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-blue transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Stats panel */}
        <div className="space-y-4">
          <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
            <h3 className="mb-4 text-[15px] font-bold text-brand-ink">{d.teacher.statsTitle}</h3>
            <div className="space-y-2">
              {statusButtons.map((b) => (
                <button key={b.key} onClick={() => setStatusFilter(b.key)}
                  className={cn("flex w-full items-center justify-between rounded-[12px] px-3 py-2.5 text-left text-[13px] font-medium transition-all",
                    statusFilter === b.key
                      ? "bg-brand-blue/10 text-brand-blue"
                      : "text-brand-ink-muted hover:bg-slate-50 hover:text-brand-ink")}>
                  <span>{b.label}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold",
                    statusFilter === b.key ? "bg-brand-blue text-white" : "bg-slate-100 text-slate-600")}>
                    {b.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
