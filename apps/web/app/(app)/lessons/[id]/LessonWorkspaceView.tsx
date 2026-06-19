"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Clock, MapPin, Check, FileText, FileCode2, File,
  Image as ImageIcon, Sparkles,
} from "lucide-react";
import { getSubjectStyle, formatTime, getDictionary } from "@snr/core";
import type { StudentLessonView, LessonStagePublic, Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { useRealtimeChannel } from "@/lib/realtime";
import { ClassworkBlock } from "./ClassworkBlock";
import { RaiseHandButton } from "./RaiseHandButton";

const STAGE_KEYS = ["goal", "theory", "practice", "classwork", "review", "summary"] as const;

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function fmtBytes(b: number | null): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((x) => String(x).padStart(2, "0")).join(":");
}

function materialIcon(name: string): { Icon: typeof FileText; cls: string } {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return { Icon: ImageIcon, cls: "bg-purple-100 text-purple-600" };
  if (ext === "pdf") return { Icon: FileText, cls: "bg-red-100 text-red-600" };
  if (["doc", "docx", "txt", "rtf"].includes(ext)) return { Icon: FileText, cls: "bg-blue-100 text-blue-600" };
  if (["ino", "js", "ts", "py", "c", "cpp", "java", "json", "html", "css"].includes(ext)) return { Icon: FileCode2, cls: "bg-emerald-100 text-emerald-600" };
  return { Icon: File, cls: "bg-slate-100 text-slate-600" };
}

export function LessonWorkspaceView({
  lesson,
  materialUrls,
  studentId,
}: {
  lesson: StudentLessonView;
  materialUrls: Record<string, string>;
  studentId: string | null;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const w = d.lesson.workspace;
  const router = useRouter();
  const style = getSubjectStyle(lesson.group.subject);

  const stageLabels: Record<(typeof STAGE_KEYS)[number], string> = {
    goal: d.lesson.stage1, theory: d.lesson.stage2, practice: d.lesson.stage3,
    classwork: d.lesson.stage4, review: d.lesson.stage5, summary: d.lesson.stage6,
  };

  // Live elapsed timer (client-only → "00:00:00" until mounted to avoid hydration mismatch)
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed =
    nowMs !== null && lesson.started_at
      ? fmtElapsed(nowMs - new Date(lesson.started_at).getTime())
      : "00:00:00";

  // When the teacher ends the lesson (status → completed), refresh into the completed view.
  useRealtimeChannel(`lesson-status-${lesson.id}`, "lessons", `id=eq.${lesson.id}`, () => {
    router.refresh();
  });

  // Map canonical stages → done / active / upcoming
  const stagesByKey = new Map<string, LessonStagePublic>();
  for (const s of lesson.stages) stagesByKey.set(s.stage_key, s);
  let activeAssigned = false;
  const steps = STAGE_KEYS.map((key) => {
    const s = stagesByKey.get(key);
    if (s?.is_completed) return { key, state: "done" as const };
    if (s && !activeAssigned) { activeAssigned = true; return { key, state: "active" as const }; }
    return { key, state: "upcoming" as const };
  });

  const heroTitle = lesson.title ?? lesson.topic ?? style.label;
  const timeRange = lesson.ends_at
    ? `${formatTime(lesson.starts_at)} — ${formatTime(lesson.ends_at)}`
    : formatTime(lesson.starts_at);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link
        href="/schedule"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" />
        {d.lesson.back}
      </Link>

      {/* ── Header bar (gradient) ────────────────────────────────────── */}
      <header
        className="relative overflow-hidden rounded-2xl px-6 py-4 text-white shadow-xl"
        style={{ background: "linear-gradient(110deg, #0058bc 0%, #6b38d4 100%)" }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-100">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
              {w.live}
            </span>
            <h1 className="mt-1.5 truncate text-xl font-bold leading-tight md:text-2xl">{style.label}</h1>
            <p className="truncate text-sm text-white/75">{heroTitle}</p>
          </div>

          <div className="flex items-center gap-3">
            {lesson.teacher && (
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/10 py-1 pl-1 pr-4 sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                  {initials(lesson.teacher.full_name)}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-semibold">{lesson.teacher.full_name}</span>
                  {lesson.room && <span className="text-[10px] text-white/70">{d.lesson.cabinet} {lesson.room}</span>}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono">
              <Clock className="h-4 w-4 text-white/80" />
              <span className="text-lg font-bold tracking-wider tabular-nums">{elapsed}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── 3-column workspace ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: stages + raise hand */}
        <aside className="space-y-5 lg:col-span-3">
          <section className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">
              {d.lesson.stagesTitle}
            </h2>
            <ul className="relative flex flex-col gap-4">
              {steps.map((step, i) => {
                const isLast = i === steps.length - 1;
                return (
                  <li key={step.key} className="relative flex gap-3">
                    {!isLast && (
                      <span className="absolute left-[11px] top-6 h-[calc(100%+4px)] w-0.5 bg-slate-200" />
                    )}
                    <span
                      className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                        step.state === "done"
                          ? "border-emerald-500 bg-emerald-100 text-emerald-600"
                          : step.state === "active"
                          ? "border-blue-600 bg-blue-600 ring-4 ring-blue-200"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {step.state === "done" ? (
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      ) : step.state === "active" ? (
                        <span className="h-2 w-2 rounded-full bg-white" />
                      ) : null}
                    </span>
                    <span
                      className={`pt-0.5 text-sm ${
                        step.state === "done"
                          ? "font-medium text-slate-500"
                          : step.state === "active"
                          ? "font-bold text-blue-600"
                          : "font-medium text-slate-400"
                      }`}
                    >
                      {stageLabels[step.key]}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-5 border-t border-slate-100 pt-3 text-center text-[11px] font-medium text-slate-300">
              ID: {lesson.id.slice(0, 8)}
            </p>
          </section>

          {/* Raise hand */}
          {studentId && <RaiseHandButton lessonId={lesson.id} studentId={studentId} />}
        </aside>

        {/* Center: task / classwork */}
        <section className="lg:col-span-6">
          <div className="rounded-2xl border border-white/60 bg-white/60 p-6 shadow-sm backdrop-blur-xl md:p-8">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">{w.task}</h3>
            {lesson.description && (
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{lesson.description}</p>
            )}
            {studentId ? (
              <div className="mt-5">
                <ClassworkBlock lessonId={lesson.id} studentId={studentId} />
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-400">{w.noTask}</p>
            )}
          </div>
        </section>

        {/* Right: materials + AI */}
        <aside className="space-y-5 lg:col-span-3">
          <section className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-500">{w.materials}</h3>
            {lesson.materials.length === 0 ? (
              <p className="text-sm text-gray-400">{d.lesson.materialsEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {lesson.materials.map((m) => {
                  const url = materialUrls[m.id];
                  const ext = (m.file_original_name ?? m.title).split(".").pop()?.toUpperCase() ?? "";
                  const { Icon, cls } = materialIcon(m.file_original_name ?? m.title);
                  return (
                    <li key={m.id}>
                      <a
                        href={url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 rounded-xl border border-transparent p-2 transition-all hover:border-white/60 hover:bg-white/70"
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cls}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800 group-hover:text-blue-600">{m.title}</p>
                          <p className="text-[11px] text-slate-400">
                            {[ext, fmtBytes(m.file_size_bytes)].filter(Boolean).join(", ")}
                          </p>
                        </div>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* AI assistant (links to the dedicated AI page) */}
          <Link
            href="/ai-assistant"
            className="group relative block overflow-hidden rounded-2xl p-5 text-white shadow-lg transition-shadow hover:shadow-xl"
            style={{ background: "linear-gradient(135deg, #213145 0%, #0b1c30 100%)" }}
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-blue-500/30 blur-2xl transition-colors group-hover:bg-blue-500/50" />
            <div className="relative z-10 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-300" />
                <span className="text-[15px] font-bold">{w.aiTitle}</span>
              </div>
              <p className="text-[13px] leading-snug text-white/80">{w.aiPrompt}</p>
              <span className="mt-1 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-center text-xs font-semibold backdrop-blur-sm transition-colors group-hover:bg-white/20">
                {w.aiAsk}
              </span>
            </div>
          </Link>
        </aside>
      </div>
    </div>
  );
}
