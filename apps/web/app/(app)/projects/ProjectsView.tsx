"use client";

import { useState } from "react";
import { ArrowRight, Code2, Cpu, Globe, type LucideIcon } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components";
import { cn } from "@/lib/cn";
import { SandboxView } from "./SandboxView";
import type { SandboxToolId } from "@/lib/sandbox-tools";

type Mode = "projects" | "sandbox";
type ProjectType = "python" | "arduino" | "web" | "turbowarp";
type ProjectStatus = "not_started" | "in_progress" | "completed";

type DemoProject = {
  id: number;
  title: string;
  type: ProjectType;
  icon: string;
  description: string;
  status: ProjectStatus;
  progress: number;
};

// Заглушки — реальной таблицы "портфолио проектов" нет, только оцениваемые
// проекты (см. getStudentProjects/[id]) и песочница. Карточки ведут в
// песочницу с предвыбранным инструментом (Iter5 P10, вариант А).
const DEMO_PROJECTS: DemoProject[] = [
  { id: 1, title: "Игра змейка на Python", type: "python", icon: "🐍", description: "Классическая игра Змейка с использованием Pygame", status: "in_progress", progress: 60 },
  { id: 2, title: "Мигающий светодиод Arduino", type: "arduino", icon: "💡", description: "Управление светодиодом через Wokwi симулятор", status: "completed", progress: 100 },
  { id: 3, title: "Мой первый сайт", type: "web", icon: "🌐", description: "HTML + CSS страница про хобби", status: "in_progress", progress: 40 },
  { id: 4, title: "Танцующий кот", type: "turbowarp", icon: "🐱", description: "Анимация в TurboWarp", status: "completed", progress: 100 },
  { id: 5, title: "Калькулятор", type: "python", icon: "🧮", description: "Простой калькулятор на Python", status: "not_started", progress: 0 },
  { id: 6, title: "Умный дом на Arduino", type: "arduino", icon: "🏠", description: "Датчики температуры и света через Wokwi", status: "in_progress", progress: 30 },
  { id: 7, title: "Викторина на TurboWarp", type: "turbowarp", icon: "❓", description: "Интерактивная викторина по школьным предметам", status: "not_started", progress: 0 },
];

// Соответствует градиентам инструментов в SANDBOX_TOOLS — карточка ведёт
// именно в этот инструмент, поэтому цвета совпадают.
const TYPE_STYLE: Record<ProjectType, { tool: SandboxToolId; gradient: string; badgeBg: string; badgeText: string; Icon: LucideIcon }> = {
  python: { tool: "code", gradient: "from-emerald-500 to-teal-600", badgeBg: "bg-emerald-50", badgeText: "text-emerald-700", Icon: Code2 },
  arduino: { tool: "wokwi", gradient: "from-sky-400 to-blue-500", badgeBg: "bg-sky-50", badgeText: "text-sky-700", Icon: Cpu },
  web: { tool: "codesandbox", gradient: "from-slate-600 to-slate-800", badgeBg: "bg-slate-100", badgeText: "text-slate-700", Icon: Globe },
  turbowarp: { tool: "turbowarp", gradient: "from-orange-400 to-amber-500", badgeBg: "bg-orange-50", badgeText: "text-orange-700", Icon: Code2 },
};

export function ProjectsView() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.projects;
  const [mode, setMode] = useState<Mode>("projects");
  const [initialTool, setInitialTool] = useState<SandboxToolId | undefined>(undefined);

  function openSandbox(toolId?: SandboxToolId) {
    setInitialTool(toolId);
    setMode("sandbox");
  }

  const typeLabels: Record<ProjectType, string> = {
    python: t.typePython,
    arduino: t.typeArduino,
    web: t.typeWeb,
    turbowarp: t.typeTurbowarp,
  };

  function statusBadge(p: DemoProject) {
    if (p.status === "completed") return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{t.statusCompleted}</span>;
    if (p.status === "in_progress") return <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-700">{t.statusInProgress}</span>;
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{t.statusNotStarted}</span>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl text-slate-800">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{d.nav.projects}</h1>
      <p className="mt-1.5 text-sm text-slate-500">{t.pageSubtitle}</p>

      {/* Mode switch: демо-проекты | песочница */}
      <div className="mt-5 inline-flex rounded-full border border-white/60 bg-white/60 p-1 backdrop-blur-xl">
        {([
          { key: "projects" as Mode, label: d.sandbox.modeProjects },
          { key: "sandbox" as Mode, label: d.sandbox.modeSandbox },
        ]).map((m) => (
          <button
            key={m.key}
            onClick={() => { if (m.key === "projects") setMode("projects"); else openSandbox(undefined); }}
            className={cn(
              "rounded-full px-5 py-1.5 text-sm font-bold transition-all",
              mode === m.key ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-500 hover:text-slate-700",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "sandbox" && <div className="mt-6"><SandboxView initialToolId={initialTool} /></div>}

      {mode === "projects" && (
        <>
          {/* Крупный CTA на песочницу */}
          <button
            type="button"
            onClick={() => openSandbox(undefined)}
            className="group mt-6 flex w-full items-center gap-5 rounded-[24px] bg-gradient-to-br from-violet-600 to-indigo-600 p-6 text-left shadow-lg shadow-violet-500/20 transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl">🧪</div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold text-white">{t.openSandboxBtn}</h2>
              <p className="mt-0.5 text-sm text-violet-100">{d.sandbox.subtitle}</p>
            </div>
            <ArrowRight className="h-6 w-6 shrink-0 text-white transition-transform group-hover:translate-x-1" />
          </button>

          <h2 className="mt-8 text-lg font-bold text-slate-900">{t.myProjectsSection}</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 pb-12 md:grid-cols-2 lg:grid-cols-3">
            {DEMO_PROJECTS.map((p) => {
              const style = TYPE_STYLE[p.type];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openSandbox(style.tool)}
                  className="group flex flex-col overflow-hidden rounded-[20px] border border-white bg-white/70 p-5 text-left shadow-md backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-xl shadow-sm", style.gradient)}>
                        {p.icon}
                      </div>
                      <h3 className="font-bold text-slate-900">{p.title}</h3>
                    </div>
                  </div>
                  <span className={cn("mt-3 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold", style.badgeBg, style.badgeText)}>
                    <style.Icon className="h-3 w-3" /> {typeLabels[p.type]}
                  </span>
                  <p className="mt-3 line-clamp-2 flex-1 text-[13px] text-slate-500">{p.description}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex flex-1 items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn("h-full rounded-full bg-gradient-to-r", style.gradient)}
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold tabular-nums text-slate-400">{p.progress}%</span>
                    </div>
                  </div>
                  <div className="mt-3">{statusBadge(p)}</div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
