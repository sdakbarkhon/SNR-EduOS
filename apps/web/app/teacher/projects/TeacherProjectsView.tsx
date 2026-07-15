"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Briefcase, Calendar, Layers, Users, Search } from "lucide-react";
import { getDictionary, getSubjectStyle, type Locale, type TeacherProjectListItem } from "@snr/core";
import { SubjectIcon, useLocale } from "@/components";
import { TeacherProjectFormModal } from "./TeacherProjectFormModal";

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Asia/Tashkent" });
}

export function TeacherProjectsView({
  teacherId, projects, groups,
}: {
  teacherId: string;
  projects: TeacherProjectListItem[];
  groups: Array<{ id: string; name: string; subject: string }>;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.teacher.projects;
  const [formOpen, setFormOpen] = useState(false);
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery), 300);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.group.name.toLowerCase().includes(q) ||
      p.subject.toLowerCase().includes(q),
    );
  }, [projects, query]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="group relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-600" />
          <input
            type="text"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Поиск по проектам…"
            className="w-full rounded-xl border border-white/50 bg-white/60 py-2.5 pl-11 pr-4 text-sm font-medium text-brand-ink shadow-sm backdrop-blur outline-none transition-all placeholder:text-gray-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <button onClick={() => setFormOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-blue/25 hover:brightness-110">
          <Plus size={16} /> {t.create}
        </button>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[24px] border border-white/70 bg-white/60 py-20 text-center backdrop-blur-xl">
          <Briefcase className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-brand-ink-muted">{projects.length === 0 ? t.empty : d.homework.noResultsTitle}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((p) => {
            const style = getSubjectStyle(p.subject);
            const due = fmtDate(p.deadline);
            return (
              <Link key={p.id} href={`/teacher/projects/${p.id}`}
                className="group flex flex-col gap-3 rounded-[20px] border border-white/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${style.color}1a` }}>
                    <SubjectIcon subject={p.subject} size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: style.color }}>{p.group.name}</p>
                    <h3 className="truncate text-[15px] font-bold text-brand-ink">{p.title}</h3>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-brand-ink-muted">
                  <span className="inline-flex items-center gap-1"><Layers size={13} /> {t.stagesCount.replace("{n}", String(p.stageCount))}</span>
                  <span className="inline-flex items-center gap-1"><Users size={13} /> {t.submittedCount.replace("{done}", String(p.submittedCount)).replace("{total}", String(p.totalStudents))}</span>
                  {due && <span className="inline-flex items-center gap-1"><Calendar size={13} /> {due}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {formOpen && <TeacherProjectFormModal teacherId={teacherId} groups={groups} onClose={() => setFormOpen(false)} />}
    </div>
  );
}
