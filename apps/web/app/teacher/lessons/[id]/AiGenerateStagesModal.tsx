"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, Sparkles, Loader2, Trash2, Edit2, Check, Clock,
  BookOpen, Code2, TestTube2, Gamepad2, Puzzle, CircuitBoard, Globe,
  Paperclip, Search, Copy, ExternalLink,
} from "lucide-react";
import { addLessonStage, replaceQuizQuestions, getDictionary } from "@snr/core";
import type { Locale, QuizQuestionInput, StageDifficulty, LessonContentType } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

// ── Types ────────────────────────────────────────────────────────────────────

interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_option_index: number;
  time_per_question_seconds?: number;
}

interface GeneratedStage {
  stage_type: "theory" | "task";
  content_type: string; // presentation | code | quiz_* | scratch | wokwi | codesandbox | makecode
  title: string;
  description?: string;
  difficulty: StageDifficulty;
  duration_min: number;
  config?: Record<string, unknown> & {
    language?: string;
    starter_code?: string;
    expected_output?: string;
    time_limit_minutes?: number | null;
    points_per_question?: number;
  };
  questions?: GeneratedQuestion[];
}

interface GenerateResult {
  lesson_title_suggestion: string;
  lesson_description_suggestion: string;
  stages: GeneratedStage[];
  recommendedSearches: string[];
  classGrade: number;
  notes: string;
  external: string[];
}

const EXTERNAL = ["scratch", "wokwi", "codesandbox", "makecode"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function stageIcon(ct: string) {
  switch (ct) {
    case "presentation": return <BookOpen className="h-4 w-4" />;
    case "code": return <Code2 className="h-4 w-4" />;
    case "quiz_qia": return <TestTube2 className="h-4 w-4" />;
    case "quiz_kahoot": return <Gamepad2 className="h-4 w-4" />;
    case "scratch": return <Puzzle className="h-4 w-4" />;
    case "wokwi": return <CircuitBoard className="h-4 w-4" />;
    case "codesandbox": return <Code2 className="h-4 w-4" />;
    case "makecode": return <Gamepad2 className="h-4 w-4" />;
    default: return null;
  }
}

function ctLabel(
  ct: string,
  t: ReturnType<typeof getDictionary>["ai"]["generate"],
): string {
  switch (ct) {
    case "presentation": return t.theory;
    case "code": return t.code;
    case "quiz_qia": return t.quizQia;
    case "quiz_kahoot": return t.quizKahoot;
    case "scratch": return "Scratch";
    case "wokwi": return "Wokwi";
    case "codesandbox": return "CodeSandbox";
    case "makecode": return "MakeCode";
    default: return ct;
  }
}

// ── Edit sub-form ─────────────────────────────────────────────────────────────

function StageEditRow({
  stage, t,
  onUpdate, onRemove,
}: {
  stage: GeneratedStage;
  t: ReturnType<typeof getDictionary>["ai"]["generate"];
  onUpdate: (s: GeneratedStage) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(stage.title);
  const [desc, setDesc] = useState(stage.description ?? "");
  const [difficulty, setDifficulty] = useState<StageDifficulty>(stage.difficulty);
  const [duration, setDuration] = useState(String(stage.duration_min));

  const diffLabel =
    difficulty === "easy" ? t.difficultyEasy : difficulty === "hard" ? t.difficultyHard : t.difficultyMedium;
  const diffCls =
    stage.difficulty === "easy"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
      : stage.difficulty === "hard"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";

  function save() {
    onUpdate({
      ...stage,
      title: title.trim() || stage.title,
      description: desc.trim() || stage.description,
      difficulty,
      duration_min: Math.max(1, Math.min(120, Number(duration) || stage.duration_min)),
    });
    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      {editing ? (
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder={t.topicPlaceholder}
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {(["easy", "medium", "hard"] as StageDifficulty[]).map((dv) => (
                <button
                  key={dv}
                  type="button"
                  onClick={() => setDifficulty(dv)}
                  className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                    difficulty === dv
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                      : "border-slate-200 text-slate-500 dark:border-white/10"
                  }`}
                >
                  {dv === "easy" ? t.difficultyEasy : dv === "hard" ? t.difficultyHard : t.difficultyMedium}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="number" min={1} max={120} value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <span className="text-xs text-slate-400">{t.minutesShort}</span>
            </div>
          </div>
          <button
            onClick={save}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
          >
            <Check className="h-3 w-3" /> {t.edit}
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10">
            {stageIcon(stage.content_type)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {ctLabel(stage.content_type, t)}
              </span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${diffCls}`}>
                {diffLabel}
              </span>
              <span className="flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-400">
                <Clock className="h-2.5 w-2.5" />
                {stage.duration_min} {t.minutesShort}
              </span>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
              {stage.title}
            </p>
            {stage.description && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                {stage.description}
              </p>
            )}
            {stage.questions && stage.questions.length > 0 && (
              <p className="mt-1 text-[11px] text-slate-400">
                {t.stageQuestions.replace("{n}", String(stage.questions.length))}
              </p>
            )}
            {EXTERNAL.includes(stage.content_type) && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                <Globe className="h-3 w-3" /> {ctLabel(stage.content_type, t)} — добавьте ссылку на проект после создания
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => setEditing(true)}
              title={t.edit}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onRemove}
              title={t.remove}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function AiGenerateStagesModal({
  lessonId,
  lessonTopic,
  onClose,
  onAdded,
}: {
  lessonId: string;
  lessonTopic: string | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.ai.generate;
  const db = createClient();

  // Form state
  const [topic, setTopic] = useState(lessonTopic ?? "");
  const [duration, setDuration] = useState(45);
  const [useWebSearch, setUseWebSearch] = useState(false);

  // Attached files (read once on open)
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesAttached, setFilesAttached] = useState(0);
  const [materials, setMaterials] = useState<Array<{ title: string; text: string }>>([]);

  // Generation state
  const [phase, setPhase] = useState<"form" | "preview" | "added">("form");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [stages, setStages] = useState<GeneratedStage[]>([]);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch attached materials text once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/extract-files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId }),
        });
        const data = (await res.json()) as {
          texts?: Array<{ title: string; text: string }>;
          filesAttached?: number;
        };
        if (cancelled) return;
        setMaterials(data.texts ?? []);
        setFilesAttached(data.filesAttached ?? 0);
        // Default: web search on only when there are no usable files.
        setUseWebSearch((data.texts?.length ?? 0) === 0);
      } catch {
        if (!cancelled) { setMaterials([]); setFilesAttached(0); setUseWebSearch(true); }
      } finally {
        if (!cancelled) setFilesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lessonId]);

  const generate = useCallback(async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/ai/generate-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson_id: lessonId,
          topic: topic.trim(),
          duration_min: duration,
          use_web_search: useWebSearch,
          attached_materials: materials,
        }),
      });
      const data = (await res.json()) as GenerateResult & { error?: string };
      if (!res.ok || data.error) {
        setGenError(data.error ?? t.error);
        return;
      }
      setResult(data);
      setStages(data.stages ?? []);
      setPhase("preview");
    } catch {
      setGenError(t.error);
    } finally {
      setGenerating(false);
    }
  }, [topic, duration, useWebSearch, materials, lessonId, t.error]);

  const addToLesson = useCallback(async () => {
    if (stages.length === 0) return;
    setAdding(true);
    try {
      for (const s of stages) {
        const config: Record<string, unknown> = {};
        if (s.content_type === "code" && s.config) {
          config.language = s.config.language ?? "python";
          config.starter_code = s.config.starter_code ?? "";
          config.expected_output = s.config.expected_output ?? "";
        } else if (s.content_type === "quiz_qia" && s.config) {
          config.time_limit_minutes = s.config.time_limit_minutes ?? null;
          config.points_per_question = s.config.points_per_question ?? 1;
        } else if (EXTERNAL.includes(s.content_type)) {
          // Placeholder — teacher fills the project link via stage editor.
          config.url = "";
          config.requires_link = true;
          config.requires_screenshot = false;
        }
        const stage = await addLessonStage(db, lessonId, {
          stageType: s.stage_type,
          // external/code/quiz content types are all valid LessonContentType values
          contentType: s.content_type as LessonContentType,
          title: s.title,
          description: s.description ?? null,
          config,
          difficulty: s.difficulty,
          durationMin: s.duration_min,
        });
        if (
          (s.content_type === "quiz_qia" || s.content_type === "quiz_kahoot") &&
          Array.isArray(s.questions) && s.questions.length > 0
        ) {
          const qInputs: QuizQuestionInput[] = s.questions.map((q) => ({
            question_text: q.question_text,
            options: q.options,
            correct_option_index: q.correct_option_index,
            points: 1,
            time_per_question_seconds: q.time_per_question_seconds ?? 20,
          }));
          await replaceQuizQuestions(db, stage.id, qInputs);
        }
      }
      setPhase("added");
      setTimeout(() => { onAdded(); onClose(); }, 1200);
    } catch {
      setGenError(t.error);
    } finally {
      setAdding(false);
    }
  }, [db, lessonId, stages, onAdded, onClose, t.error]);

  const copySearches = useCallback(async () => {
    if (!result?.recommendedSearches.length) return;
    try {
      await navigator.clipboard.writeText(result.recommendedSearches.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  }, [result]);

  if (typeof document === "undefined") return null;

  const totalDuration = stages.reduce((sum, s) => sum + s.duration_min, 0);

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: "var(--surface-1)" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* ── FORM ── */}
          {phase === "form" && (
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t.topic}
                </label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t.topicPlaceholder}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t.duration}
                </label>
                <input
                  type="number" min={5} max={240} value={duration}
                  onChange={(e) => setDuration(Math.max(5, Math.min(240, Number(e.target.value) || 45)))}
                  className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Web search toggle */}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                <input
                  type="checkbox"
                  checked={useWebSearch}
                  onChange={(e) => setUseWebSearch(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <Search className="h-3.5 w-3.5" /> {t.useWebSearch}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">{t.useWebSearchHint}</span>
                </span>
              </label>

              {/* Attached files info */}
              <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-500/20 dark:bg-blue-500/5">
                <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <div className="text-xs">
                  {filesLoading ? (
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Loader2 className="h-3 w-3 animate-spin" /> …
                    </span>
                  ) : filesAttached > 0 ? (
                    <>
                      <p className="font-semibold text-blue-700 dark:text-blue-300">
                        {t.filesAttached.replace("{count}", String(filesAttached))}
                      </p>
                      <p className="mt-0.5 text-blue-600/80 dark:text-blue-400/80">{t.filesHint}</p>
                    </>
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400">{t.noFilesAttached}</p>
                  )}
                </div>
              </div>

              {genError && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  {genError}
                </p>
              )}
            </div>
          )}

          {/* ── PREVIEW ── */}
          {phase === "preview" && result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t.preview.replace("{n}", String(stages.length))}
                </p>
                <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                  <Clock className="h-3.5 w-3.5" /> {totalDuration} {t.minutesShort}
                </span>
              </div>

              <div className="space-y-2">
                {stages.map((s, i) => (
                  <StageEditRow
                    key={i}
                    stage={s}
                    t={t}
                    onUpdate={(updated) => setStages((prev) => prev.map((x, j) => (j === i ? updated : x)))}
                    onRemove={() => setStages((prev) => prev.filter((_, j) => j !== i))}
                  />
                ))}
              </div>

              {/* Recommended searches */}
              {result.recommendedSearches.length > 0 && (
                <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 dark:border-violet-500/20 dark:bg-violet-500/5">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-violet-700 dark:text-violet-300">
                    <Search className="h-3.5 w-3.5" /> {t.recommendedMaterials}
                  </p>
                  <ul className="space-y-1">
                    {result.recommendedSearches.map((q, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs text-violet-700 dark:text-violet-300">
                        <span className="text-violet-400">•</span> {q}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => void copySearches()}
                      className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-500/30 dark:bg-transparent dark:text-violet-300"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? t.copied : t.copyAll}
                    </button>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(result.recommendedSearches[0] ?? "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-500/30 dark:bg-transparent dark:text-violet-300"
                    >
                      <ExternalLink className="h-3 w-3" /> {t.openInGoogle}
                    </a>
                  </div>
                </div>
              )}

              {/* AI notes */}
              {result.notes && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-500/20 dark:bg-blue-500/5">
                  <p className="mb-1 text-xs font-bold text-blue-700 dark:text-blue-300">📝 {t.aiNotes}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">{result.notes}</p>
                </div>
              )}

              {(result.lesson_title_suggestion || result.lesson_description_suggestion) && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                  {result.lesson_title_suggestion && (
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      💡 {result.lesson_title_suggestion}
                    </p>
                  )}
                  {result.lesson_description_suggestion && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {result.lesson_description_suggestion}
                    </p>
                  )}
                </div>
              )}

              {genError && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  {genError}
                </p>
              )}
            </div>
          )}

          {/* ── ADDED ── */}
          {phase === "added" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                <Check className="h-7 w-7" />
              </div>
              <p className="text-base font-bold text-slate-800 dark:text-slate-100">{t.added}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {phase !== "added" && (
          <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-white/10">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              {d.common.cancel}
            </button>

            <div className="flex gap-2">
              {phase === "preview" && (
                <button
                  onClick={() => { setPhase("form"); setGenError(""); }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t.regenerate}
                </button>
              )}

              {phase === "form" && (
                <button
                  onClick={() => void generate()}
                  disabled={generating || !topic.trim()}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:opacity-90 disabled:opacity-50"
                >
                  {generating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {t.generatingLong}</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> {t.button}</>
                  )}
                </button>
              )}

              {phase === "preview" && (
                <button
                  onClick={() => void addToLesson()}
                  disabled={adding || stages.length === 0}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {adding ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {t.adding}</>
                  ) : (
                    t.createStages
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
