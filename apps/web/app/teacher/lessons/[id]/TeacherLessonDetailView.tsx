"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ChevronLeft, MapPin, Check, Plus, X, FileText, Download,
  Trash2, Upload, Play, Square, Clock, AlertCircle, CalendarX,
  ChevronUp, ChevronDown, Monitor, Code2, Puzzle, Wrench, Bot,
  TestTube2, Gamepad2, Presentation, BookOpen, ListChecks,
} from "lucide-react";
import {
  updateLesson, getLessonStages, addLessonStage, updateLessonStage,
  deleteLessonStage, reorderLessonStages,
  uploadLessonMaterial, deleteLessonMaterial, getLessonMaterialUrl,
  getSubjectStyle, startLesson, endLesson, getLessonExcuseRequests,
} from "@snr/core";
import type {
  TeacherLessonView, LessonStatus, LessonStage, LessonContentType,
  LessonStageType, LessonMaterial, Teacher, ExcuseRequestWithStudent,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { AttendanceRollCall } from "./AttendanceRollCall";
import { RaisedHandsBlock } from "./RaisedHandsBlock";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useRealtimeChannel } from "@/lib/realtime";

// ── Content type metadata ─────────────────────────────────────────────────────
const CONTENT_ICONS: Record<LessonContentType, React.ReactNode> = {
  presentation: <Presentation className="h-4 w-4" />,
  code:         <Code2 className="h-4 w-4" />,
  scratch:      <Puzzle className="h-4 w-4" />,
  tinkercad:    <Wrench className="h-4 w-4" />,
  app_inventor: <Bot className="h-4 w-4" />,
  code_monkey:  <Monitor className="h-4 w-4" />,
  quiz_qia:     <TestTube2 className="h-4 w-4" />,
  quiz_kahoot:  <Gamepad2 className="h-4 w-4" />,
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tashkent" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
}
function fmtBytes(b: number | null): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ── Stage add/edit modal ──────────────────────────────────────────────────────
type StageModalState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; stage: LessonStage };

type ModalStep = 1 | 2 | 3;

const THEORY_CONTENT_TYPES: LessonContentType[] = ["presentation"];
const TASK_CONTENT_TYPES: LessonContentType[] = [
  "presentation", "code", "scratch", "tinkercad",
  "app_inventor", "code_monkey", "quiz_qia", "quiz_kahoot",
];

function StageModal({
  modalState,
  onClose,
  onSave,
  contentLabel,
}: {
  modalState: Extract<StageModalState, { mode: "add" | "edit" }>;
  onClose: () => void;
  onSave: (data: {
    stageType: LessonStageType;
    contentType: LessonContentType | null;
    title: string;
    description: string | null;
  }) => Promise<void>;
  contentLabel: (ct: LessonContentType) => string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).lesson;
  const isEdit = modalState.mode === "edit";
  const existing = isEdit ? modalState.stage : null;

  const [step, setStep] = useState<ModalStep>(isEdit ? 3 : 1);
  const [stageType, setStageType] = useState<LessonStageType>(existing?.stage_type ?? "theory");
  const [contentType, setContentType] = useState<LessonContentType | null>(existing?.content_type ?? null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [desc, setDesc] = useState(existing?.description ?? "");
  const [saving, setSaving] = useState(false);

  const availableContentTypes = stageType === "theory" ? THEORY_CONTENT_TYPES : TASK_CONTENT_TYPES;

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ stageType, contentType, title: title.trim(), description: desc.trim() || null });
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl"
        style={{ background: "var(--surface-1)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {isEdit ? d.stageEditModalTitle : d.stageAddModalTitle}
          </h3>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Step 1: Stage type (hidden in edit mode) */}
          {!isEdit && step >= 1 && (
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">{d.stageStep1Title}</p>
              <div className="grid grid-cols-2 gap-3">
                {(["theory", "task"] as LessonStageType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => { setStageType(type); setContentType(null); }}
                    className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-all ${
                      stageType === type
                        ? type === "theory"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                          : "border-violet-500 bg-violet-50 dark:bg-violet-500/10"
                        : "border-slate-200 dark:border-white/10 hover:border-slate-300"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {type === "theory" ? <BookOpen className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {type === "theory" ? d.stageTypeTheoryLabel : d.stageTypeTaskLabel}
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      {type === "theory" ? d.stageTypeTheoryDesc : d.stageTypeTaskDesc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Content type (or next button) */}
          {!isEdit && step >= 1 && (
            <div>
              {step < 2 ? (
                <button
                  onClick={() => setStep(2)}
                  className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                >
                  Далее →
                </button>
              ) : (
                <>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">{d.stageStep2Title}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {availableContentTypes.map((ct) => (
                      <button
                        key={ct}
                        onClick={() => setContentType(ct === contentType ? null : ct)}
                        className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm transition-all ${
                          contentType === ct
                            ? "border-blue-500 bg-blue-50 font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                            : "border-slate-200 dark:border-white/10 hover:border-slate-300 text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        <span className="shrink-0 text-slate-500">{CONTENT_ICONS[ct]}</span>
                        <span>{contentLabel(ct)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Title + description (shown after content type selection, or immediately in edit) */}
          {(isEdit || step >= 2) && (
            <div className={isEdit ? "" : "border-t border-slate-100 dark:border-white/10 pt-5"}>
              {!isEdit && <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">{d.stageStep3Title}</p>}

              {/* Stub note for non-presentation types */}
              {contentType && contentType !== "presentation" && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  {d.stageContentStubNote}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {d.stageTitleLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    autoFocus={!isEdit}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={d.stageTitlePlaceholder}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{d.stageDescLabel2}</label>
                  <textarea
                    rows={3}
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder={d.stageDescPlaceholder2}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50"
                >
                  {saving ? "Сохранение…" : isEdit ? d.stageSaveBtn2 : d.stageAddConfirmBtn}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TeacherLessonDetailView({
  lesson,
  teacher,
}: {
  lesson: TeacherLessonView;
  teacher: Teacher;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dl = d.lesson;

  const [title, setTitle] = useState(lesson.title ?? "");
  const [desc, setDesc] = useState(lesson.description ?? "");
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);

  const [stages, setStages] = useState<LessonStage[]>(lesson.stages);
  const [stageModal, setStageModal] = useState<StageModalState>({ mode: "closed" });
  const [stageToDelete, setStageToDelete] = useState<LessonStage | null>(null);

  const [materials, setMaterials] = useState<LessonMaterial[]>(lesson.materials);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const db = createClient();
  const [status, setStatus] = useState<LessonStatus>(lesson.status);
  const [startedAt, setStartedAt] = useState<string | null>(lesson.started_at);
  const [endedAt, setEndedAt] = useState<string | null>(lesson.ended_at);
  const [statusLoading, setStatusLoading] = useState(false);
  const [elapsedMin, setElapsedMin] = useState(0);

  const [allMarked, setAllMarked] = useState(false);
  const [unmarkedNames, setUnmarkedNames] = useState<string[]>([]);
  const handleAttendanceStatus = useCallback((allDone: boolean, names: string[]) => {
    setAllMarked(allDone);
    setUnmarkedNames(names);
  }, []);

  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [incompleteOpen, setIncompleteOpen] = useState(false);
  const [confirmDeleteMatOpen, setConfirmDeleteMatOpen] = useState(false);
  const [matToDelete, setMatToDelete] = useState<LessonMaterial | null>(null);

  const [excuses, setExcuses] = useState<ExcuseRequestWithStudent[]>([]);
  const reloadExcuses = useCallback(() => {
    getLessonExcuseRequests(db as never, lesson.id).then(setExcuses).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (status !== "completed") reloadExcuses();
  }, [status, reloadExcuses]);

  useRealtimeChannel(
    status === "completed" ? null : `lesson-excuses-${lesson.id}`,
    "lesson_excuse_requests",
    `lesson_id=eq.${lesson.id}`,
    reloadExcuses,
  );

  const excusedMap: Record<string, string> = {};
  for (const e of excuses) excusedMap[e.student_id] = e.reason;

  useEffect(() => {
    if (status !== "in_progress" || !startedAt) return;
    const tick = () => setElapsedMin(Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [status, startedAt]);

  async function handleStart() {
    setStatusLoading(true);
    try {
      await startLesson(db, lesson.id);
      const now = new Date().toISOString();
      setStatus("in_progress");
      setStartedAt(now);
      // Mark start stage completed in local state
      setStages((prev) => prev.map((s) =>
        s.stage_role === "start" ? { ...s, is_completed: true, completed_at: now } : s
      ));
    } catch { /* noop */ } finally { setStatusLoading(false); }
  }

  function requestEnd() {
    if (status === "in_progress" && !allMarked && unmarkedNames.length > 0) {
      setIncompleteOpen(true);
      return;
    }
    setConfirmEndOpen(true);
  }

  async function handleEnd() {
    setStatusLoading(true);
    try {
      await endLesson(db, lesson.id);
      const now = new Date().toISOString();
      setStatus("completed");
      setEndedAt(now);
      // Mark summary stage completed in local state
      setStages((prev) => prev.map((s) =>
        s.stage_role === "summary" ? { ...s, is_completed: true, completed_at: now } : s
      ));
    } catch { /* noop */ } finally {
      setStatusLoading(false);
      setConfirmEndOpen(false);
      setIncompleteOpen(false);
    }
  }

  async function handleSaveInfo() {
    setInfoSaving(true);
    try {
      await updateLesson(db, lesson.id, { title: title || null, description: desc || null });
      setInfoSaved(true);
      setTimeout(() => setInfoSaved(false), 2000);
    } catch { /* noop */ } finally { setInfoSaving(false); }
  }

  // ── Stage CRUD ──────────────────────────────────────────────────────────────

  async function handleAddStage(data: {
    stageType: LessonStageType;
    contentType: LessonContentType | null;
    title: string;
    description: string | null;
  }) {
    const newStage = await addLessonStage(db, lesson.id, data);
    setStages((prev) => {
      const withoutSummary = prev.filter((s) => s.stage_role !== "summary");
      const summary = prev.find((s) => s.stage_role === "summary");
      return summary ? [...withoutSummary, newStage, summary] : [...withoutSummary, newStage];
    });
    setStageModal({ mode: "closed" });
  }

  async function handleEditStage(data: {
    stageType: LessonStageType;
    contentType: LessonContentType | null;
    title: string;
    description: string | null;
  }) {
    if (stageModal.mode !== "edit") return;
    const updated = await updateLessonStage(db, stageModal.stage.id, {
      title: data.title,
      description: data.description,
      stage_type: data.stageType,
      content_type: data.contentType,
    });
    setStages((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    setStageModal({ mode: "closed" });
  }

  async function handleDeleteStage() {
    if (!stageToDelete) return;
    await deleteLessonStage(db, stageToDelete.id).catch(() => null);
    setStages((prev) => prev.filter((s) => s.id !== stageToDelete.id));
    setStageToDelete(null);
  }

  async function handleMoveStage(stageId: string, direction: "up" | "down") {
    const middles = stages.filter((s) => s.stage_role === "middle");
    const idx = middles.findIndex((s) => s.id === stageId);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= middles.length) return;
    const reordered = [...middles];
    const tmp = reordered[idx]!;
    reordered[idx] = reordered[newIdx]!;
    reordered[newIdx] = tmp;
    const orderedIds = reordered.map((s) => s.id);
    // Optimistic update
    const posMap = new Map(reordered.map((s, i) => [s.id, i + 1]));
    setStages((prev) => prev.map((s) => posMap.has(s.id) ? { ...s, position: posMap.get(s.id)! } : s));
    await reorderLessonStages(db, lesson.id, orderedIds).catch(() => {
      // Reload on failure
      getLessonStages(db, lesson.id).then(setStages).catch(() => null);
    });
  }

  // ── Material CRUD ───────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!uploadFile || !uploadTitle.trim()) return;
    setUploading(true);
    try {
      const mat = await uploadLessonMaterial(db, {
        lessonId: lesson.id, teacherId: teacher.id, file: uploadFile, title: uploadTitle.trim(),
      });
      setMaterials((prev) => [...prev, mat]);
      setUploadModal(false);
      setUploadTitle("");
      setUploadFile(null);
    } catch { /* noop */ } finally { setUploading(false); }
  }

  async function handleDeleteMaterial() {
    if (!matToDelete) return;
    await deleteLessonMaterial(db, matToDelete.id, matToDelete.file_storage_path).catch(() => null);
    setMaterials((prev) => prev.filter((m) => m.id !== matToDelete.id));
    setMatToDelete(null);
  }

  async function handleDownloadMaterial(mat: LessonMaterial) {
    const url = await getLessonMaterialUrl(db, mat.file_storage_path, mat.file_original_name ?? mat.title).catch(() => null);
    if (url) window.open(url, "_blank");
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const style = getSubjectStyle(lesson.group.subject);
  const infoChanged = title !== (lesson.title ?? "") || desc !== (lesson.description ?? "");
  const timeRange = lesson.ends_at
    ? `${fmtTime(lesson.starts_at)} – ${fmtTime(lesson.ends_at)}`
    : fmtTime(lesson.starts_at);

  const startStage = stages.find((s) => s.stage_role === "start");
  const summaryStage = stages.find((s) => s.stage_role === "summary");
  const middleStages = stages
    .filter((s) => s.stage_role === "middle")
    .sort((a, b) => a.position - b.position);

  function contentLabel(ct: LessonContentType): string {
    const map: Record<LessonContentType, string> = {
      presentation: dl.stageContentPresentation,
      code:         dl.stageContentCode,
      scratch:      dl.stageContentScratch,
      tinkercad:    dl.stageContentTinkercad,
      app_inventor: dl.stageContentAppInventor,
      code_monkey:  dl.stageContentCodeMonkey,
      quiz_qia:     dl.stageContentQuizQia,
      quiz_kahoot:  dl.stageContentQuizKahoot,
    };
    return map[ct] ?? ct;
  }

  if (!mounted) {
    return (
      <div className="mx-auto max-w-5xl flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back */}
      <Link
        href="/teacher/lessons"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" />
        {dl.backToLessons}
      </Link>

      {/* Header card */}
      {(() => {
        const bg =
          status === "in_progress" ? "linear-gradient(135deg, #16a34a, #15803d)"
          : status === "completed"  ? "linear-gradient(135deg, #6b7280, #4b5563)"
          : `linear-gradient(135deg, ${style.color}, color-mix(in sRGB, ${style.color} 60%, #1e1b4b))`;
        return (
          <div className="flex flex-col gap-2 rounded-2xl p-6 text-white shadow-xl" style={{ background: bg }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
              {style.label} · {lesson.group.name}
            </p>
            {lesson.lesson_no && <p className="text-xs text-white/60">Урок №{lesson.lesson_no}</p>}
            <h1 className="text-2xl font-bold">
              {lesson.title ?? lesson.topic ?? `Урок от ${fmtDate(lesson.starts_at)}`}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-white/10 px-3 py-1">{timeRange}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">{fmtDate(lesson.starts_at)}</span>
              {lesson.room && (
                <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                  <MapPin className="h-3.5 w-3.5" /> Каб. {lesson.room}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Status control */}
      {status === "scheduled" && (
        <div className="flex items-center justify-between rounded-2xl border border-yellow-200 bg-yellow-50 px-5 py-4">
          <p className="text-sm text-yellow-800">Урок запланирован. Нажмите когда начнётся.</p>
          <button
            onClick={handleStart} disabled={statusLoading}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-green-500/25 hover:bg-green-700 active:scale-95 disabled:opacity-50"
          >
            <Play className="h-4 w-4 fill-white" /> Начать урок
          </button>
        </div>
      )}
      {status === "in_progress" && (
        <div className="flex items-center justify-between rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <p className="text-sm text-green-800 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Урок идёт. Длится {elapsedMin} мин.
          </p>
          <button
            onClick={requestEnd} disabled={statusLoading}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-red-500/25 hover:bg-red-700 active:scale-95 disabled:opacity-50"
          >
            <Square className="h-4 w-4 fill-white" /> Закончить урок
          </button>
        </div>
      )}
      {status === "completed" && (
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
          <Check className="h-5 w-5 text-gray-500" />
          <p className="text-sm text-gray-600">
            Урок завершён{startedAt && endedAt && ` · ${fmtTime(startedAt)} – ${fmtTime(endedAt)}`}
          </p>
        </div>
      )}

      {/* Roll call */}
      {(status === "in_progress" || status === "completed") && (
        <AttendanceRollCall
          lessonId={lesson.id}
          teacherId={teacher.id}
          lessonStatus={status}
          excused={excusedMap}
          onStatusChange={handleAttendanceStatus}
        />
      )}

      {/* Raised hands */}
      {status === "in_progress" && (
        <RaisedHandsBlock lessonId={lesson.id} teacherId={teacher.id} />
      )}

      {/* About lesson */}
      <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">{dl.aboutLesson}</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">{dl.titleLabel}</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={dl.titlePlaceholder}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">{dl.descLabel}</label>
            <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder={dl.descPlaceholder}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
          {infoChanged && (
            <button onClick={handleSaveInfo} disabled={infoSaving}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-60">
              {infoSaved ? <><Check className="inline-block h-4 w-4 mr-1" /> {dl.saveBtn}</> : infoSaving ? dl.uploading : dl.saveBtn}
            </button>
          )}
        </div>
      </section>

      {/* Excuse requests */}
      {status !== "completed" && excuses.length > 0 && (
        <section className="rounded-2xl border border-orange-100 bg-orange-50/50 p-6 shadow-sm space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-orange-600">
            <CalendarX className="h-4 w-4" />
            {dl.excuse.teacherTitle} ({excuses.length})
          </h2>
          <div className="space-y-2">
            {excuses.map((e) => (
              <div key={e.id} className="flex items-start gap-3 rounded-xl border border-white bg-white/80 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[12px] font-bold text-orange-600">
                  {e.student.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-800">{e.student.full_name}</p>
                  <p className="mt-0.5 text-[13px] text-slate-500">{e.reason}</p>
                </div>
                <span className="shrink-0 text-[11px] text-slate-400">{fmtTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── STAGES BLOCK ──────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">{dl.stagesTitle}</h2>
          <button
            onClick={() => setStageModal({ mode: "add" })}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 active:scale-95"
          >
            <Plus className="h-4 w-4" /> {dl.stageAddBtn}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {/* Start stage */}
          {startStage && (
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
              startStage.is_completed
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                : "border-slate-100 bg-white dark:border-white/10 dark:bg-white/5"
            }`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                startStage.is_completed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-slate-100 text-slate-500"
              }`}>
                {startStage.is_completed ? <Check className="h-4 w-4" /> : "→"}
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{dl.stageStartLabel}</span>
              {startStage.is_completed && (
                <span className="ml-auto text-xs font-semibold text-emerald-600 dark:text-emerald-400">Пройден</span>
              )}
            </div>
          )}

          {/* Middle stages */}
          {middleStages.length === 0 ? (
            <div
              onClick={() => setStageModal({ mode: "add" })}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-6 text-slate-400 transition-all hover:border-blue-300 hover:text-blue-500"
            >
              <Plus className="h-5 w-5" />
              <span className="text-sm">{dl.stageAddBtn}</span>
            </div>
          ) : (
            middleStages.map((stage, idx) => (
              <div
                key={stage.id}
                className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5"
              >
                {/* Position + type badge */}
                <div className="mt-0.5 flex shrink-0 flex-col items-center gap-1">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold ${
                    stage.stage_type === "task"
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                  }`}>
                    {idx + 1}
                  </div>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{stage.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      stage.stage_type === "task"
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                    }`}>
                      {stage.stage_type === "task" ? dl.stageBadgeTask : dl.stageBadgeTheory}
                    </span>
                    {stage.content_type && (
                      <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        {CONTENT_ICONS[stage.content_type]}
                        {contentLabel(stage.content_type)}
                      </span>
                    )}
                  </div>
                  {stage.description && (
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{stage.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleMoveStage(stage.id, "up")}
                    disabled={idx === 0}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 dark:hover:bg-white/10"
                    title={dl.stageMoveUp}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleMoveStage(stage.id, "down")}
                    disabled={idx === middleStages.length - 1}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 dark:hover:bg-white/10"
                    title={dl.stageMoveDown}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setStageModal({ mode: "edit", stage })}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setStageToDelete(stage)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Summary stage */}
          {summaryStage && (
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
              summaryStage.is_completed
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                : "border-slate-100 bg-white dark:border-white/10 dark:bg-white/5"
            }`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                summaryStage.is_completed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-slate-100 text-slate-500"
              }`}>
                {summaryStage.is_completed ? <Check className="h-4 w-4" /> : "✓"}
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{dl.stageSummaryLabel}</span>
              {summaryStage.is_completed && (
                <span className="ml-auto text-xs font-semibold text-emerald-600 dark:text-emerald-400">Пройден</span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Materials */}
      <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">{dl.materialsTitle}</h2>
          <button onClick={() => setUploadModal(true)}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 active:scale-95">
            {dl.addMaterialLabel}
          </button>
        </div>
        {materials.length === 0 ? (
          <p className="text-sm text-gray-400">{dl.materialsEmpty}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {materials.map((mat) => (
              <div key={mat.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{mat.title}</p>
                  {mat.file_size_bytes && <p className="text-xs text-gray-400">{fmtBytes(mat.file_size_bytes)}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => handleDownloadMaterial(mat)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title={dl.download}>
                    <Download className="h-4 w-4" />
                  </button>
                  <button onClick={() => { setMatToDelete(mat); setConfirmDeleteMatOpen(true); }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" title={dl.deleteConfirm}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upload material modal */}
      {uploadModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{dl.addMaterialTitle}</h3>
              <button onClick={() => setUploadModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">{dl.materialTitleLabel}</label>
                <input type="text" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder={dl.materialTitlePlaceholder}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                <button onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-6 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-500">
                  <Upload className="h-5 w-5" />
                  {uploadFile ? uploadFile.name : "Выбрать файл (макс. 50 МБ)"}
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setUploadModal(false)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">{d.common.cancel}</button>
                <button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadTitle.trim()}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                  {uploading ? dl.uploading : dl.saveBtn}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Stage add/edit modal */}
      {stageModal.mode !== "closed" && (
        <StageModal
          modalState={stageModal}
          onClose={() => setStageModal({ mode: "closed" })}
          onSave={stageModal.mode === "add" ? handleAddStage : handleEditStage}
          contentLabel={contentLabel}
        />
      )}

      {/* Confirm delete stage */}
      <ConfirmModal
        open={!!stageToDelete}
        onClose={() => setStageToDelete(null)}
        onConfirm={handleDeleteStage}
        title="Удалить этап?"
        message={dl.stageDeleteConfirmMsg}
        variant="danger"
        confirmText="Удалить"
        cancelText={d.common.cancel}
      />

      {/* Incomplete attendance modal */}
      <ConfirmModal
        open={incompleteOpen}
        onClose={() => setIncompleteOpen(false)}
        title="Перекличка не завершена"
        message={`Отметь всех учеников перед завершением урока. Не отмечено: ${unmarkedNames.length}`}
        icon={<AlertCircle className="h-6 w-6 text-orange-500" />}
        variant="warning"
        confirmText="Понятно"
      >
        {unmarkedNames.length > 0 && (
          <ul className="mt-2 space-y-1">
            {unmarkedNames.map((name) => (
              <li key={name} className="flex items-center gap-2 text-[13px] text-gray-700">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                {name}
              </li>
            ))}
          </ul>
        )}
      </ConfirmModal>

      {/* Confirm end lesson */}
      <ConfirmModal
        open={confirmEndOpen}
        onClose={() => setConfirmEndOpen(false)}
        onConfirm={handleEnd}
        title={d.teacher.endLessonConfirmTitle}
        message={d.teacher.endLessonConfirmMsg}
        variant="danger"
        confirmText="Закончить"
        cancelText={d.common.cancel}
      />

      {/* Confirm delete material */}
      <ConfirmModal
        open={confirmDeleteMatOpen}
        onClose={() => { setConfirmDeleteMatOpen(false); setMatToDelete(null); }}
        onConfirm={handleDeleteMaterial}
        title={dl.deleteConfirm}
        variant="danger"
        confirmText="Удалить"
        cancelText={d.common.cancel}
      />
    </div>
  );
}
