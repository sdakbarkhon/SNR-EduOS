"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ChevronLeft, MapPin, Check, Plus, X, FileText, Download,
  Trash2, Upload, Clock, CalendarX,
  ChevronUp, ChevronDown, Code2, Puzzle, CircuitBoard,
  TestTube2, Gamepad2, Presentation, BookOpen, ListChecks, Loader2, Lock, Globe, Sparkles, Monitor, Type,
  Minimize2, Maximize2,
  Ruler, FlaskConical, LineChart, Shuffle, Palette, PenTool, Brain, Database, Grid3x3,
} from "lucide-react";
import {
  updateLesson, getLessonStages, addLessonStage, updateLessonStage,
  deleteLessonStage, reorderLessonStages,
  uploadLessonMaterial, deleteLessonMaterial, getLessonMaterialUrl,
  getSubjectStyle, getLessonExcuseRequests,
  getQuizQuestions, replaceQuizQuestions,
  setActiveStage, setDemoMaterial, lowerHand,
} from "@snr/core";
import type {
  TeacherLessonView, LessonStatus, LessonStage, LessonContentType,
  LessonStageType, LessonMaterial, Teacher, ExcuseRequestWithStudent,
  CodeLanguage, CodeStageConfig, ExternalServiceConfig, ExternalServiceType,
  QuizQuestionInput, QuizConfigForStage,
} from "@snr/core";
import { SERVICE_CONFIG, validateServiceUrl, isExternalService } from "@/lib/external-services";
import { QuizBuilder, emptyQuizQuestion, quizQuestionsValid } from "./QuizBuilder";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { AttendanceRollCall } from "./AttendanceRollCall";
import { RaisedHandsBlock } from "./RaisedHandsBlock";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useRealtimeChannel } from "@/lib/realtime";
import { AttendanceReminderBanner } from "./AttendanceReminderBanner";
import { CodeEditor } from "@/components/CodeEditor";
import { CodeStageSubmissionsModal } from "./CodeStageSubmissionsModal";
import { SlideViewer } from "@/components/lesson-stages/SlideViewer";
import { TeacherLiveCodeControl } from "@/components/lesson-stages/TeacherLiveCodeControl";
import { exportSlidesToPptx } from "@/lib/export-slides-to-pptx";
import { demoKind } from "@/lib/material-kind";
import { PdfViewer } from "@/components/PdfViewer";
import { ExternalSubmissionsModal } from "./ExternalSubmissionsModal";
import { KahootTeacherModal } from "./KahootTeacherModal";
import { AiGenerateStagesModal } from "./AiGenerateStagesModal";

// ── Content type metadata ─────────────────────────────────────────────────────
const CONTENT_ICONS: Record<LessonContentType, React.ReactNode> = {
  presentation:   <Presentation className="h-4 w-4" />,
  code:           <Code2 className="h-4 w-4" />,
  wokwi:          <CircuitBoard className="h-4 w-4" />,
  codesandbox:    <Code2 className="h-4 w-4" />,
  quiz_qia:       <TestTube2 className="h-4 w-4" />,
  quiz_kahoot:    <Gamepad2 className="h-4 w-4" />,
  geogebra:       <Ruler className="h-4 w-4" />,
  phet:           <FlaskConical className="h-4 w-4" />,
  desmos:         <LineChart className="h-4 w-4" />,
  blockly_games:  <Puzzle className="h-4 w-4" />,
  visualgo:       <Shuffle className="h-4 w-4" />,
  p5js:           <Palette className="h-4 w-4" />,
  excalidraw:     <PenTool className="h-4 w-4" />,
  learningapps:   <Brain className="h-4 w-4" />,
  sqlonline:      <Database className="h-4 w-4" />,
  h5p:            <Grid3x3 className="h-4 w-4" />,
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
  "code", "wokwi", "codesandbox", "quiz_qia", "quiz_kahoot",
  "geogebra", "phet", "desmos", "blockly_games", "visualgo", "p5js", "excalidraw", "learningapps", "sqlonline",
  "h5p",
];

function StageModal({
  modalState,
  onClose,
  onSave,
  contentLabel,
  db,
}: {
  modalState: Extract<StageModalState, { mode: "add" | "edit" }>;
  onClose: () => void;
  onSave: (data: {
    stageType: LessonStageType;
    contentType: LessonContentType | null;
    title: string;
    description: string | null;
    teacherNotes?: string | null;
    starterCode?: string | null;
    programmingLanguage?: string | null;
    expectedOutput?: string | null;
    config?: Record<string, unknown>;
    quizQuestions?: QuizQuestionInput[];
  }) => Promise<void>;
  contentLabel: (ct: LessonContentType) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).lesson;
  const dc = d.code;
  const isEdit = modalState.mode === "edit";
  const existing = isEdit ? modalState.stage : null;
  const existingCfg = (existing?.config ?? {}) as Partial<CodeStageConfig>;

  const [step, setStep] = useState<ModalStep>(isEdit ? 3 : 1);
  const [stageType, setStageType] = useState<LessonStageType | null>(isEdit ? (existing?.stage_type ?? "theory") : null);
  const [contentType, setContentType] = useState<LessonContentType | null>(existing?.content_type ?? null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [desc, setDesc] = useState(existing?.description ?? "");
  const [teacherNotes, setTeacherNotes] = useState(existing?.teacher_notes ?? "");
  const hasSlides = !!(existing?.slides && existing.slides.length > 0);
  // Content source for theory stages: 'ai' (slides via ✨) or 'text' (manual description).
  const [contentSource, setContentSource] = useState<"ai" | "text">(hasSlides ? "ai" : "text");
  const [saving, setSaving] = useState(false);
  const [stepError, setStepError] = useState("");

  // code-stage — migration 62 promoted these to top-level columns; config is
  // read as a fallback for stages saved before the migration.
  const [codeLang, setCodeLang] = useState<CodeLanguage>(
    (existing?.programming_language as CodeLanguage | undefined) ?? existingCfg.language ?? "python",
  );
  const [starterCode, setStarterCode] = useState(existing?.starter_code ?? existingCfg.starter_code ?? "");
  const [expectedOutput, setExpectedOutput] = useState(existing?.expected_output ?? existingCfg.expected_output ?? "");
  const isCode = contentType === "code";

  // external-service config (wokwi/codesandbox/geogebra/phet/desmos/blockly_games/visualgo/p5js/excalidraw/learningapps/sqlonline)
  const existingExtCfg = (existing?.config ?? {}) as Partial<ExternalServiceConfig>;
  const isExternal = isExternalService(contentType);
  const externalMeta = isExternal ? SERVICE_CONFIG[contentType as ExternalServiceType] : null;
  const [extUrl, setExtUrl] = useState(existingExtCfg.url ?? "");
  const [extEmbedUrl, setExtEmbedUrl] = useState<string | null>(existingExtCfg.embed_url ?? null);
  const [extUrlError, setExtUrlError] = useState("");
  const [extUrlValid, setExtUrlValid] = useState(!!existingExtCfg.url);
  const [reqLink, setReqLink] = useState(existingExtCfg.requires_link ?? true);
  const [reqScreenshot, setReqScreenshot] = useState(existingExtCfg.requires_screenshot ?? false);

  function validateExtUrl() {
    if (!isExternal || !extUrl.trim()) { setExtUrlValid(false); setExtUrlError(""); setExtEmbedUrl(null); return; }
    const res = validateServiceUrl(contentType as ExternalServiceType, extUrl);
    setExtUrlValid(res.valid);
    setExtUrlError(res.valid ? "" : (res.error ?? ""));
    setExtEmbedUrl(res.embedUrl);
  }

  // URL is optional — an empty field falls back to a blank editor for the
  // service at render time. Only a *provided* URL must pass validation.
  const externalReady = !isExternal || !extUrl.trim() || extUrlValid;

  // quiz config (quiz_qia / quiz_kahoot)
  const isQqia = contentType === "quiz_qia";
  const isKahoot = contentType === "quiz_kahoot";
  const isQuiz = isQqia || isKahoot;
  const existingQuizCfg = (existing?.config ?? {}) as QuizConfigForStage;
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionInput[]>([]);
  const [quizTimeLimited, setQuizTimeLimited] = useState<boolean>(existingQuizCfg.time_limit_minutes != null);
  const [quizMinutes, setQuizMinutes] = useState<number>(existingQuizCfg.time_limit_minutes ?? 5);
  const [quizPoints, setQuizPoints] = useState<number>(existingQuizCfg.points_per_question ?? 1);

  useEffect(() => {
    if (isEdit && isQuiz && existing) {
      getQuizQuestions(db, existing.id).then((qs) => {
        setQuizQuestions(qs.map((q) => ({
          question_text: q.question_text,
          options: [0, 1, 2, 3].map((i) => q.options[i] ?? ""),
          correct_option_index: q.correct_option_index,
          points: q.points,
          time_per_question_seconds: q.time_per_question_seconds,
        })));
      }).catch(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quizReady = !isQuiz || quizQuestionsValid(quizQuestions);

  const availableContentTypes = stageType === "theory" ? THEORY_CONTENT_TYPES : stageType === "task" ? TASK_CONTENT_TYPES : [];

  function handleNext() {
    if (!stageType) { setStepError("Выбери тип этапа"); return; }
    setStepError("");
    setStep(2);
  }

  async function handleSave() {
    if (!stageType || !title.trim()) return;
    let config: Record<string, unknown> | undefined;
    let quizQuestionsOut: QuizQuestionInput[] | undefined;
    if (isCode) {
      config = {};
    } else if (isExternal) {
      config = {
        url: extUrl.trim(),
        ...(externalMeta?.embedSupported ? { embed_url: extEmbedUrl } : {}),
        ...(!externalMeta?.embedSupported ? { requires_link: reqLink, requires_screenshot: reqScreenshot } : {}),
      };
    } else if (isQuiz) {
      config = isQqia
        ? { time_limit_minutes: quizTimeLimited ? quizMinutes : undefined, points_per_question: quizPoints }
        : {};
      quizQuestionsOut = quizQuestions.map((q) => ({
        ...q,
        options: q.options.map((o) => o.trim()).filter((_, i) => i < 4),
      }));
    }
    setSaving(true);
    try {
      await onSave({
        stageType: stageType as LessonStageType, contentType,
        title: title.trim(), description: desc.trim() || null,
        teacherNotes: teacherNotes.trim() || null,
        ...(isCode ? {
          starterCode: starterCode || null,
          programmingLanguage: codeLang,
          expectedOutput: expectedOutput.trim() || null,
        } : {}),
        config,
        quizQuestions: quizQuestionsOut,
      });
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl shadow-2xl ${isCode || isQuiz ? "max-w-2xl" : "max-w-lg"}`}
        style={{ background: "var(--surface-1)" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {isEdit ? d.stageEditModalTitle : d.stageAddModalTitle}
          </h3>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
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
                <div>
                  <button
                    onClick={handleNext}
                    className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Далее →
                  </button>
                  {stepError && <p className="mt-1.5 text-xs text-red-500">{stepError}</p>}
                </div>
              ) : (
                <>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">{d.stageStep2Title}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {availableContentTypes.map((ct) => (
                      <button
                        key={ct}
                        onClick={() => setContentType(ct === contentType ? null : ct)}
                        className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm transition-all ${
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

              {/* Stub note: still a placeholder for content types we haven't built yet */}
              {contentType && contentType !== "presentation" && !isCode && !isExternal && !isQuiz && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  {d.stageContentStubNote}
                </div>
              )}

              {/* External service: project URL + (for non-embeddable) attachment requirements */}
              {isExternal && externalMeta && (
                <div className="mb-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {d.external.projectLink}
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        value={extUrl}
                        onChange={(e) => { setExtUrl(e.target.value); setExtUrlError(""); }}
                        onBlur={validateExtUrl}
                        placeholder={externalMeta.placeholder}
                        className={`w-full rounded-xl border bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 outline-none transition-all focus:ring-2 dark:bg-white/5 dark:text-slate-100 ${
                          extUrlError
                            ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                            : extUrlValid
                            ? "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-100"
                            : "border-slate-200 focus:border-blue-500 focus:ring-blue-100 dark:border-white/10"
                        }`}
                      />
                      {extUrlValid && !extUrlError && (
                        <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" strokeWidth={3} />
                      )}
                    </div>
                    {extUrlError && <p className="mt-1 text-xs text-red-500">{extUrlError}</p>}
                    {!extUrlError && !extUrl.trim() && (
                      <p className="mt-1 text-xs text-slate-400">{d.external.leaveEmptyHint}</p>
                    )}
                  </div>

                  {/* Non-embeddable: attachment requirements */}
                  {!externalMeta.embedSupported && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/5">
                      <p className="mb-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Globe className="h-3.5 w-3.5" /> {d.external.cantEmbedHint}
                      </p>
                      <label className="mb-1.5 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <input type="checkbox" checked={reqLink} onChange={(e) => setReqLink(e.target.checked)} className="h-4 w-4 rounded" />
                        {d.external.requiredLink}
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <input type="checkbox" checked={reqScreenshot} onChange={(e) => setReqScreenshot(e.target.checked)} className="h-4 w-4 rounded" />
                        {d.external.requiredScreenshot}
                      </label>
                      {!reqLink && !reqScreenshot && (
                        <p className="mt-1.5 text-xs text-red-500">{d.external.atLeastOne}</p>
                      )}
                      <p className="mt-2 text-[11px] text-slate-400">{d.external.mustAttachHint}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Quiz stage: question builder + (QIA) options */}
              {isQuiz && (
                <div className="mb-4 space-y-4">
                  {isQqia && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/5">
                      <label className="mb-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <input type="checkbox" checked={quizTimeLimited} onChange={(e) => setQuizTimeLimited(e.target.checked)} className="h-4 w-4 rounded" />
                        {d.quiz.limitTime}
                      </label>
                      {quizTimeLimited && (
                        <div className="mb-2 flex items-center gap-2">
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{d.quiz.minutesForTest}</label>
                          <input type="number" min={1} max={120} value={quizMinutes} onChange={(e) => setQuizMinutes(Math.max(1, Number(e.target.value) || 5))}
                            className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/5" />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{d.quiz.pointsPerCorrect}</label>
                        <input type="number" min={1} max={100} value={quizPoints} onChange={(e) => setQuizPoints(Math.max(1, Number(e.target.value) || 1))}
                          className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/5" />
                      </div>
                    </div>
                  )}
                  <QuizBuilder questions={quizQuestions} onChange={setQuizQuestions} isKahoot={isKahoot} />
                  {!quizReady && (
                    <p className="text-xs text-red-500">
                      {quizQuestions.length === 0 ? d.quiz.minOneQuestion : d.quiz.invalidQuestions}
                    </p>
                  )}
                </div>
              )}

              {/* Code stage: language selector (big, on top) */}
              {isCode && (
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-400">{dc.language}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["python", "cpp"] as CodeLanguage[]).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setCodeLang(lang)}
                        className={`flex items-center gap-2 rounded-xl border-2 p-3 text-left transition-all ${
                          codeLang === lang
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
                            : "border-slate-200 dark:border-white/10 hover:border-slate-300"
                        }`}
                      >
                        <Code2 className="h-5 w-5 text-emerald-600" />
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {lang === "python" ? dc.python : dc.cpp}
                        </span>
                      </button>
                    ))}
                  </div>
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
                {/* Theory content source: AI slides vs manual text */}
                {stageType === "theory" && !isCode && !isExternal && !isQuiz && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {d.contentSource.label}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setContentSource("ai")}
                        className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition ${
                          contentSource === "ai"
                            ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10"
                            : "border-slate-200 hover:border-slate-300 dark:border-white/10"
                        }`}
                      >
                        <Presentation className="h-5 w-5 text-violet-600" />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{d.contentSource.ai}</span>
                        <span className="text-[10px] text-slate-400">{d.contentSource.aiDesc}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setContentSource("text")}
                        className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition ${
                          contentSource === "text"
                            ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10"
                            : "border-slate-200 hover:border-slate-300 dark:border-white/10"
                        }`}
                      >
                        <Type className="h-5 w-5 text-slate-600" />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{d.contentSource.text}</span>
                        <span className="text-[10px] text-slate-400">{d.contentSource.textDesc}</span>
                      </button>
                    </div>
                    {contentSource === "ai" && (
                      <div className="mt-2 flex items-start gap-2 rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/5 dark:text-violet-300">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          {hasSlides
                            ? `${existing?.slides?.length} ${d.slides.of} — слайды готовы. Перегенерировать можно кнопкой «✨».`
                            : "Слайды генерируются кнопкой «✨ Сгенерировать этапы» из плана урока."}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {(stageType !== "theory" || contentSource === "text" || isCode) && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {isCode ? dc.problemStatement : d.studentDescriptionLabel}
                    </label>
                    <textarea
                      rows={3}
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      placeholder={d.stageDescPlaceholder2}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {d.teacherNotesLabel}
                  </label>
                  <textarea
                    rows={3}
                    value={teacherNotes}
                    onChange={(e) => setTeacherNotes(e.target.value)}
                    placeholder={d.teacherNotesPlaceholder}
                    className="w-full resize-none rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-amber-500/30 dark:bg-amber-500/5 dark:text-slate-100"
                  />
                </div>

                {/* Code stage: starter code + expected output */}
                {isCode && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{dc.starterCode}</label>
                      <CodeEditor value={starterCode} onChange={setStarterCode} language={codeLang} minHeight={160} />
                      <p className="mt-1 text-[11px] text-slate-400">{dc.starterCodePlaceholder}</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{dc.expectedOutput}</label>
                      <textarea
                        rows={2}
                        value={expectedOutput}
                        onChange={(e) => setExpectedOutput(e.target.value)}
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">{dc.expectedOutputHint}</p>
                    </div>
                  </>
                )}
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
                  disabled={saving || !title.trim() || (!isEdit && (!stageType || !contentType)) || !externalReady || !quizReady}
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
  const [activeStageId, setActiveStageId] = useState<string | null>(lesson.active_stage_id);
  const [activatingStageId, setActivatingStageId] = useState<string | null>(null);
  const [stageModal, setStageModal] = useState<StageModalState>({ mode: "closed" });
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  const [stageToDelete, setStageToDelete] = useState<LessonStage | null>(null);
  const [reviewStage, setReviewStage] = useState<LessonStage | null>(null);
  const [kahootStage, setKahootStage] = useState<LessonStage | null>(null);
  // Reorder lock: ref = синхронный гард (срабатывает в том же тике, до re-render),
  // state = визуальный feedback (disabled + spinner). Вместе исключают наложение
  // двух reorder-операций → bump одной не конфликтует с финалом другой (409).
  const reorderingRef = useRef(false);
  const [reorderingStageId, setReorderingStageId] = useState<string | null>(null);

  const [materials, setMaterials] = useState<LessonMaterial[]>(lesson.materials);
  const [demoMaterialId, setDemoMaterialId] = useState<string | null>(lesson.demo_material_id);
  // Teacher sees the same material they're broadcasting — fetched lazily
  // (view-only URL, no forced download — see Prompt 11 Part 1) whenever
  // demoMaterialId changes. Minimize is teacher-only UI state; it never
  // touches demo_material_id, so students are unaffected either way.
  const [demoMaterialUrl, setDemoMaterialUrl] = useState<string | null>(null);
  const [demoMinimized, setDemoMinimized] = useState(false);
  useEffect(() => {
    setDemoMinimized(false);
    if (!demoMaterialId) { setDemoMaterialUrl(null); return; }
    const mat = materials.find((m) => m.id === demoMaterialId);
    if (!mat) { setDemoMaterialUrl(null); return; }
    let cancelled = false;
    getLessonMaterialUrl(db, mat.file_storage_path)
      .then((url) => { if (!cancelled) setDemoMaterialUrl(url); })
      .catch(() => { if (!cancelled) setDemoMaterialUrl(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMaterialId]);

  const [uploadModal, setUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadVisibility, setUploadVisibility] = useState<'all' | 'teacher_only'>('all');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const db = createClient();
  const rollCallRef = useRef<HTMLDivElement>(null);
  const [status] = useState<LessonStatus>(lesson.status);
  const [startedAt] = useState<string | null>(lesson.started_at);
  const [endedAt] = useState<string | null>(lesson.ended_at);
  const [elapsedMin, setElapsedMin] = useState(0);


  const [confirmDeleteMatOpen, setConfirmDeleteMatOpen] = useState(false);
  const [matToDelete, setMatToDelete] = useState<LessonMaterial | null>(null);

  const [excuses, setExcuses] = useState<ExcuseRequestWithStudent[]>([]);
  const reloadExcuses = useCallback(() => {
    getLessonExcuseRequests(db as never, lesson.id).then(setExcuses).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  // Blocking "student raised hand" notification — separate from the always-
  // visible RaisedHandsBlock list, fires only on a fresh INSERT so it doesn't
  // reappear on every re-render or when a hand is lowered.
  const [raisedHandModal, setRaisedHandModal] = useState<{ studentName: string; handId: string } | null>(null);
  const handleRaisedHandInsert = useCallback((payload: { eventType: string; new: Record<string, unknown> }) => {
    if (payload.eventType !== "INSERT") return;
    const studentId = payload.new.student_id as string | undefined;
    const handId = payload.new.id as string | undefined;
    if (!studentId || !handId) return;
    (db as never as { from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { single: () => Promise<{ data: { full_name: string } | null }> } } } })
      .from("students").select("full_name").eq("id", studentId).single()
      .then(({ data }) => setRaisedHandModal({ studentName: data?.full_name ?? "Ученик", handId }))
      .catch(() => setRaisedHandModal({ studentName: "Ученик", handId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChannel(
    status === "in_progress" ? `lesson-hand-modal-${lesson.id}` : null,
    "lesson_raised_hands",
    `lesson_id=eq.${lesson.id}`,
    handleRaisedHandInsert,
  );

  async function handleAcknowledgeRaisedHand() {
    if (!raisedHandModal) return;
    const handId = raisedHandModal.handId;
    setRaisedHandModal(null);
    await lowerHand(db as never, handId, teacher.id).catch(() => null);
  }

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

  // Auto-refresh when pg_cron changes lesson status (scheduled→in_progress→completed).
  // A status transition is only ever triggered server-side by pg_cron, so a full
  // page reload is safe here and guarantees fresh server-rendered props (router.refresh
  // alone is unreliable for Server Components in Next 15, and `status` lives in useState
  // which would otherwise stay stale).
  useRealtimeChannel(
    `lesson-status-${lesson.id}`,
    "lessons",
    `id=eq.${lesson.id}`,
    (payload) => {
      const newStatus = payload?.new?.status as LessonStatus | undefined;
      // eslint-disable-next-line no-console
      console.log("[lesson-realtime] event:", payload?.eventType, newStatus);
      // Sync active_stage_id from other open tabs / auto-trigger
      const newActiveStageId = payload?.new?.active_stage_id as string | null | undefined;
      if (newActiveStageId !== undefined) setActiveStageId(newActiveStageId ?? null);
      // Sync demo material (another tab / auto-clear on complete)
      const newDemoId = payload?.new?.demo_material_id as string | null | undefined;
      if (newDemoId !== undefined) setDemoMaterialId(newDemoId ?? null);
      if (newStatus && newStatus !== status) window.location.reload();
    },
  );

  // Polling safety net: even if realtime delivery is misconfigured, this guarantees
  // the teacher sees scheduled→in_progress→completed without F5. Stops once completed.
  useEffect(() => {
    if (status === "completed") return;
    const id = setInterval(() => {
      db.from("lessons").select("status").eq("id", lesson.id).single()
        .then(({ data }) => {
          if (data?.status && data.status !== status) window.location.reload();
        });
    }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, lesson.id]);

  const excusedMap: Record<string, string> = {};
  for (const e of excuses) excusedMap[e.student_id] = e.reason;

  useEffect(() => {
    if (status !== "in_progress" || !startedAt) return;
    const tick = () => setElapsedMin(Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [status, startedAt]);

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
    teacherNotes?: string | null;
    starterCode?: string | null;
    programmingLanguage?: string | null;
    expectedOutput?: string | null;
    config?: Record<string, unknown>;
    quizQuestions?: QuizQuestionInput[];
  }) {
    // Manual stages: difficulty defaults to 'medium' and duration_min stays NULL (DB defaults).
    const newStage = await addLessonStage(db, lesson.id, data);
    if (data.quizQuestions) {
      await replaceQuizQuestions(db, newStage.id, data.quizQuestions).catch(() => null);
    }
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
    teacherNotes?: string | null;
    starterCode?: string | null;
    programmingLanguage?: string | null;
    expectedOutput?: string | null;
    config?: Record<string, unknown>;
    quizQuestions?: QuizQuestionInput[];
  }) {
    if (stageModal.mode !== "edit") return;
    // difficulty/duration_min are not edited here — left untouched (AI stages keep theirs).
    const updated = await updateLessonStage(db, stageModal.stage.id, {
      title: data.title,
      description: data.description,
      teacher_notes: data.teacherNotes,
      stage_type: data.stageType,
      content_type: data.contentType,
      ...(data.starterCode !== undefined ? { starter_code: data.starterCode } : {}),
      ...(data.programmingLanguage !== undefined ? { programming_language: data.programmingLanguage } : {}),
      ...(data.expectedOutput !== undefined ? { expected_output: data.expectedOutput } : {}),
      ...(data.config !== undefined ? { config: data.config } : {}),
    });
    if (data.quizQuestions) {
      await replaceQuizQuestions(db, updated.id, data.quizQuestions).catch(() => null);
    }
    setStages((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    setStageModal({ mode: "closed" });
  }

  async function handleDeleteStage() {
    if (!stageToDelete) return;
    await deleteLessonStage(db, stageToDelete.id).catch(() => null);
    setStages((prev) => prev.filter((s) => s.id !== stageToDelete.id));
    setStageToDelete(null);
  }

  // Перезагрузка этапов из БД (приходят .order("position")) — синхронизирует
  // порядок массива state с реальными position после любого reorder.
  async function reloadStages() {
    const fresh = await getLessonStages(db, lesson.id).catch(() => null);
    if (fresh) setStages(fresh);
  }

  async function handleMoveStage(stageId: string, direction: "up" | "down") {
    // Синхронный гард: блокирует наложение reorder-операций в одном тике, ещё до
    // того как сработает re-render с disabled-кнопками. Без этого два быстрых
    // клика стартуют параллельно → bump одного конфликтует с финалом другого (409).
    if (reorderingRef.current) return;
    reorderingRef.current = true;
    setReorderingStageId(stageId);
    try {
      // ВСЕ middle-этапы (theory + task), строго по position — НЕ по порядку
      // в массиве state, который дрейфует после оптимистичных обновлений.
      const middles = stages
        .filter((s) => s.stage_role === "middle")
        .sort((a, b) => a.position - b.position);
      const idx = middles.findIndex((s) => s.id === stageId);
      if (idx === -1) return;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= middles.length) return;

      const reordered = [...middles];
      const tmp = reordered[idx]!;
      reordered[idx] = reordered[newIdx]!;
      reordered[newIdx] = tmp;
      const orderedIds = reordered.map((s) => s.id);

      // Оптимистично: переназначаем position 1..N по новому порядку (мгновенный отклик).
      const posMap = new Map(reordered.map((s, i) => [s.id, i + 1]));
      setStages((prev) => prev.map((s) => posMap.has(s.id) ? { ...s, position: posMap.get(s.id)! } : s));

      // Весь массив middle-ID в новом порядке → bump-стратегия проставит 1..N в БД.
      await reorderLessonStages(db, lesson.id, orderedIds);

      // ОБЯЗАТЕЛЬНО перезагрузить из БД — иначе следующий клик считает индексы по
      // устаревшему порядку массива и Задача «залипает».
      await reloadStages();
    } catch (e) {
      console.error("[reorder] failed:", e);
      await reloadStages().catch(() => null);
    } finally {
      reorderingRef.current = false;
      setReorderingStageId(null);
    }
  }

  // ── Active stage control ────────────────────────────────────────────────────

  async function handleActivateStage(stageId: string) {
    if (status !== "in_progress") return;
    setActivatingStageId(stageId);
    try {
      await setActiveStage(db, lesson.id, stageId);
      setActiveStageId(stageId);
    } catch { /* noop */ } finally {
      setActivatingStageId(null);
    }
  }

  // ── Material CRUD ───────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!uploadFile || !uploadTitle.trim()) return;
    setUploading(true);
    try {
      const mat = await uploadLessonMaterial(db, {
        lessonId: lesson.id, teacherId: teacher.id, file: uploadFile,
        title: uploadTitle.trim(), visibility: uploadVisibility,
      });
      setMaterials((prev) => [...prev, mat]);
      setUploadModal(false);
      setUploadTitle("");
      setUploadFile(null);
      setUploadVisibility('all');
    } catch { /* noop */ } finally { setUploading(false); }
  }

  // Toggle "show to class" for a material (teacher → all students via realtime).
  async function handleToggleDemo(materialId: string) {
    if (status !== "in_progress") return;
    const prev = demoMaterialId;
    const next = prev === materialId ? null : materialId;
    setDemoMaterialId(next); // optimistic
    try {
      await setDemoMaterial(db, lesson.id, next);
    } catch {
      setDemoMaterialId(prev); // revert on failure
    }
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

  const isLessonCompleted = status === "completed";
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
      presentation:   dl.stageContentPresentation,
      code:           dl.stageContentCode,
      wokwi:          dl.stageContentWokwi,
      codesandbox:    dl.stageContentCodesandbox,
      quiz_qia:       dl.stageContentQuizQia,
      quiz_kahoot:    dl.stageContentQuizKahoot,
      geogebra:       dl.stageContentGeogebra,
      phet:           dl.stageContentPhet,
      desmos:         dl.stageContentDesmos,
      blockly_games:  dl.stageContentBlocklyGames,
      visualgo:       dl.stageContentVisualgo,
      p5js:           dl.stageContentP5js,
      excalidraw:     dl.stageContentExcalidraw,
      learningapps:   dl.stageContentLearningapps,
      sqlonline:      dl.stageContentSqlonline,
      h5p:            dl.stageContentH5p,
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
              {(lesson.subjectName ?? style.label)} · {lesson.group.name}
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

      {/* Status indicator (no manual start/end — pg_cron handles transitions) */}
      {status === "scheduled" && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
          <Clock className="h-4 w-4 shrink-0 text-blue-500" />
          <p className="text-sm text-blue-800">{dl.scheduledAutoNote}</p>
        </div>
      )}
      {status === "in_progress" && (
        <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-green-500" />
          <p className="text-sm text-green-800">
            {dl.inProgressAutoNote}{" "}
            {elapsedMin > 0 && dl.inProgressMins.replace("{n}", String(elapsedMin))}
          </p>
        </div>
      )}

      {/* Inline attendance reminder (5–15 min before end) */}
      {status === "in_progress" && (
        <AttendanceReminderBanner
          lessonId={lesson.id}
          endsAt={lesson.ends_at}
          status={status}
          onScrollToRollCall={() =>
            rollCallRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />
      )}
      {status === "completed" && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
            <Check className="h-5 w-5 text-gray-500" />
            <p className="text-sm text-gray-600">
              Урок завершён{startedAt && endedAt && ` · ${fmtTime(startedAt)} – ${fmtTime(endedAt)}`}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 px-5 py-3">
            <Lock className="h-4 w-4 shrink-0 text-yellow-600" />
            <p className="text-sm font-medium text-yellow-800">{dl.completedLock}</p>
          </div>
        </div>
      )}

      {/* Roll call */}
      {(status === "in_progress" || status === "completed") && (
        <div ref={rollCallRef}>
        <AttendanceRollCall
          lessonId={lesson.id}
          teacherId={teacher.id}
          lessonStatus={status}
          excused={excusedMap}
        />
        </div>
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
              disabled={isLessonCompleted}
              placeholder={dl.titlePlaceholder}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">{dl.descLabel}</label>
            <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)}
              disabled={isLessonCompleted}
              placeholder={dl.descPlaceholder}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
          {!isLessonCompleted && infoChanged && (
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

      {/* ── ACTIVE STAGE CONTROL (only during in_progress) ─────────────────── */}
      {(status === "in_progress" || status === "scheduled") && middleStages.length > 0 && (
        <section className="rounded-2xl border border-violet-100 bg-violet-50/50 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-violet-500" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-violet-700">
              {dl.activeStage.manageStages}
            </h2>
          </div>

          <div className="flex flex-col divide-y divide-violet-100 rounded-xl border border-violet-100 bg-white overflow-hidden">
            {middleStages.map((stage) => {
              const isActive = stage.id === activeStageId;
              const activePos = middleStages.find((s) => s.id === activeStageId)?.position ?? Infinity;
              const isPassed = stage.position < activePos && activeStageId !== null;
              const isActivating = activatingStageId === stage.id;

              const hasSlides = isActive && stage.slides && stage.slides.length > 0;
              const hasLiveCode = isActive && stage.content_type === "code";

              return (
                <div key={stage.id}>
                  <div
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      isActive ? "bg-violet-50" : ""
                    }`}
                  >
                    {/* State indicator */}
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isActive
                        ? "bg-violet-600 text-white"
                        : isPassed
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {isPassed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : stage.position}
                    </div>

                    {/* Title + badge */}
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-semibold ${isActive ? "text-violet-800" : "text-slate-700"}`}>
                        {stage.title}
                      </span>
                      {isActive && (
                        <p className="mt-0.5 text-[11px] text-violet-500">{dl.activeStage.studentsSeeThis}</p>
                      )}
                    </div>

                    {/* Status label or button */}
                    {isActive ? (
                      <span className="shrink-0 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-bold text-white">
                        {dl.activeStage.activeNow}
                      </span>
                    ) : isPassed ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[11px] font-semibold text-emerald-600">{dl.activeStage.passed}</span>
                        <button
                          onClick={() => handleActivateStage(stage.id)}
                          disabled={status !== "in_progress" || isActivating}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isActivating ? "…" : dl.activeStage.activate}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleActivateStage(stage.id)}
                        disabled={status !== "in_progress" || isActivating}
                        title={status === "scheduled" ? dl.activeStage.lessonNotStarted : undefined}
                        className="shrink-0 flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-violet-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isActivating ? "…" : `▶ ${dl.activeStage.activate}`}
                      </button>
                    )}
                  </div>

                  {/* Teacher presentation control — drives students' current_slide_index via Realtime */}
                  {hasSlides && (
                    <div className="h-[60vh] min-h-[420px] border-t border-violet-100 bg-white p-3">
                      <SlideViewer
                        slides={stage.slides ?? []}
                        canExport
                        onExportPptx={() => exportSlidesToPptx(stage.slides ?? [], stage.title)}
                        isTeacher
                        stageId={stage.id}
                        initialSlide={stage.current_slide_index ?? 0}
                      />
                    </div>
                  )}

                  {/* Live coding — drives students' fullscreen read-only view via Realtime */}
                  {hasLiveCode && (
                    <div className="h-[60vh] min-h-[420px] border-t border-violet-100 bg-white p-3">
                      <TeacherLiveCodeControl stage={stage} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {status === "scheduled" && (
            <p className="text-[11px] text-violet-400">{dl.activeStage.lessonNotStarted}</p>
          )}
        </section>
      )}

      {/* ── STAGES BLOCK ──────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">{dl.stagesTitle}</h2>
          {!isLessonCompleted && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAiGenerateOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-violet-300 bg-gradient-to-r from-blue-50 to-violet-50 px-4 py-2 text-sm font-bold text-violet-700 shadow-sm hover:from-blue-100 hover:to-violet-100 active:scale-95 dark:border-violet-500/30 dark:from-blue-500/10 dark:to-violet-500/10 dark:text-violet-300"
              >
                <Sparkles className="h-4 w-4" /> {d.ai.generate.button}
              </button>
              <button
                onClick={() => setStageModal({ mode: "add" })}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 active:scale-95"
              >
                <Plus className="h-4 w-4" /> {dl.stageAddBtn}
              </button>
            </div>
          )}
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
            !isLessonCompleted && (
              <div
                onClick={() => setStageModal({ mode: "add" })}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-6 text-slate-400 transition-all hover:border-blue-300 hover:text-blue-500"
              >
                <Plus className="h-5 w-5" />
                <span className="text-sm">{dl.stageAddBtn}</span>
              </div>
            )
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
                    {/* Пропущен badge: stage was never activated during the completed lesson */}
                    {isLessonCompleted && !(stage as any).was_activated && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        Пропущен
                      </span>
                    )}
                    {/* Difficulty + duration badges: only for AI-generated stages (duration_min set) */}
                    {stage.duration_min != null && (
                      <>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          stage.difficulty === "easy"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                            : stage.difficulty === "hard"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                        }`}>
                          {stage.difficulty === "easy"
                            ? dl.stageDifficultyEasy
                            : stage.difficulty === "hard"
                            ? dl.stageDifficultyHard
                            : dl.stageDifficultyMedium}
                        </span>
                        <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-400">
                          <Clock className="h-3 w-3" />
                          {stage.duration_min} {d.ai.generate.minutesShort}
                        </span>
                      </>
                    )}
                  </div>
                  {stage.description && (
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{stage.description}</p>
                  )}
                </div>

                {/* Review submissions — code + external stages, always available (incl. after lesson ends) */}
                {(stage.content_type === "code" || isExternalService(stage.content_type)) && (
                  <button
                    onClick={() => setReviewStage(stage)}
                    className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                  >
                    {dl.code.reviewSubmissions}
                  </button>
                )}

                {/* Kahoot: launch live game */}
                {stage.content_type === "quiz_kahoot" && (
                  <button
                    onClick={() => setKahootStage(stage)}
                    className="shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"
                  >
                    {dl.quiz.launchGame}
                  </button>
                )}

                {/* Actions */}
                {!isLessonCompleted && (
                <div className="flex shrink-0 items-center gap-1">
                  {reorderingStageId === stage.id ? (
                    // Спиннер на этапе, по которому идёт reorder
                    <span className="flex h-7 w-[60px] items-center justify-center text-blue-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleMoveStage(stage.id, "up")}
                        disabled={idx === 0 || reorderingStageId !== null}
                        className={`rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 dark:hover:bg-white/10 ${reorderingStageId !== null ? "cursor-not-allowed" : ""}`}
                        title={dl.stageMoveUp}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleMoveStage(stage.id, "down")}
                        disabled={idx === middleStages.length - 1 || reorderingStageId !== null}
                        className={`rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 dark:hover:bg-white/10 ${reorderingStageId !== null ? "cursor-not-allowed" : ""}`}
                        title={dl.stageMoveDown}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </>
                  )}
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
                )}
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
          {!isLessonCompleted && (
            <button onClick={() => setUploadModal(true)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 active:scale-95">
              {dl.addMaterialLabel}
            </button>
          )}
        </div>
        {materials.length === 0 ? (
          <p className="text-sm text-gray-400">{dl.materialsEmpty}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {materials.map((mat) => (
              <div key={mat.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{mat.title}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {mat.file_size_bytes && <p className="text-xs text-gray-400">{fmtBytes(mat.file_size_bytes)}</p>}
                      {mat.visibility === 'teacher_only' && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                          {dl.materialTeacherOnlyBadge}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => handleDownloadMaterial(mat)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title={dl.download}>
                      <Download className="h-4 w-4" />
                    </button>
                    {!isLessonCompleted && (
                      <button onClick={() => { setMatToDelete(mat); setConfirmDeleteMatOpen(true); }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" title={dl.deleteConfirm}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Show-to-class control (only while the lesson is live) */}
                {status === "in_progress" && (
                  demoMaterialId === mat.id ? (
                    <div className="flex items-center gap-2">
                      <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        {d.demo.showingNow}
                      </span>
                      <button onClick={() => handleToggleDemo(mat.id)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        {d.demo.stopShowing}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => handleToggleDemo(mat.id)}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-100">
                      <Monitor className="h-3.5 w-3.5" /> {d.demo.showToClass}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upload material modal */}
      {uploadModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 9999, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{dl.addMaterialTitle}</h3>
              <button onClick={() => { setUploadModal(false); setUploadTitle(""); setUploadFile(null); setUploadVisibility('all'); }}
                className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
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
              {/* Visibility toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setUploadVisibility('all')}
                  className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition-colors ${uploadVisibility === 'all' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {dl.materialVisibilityAll}
                </button>
                <button
                  onClick={() => setUploadVisibility('teacher_only')}
                  className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition-colors ${uploadVisibility === 'teacher_only' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {dl.materialVisibilityTeacher}
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setUploadModal(false); setUploadTitle(""); setUploadFile(null); setUploadVisibility('all'); }}
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
          db={db}
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

      {/* Teacher's own preview of the material being demonstrated to the class.
          Minimize is local UI state only — it never touches demo_material_id,
          so students keep seeing the fullscreen broadcast regardless. Stopping
          the demo (for everyone) stays the existing materials-list toggle. */}
      {mounted && demoMaterialId && demoMaterialUrl && typeof document !== "undefined" && (() => {
        const mat = materials.find((m) => m.id === demoMaterialId);
        const name = mat?.file_original_name ?? mat?.title ?? "";
        const kind = demoKind(name, demoMaterialUrl);

        if (demoMinimized) {
          return createPortal(
            <div className="fixed bottom-6 right-6 z-[9999] flex w-72 flex-col overflow-hidden rounded-2xl border border-violet-300 bg-white shadow-2xl">
              <div className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-2 text-white">
                <Monitor className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-xs font-bold">{mat?.title ?? d.demo.showingNow}</span>
                <button
                  onClick={() => setDemoMinimized(false)}
                  title={d.demo.maximizeDemo}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/80 hover:bg-white/20 hover:text-white"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex h-32 items-center justify-center bg-slate-900">
                {kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={demoMaterialUrl} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <Monitor className="h-8 w-8 text-white/40" />
                )}
              </div>
              <button
                onClick={() => demoMaterialId && handleToggleDemo(demoMaterialId)}
                className="border-t border-slate-100 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                {d.demo.stopShowing}
              </button>
            </div>,
            document.body,
          );
        }

        return createPortal(
          <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
            <div className="flex shrink-0 items-center gap-3 bg-black px-6 py-3 text-white">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" />
              <span className="truncate text-sm font-medium">
                {d.demo.teacherShowing}{mat?.title ? `: ${mat.title}` : ""}
              </span>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setDemoMinimized(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                >
                  <Minimize2 className="h-3.5 w-3.5" /> {d.demo.minimizeDemo}
                </button>
                <button
                  onClick={() => demoMaterialId && handleToggleDemo(demoMaterialId)}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  {d.demo.stopShowing}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-white">
              {kind === "pdf" ? (
                <PdfViewer url={demoMaterialUrl} title={name} />
              ) : kind === "video" ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={demoMaterialUrl} controls className="h-full w-full object-contain" />
              ) : kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={demoMaterialUrl} alt={name} className="mx-auto h-full max-h-full w-full object-contain" />
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

      {/* Student raised hand — blocking notification */}
      {mounted && raisedHandModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <div className="mb-4 text-center text-6xl">✋</div>
            <h3 className="mb-6 text-center text-xl font-bold text-slate-900">
              {dl.raisedHand.studentRaisedHand.replace("{name}", raisedHandModal.studentName)}
            </h3>
            <button
              onClick={handleAcknowledgeRaisedHand}
              className="w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-md shadow-violet-500/25 hover:bg-violet-700 active:scale-95"
            >
              {dl.raisedHand.acknowledge}
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* Submissions review — code vs external service */}
      {mounted && reviewStage && (
        reviewStage.content_type === "code" ? (
          <CodeStageSubmissionsModal
            stage={reviewStage}
            teacherId={teacher.id}
            onClose={() => setReviewStage(null)}
          />
        ) : (
          <ExternalSubmissionsModal
            stage={reviewStage}
            teacherId={teacher.id}
            onClose={() => setReviewStage(null)}
          />
        )
      )}

      {/* Kahoot live game control panel */}
      {mounted && kahootStage && (
        <KahootTeacherModal
          stage={kahootStage}
          teacherId={teacher.id}
          onClose={() => setKahootStage(null)}
        />
      )}

      {/* AI generate stages modal */}
      {mounted && aiGenerateOpen && (
        <AiGenerateStagesModal
          lessonId={lesson.id}
          lessonTopic={lesson.topic ?? lesson.title}
          lessonDurationMin={
            lesson.ends_at
              ? Math.max(5, Math.round(
                  (new Date(lesson.ends_at).getTime() - new Date(lesson.starts_at).getTime()) / 60000,
                ))
              : 45
          }
          onClose={() => setAiGenerateOpen(false)}
          onAdded={async () => {
            const fresh = await getLessonStages(db, lesson.id);
            setStages(fresh);
          }}
        />
      )}

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
