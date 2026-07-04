"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Clock, Check, FileText, FileCode2, File, ChevronsLeft, ChevronsRight,
  Image as ImageIcon, BookOpen, ListChecks, Lock, X, Download, Users, Hash,
  Maximize2, Minimize2, Bot,
} from "lucide-react";
import {
  getSubjectStyle, formatTime, getDictionary,
  markTheoryStudied, submitStageTask,
} from "@snr/core";
import type { StudentLessonView, LessonStageWithProgress, LessonStageProgress, LessonMaterial, Locale, QuizConfigForStage } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { useRealtimeChannel } from "@/lib/realtime";
import { RaiseHandButton } from "./RaiseHandButton";
import { StageActionButton } from "@/components/lesson-stages/StageActionButton";
import { AiChatPanel } from "./AiChatPanel";
import { SlideViewer } from "@/components/lesson-stages/SlideViewer";
import { exportSlidesToPptx } from "@/lib/export-slides-to-pptx";
import { CodeStageView } from "./CodeStageView";
import { ExternalStageModal } from "./ExternalStageModal";
import { QiaQuizModal } from "./QiaQuizModal";
import { KahootStudentModal } from "./KahootStudentModal";
import { isExternalService } from "@/lib/external-services";
import { demoKind } from "@/lib/material-kind";
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
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return { Icon: ImageIcon, cls: "bg-purple-50 text-purple-500" };
  if (ext === "pdf") return { Icon: FileText, cls: "bg-rose-50 text-rose-500" };
  if (["doc", "docx", "txt", "rtf"].includes(ext)) return { Icon: FileText, cls: "bg-blue-50 text-blue-500" };
  if (["ino", "js", "ts", "py", "c", "cpp", "java", "json", "html", "css"].includes(ext)) return { Icon: FileCode2, cls: "bg-blue-50 text-blue-500" };
  return { Icon: File, cls: "bg-slate-50 text-slate-500" };
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
        turbowarp:    d.stageContentTurbowarp,
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
  const [mounted, setMounted] = useState(false);
  const [viewerMat, setViewerMat] = useState<ViewerMaterial | null>(null);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [completedElapsed, setCompletedElapsed] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Refs for stable callback in realtime handler (avoid stale closure)
  const activeStageIdRef = useRef(activeStageId);
  useEffect(() => { activeStageIdRef.current = activeStageId; }, [activeStageId]);

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

  // Real browser Fullscreen API toggle (Часть 2 — "Во весь экран" button).
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    function onChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => null);
    } else {
      document.documentElement.requestFullscreen().catch(() => null);
    }
  }

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

  // Applies a lesson row's live-state fields (active_stage_id/demo_material_id/
  // status) to local state — shared by the realtime handler below and the
  // polling fallback, so both paths behave identically. A plain
  // router.refresh() poll (the PreLessonView pattern) wouldn't actually fix
  // anything here: activeStageId/demoMaterialId are local state seeded once
  // from props, not re-synced on every re-render, so a fresh RSC prop alone
  // never reaches them — this needs to explicitly call the setters.
  const applyLessonLiveUpdate = useCallback((row: {
    active_stage_id?: string | null;
    demo_material_id?: string | null;
    status?: string;
  }) => {
    const newActiveStageId = row.active_stage_id;
    const newStatus = row.status;

    // Handle active_stage_id change
    if (newActiveStageId !== undefined && newActiveStageId !== activeStageIdRef.current) {
      setActiveStageId(newActiveStageId ?? null);

      // Show "teacher moved to new stage" banner briefly
      setStageChangedBanner(true);
      setTimeout(() => setStageChangedBanner(false), 4000);

      // Code/external/quiz stages are all embedded inline now — they
      // unmount on their own when centerStages changes as the teacher
      // moves the active stage forward, no explicit close needed here.
      setOpenTaskStageId(null);
    }

    // Teacher "show to class": demo material toggled on/off.
    const newDemoId = row.demo_material_id;
    if (newDemoId !== undefined) {
      setDemoMaterialId(newDemoId ?? null);
      // Starting a demo drops the student out of any open fullscreen stage.
      if (newDemoId) {
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
  }, [lesson.status, lesson.started_at, router]);

  // Realtime: listen for lesson changes (status + active_stage_id)
  useRealtimeChannel(
    `lesson-student-${lesson.id}`,
    "lessons",
    `id=eq.${lesson.id}`,
    useCallback((payload) => {
      applyLessonLiveUpdate({
        active_stage_id: payload?.new?.active_stage_id as string | null | undefined,
        demo_material_id: payload?.new?.demo_material_id as string | null | undefined,
        status: payload?.new?.status as string | undefined,
      });
    }, [applyLessonLiveUpdate]),
  );

  // Belt-and-suspenders poll (Iter5 hotfix P14.2) — realtime can silently miss
  // events (dropped connection, auth hiccup). Queries the live columns
  // directly rather than router.refresh(), since local state here doesn't
  // re-sync from a refreshed RSC prop on its own (see applyLessonLiveUpdate).
  useEffect(() => {
    const poll = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db as any)
        .from("lessons")
        .select("active_stage_id, demo_material_id, status")
        .eq("id", lesson.id)
        .maybeSingle()
        .then(({ data }: { data: { active_stage_id: string | null; demo_material_id: string | null; status: string } | null }) => {
          if (data) applyLessonLiveUpdate(data);
        })
        .catch(() => null);
    }, 3000);
    return () => clearInterval(poll);
  }, [lesson.id, db, applyLessonLiveUpdate]);


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

  const handleStageSubmitted = useCallback((progress: LessonStageProgress) => {
    setStages((prev) => prev.map((s) => s.id === progress.stage_id ? { ...s, progress } : s));
  }, []);

  // Shared by the expanded materials list and the collapsed (64px) icon rail.
  function openMaterial(m: LessonMaterial) {
    const url = materialUrls[m.id];
    if (!url) return;
    const fname = m.file_original_name ?? m.title;
    const kind = demoKind(fname, url);
    const viewerType: ViewerMaterial["type"] = kind === "pdf" ? "pdf" : kind === "image" ? "image" : "other";
    if (viewerType === "other") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      setViewerMat({ url, type: viewerType, title: m.title });
    }
  }

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
  const stepperStates: StepState[] = allStepsForStepper.map((stage) =>
    stage.stage_role === "start"
      ? (lesson.status === "in_progress" || lesson.status === "completed" ? "done" : "upcoming")
      : stage.stage_role === "summary"
      ? (lesson.status === "completed" ? "done" : "upcoming")
      : getStepState(stage),
  );
  const stepperPercent = stepperStates.length > 0
    ? Math.round((stepperStates.filter((s) => s === "done").length / stepperStates.length) * 100)
    : 0;

  const da = dl.activeStage;
  const currentCenterStage = centerStages[0] ?? null;
  const currentCfg = currentCenterStage ? ((currentCenterStage.config ?? {}) as QuizConfigForStage) : null;
  const currentIsQuiz = currentCenterStage?.content_type === "quiz_qia";
  const currentIsKahoot = currentCenterStage?.content_type === "quiz_kahoot";

  return (
    <div className="flex h-screen">
      {/* Left: full-height lesson sidebar (Iter5 P13.A — spans the whole
          left column top-to-bottom; the top panel lives only in the right
          column, per Часть 7). */}
      <aside className={`relative flex h-full shrink-0 flex-col gap-3.5 overflow-y-auto p-3 transition-all duration-300 ease-out ${sidebarCollapsed ? "w-16" : "w-[266px]"}`}>

          {/* Logo + collapse toggle — always visible */}
          <div className="flex items-center justify-between rounded-2xl border border-[#ECEDF4] bg-white px-4 py-3 shadow-sm">
            {!sidebarCollapsed && (
              <span className="truncate text-sm font-black">
                <span className="text-[#FF9A3D]">SNR</span>{" "}
                <span className="text-[#6A4FE6]">EduOS</span>
              </span>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-[#ECEDF4] text-[#9A9FB4] transition-colors hover:bg-slate-50"
              title={sidebarCollapsed ? w.expand : w.collapse}
            >
              {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* Collapsed: icon-only rail (stages then materials), hover tooltip via title */}
          {sidebarCollapsed ? (
            <div className="hidden flex-col items-center gap-2 rounded-[18px] border border-[#ECEDF4] bg-white p-3 shadow-sm lg:flex">
              {allStepsForStepper.map((stage, i) => {
                const stepState = stepperStates[i];
                return (
                  <span
                    key={stage.id}
                    title={stage.title}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                      stepState === "done"
                        ? "bg-[#33C27F] text-white"
                        : stepState === "active"
                        ? "bg-[#6A4FE6] text-white ring-4 ring-[#F2EFFE]"
                        : "bg-[#EFEFF4] text-[#A6AABD]"
                    }`}
                  >
                    {stepState === "done" ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    ) : stage.stage_role === "middle" ? (
                      stage.position
                    ) : null}
                  </span>
                );
              })}
              {allStepsForStepper.length > 0 && lesson.materials.length > 0 && (
                <div className="my-1 h-px w-8 shrink-0 bg-[#ECEDF4]" />
              )}
              {lesson.materials.map((m) => {
                const fname = m.file_original_name ?? m.title;
                const { Icon, cls } = materialIcon(fname);
                const url = materialUrls[m.id];
                return (
                  <button
                    key={m.id}
                    title={m.title}
                    onClick={() => openMaterial(m)}
                    disabled={!url}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-opacity disabled:opacity-50 ${cls}`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          ) : (
          <div className="flex flex-col gap-3.5">
          <section className="rounded-[18px] border border-[#ECEDF4] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold text-[#242A45]">
                {w.stagePlan}
              </h2>
              <span className="rounded-[8px] bg-[#EEEAFD] px-2.5 py-0.5 text-[12.5px] font-extrabold text-[#6A4FE6]">
                {stepperPercent}%
              </span>
            </div>
            <ul className="relative mt-2.5 flex flex-col gap-0.5">
              {allStepsForStepper.map((stage, i) => {
                const isLast = i === allStepsForStepper.length - 1;
                const stepState = stepperStates[i];

                return (
                  <li key={stage.id} className={`relative flex gap-2.5 rounded-xl p-1.5 ${stepState === "active" ? "bg-[#F2EFFE]" : ""}`}>
                    {!isLast && (
                      <span className={`absolute left-[19px] top-8 h-[calc(100%-8px)] w-0.5 ${
                        stepState === "done" ? "bg-[#BCE9CF]" : "bg-[#E4E7F0]"
                      }`} />
                    )}
                    <span
                      className={`z-10 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${
                        stepState === "done"
                          ? "bg-[#33C27F] text-white"
                          : stepState === "active"
                          ? "bg-[#6A4FE6] text-white"
                          : "bg-[#EFEFF4] text-[#A6AABD]"
                      }`}
                    >
                      {stepState === "done" ? (
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      ) : stage.stage_role === "middle" ? (
                        stage.position
                      ) : null}
                    </span>
                    <div className="flex flex-1 flex-col gap-0.5 pt-0.5">
                      <span
                        className={`text-[13.5px] leading-tight ${
                          stepState === "done"
                            ? "font-bold text-[#2C3350]"
                            : stepState === "active"
                            ? "font-extrabold text-[#5A3FE0]"
                            : "font-bold text-[#8A8FA4]"
                        }`}
                      >
                        {stage.title}
                      </span>
                      {stage.stage_role === "middle" && stage.stage_type && (
                        <span className={`text-[11px] font-semibold ${
                          stepState === "active" ? "text-[#8E86C0]" : "text-[#B0B4C6]"
                        }`}>
                          {stage.stage_type === "task"
                            ? dl.stageBadgeTask
                            : dl.stageBadgeTheory}
                        </span>
                      )}
                      {stage.stage_role === "middle" && isStageReadOnly(stage) && !isCompleted && (
                        <span className="text-[11px] font-semibold text-[#33C27F]">{da.passed}</span>
                      )}
                    </div>
                    {stepState === "done" ? (
                      <Check className="h-[15px] w-[15px] shrink-0 self-center text-[#33C27F]" strokeWidth={3} />
                    ) : stepState === "upcoming" ? (
                      <span className="shrink-0 self-center" title={w.stageLockedShort}>
                        <Lock className="h-[15px] w-[15px] text-[#C2C6D6]" />
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {allStepsForStepper.length === 0 && (
              <p className="text-center text-xs text-[#9CA0B4]">—</p>
            )}
          </section>

          {/* Materials */}
          <section className="rounded-[18px] border border-[#ECEDF4] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-extrabold text-[#242A45]">{w.materials}</h3>
              {lesson.materials.length > 0 && (
                <span className="rounded-[7px] bg-[#F1F2F7] px-2 py-0.5 text-xs font-extrabold text-[#8A8FA6]">
                  {lesson.materials.length}
                </span>
              )}
            </div>
            {lesson.materials.length === 0 ? (
              <p className="mt-2 text-sm text-[#B0B4C6]">{w.noMaterials}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2.5">
                {lesson.materials.map((m) => {
                  const url = materialUrls[m.id];
                  const fname = m.file_original_name ?? m.title;
                  const rawExt = (fname.split(".").pop() ?? "").toLowerCase();
                  const ext = rawExt.toUpperCase();
                  const { Icon, cls } = materialIcon(fname);

                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => openMaterial(m)}
                        disabled={!url}
                        className="group flex w-full items-center gap-2.5 text-left transition-opacity disabled:opacity-50"
                      >
                        <div className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] ${cls}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-bold text-[#2C3350] group-hover:text-[#6A4FE6]">{m.title}</p>
                          <p className="text-[11.5px] text-[#9CA0B4]">
                            {[ext, fmtBytes(m.file_size_bytes)].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Help tip — static info card, not a second raise-hand entry point
              (the real action lives once, in the header, per Часть 2). */}
          <div
            className="mt-auto flex items-center gap-3 rounded-2xl border border-[#E7E1FB] p-3.5"
            style={{ background: "linear-gradient(135deg,#F2EFFE,#EFEAFE)" }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-extrabold text-[#3B2E7E]">{w.helpTitle}</p>
              <p className="mt-0.5 text-xs text-[#8B85B8]">{w.helpSubtitle}</p>
            </div>
            <div
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] text-white"
              style={{ background: "#6A4FE6", boxShadow: "0 6px 14px -4px rgba(106,79,230,.6)" }}
            >
              <Bot className="h-5 w-5" />
            </div>
          </div>
          </div>
          )}
        </aside>

      {/* Right column: top panel + stage content, scrolls independently
          of the full-height sidebar above. */}
      <div className="flex min-w-0 flex-1 flex-col space-y-5 overflow-y-auto px-4 py-5 md:px-6">
      {/* Header bar */}
      <header className="rounded-2xl border border-[#ECEDF4] bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-2xl"
              style={{ background: "linear-gradient(135deg,#EEEAFD,#E6DEFC)" }}
            >
              {style.emoji}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-extrabold uppercase tracking-wide text-[#6A4FE6]">{lesson.subjectName ?? style.label}</p>
              <h1 className="truncate text-lg font-black leading-tight text-[#242A45]">{heroTitle}</h1>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {studentId && <RaiseHandButton lessonId={lesson.id} studentId={studentId} />}
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 rounded-[11px] border border-[#E6E7EF] bg-white px-3 py-2 text-sm font-bold text-[#5B6178] transition-colors hover:bg-slate-50"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="hidden sm:inline">{isFullscreen ? w.fullscreenExit : w.fullscreen}</span>
            </button>
            {lesson.teacher && (
              <div className="hidden items-center gap-2 rounded-[13px] border border-[#E6E7EF] bg-white py-1 pl-1 pr-3 sm:flex">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#7C63F0,#6A4FE6)" }}
                >
                  {initials(lesson.teacher.full_name)}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] text-[#9CA0B4]">{dl.teacherLabel}</span>
                  <span className="text-xs font-bold text-[#242A45]">{lesson.teacher.full_name}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pills row: elapsed timer, live status, group, lesson number, quiz/kahoot context */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-[12px] border border-[#ECEDF4] bg-white px-3 py-2 text-sm font-bold text-[#5B6178]">
            <Clock className="h-4 w-4 text-[#9CA0B4]" />
            <span className="font-mono tabular-nums">{elapsed}</span>
          </div>
          {!isCompleted && (
            <div className="flex items-center gap-2 rounded-[12px] border border-green-100 bg-green-50 px-3 py-2 text-sm font-bold text-green-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              {w.live}
            </div>
          )}
          <div className="flex items-center gap-2 rounded-[12px] border border-[#ECEDF4] bg-white px-3 py-2 text-sm font-bold text-[#5B6178]">
            <Users className="h-4 w-4 text-[#9CA0B4]" />
            {lesson.group.name}
          </div>
          {lesson.lesson_no != null && (
            <div className="flex items-center gap-2 rounded-[12px] border border-[#ECEDF4] bg-white px-3 py-2 text-sm font-bold text-[#5B6178]">
              <Hash className="h-4 w-4 text-[#9CA0B4]" />
              {w.lessonNumberLabel.replace("{n}", String(lesson.lesson_no))}
            </div>
          )}
          {currentIsQuiz && currentCfg?.time_limit_minutes != null && (
            <div className="flex items-center gap-2 rounded-[12px] border border-[#ECEDF4] bg-white px-3 py-2 text-sm font-bold text-[#5B6178]">
              <Clock className="h-4 w-4 text-[#9CA0B4]" />
              {currentCfg.time_limit_minutes} {d.ai.generate.minutesShort}
            </div>
          )}
          {currentIsKahoot && (
            <div className="flex items-center gap-2 rounded-[12px] border border-[#C9EEDA] bg-[#E7F7EE] px-3 py-2 text-sm font-extrabold text-[#1E9E63]">
              <span className="h-2 w-2 rounded-full bg-[#22B573] animate-pulse" />
              {dl.quiz.kahootLiveNow}
            </div>
          )}
        </div>
      </header>

      {/* Teacher is showing a material to the whole class (Realtime broadcast).
          Fullscreen — no sidebar/topbar/scroll, and no close control on the
          student side. Only the teacher stopping the demo (demo_material_id
          → null, synced via Realtime) can dismiss it. */}
      {mounted && demoMaterialId && (() => {
        const mat = lesson.materials.find((m) => m.id === demoMaterialId);
        const url = mat ? materialUrls[mat.id] : undefined;
        const name = mat?.file_original_name ?? mat?.title ?? "";
        const kind = demoKind(name, url);
        return createPortal(
          <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
            <div className="flex shrink-0 items-center gap-3 bg-black px-6 py-3 text-white">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" />
              <span className="truncate text-sm font-medium">
                {d.demo.teacherShowing}{mat?.title ? `: ${mat.title}` : ""}
              </span>
              <span className="ml-auto shrink-0 text-xs text-white/60">{d.demo.onlyTeacherCanClose}</span>
            </div>
            <div className="flex-1 overflow-auto bg-white">
              {mat && url && kind === "pdf" ? (
                <iframe src={url} className="h-full w-full border-0" title={mat.title} />
              ) : mat && url && kind === "video" ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={url} controls className="h-full w-full object-contain" />
              ) : mat && url && kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={name} className="mx-auto h-full max-h-full w-full object-contain" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 px-6 py-12 text-center">
                  <p className="text-sm font-semibold text-slate-700">{d.demo.unsupportedFormat}</p>
                  <p className="text-xs text-slate-400">{d.demo.supportedFormats}</p>
                </div>
              )}
            </div>
          </div>,
          document.body,
        );
      })()}

      {/* Teacher changed stage banner */}
      {stageChangedBanner && (
        <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-800 shadow-sm">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-violet-500" />
          {da.teacherChangedStage}
        </div>
      )}

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
              const isCodeOrExternal = stage.content_type === "code" || isExternalService(stage.content_type)
                || stage.content_type === "quiz_qia" || stage.content_type === "quiz_kahoot";

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
                  className={`rounded-2xl border shadow-sm backdrop-blur-xl transition-all ${
                    stage.stage_type === "task"
                      ? "border-violet-100 bg-violet-50/40 dark:border-violet-500/20 dark:bg-violet-500/5"
                      : "border-blue-100 bg-blue-50/40 dark:border-blue-500/20 dark:bg-blue-500/5"
                  } ${isCodeOrExternal ? "flex h-[78vh] min-h-[560px] flex-col p-4" : "p-5"}`}
                >
                  {/* Icon+title header — CodeStageView/ExternalStageModal render their own
                      compact title/description row instead, to save vertical space for
                      the editor/iframe. */}
                  {!isCodeOrExternal && (
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
                  )}

                  {/* Theory: full presentation (slides) when generated, else plain text.
                      Students never drive navigation — they follow the teacher's
                      current_slide_index via Realtime inside SlideViewer. */}
                  {!isCodeOrExternal && (
                    stage.stage_type === "theory" && stage.slides && stage.slides.length > 0 ? (
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
                    ) : null
                  )}


                  {/* Task — also shown for stage_type='theory' code stages (AI "Демо:"
                      stages): a code editor is a valid thing to open regardless of
                      whether the stage counts as a gradable task. */}
                  {(stage.stage_type === "task" || stage.content_type === "code") && (
                    <div className={isCodeOrExternal ? "flex min-h-0 flex-1 flex-col" : "space-y-2"}>
                      {/* CodeStageView/ExternalStageModal render their own (richer, with
                          teacher_comment) grade/submitted banner — skip this compact one
                          for them to avoid showing status twice. */}
                      {!isCodeOrExternal && (
                        isGraded ? (
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
                        ) : null
                      )}

                      {/* Code, external, and quiz stages are all embedded directly — no "open" gate/modal */}
                      {stage.content_type === "code" ? (
                        mounted && studentId && (
                          <CodeStageView
                            stage={stage}
                            studentId={studentId}
                            onSubmitted={handleStageSubmitted}
                          />
                        )
                      ) : isExternalService(stage.content_type) ? (
                        mounted && studentId && (
                          <ExternalStageModal
                            stage={stage}
                            studentId={studentId}
                            onSubmitted={handleStageSubmitted}
                          />
                        )
                      ) : stage.content_type === "quiz_qia" ? (
                        mounted && studentId && (
                          <QiaQuizModal
                            key={stage.id}
                            stage={stage}
                            studentId={studentId}
                            onSubmitted={handleStageSubmitted}
                          />
                        )
                      ) : stage.content_type === "quiz_kahoot" ? (
                        mounted && studentId && (
                          <KahootStudentModal
                            key={stage.id}
                            stage={stage}
                            studentId={studentId}
                            onSubmitted={handleStageSubmitted}
                          />
                        )
                      ) : (
                        !isGraded && !isSubmitted && !readOnly && mounted && studentId && (
                          <StageActionButton onClick={() => setOpenTaskStageId(stage.id)}>
                            {dl.stageTaskStubPrefix}
                          </StageActionButton>
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
          stageId={openTaskStageId ?? activeStageId ?? null}
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
