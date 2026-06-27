"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase, Calendar } from "lucide-react";
import { getDictionary, getSubjectStyle, type Locale, type StudentProjectListItem } from "@snr/core";
import { SubjectIcon, useLocale } from "@/components";
import { cn } from "@/lib/cn";
import { SandboxView } from "./SandboxView";

type Filter = "all" | "active" | "submitted" | "graded";
type Mode = "projects" | "sandbox";

function statusOf(p: StudentProjectListItem): "not_started" | "in_progress" | "awaiting" | "graded" {
  const s = p.submission;
  if (!s) return "not_started";
  if (s.grade != null) return "graded";
  if (s.is_submitted) return "awaiting";
  return "in_progress";
}

export function ProjectsView({ projects }: { projects: StudentProjectListItem[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.projects;
  const ts = d.sandbox;
  const [mode, setMode] = useState<Mode>("projects");
  const [filter, setFilter] = useState<Filter>("all");

  const pills: { key: Filter; label: string }[] = [
    { key: "all", label: t.filterAll },
    { key: "active", label: t.filterActive },
    { key: "submitted", label: t.filterSubmitted },
    { key: "graded", label: t.filterGraded },
  ];

  const filtered = projects.filter((p) => {
    const s = statusOf(p);
    if (filter === "active") return s === "not_started" || s === "in_progress";
    if (filter === "submitted") return s === "awaiting";
    if (filter === "graded") return s === "graded";
    return true;
  });

  function statusBadge(p: StudentProjectListItem) {
    const s = statusOf(p);
    if (s === "graded") return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{t.statusGraded}: {p.submission?.grade}</span>;
    if (s === "awaiting") return <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-[10px] font-bold text-yellow-700">{t.statusAwaiting}</span>;
    if (s === "in_progress") return <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-700">{t.statusInProgress}</span>;
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{t.statusNotStarted}</span>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl text-slate-800">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{t.title}</h1>

      {/* Mode switch: оцениваемые проекты | песочница */}
      <div className="mt-4 inline-flex rounded-full border border-white/60 bg-white/60 p-1 backdrop-blur-xl">
        {([
          { key: "projects" as Mode, label: ts.modeProjects },
          { key: "sandbox" as Mode, label: ts.modeSandbox },
        ]).map((m) => (
          <button key={m.key} onClick={() => setMode(m.key)}
            className={cn("rounded-full px-5 py-1.5 text-sm font-bold transition-all",
              mode === m.key ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-500 hover:text-slate-700")}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === "sandbox" && <div className="mt-6"><SandboxView /></div>}

      {mode === "projects" && (<>
      <div className="mt-4 flex flex-wrap gap-2">
        {pills.map((p) => (
          <button key={p.key} onClick={() => setFilter(p.key)}
            className={cn("rounded-full px-5 py-2 text-sm font-bold transition-all",
              filter === p.key ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "border border-white/50 bg-white/70 text-slate-600 backdrop-blur-xl hover:bg-white/90")}>
            {p.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-[24px] border border-white/70 bg-white/60 py-20 text-center backdrop-blur-xl">
          <Briefcase className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-400">{t.empty}</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 pb-12 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const style = getSubjectStyle(p.subject);
            const pct = p.stageCount > 0 ? Math.round((p.completedCount / p.stageCount) * 100) : 0;
            const due = p.deadline ? new Date(p.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Asia/Tashkent" }) : null;
            const overdue = p.deadline ? new Date(p.deadline).getTime() < Date.now() && statusOf(p) !== "graded" : false;
            return (
              <Link key={p.id} href={`/projects/${p.id}`}
                className="group flex flex-col overflow-hidden rounded-[20px] border border-white bg-white/70 p-5 shadow-md backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${style.color}1a` }}>
                      <SubjectIcon subject={p.subject} size={20} />
                    </div>
                    <h3 className="font-bold text-slate-900">{p.title}</h3>
                  </div>
                  {statusBadge(p)}
                </div>
                {p.description && <p className="mt-3 line-clamp-2 text-[13px] text-slate-500">{p.description}</p>}
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={cn("h-full rounded-full", statusOf(p) === "graded" ? "bg-emerald-500" : "bg-blue-500")} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] font-bold tabular-nums text-slate-400">{p.completedCount}/{p.stageCount}</span>
                </div>
                {due && (
                  <p className={cn("mt-3 flex items-center gap-1 text-[12px]", overdue ? "font-semibold text-red-500" : "text-slate-400")}>
                    <Calendar size={12} /> {t.deadline}: {due}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
      </>)}
    </div>
  );
}
