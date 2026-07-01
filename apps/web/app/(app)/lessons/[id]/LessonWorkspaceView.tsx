"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Clock, Check, FileText, FileCode2, File, Menu,
  Image as ImageIcon, BookOpen, ListChecks, Lock, X, Download, Monitor,
} from "lucide-react";
import {
  getSubjectStyle, formatTime, getDictionary,
  markTheoryStudied, submitStageTask,
} from "@snr/core";
import type { StudentLessonView, LessonStageWithProgress, LessonStageProgress, Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { useRealtimeChannel } from "@/lib/realtime";
import { RaiseHandButton } from "./RaiseHandButton";
import { AiChatPanel } from "./AiChatPanel";
import { SlideViewer } from "@/components/lesson-stages/SlideViewer";
import { exportSlidesToPptx } from "@/lib/export-slides-to-pptx";
import { CodeStageView } from "./CodeStageView";
import { ExternalStageModal } from "./ExternalStageModal";
import { QiaQuizModal } from "./QiaQuizModal";
import { KahootStudentModal } from "./KahootStudentModal";
import { isExternalService } from "@/lib/external-services";
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

// Demo block: how to render a shown material, by file extension.
function demoKind(name: string): "pdf" | "video" | "image" | "other" {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["mp4", "webm", "ogg", "mov", "m4v"].includes(ext)) return "video";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext)) return "image";
  return "other";
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
        wokwi:        d.stageContentWokwi,
        codesandbox:  d.stageContentCodesandbox,
        makecode:     d.stageContentMakecode,
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

// ── MaterialViewerModal ────────────────────────────────────────────────────────
type ViewerMaterial = { url: string; type: "pdf" | "image" | "other"; title: string };

function MaterialViewerModal({ mat, onClose }: { mat: ViewerMaterial; onClose: () => void }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex flex-col"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="truncate text-sm font-medium text-white">{mat.title}</p>
        <div className="flex items-center gap-2">
          <a
            href={mat.url}
            download
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
          >
            <Download className="h-3.5 w-3.5" />
            {d.common.download}
          </a>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        {mat.type === "pdf" && (
          <iframe
            src={`${mat.url}#toolbar=0`}
            className="h-full w-full"
            title={mat.title}
          />
        )}
        {mat.type === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mat.url}
            alt={mat.title}
            className="max-h-full max-w-full object-contain"
          />
        )}
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
  const [activeStageId, setActiveStageId] = useState<string | null>(lesson.active_stage_id);
  const [demoMaterialId, setDemoMaterialId] = useState<string | null>(lesson.demo_material_id);
  const [stageChangedBanner, setStageChangedBanner] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [openTaskStageId, setOpenTaskStageId] = useState<string | null>(null);
  const [activeCodeStageId, setActiveCodeStageId] = useState<string | null>(null);
  const [externalStageId, setExternalStageId] = useState<string | null>(null);
  const [qiaStageId, setQiaStageId] = useState<string | null>(null);
  const [kahootStageId, setKahootStageId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [viewerMat, setViewerMat] = useState<ViewerMaterial | null>(null);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [completedElapsed, setCompletedElapsed] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Refs for stable callback in realtime handler (avoid stale closure)
  const activeStageIdRef = useRef(activeStageId);
  const activeCodeStageIdRef = useRef(activeCodeStageId);
  const externalStageIdRef = useRef(externalStageId);
  const qiaStageIdRef = useRef(qiaStageId);
  const kahootStageIdRef = useRef(kahootStageId);
  useEffect(() => { activeStageIdRef.current = activeStageId; }, [activeStageId]);
  useEffect(() => { activeCodeStageIdRef.current = activeCodeStageId; }, [activeCodeStageId]);
  useEffect(() => { externalStageIdRef.current = externalStageId; }, [externalStageId]);
  useEffect(() => { qiaStageIdRef.current = qiaStageId; }, [qiaStageId]);
  useEffect(() => { kahootStageIdRef.current = kahootStageId; }, [kahootStageId]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setAnimKey((k) => k + 1); }, [activeStageId]);
  // Read sidebar state from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    const stored = localStorage.getItem("lesson-sidebar-collapsed");
    if (stored !== null) setSidebarCollapsed(stored === "true");
  }, []);
  useEffect(() => {
    localStorage.setItem("lesson-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Auto-mark theory stages as studied when teacher activates them
  useEffect(() => {
    if (!studentId || !activeStageId) return;
    const s = stages.find((st) => st.id === activeStageId);
    if (s?.stage_type !== "theory" || s.progress?.is_completed) return;
    markTheoryStudied(db, activeStageId, studentId).catch(() => null);
    setStages((prev) =>
      prev.map((st) =>
        st.id !== activeStageId ? st : {
          ...st,
          progress: {
            id: st.progress?.id ?? "",
            stage_id: activeStageId,
            student_id: studentId,
            is_completed: true,
            completed_at: new Date().toISOString(),
            submission_data: st.progress?.submission_data ?? null,
            grade: st.progress?.grade ?? null,
            teacher_comment: st.progress?.teacher_comment ?? null,
            graded_at: st.progress?.graded_at ?? null,
            graded_by: st.progress?.graded_by ?? null,
          } as LessonStageProgress,
        }
      ),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStageId, studentId]);

  // Completion modal countdown → redirect to /schedule at 0
  useEffect(() => {
    if (!showCompletedModal) return;
    if (countdown <= 0) { router.push("/schedule"); return; }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [showCompletedModal, countdown, router]);

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

  // Realtime: listen for lesson changes (status + active_stage_id)
  useRealtimeChannel(
    `lesson-student-${lesson.id}`,
    "lessons",
    `id=eq.${lesson.id}`,
    useCallback((payload) => {
      const newActiveStageId = payload?.new?.active_stage_id as string | null | undefined;
      const newStatus = payload?.new?.status as string | undefined;

      // Handle active_stage_id change
      if (newActiveStageId !== undefined && newActiveStageId !== activeStageIdRef.current) {
        setActiveStageId(newActiveStageId ?? null);

        // Show "teacher moved to new stage" banner briefly
        setStageChangedBanner(true);
        setTimeout(() => setStageChangedBanner(false), 4000);

        // Close fullscreen if student is viewing a stage that is no longer the active one
        // (i.e., teacher jumped forward past it, or activated a different stage)
        const openId = activeCodeStageIdRef.current ?? externalStageIdRef.current
          ?? qiaStageIdRef.current ?? kahootStageIdRef.current;
        if (openId && openId !== (newActiveStageId ?? null)) {
          setActiveCodeStageId(null);
          setExternalStageId(null);
          setQiaStageId(null);
          setKahootStageId(null);
          setOpenTaskStageId(null);
        }
      }

      // Teacher "show to class": demo material toggled on/off.
      const newDemoId = payload?.new?.demo_material_id as string | null | undefined;
      if (newDemoId !== undefined) {
        setDemoMaterialId(newDemoId ?? null);
        // Starting a demo drops the student out of any open fullscreen stage.
        if (newDemoId) {
          setActiveCodeStageId(null);
          setExternalStageId(null);
          setQiaStageId(null);
          setKahootStageId(null);
          setOpenTaskStageId(null);
        }
      }

      // When lesson ends, show completion modal (intercepts router.refresh)
      if (newStatus && newStatus !== lesson.status) {
        if (newStatus === "completed") {
          const duration = lesson.started_at
            ? Date.now() - new Date(lesson.started_at).getTime()
            : 0;
          if (duration > 60000) {
            setCompletedElapsed(fmtElapsed(duration));
            setShowCompletedModal(true);
            setCountdown(5);
          } else {
            router.push("/schedule");
          }
        } else {
          router.refresh();
        }
      }
    }, [lesson.status, router]),
  );


  const heroTitle = lesson.title ?? lesson.topic ?? style.label;
  const timeRange = lesson.ends_at
    ? `${formatTime(lesson.starts_at)} — ${formatTime(lesson.ends_at)}`
    : formatTime(lesson.starts_at);

  const startStage   = stages.find((s) => s.stage_role === "start");
  const summaryStage = stages.find((s) => s.stage_role === "summary");
  const allMiddleStages = stages
    .filter((s) => s.stage_role === "middle")
    .sort((a, b) => a.position - b.position);

  // Active-stage visibility: only show stages up to (and including) the active one,
  // unless the lesson is completed (show all as read-only).
  const activeMiddleStage = allMiddleStages.find((s) => s.id === activeStageId) ?? null;
  const activePos = activeMiddleStage?.position ?? -1;
  const isCompleted = lesson.status === "completed";
  // middleStages: visible stages for sidebar stepper (position ≤ active, or all if completed)
  const middleStages = isCompleted
    ? allMiddleStages.filter((s) => (s as any).was_activated === true)
    : allMiddleStages.filter((s) => activeStageId === null ? false : s.position <= activePos);
  // centerStages: what the center panel renders — only active stage (in_progress) or all (completed)
  const centerStages = isCompleted
    ? allMiddleStages.filter((s) => (s as any).was_activated === true)
    : activeMiddleStage ? [activeMiddleStage] : [];

  // A stage is read-only if it's a passed stage (position < active) or the lesson is completed
  function isStageReadOnly(stage: LessonStageWithProgress): boolean {
    if (isCompleted) return true;
    if (activeStageId === null) return false;
    return stage.position < activePos;
  }

  const openTaskStage = openTaskStageId ? stages.find((s) => s.id === openTaskStageId) : null;
  const activeCodeStage = activeCodeStageId ? stages.find((s) => s.id === activeCodeStageId) : null;
  const externalStage = externalStageId ? stages.find((s) => s.id === externalStageId) : null;
  const qiaStage = qiaStageId ? stages.find((s) => s.id === qiaStageId) : null;
  const kahootStage = kahootStageId ? stages.find((s) => s.id === kahootStageId) : null;

  const handleStageSubmitted = useCallback((progress: LessonStageProgress) => {
    setStages((prev) => prev.map((s) => s.id === progress.stage_id ? { ...s, progress } : s));
  }, []);

  // Compute stepper state based on teacher-set active stage
  type StepState = "done" | "active" | "upcoming";
  function getStepState(stage: LessonStageWithProgress): StepState {
    if (isCompleted) return "done";
    if (activeStageId === null) return "upcoming";
    if (stage.id === activeStageId) return "active";
    if (stage.position < activePos) return "done";
    return "upcoming";
  }

  function isMiddleStageUnlocked(idx: number): boolean {
    if (isCompleted) return true;
    if (idx === 0) return true;
    return centerStages.slice(0, idx).every((s) =>
      s.progress?.is_completed || s.progress?.submission_data != null
    );
  }

  // Stepper shows: start + all middle stages + summary
  const allStepsForStepper = [
    ...(startStage ? [startStage] : []),
    ...allMiddleStages,
    ...(summaryStage ? [summaryStage] : []),
  ];

  const da = dl.activeStage;

  return (
    <div className="w-full px-4 md:px-6 space-y-5">
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
            <h1 className="mt-1.5 truncate text-xl font-bold leading-tight md:text-2xl">{lesson.subjectName ?? style.label}</h1>
            <p className="truncate text-sm text-white/75">{heroTitle}</p>
          </div>

          <div className="flex items-center gap-3">
            {lesson.teacher && (
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/10 py-1 pl-1 pr-4 sm:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                  {initials(lesson.teacher.full_name)}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] text-white/60">{dl.teacherLabel}</span>
                  <span className="text-xs font-semibold">{lesson.teacher.full_name}</span>
                </div>
              </div>
            )}
            {studentId && <RaiseHandButton lessonId={lesson.id} studentId={studentId} />}
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono">
              <Clock className="h-4 w-4 text-white/80" />
              <span className="text-lg font-bold tracking-wider tabular-nums">{elapsed}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Teacher is showing a material to the whole class (Realtime broadcast) */}
      {demoMaterialId && (() => {
        const mat = lesson.materials.find((m) => m.id === demoMaterialId);
        const url = mat ? materialUrls[mat.id] : undefined;
        const name = mat?.file_original_name ?? mat?.title ?? "";
        const kind = demoKind(name);
        return (
          <section className="overflow-hidden rounded-2xl border-2 border-violet-300 shadow-xl">
            <div className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-3 text-white">
              <Monitor className="h-5 w-5 shrink-0" />
              <span className="text-sm font-bold">{d.demo.teacherShowing}</span>
              {mat?.title && <span className="truncate text-sm text-white/80">— {mat.title}</span>}
              <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Live
              </span>
            </div>
            <div className="bg-slate-900">
              {mat && url && kind === "pdf" ? (
                <iframe src={`${url}#toolbar=0`} title={name} className="h-[600px] w-full bg-white" />
              ) : mat && url && kind === "video" ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={url} controls autoPlay className="mx-auto max-h-[600px] w-full bg-black" />
              ) : mat && url && kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={name} className="mx-auto max-h-[600px] w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
                  <p className="text-sm font-semibold text-white">{d.demo.unsupportedFormat}</p>
                  <p className="text-xs text-white/60">{d.demo.supportedFormats}</p>
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* Teacher changed stage banner */}
      {stageChangedBanner && (
        <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-800 shadow-sm">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-violet-500" />
          {da.teacherChangedStage}
        </div>
      )}

      {/* Fixed sidebar toggle — burger/X, desktop only */}
      {mounted && (
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="fixed left-4 top-4 z-40 hidden h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all duration-200 hover:bg-white/20 lg:flex"
          title={sidebarCollapsed ? w.expand : w.collapse}
        >
          {sidebarCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </button>
      )}

      {/* 3-column workspace */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">

        {/* Left: stages stepper — collapsible on desktop */}
        <aside className={`relative lg:flex-shrink-0 lg:transition-all lg:duration-300 lg:ease-out ${sidebarCollapsed ? "lg:w-0 lg:overflow-hidden" : "lg:w-80"}`}>

          <div className={`space-y-5 lg:transition-opacity lg:duration-200 ${sidebarCollapsed ? "lg:opacity-0" : "opacity-100"}`}>
          <section className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">
              {w.stages}
            </h2>
            <ul className="relative flex flex-col gap-4">
              {allStepsForStepper.map((stage, i) => {
                const isLast = i === allStepsForStepper.length - 1;
                const stepState: StepState =
                  stage.stage_role === "start"
                    ? lesson.status === "in_progress" || lesson.status === "completed"
                      ? "done"
                      : "upcoming"
                    : stage.stage_role === "summary"
                    ? lesson.status === "completed"
                      ? "done"
                      : "upcoming"
                    : getStepState(stage);

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
                          ? "animate-pulse border-violet-600 bg-violet-600 ring-4 ring-violet-200"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {stepState === "done" ? (
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      ) : stepState === "active" ? (
                        <span className="h-2 w-2 rounded-full bg-white" />
                      ) : stage.stage_role === "middle" ? (
                        <span className="text-[9px] font-bold text-slate-400">{stage.position}</span>
                      ) : null}
                    </span>
                    <div className="flex flex-1 flex-col gap-0.5 pt-0.5">
                      <span
                        className={`text-sm ${
                          stepState === "done"
                            ? "font-medium text-slate-500"
                            : stepState === "active"
                            ? "font-bold text-violet-600"
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
                      {/* Passed-stage label (position < active) */}
                      {stage.stage_role === "middle" && isStageReadOnly(stage) && !isCompleted && (
                        <span className="text-[10px] font-semibold text-emerald-500">{da.passed}</span>
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

          {/* Separator */}
          <div className="border-t border-slate-200" />

          {/* Materials */}
          <section className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-500">{w.materials}</h3>
            {lesson.materials.length === 0 ? (
              <p className="text-sm text-gray-400">{w.noMaterials}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {lesson.materials.map((m) => {
                  const url = materialUrls[m.id];
                  const fname = m.file_original_name ?? m.title;
                  const rawExt = (fname.split(".").pop() ?? "").toLowerCase();
                  const ext = rawExt.toUpperCase();
                  const { Icon, cls } = materialIcon(fname);
                  const isPdf = rawExt === "pdf";
                  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(rawExt);
                  const viewerType: ViewerMaterial["type"] = isPdf ? "pdf" : isImage ? "image" : "other";

                  function handleOpen() {
                    if (!url) return;
                    if (viewerType === "other") {
                      window.open(url, "_blank", "noopener,noreferrer");
                    } else {
                      setViewerMat({ url, type: viewerType, title: m.title });
                    }
                  }

                  return (
                    <li key={m.id}>
                      <button
                        onClick={handleOpen}
                        disabled={!url}
                        className="group flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left transition-all hover:border-white/60 hover:bg-white/70 disabled:opacity-50"
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
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          </div>
        </aside>

        {/* Center: active middle stages content */}
        <section className="flex-1 min-w-0 space-y-4">
          {lesson.description && (
            <div className="rounded-2xl border border-white/60 bg-white/60 px-6 py-4 shadow-sm backdrop-blur-xl">
              <p className="text-[15px] leading-relaxed text-slate-600">{lesson.description}</p>
            </div>
          )}

          {/* Center panel: waiting / single active stage / all (completed) */}
          {lesson.status === "in_progress" && activeStageId === null && allMiddleStages.length > 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-8 text-center shadow-sm">
              <span className="flex h-3 w-3 animate-pulse rounded-full bg-violet-400" />
              <p className="text-sm font-semibold text-violet-700">{da.waitingForTeacher}</p>
            </div>
          ) : centerStages.length === 0 && allMiddleStages.length === 0 ? (
            <div className="rounded-2xl border border-white/60 bg-white/60 p-6 shadow-sm backdrop-blur-xl">
              <p className="text-center text-sm text-slate-400">{w.noTask}</p>
            </div>
          ) : (
            centerStages.map((stage, idx) => {
              const unlocked = isMiddleStageUnlocked(idx);
              const prevStage = idx > 0 ? centerStages[idx - 1] : null;
              const readOnly = isStageReadOnly(stage);
              const isStudied = stage.progress?.is_completed;
              const isSubmitted = !!stage.progress?.submission_data;
              const isGraded = stage.progress?.grade != null;

              return (
                <div key={isCompleted ? stage.id : `${stage.id}-${animKey}`} className={`relative${isCompleted ? "" : " animate-stage-in"}`}>
                {/* Lock overlay for sequential unlock */}
                {!unlocked && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl backdrop-blur-sm"
                    style={{ background: "rgba(255,255,255,0.75)" }}>
                    <Lock className="h-5 w-5 text-gray-400" />
                    <p className="text-sm font-medium text-gray-500 text-center px-4">
                      {dl.stageLocked}{prevStage ? `: ${prevStage.title}` : ""}
                    </p>
                  </div>
                )}
                <div
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

                  {/* Theory: full presentation (slides) when generated, else plain text.
                      Students never drive navigation — they follow the teacher's
                      current_slide_index via Realtime inside SlideViewer. */}
                  {stage.stage_type === "theory" && stage.slides && stage.slides.length > 0 ? (
                    <div className="mb-3 h-[70vh] min-h-[460px]">
                      <SlideViewer
                        slides={stage.slides}
                        canExport
                        onExportPptx={() => exportSlidesToPptx(stage.slides ?? [], stage.title)}
                        isTeacher={false}
                        stageId={stage.id}
                        initialSlide={stage.current_slide_index ?? 0}
                      />
                    </div>
                  ) : stage.description ? (
                    <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{stage.description}</p>
                  ) : null}


                  {/* Task */}
                  {stage.stage_type === "task" && (
                    <div className="space-y-2">
                      {isGraded ? (
                        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          <Check className="h-4 w-4" />
                          {dl.stageTaskGradedLabel}: {stage.progress?.grade}/5
                        </div>
                      ) : isSubmitted ? (
                        <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                          {dl.stageTaskSubmittedLabel}
                        </div>
                      ) : readOnly ? (
                        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                          <Check className="h-4 w-4" />
                          {w.submitted}
                        </div>
                      ) : null}

                      {/* Code + external stages always offer an open button (open / view read-only) */}
                      {stage.content_type === "code" ? (
                        mounted && studentId && (
                          <button
                            onClick={() => setActiveCodeStageId(stage.id)}
                            className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/25 hover:bg-violet-700 active:scale-95"
                          >
                            {dl.code.openEditor}
                          </button>
                        )
                      ) : isExternalService(stage.content_type) ? (
                        mounted && studentId && (
                          <button
                            onClick={() => setExternalStageId(stage.id)}
                            className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/25 hover:bg-violet-700 active:scale-95"
                          >
                            {dl.external.open}
                          </button>
                        )
                      ) : stage.content_type === "quiz_qia" ? (
                        mounted && studentId && (
                          <button
                            onClick={() => setQiaStageId(stage.id)}
                            className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/25 hover:bg-violet-700 active:scale-95"
                          >
                            {(readOnly || stage.progress?.is_completed) ? dl.quiz.viewResult : dl.quiz.open}
                          </button>
                        )
                      ) : stage.content_type === "quiz_kahoot" ? (
                        mounted && studentId && (
                          <button
                            onClick={() => setKahootStageId(stage.id)}
                            className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/25 hover:bg-violet-700 active:scale-95"
                          >
                            {(readOnly || stage.progress?.is_completed) ? dl.quiz.viewResult : dl.quiz.open}
                          </button>
                        )
                      ) : (
                        !isGraded && !isSubmitted && !readOnly && mounted && studentId && (
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
                </div>
              );
            })
          )}

          {/* Summary stage — only show when lesson is completed */}
          {summaryStage && isCompleted && (
            <div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5 shadow-sm backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <h3 className="text-[15px] font-bold text-slate-800">{summaryStage.title}</h3>
                </div>
                {summaryStage.description && (
                  <p className="text-sm leading-relaxed text-slate-600">{summaryStage.description}</p>
                )}
              </div>
            </div>
          )}
        </section>

      </div>

      {/* AI chat panel (fixed overlay) */}
      {mounted && studentId && (
        <AiChatPanel
          lessonId={lesson.id}
          stageId={
            openTaskStageId ?? activeCodeStageId ?? externalStageId ??
            qiaStageId ?? kahootStageId ?? null
          }
        />
      )}

      {/* Task stub modal */}
      {mounted && openTaskStage && (
        <TaskStubModal
          stage={openTaskStage}
          onClose={() => setOpenTaskStageId(null)}
        />
      )}

      {/* Material viewer modal */}
      {mounted && viewerMat && (
        <MaterialViewerModal mat={viewerMat} onClose={() => setViewerMat(null)} />
      )}

      {/* Code-task stage → fullscreen IDE overlay */}
      {mounted && activeCodeStage && studentId && (
        <CodeStageView
          stage={activeCodeStage}
          studentId={studentId}
          onBack={() => setActiveCodeStageId(null)}
          onSubmitted={(progress) => { handleStageSubmitted(progress); setActiveCodeStageId(null); }}
        />
      )}

      {/* External service modal (scratch/wokwi/codesandbox/makecode) */}
      {mounted && externalStage && studentId && (
        <ExternalStageModal
          stage={externalStage}
          studentId={studentId}
          onClose={() => setExternalStageId(null)}
          onSubmitted={handleStageSubmitted}
        />
      )}

      {/* QIA quiz modal */}
      {mounted && qiaStage && studentId && (
        <QiaQuizModal
          stage={qiaStage}
          studentId={studentId}
          onClose={() => setQiaStageId(null)}
          onSubmitted={handleStageSubmitted}
        />
      )}

      {/* Kahoot live game (student) */}
      {mounted && kahootStage && studentId && (
        <KahootStudentModal
          stage={kahootStage}
          studentId={studentId}
          onClose={() => setKahootStageId(null)}
          onSubmitted={handleStageSubmitted}
        />
      )}

      {/* Lesson completion modal */}
      {mounted && showCompletedModal && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
        >
          <div
            className="animate-scale-in w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl"
            style={{ background: "var(--surface-1, #fff)" }}
          >
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{dl.completedTitle}</h2>
            <div className="mt-4 space-y-2">
              <div className="rounded-xl bg-gray-50 px-4 py-3 text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{dl.completedTopic}</p>
                <p className="mt-0.5 text-sm font-medium text-gray-800">{lesson.title}</p>
              </div>
              {completedElapsed && (
                <div className="rounded-xl bg-gray-50 px-4 py-3 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{dl.completedDuration}</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-800">{completedElapsed}</p>
                </div>
              )}
            </div>
            <p className="mt-5 text-sm text-gray-500">
              {dl.completedRedirect}{" "}
              <span className="font-bold text-gray-800">{countdown}</span>{" "}
              {d.common.seconds}
            </p>
            <button
              type="button"
              onClick={() => router.push("/schedule")}
              className="mt-4 w-full rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-blue-700 active:scale-95"
            >
              {dl.completedGoNow}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
