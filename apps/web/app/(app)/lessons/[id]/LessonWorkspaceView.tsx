"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Clock, Check, FileText, FileCode2, File,
  Image as ImageIcon, Sparkles, BookOpen, ListChecks,
} from "lucide-react";
import {
  getSubjectStyle, formatTime, getDictionary,
  markTheoryStudied, submitStageTask,
} from "@snr/core";
import type { StudentLessonView, LessonStageWithProgress, Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { useRealtimeChannel } from "@/lib/realtime";
import { RaiseHandButton } from "./RaiseHandButton";
import { createClient } from "@/lib/supabase/client";

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

// ── Task stub modal ────────────────────────────────────────────────────────────
function TaskStubModal({
  stage,
  onClose,
}: {
  stage: LessonStageWithProgress;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).lesson;

  const contentName = stage.content_type
    ? {
        presentation: d.stageContentPresentation,
        code:         d.stageContentCode,
        scratch:      d.stageContentScratch,
        tinkercad:    d.stageContentTinkercad,
        app_inventor: d.stageContentAppInventor,
        code_monkey:  d.stageContentCodeMonkey,
        quiz_qia:     d.stageContentQuizQia,
        quiz_kahoot:  d.stageContentQuizKahoot,
      }[stage.content_type] ?? stage.content_type
    : null;

  const isSubmitted = !!stage.progress?.submission_data;
  const isGraded = stage.progress?.grade != null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--surface-1, #fff)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{stage.title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {stage.description && (
          <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{stage.description}</p>
        )}

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          {d.stageTaskStubPrefix}
          {contentName ? ` ${contentName}` : ""}
        </div>

        {isGraded && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            {d.stageTaskGradedLabel}: {stage.progress?.grade}/5
            {stage.progress?.teacher_comment && (
              <p className="mt-1 text-xs opacity-80">{stage.progress.teacher_comment}</p>
            )}
          </div>
        )}
        {!isGraded && isSubmitted && (
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
            {d.stageTaskSubmittedLabel}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
        >
          {d.stageTaskCloseBtn}
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

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
  const dl = d.lesson;
  const router = useRouter();
  const db = createClient();
  const style = getSubjectStyle(lesson.group.subject);

  const [stages, setStages] = useState<LessonStageWithProgress[]>(lesson.stages);
  const [openTaskStageId, setOpenTaskStageId] = useState<string | null>(null);
  const [studiedLoading, setStudiedLoading] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Live elapsed timer (client-only → "00:00:00" until mounted)
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

  // Refresh when teacher ends lesson
  useRealtimeChannel(`lesson-status-${lesson.id}`, "lessons", `id=eq.${lesson.id}`, () => {
    router.refresh();
  });

  const handleMarkStudied = useCallback(async (stageId: string) => {
    if (!studentId) return;
    setStudiedLoading(stageId);
    try {
      await markTheoryStudied(db, stageId, studentId);
      setStages((prev) =>
        prev.map((s) =>
          s.id === stageId
            ? {
                ...s,
                progress: {
                  ...s.progress,
                  id: s.progress?.id ?? "",
                  stage_id: stageId,
                  student_id: studentId,
                  is_completed: true,
                  completed_at: new Date().toISOString(),
                  submission_data: s.progress?.submission_data ?? null,
                  grade: s.progress?.grade ?? null,
                  teacher_comment: s.progress?.teacher_comment ?? null,
                  graded_at: s.progress?.graded_at ?? null,
                  graded_by: s.progress?.graded_by ?? null,
                },
              }
            : s,
        ),
      );
    } catch { /* noop */ } finally {
      setStudiedLoading(null);
    }
  }, [db, studentId]);

  const heroTitle = lesson.title ?? lesson.topic ?? style.label;
  const timeRange = lesson.ends_at
    ? `${formatTime(lesson.starts_at)} — ${formatTime(lesson.ends_at)}`
    : formatTime(lesson.starts_at);

  const startStage   = stages.find((s) => s.stage_role === "start");
  const summaryStage = stages.find((s) => s.stage_role === "summary");
  const middleStages = stages
    .filter((s) => s.stage_role === "middle")
    .sort((a, b) => a.position - b.position);

  const openTaskStage = openTaskStageId ? stages.find((s) => s.id === openTaskStageId) : null;

  // Compute stepper state
  type StepState = "done" | "active" | "upcoming";
  function getStepState(stage: LessonStageWithProgress, idx: number): StepState {
    if (stage.is_completed) return "done";
    if (stage.stage_role === "start" && lesson.status === "in_progress") return "done";
    if (stage.progress?.is_completed) return "done";
    // first non-done middle stage is active
    const prevAllDone = middleStages.slice(0, idx).every(
      (s) => s.is_completed || s.progress?.is_completed,
    );
    if (prevAllDone) return "active";
    return "upcoming";
  }

  const allStepsForStepper = [
    ...(startStage ? [startStage] : []),
    ...middleStages,
    ...(summaryStage ? [summaryStage] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link
        href="/schedule"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" />
        {dl.back}
      </Link>

      {/* Header bar */}
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
                  {lesson.room && <span className="text-[10px] text-white/70">{dl.cabinet} {lesson.room}</span>}
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

      {/* 3-column workspace */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

        {/* Left: stages stepper */}
        <aside className="space-y-5 lg:col-span-3">
          <section className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">
              {dl.stagesTitle}
            </h2>
            <ul className="relative flex flex-col gap-4">
              {allStepsForStepper.map((stage, i) => {
                const isLast = i === allStepsForStepper.length - 1;
                const middleIdx = middleStages.findIndex((s) => s.id === stage.id);
                const stepState: StepState =
                  stage.stage_role === "start"
                    ? lesson.status === "in_progress" || lesson.status === "completed"
                      ? "done"
                      : "upcoming"
                    : stage.stage_role === "summary"
                    ? lesson.status === "completed"
                      ? "done"
                      : "upcoming"
                    : getStepState(stage, middleIdx);

                return (
                  <li key={stage.id} className="relative flex gap-3">
                    {!isLast && (
                      <span className="absolute left-[11px] top-6 h-[calc(100%+4px)] w-0.5 bg-slate-200" />
                    )}
                    <span
                      className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                        stepState === "done"
                          ? "border-emerald-500 bg-emerald-100 text-emerald-600"
                          : stepState === "active"
                          ? "border-blue-600 bg-blue-600 ring-4 ring-blue-200"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {stepState === "done" ? (
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      ) : stepState === "active" ? (
                        <span className="h-2 w-2 rounded-full bg-white" />
                      ) : null}
                    </span>
                    <div className="flex flex-1 flex-col gap-0.5 pt-0.5">
                      <span
                        className={`text-sm ${
                          stepState === "done"
                            ? "font-medium text-slate-500"
                            : stepState === "active"
                            ? "font-bold text-blue-600"
                            : "font-medium text-slate-400"
                        }`}
                      >
                        {stage.title}
                      </span>
                      {stage.stage_role === "middle" && stage.stage_type && (
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                          stage.stage_type === "task" ? "text-violet-500" : "text-blue-400"
                        }`}>
                          {stage.stage_type === "task"
                            ? dl.stageBadgeTask
                            : dl.stageBadgeTheory}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {allStepsForStepper.length === 0 && (
              <p className="text-center text-xs text-slate-400">—</p>
            )}
            <p className="mt-5 border-t border-slate-100 pt-3 text-center text-[11px] font-medium text-slate-300">
              ID: {lesson.id.slice(0, 8)}
            </p>
          </section>

          {/* Raise hand */}
          {studentId && <RaiseHandButton lessonId={lesson.id} studentId={studentId} />}
        </aside>

        {/* Center: active middle stages content */}
        <section className="space-y-4 lg:col-span-6">
          {lesson.description && (
            <div className="rounded-2xl border border-white/60 bg-white/60 px-6 py-4 shadow-sm backdrop-blur-xl">
              <p className="text-[15px] leading-relaxed text-slate-600">{lesson.description}</p>
            </div>
          )}

          {middleStages.length === 0 ? (
            <div className="rounded-2xl border border-white/60 bg-white/60 p-6 shadow-sm backdrop-blur-xl">
              <p className="text-center text-sm text-slate-400">{w.noTask}</p>
            </div>
          ) : (
            middleStages.map((stage) => {
              const isStudied = stage.progress?.is_completed;
              const isSubmitted = !!stage.progress?.submission_data;
              const isGraded = stage.progress?.grade != null;
              const isLoading = studiedLoading === stage.id;

              return (
                <div
                  key={stage.id}
                  className={`rounded-2xl border p-5 shadow-sm backdrop-blur-xl transition-all ${
                    stage.stage_type === "task"
                      ? "border-violet-100 bg-violet-50/40 dark:border-violet-500/20 dark:bg-violet-500/5"
                      : "border-blue-100 bg-blue-50/40 dark:border-blue-500/20 dark:bg-blue-500/5"
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      stage.stage_type === "task"
                        ? "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300"
                        : "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300"
                    }`}>
                      {stage.stage_type === "task"
                        ? <ListChecks className="h-4 w-4" />
                        : <BookOpen className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[15px] font-bold text-slate-800 dark:text-slate-100">{stage.title}</h3>
                      {stage.content_type && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {dl.stageContentPresentation && stage.content_type === "presentation"
                            ? dl.stageContentPresentation
                            : stage.content_type}
                        </span>
                      )}
                    </div>
                    {(isStudied || isSubmitted || isGraded) && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </div>

                  {stage.description && (
                    <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{stage.description}</p>
                  )}

                  {/* Theory: "Изучил" button */}
                  {stage.stage_type === "theory" && (
                    isStudied ? (
                      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        <Check className="h-4 w-4" />
                        {dl.stageStudiedDone}
                      </div>
                    ) : (
                      studentId && (
                        <button
                          onClick={() => handleMarkStudied(stage.id)}
                          disabled={isLoading}
                          className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-60"
                        >
                          {isLoading ? "…" : dl.stageStudiedBtn}
                        </button>
                      )
                    )
                  )}

                  {/* Task: stub button */}
                  {stage.stage_type === "task" && (
                    <div>
                      {isGraded ? (
                        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          <Check className="h-4 w-4" />
                          {dl.stageTaskGradedLabel}: {stage.progress?.grade}/5
                        </div>
                      ) : isSubmitted ? (
                        <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                          {dl.stageTaskSubmittedLabel}
                        </div>
                      ) : (
                        mounted && studentId && (
                          <button
                            onClick={() => setOpenTaskStageId(stage.id)}
                            className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/25 hover:bg-violet-700 active:scale-95"
                          >
                            {dl.stageTaskStubPrefix}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* Right: materials + AI */}
        <aside className="space-y-5 lg:col-span-3">
          <section className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-500">{w.materials}</h3>
            {lesson.materials.length === 0 ? (
              <p className="text-sm text-gray-400">{dl.materialsEmpty}</p>
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

          {/* AI assistant link */}
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

      {/* Task stub modal */}
      {mounted && openTaskStage && (
        <TaskStubModal
          stage={openTaskStage}
          onClose={() => setOpenTaskStageId(null)}
        />
      )}
    </div>
  );
}
