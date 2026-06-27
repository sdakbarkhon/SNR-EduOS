"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, Sparkles, Loader2, Check, Clock,
  BookOpen, Code2, TestTube2, Gamepad2, Puzzle, CircuitBoard, Globe,
  Paperclip, Search, Copy, ExternalLink, ChevronLeft,
} from "lucide-react";
import { addLessonStage, getDictionary } from "@snr/core";
import type { Locale, StageDifficulty, LessonContentType } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GeneratedStage {
  stage_type: "theory" | "task";
  content_type: string;
  title: string;
  description?: string;
  difficulty: StageDifficulty;
  duration_min: number;
}

interface GenerateResult {
  stages: GeneratedStage[];
  recommendedSearches: string[];
  classGrade: number;
  notes: string;
  external: string[];
}

const EXTERNAL = ["scratch", "wokwi", "codesandbox", "makecode"];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function diffChipCls(difficulty: string): string {
  if (difficulty === "easy")
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  if (difficulty === "hard")
    return "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function AiGenerateStagesModal({
  lessonId,
  lessonTopic,
  lessonDurationMin,
  onClose,
  onAdded,
}: {
  lessonId: string;
  lessonTopic: string | null;
  lessonDurationMin: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.ai.generate;
  const db = createClient();

  const duration = lessonDurationMin > 0 ? lessonDurationMin : 45;

  // Form state
  const [topic, setTopic] = useState(lessonTopic ?? "");
  const [overallDifficulty, setOverallDifficulty] = useState<StageDifficulty>("medium");
  const [useWebSearch, setUseWebSearch] = useState(false);

  // Attached files
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesAttached, setFilesAttached] = useState(0);
  const [materials, setMaterials] = useState<Array<{ title: string; text: string }>>([]);

  // Generation state
  const [phase, setPhase] = useState<"form" | "select" | "added">("form");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [adding, setAdding] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Fetch attached materials once.
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
          overall_difficulty: overallDifficulty,
          attached_materials: materials,
        }),
      });
      const data = (await res.json()) as GenerateResult & { error?: string };
      if (!res.ok || data.error) {
        setGenError(data.error ?? t.error);
        return;
      }
      setResult(data);
      setChecked(new Array(data.stages?.length ?? 0).fill(true));
      setPhase("select");
    } catch {
      setGenError(t.error);
    } finally {
      setGenerating(false);
    }
  }, [topic, duration, useWebSearch, overallDifficulty, materials, lessonId, t.error]);

  const addToLesson = useCallback(async () => {
    if (!result) return;
    const selectedStages = result.stages
      .filter((_, i) => checked[i])
      .map((s) => ({ ...s }));
    if (selectedStages.length === 0) {
      setGenError(t.atLeastOneStage);
      return;
    }
    // Rescale durations to fit lesson duration
    const total = selectedStages.reduce((s, x) => s + x.duration_min, 0);
    if (total > 0 && total !== duration) {
      for (const s of selectedStages) {
        s.duration_min = Math.max(1, Math.round((s.duration_min * duration) / total));
      }
      const newTotal = selectedStages.reduce((s, x) => s + x.duration_min, 0);
      const last = selectedStages[selectedStages.length - 1];
      if (last && newTotal !== duration) {
        last.duration_min = Math.max(1, last.duration_min + (duration - newTotal));
      }
    }
    setAdding(true);
    setGenError("");
    try {
      for (const s of selectedStages) {
        const config: Record<string, unknown> = {};
        if (s.content_type === "code") {
          config.language = "python";
          config.starter_code = "";
          config.expected_output = "";
        } else if (s.content_type === "quiz_qia" || s.content_type === "quiz_kahoot") {
          config.time_limit_minutes = null;
          config.points_per_question = 1;
        } else if (EXTERNAL.includes(s.content_type)) {
          config.url = "";
          config.requires_link = true;
          config.requires_screenshot = false;
        }
        await addLessonStage(db, lessonId, {
          stageType: s.stage_type,
          contentType: s.content_type as LessonContentType,
          title: s.title,
          description: s.description ?? null,
          config,
          difficulty: s.difficulty,
          durationMin: s.duration_min,
        });
      }
      setPhase("added");
      setTimeout(() => { onAdded(); onClose(); }, 1200);
    } catch {
      setGenError(t.error);
    } finally {
      setAdding(false);
    }
  }, [db, lessonId, result, checked, duration, onAdded, onClose, t]);

  const copyQuery = useCallback(async (query: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(query);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch { /* clipboard unavailable */ }
  }, []);

  if (typeof document === "undefined") return null;

  const selectedCount = checked.filter(Boolean).length;
  const selectedDuration = result
    ? result.stages.filter((_, i) => checked[i]).reduce((s, x) => s + x.duration_min, 0)
    : 0;

  const diffLabel = (dv: string) =>
    dv === "easy" ? t.difficultyEasy : dv === "hard" ? t.difficultyHard : t.difficultyMedium;

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
              {/* Topic */}
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

              {/* Overall difficulty */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t.overallDifficulty}
                </label>
                <div className="flex gap-2">
                  {(["easy", "medium", "hard"] as StageDifficulty[]).map((dv) => (
                    <button
                      key={dv}
                      type="button"
                      onClick={() => setOverallDifficulty(dv)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                        overallDifficulty === dv
                          ? dv === "easy"
                            ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : dv === "hard"
                            ? "border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-300"
                            : "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-300"
                          : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:text-slate-400"
                      }`}
                    >
                      {diffLabel(dv)}
                    </button>
                  ))}
                </div>
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

          {/* ── SELECT ── */}
          {phase === "select" && result && (
            <div className="space-y-4">
              {/* Stats header */}
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t.selectStages}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t.selectedCount
                    .replace("{selected}", String(selectedCount))
                    .replace("{total}", String(result.stages.length))}
                  {" · "}
                  {t.totalSelected.replace("{min}", String(selectedDuration))}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {t.lessonDuration.replace("{min}", String(duration))}
                </p>
              </div>

              {/* Checkbox list */}
              <div className="space-y-2">
                {result.stages.map((s, i) => (
                  <label
                    key={i}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      checked[i]
                        ? "border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/5"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-transparent"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked[i] ?? false}
                      onChange={(e) => {
                        const next = [...checked];
                        next[i] = e.target.checked;
                        setChecked(next);
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded accent-blue-600"
                    />
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10">
                      {stageIcon(s.content_type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {ctLabel(s.content_type, t)}
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${diffChipCls(s.difficulty)}`}>
                          {diffLabel(s.difficulty)}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                          <Clock className="h-2.5 w-2.5" /> {s.duration_min} {t.minutesShort}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">
                        {s.title}
                      </p>
                      {s.description && (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {s.description}
                        </p>
                      )}
                      {EXTERNAL.includes(s.content_type) && (
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                          <Globe className="h-3 w-3" /> {ctLabel(s.content_type, t)} — добавьте ссылку после создания
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {/* Recommended searches — per-query buttons */}
              {result.recommendedSearches.length > 0 && (
                <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 dark:border-violet-500/20 dark:bg-violet-500/5">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-violet-700 dark:text-violet-300">
                    <Search className="h-3.5 w-3.5" /> {t.recommendedMaterials}
                  </p>
                  <ul className="space-y-1.5">
                    {result.recommendedSearches.map((q, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 text-xs text-violet-700 dark:text-violet-300 line-clamp-1">
                          <span className="mr-1 text-violet-400">•</span>{q}
                        </span>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => void copyQuery(q, i)}
                            title={t.copyQuery}
                            className="flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-500/30 dark:bg-transparent dark:text-violet-300"
                          >
                            {copiedIdx === i
                              ? <><Check className="h-3 w-3" /> {t.copied}</>
                              : <><Copy className="h-3 w-3" /> {t.copyQuery}</>
                            }
                          </button>
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(q)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t.openInGoogle}
                            className="flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-500/30 dark:bg-transparent dark:text-violet-300"
                          >
                            <ExternalLink className="h-3 w-3" /> {t.openInGoogle}
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI notes */}
              {result.notes && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-500/20 dark:bg-blue-500/5">
                  <p className="mb-1 text-xs font-bold text-blue-700 dark:text-blue-300">📝 {t.aiNotes}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">{result.notes}</p>
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
              {phase === "select" && (
                <button
                  onClick={() => { setPhase("form"); setGenError(""); }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {t.regenerate}
                </button>
              )}

              {phase === "form" && (
                <button
                  onClick={() => void generate()}
                  disabled={generating || !topic.trim() || filesLoading}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:opacity-90 disabled:opacity-50"
                >
                  {generating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {t.generatingLong}</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> {t.proposePlan}</>
                  )}
                </button>
              )}

              {phase === "select" && (
                <button
                  onClick={() => void addToLesson()}
                  disabled={adding || selectedCount === 0}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {adding ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {t.adding}</>
                  ) : (
                    t.createSelected.replace("{count}", String(selectedCount))
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
