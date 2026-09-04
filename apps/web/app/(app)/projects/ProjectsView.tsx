"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Code2, Cpu, Globe, FlaskRound, type LucideIcon } from "lucide-react";
import { getDictionary, type Locale, type StudentProjectListItem } from "@snr/core";
import { useLocale } from "@/components";
import { cn } from "@/lib/cn";
import { SandboxView } from "./SandboxView";
import { sandboxToolById, type SandboxToolId } from "@/lib/sandbox-tools";

type Mode = "projects" | "sandbox";
// Extract, а не свой список строк: если инструмент когда-нибудь уедет из
// песочницы, ошибка вылезет здесь при сборке, а не пустой карточкой у ученика.
type ExternalTool = Extract<SandboxToolId, "wokwi" | "geogebra" | "phet">;

// "Внешние" проекты не имеют БД-бэкинга вообще (содержимое живёт на стороннем
// сервисе, не у нас) — всегда 0%/"Не начат", клик открывает песочницу с
// предвыбранным инструментом. Список зависит от класса ученика.
// «Внешние инструменты» убраны 17.08.2026. Это была зашитая в код подборка
// идей по названию класса: у всех карточек стояло «0%, не начат», хотя учитель
// их не задавал, а ученик не начинал. Новый ученик открывал раздел и видел
// список, из которого следовало, что у него уже есть работы. Настоящие проекты
// приходят из таблицы projects; песочница осталась на своей вкладке.

// Иконка "своего" проекта — по ключевым словам в заголовке (нет отдельного
// поля "тип" на строке БД, см. отчёт по схеме — не заводим лишнюю колонку
// ради одной иконки).
function internalProjectIcon(title: string): LucideIcon {
  const t = title.toLowerCase();
  if (t.includes("c++") || t.includes("arduino")) return Cpu;
  if (t.includes("веб") || t.includes("сайт") || t.includes("javascript") || t.includes("html")) return Globe;
  return Code2;
}

export function ProjectsView({
  projects,
  className,
  subjectServicesRaw,
}: {
  projects: StudentProjectListItem[];
  className: string;
  /** Наборы сервисов предметов школы (миграция 258). Пусто — все сервисы. */
  subjectServicesRaw?: Record<string, string[]>;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.projects;
  const [mode, setMode] = useState<Mode>("projects");
  const [initialTool, setInitialTool] = useState<SandboxToolId | undefined>(undefined);

  function openSandbox(toolId?: SandboxToolId) {
    setInitialTool(toolId);
    setMode("sandbox");
  }


  function internalStatusBadge(p: StudentProjectListItem) {
    if (!p.submission) return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{t.statusNotStarted}</span>;
    // Ветки «оценено» здесь не было вовсе: оценка приезжает в карточку
    // (queries/projects.ts кладёт grade), но список показывал «на проверке»
    // даже после проверки. Подпись t.statusGraded лежала в словаре без единого
    // потребителя.
    if (p.submission.grade != null) {
      return (
        <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white">
          {t.statusGraded} · {p.submission.grade}
        </span>
      );
    }
    if (p.submission.is_submitted) return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{t.statusAwaiting}</span>;
    return <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-700">{t.statusInProgress}</span>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl text-slate-800">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{d.nav.projects}</h1>
      <p className="mt-1.5 text-sm text-slate-500">{t.pageSubtitle}</p>

      {/* Mode switch: проекты | песочница */}
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

      {mode === "sandbox" && <div className="mt-6"><SandboxView initialToolId={initialTool} subjectServicesRaw={subjectServicesRaw} /></div>}

      {mode === "projects" && (
        <>
          {/* Крупный CTA на песочницу */}
          <button
            type="button"
            onClick={() => openSandbox(undefined)}
            className="group mt-6 flex w-full items-center gap-5 rounded-[24px] bg-gradient-to-br from-violet-600 to-indigo-600 p-6 text-left shadow-lg shadow-violet-500/20 transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white"><FlaskRound className="h-7 w-7" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold text-white">{t.openSandboxBtn}</h2>
              <p className="mt-0.5 text-sm text-violet-100">{d.sandbox.subtitle}</p>
            </div>
            <ArrowRight className="h-6 w-6 shrink-0 text-white transition-transform group-hover:translate-x-1" />
          </button>

          <h2 className="mt-8 text-lg font-bold text-slate-900">{t.myProjectsSection}</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 pb-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const Icon = internalProjectIcon(p.title);
              const percent = p.stageCount > 0 ? Math.round((p.completedCount / p.stageCount) * 100) : 0;
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="group flex flex-col overflow-hidden rounded-[20px] border border-white bg-white/70 p-5 text-left shadow-md backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold text-slate-900">{p.title}</h3>
                    </div>
                  </div>
                  {p.teacherName && <p className="mt-2 text-[12px] font-semibold text-slate-400">{t.teacher}: {p.teacherName}</p>}
                  <p className="mt-3 line-clamp-2 flex-1 text-[13px] text-slate-500">{p.description}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex flex-1 items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600" style={{ width: `${percent}%` }} />
                      </div>
                      <span className="text-[11px] font-bold tabular-nums text-slate-400">{percent}%</span>
                    </div>
                  </div>
                  <div className="mt-3">{internalStatusBadge(p)}</div>
                </Link>
              );
            })}
          </div>

        </>
      )}
    </div>
  );
}
