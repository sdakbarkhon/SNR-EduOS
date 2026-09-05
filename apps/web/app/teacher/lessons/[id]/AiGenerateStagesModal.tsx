"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, Sparkles, Loader2, Check, Clock,
  BookOpen, Code2, TestTube2, Gamepad2, Puzzle, CircuitBoard, Globe,
  Paperclip, Search, Copy, ExternalLink,
  Ruler, FlaskConical, LineChart, Shuffle, Palette, PenTool, Brain, Database,
} from "lucide-react";
import { applyGeneratedStages, getDictionary } from "@snr/core";
import type { Locale, StageDifficulty, LessonSlide, GeneratedStage } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { AiWorkProgress, useTypicalDuration, type WorkStep } from "@/components/AiWorkProgress";
import { AI_TASKS } from "@/lib/ai/usage";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GenerateResult {
  stages: GeneratedStage[];
  recommendedSearches: string[];
  classGrade: number;
  notes: string;
  external: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stageIcon(ct: string) {
  switch (ct) {
    case "presentation": return <BookOpen className="h-4 w-4" />;
    case "code": return <Code2 className="h-4 w-4" />;
    case "quiz_qia": return <TestTube2 className="h-4 w-4" />;
    case "quiz_kahoot": return <Gamepad2 className="h-4 w-4" />;
    case "wokwi": return <CircuitBoard className="h-4 w-4" />;
    case "codesandbox": return <Code2 className="h-4 w-4" />;
    case "geogebra": return <Ruler className="h-4 w-4" />;
    case "phet": return <FlaskConical className="h-4 w-4" />;
    case "desmos": return <LineChart className="h-4 w-4" />;
    case "blockly_games": return <Puzzle className="h-4 w-4" />;
    case "visualgo": return <Shuffle className="h-4 w-4" />;
    case "p5js": return <Palette className="h-4 w-4" />;
    case "excalidraw": return <PenTool className="h-4 w-4" />;
    case "learningapps": return <Brain className="h-4 w-4" />;
    case "sqlonline": return <Database className="h-4 w-4" />;
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
    case "wokwi": return "Wokwi";
    case "codesandbox": return "CodeSandbox";
    case "geogebra": return "GeoGebra";
    case "phet": return "PhET Simulations";
    case "desmos": return "Desmos";
    case "blockly_games": return "Blockly Games";
    case "visualgo": return "VisuAlgo";
    case "p5js": return "p5.js Web Editor";
    case "excalidraw": return "Excalidraw";
    case "learningapps": return "Learning Apps";
    case "sqlonline": return "SQL Online";
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
  teacherId,
  subjectName,
  onClose,
  onAdded,
}: {
  lessonId: string;
  lessonTopic: string | null;
  lessonDurationMin: number;
  /** Автор этапов: уходит в applyGeneratedStages как uploaded_by. Прежде
      здесь стояло «для финального шага прицепить материалы БЗ» — того шага
      больше нет (06.09.2026). */
  teacherId: string;
  subjectName: string | null;
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
  const [phase, setPhase] = useState<"form" | "added">("form");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [adding, setAdding] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Настоящие шаги работы, а не крутящийся кружок.
  //
  // Шага ДВА, и только первый непрозрачен: это один запрос к серверу, внутри
  // которого модель и генерация картинок. Второй клиент выполняет сам, по
  // одному этапу за раз, поэтому у него есть точный счёт «3 из 7». Типичная
  // длительность первого берётся из настоящих замеров учёта.
  //
  // Третьим стоял «Прикрепляем материалы из библиотеки» — ушёл 06.09.2026
  // вместе с самим прикреплением.
  const [workStep, setWorkStep] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [totalToSave, setTotalToSave] = useState(0);
  const typicalMs = useTypicalDuration(AI_TASKS.generateStages);

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

  /**
   * Положить сгенерированные этапы в урок.
   *
   * 03.09.2026, заход Q2. ЗДЕСЬ БЫЛА САМА РАБОТА — шестьдесят строк: пересчёт
   * длительностей, вставка по одному, вопросы квиза, книги библиотеки. Теперь
   * она в ядре (applyGeneratedStages), потому что ровно то же самое делает
   * разборщик очереди. Две копии разошлись бы через месяц: одна кладёт вопросы
   * квиза, другая забыла.
   *
   * Окно оставило себе ровно то, чего у разборщика нет и быть не может, —
   * счётчик «3 из 7» на экране.
   */
  const addToLesson = useCallback(async (stages: GeneratedStage[]) => {
    setAdding(true);
    setGenError("");
    setTotalToSave(stages.length);
    setSavedCount(0);
    try {
      await applyGeneratedStages(db, {
        lessonId,
        teacherId,
        lessonMinutes: duration,
        subjectName: subjectName ?? "",
        stages,
        // Одиночное наполнение НИЧЕГО НЕ СТИРАЕТ — как и раньше. Стирание
        // середины бывает только при перезаполнении из очереди, и там об этом
        // спрашивают числом.
        replaceExisting: false,
        onProgress: (saved, total) => {
          setSavedCount(saved);
          setTotalToSave(total);
        },
      });
      setPhase("added");
      setTimeout(() => { onAdded(); onClose(); }, 1200);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setGenError(detail ? `${t.error}: ${detail}` : t.error);
    } finally {
      setAdding(false);
    }
  }, [db, lessonId, duration, teacherId, subjectName, onAdded, onClose, t.error]);

  const generate = useCallback(async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setGenError("");
    setWorkStep(0);
    setSavedCount(0);
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
      setWorkStep(1);
      await addToLesson(data.stages);
    } catch {
      setGenError(t.error);
    } finally {
      setGenerating(false);
    }
  }, [topic, duration, useWebSearch, overallDifficulty, materials, lessonId, t.error, addToLesson]);

  const copyQuery = useCallback(async (query: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(query);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch { /* clipboard unavailable */ }
  }, []);

  if (typeof document === "undefined") return null;

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

              {/* Настоящие шаги вместо крутящегося кружка. Показываются только
                  во время работы; форма при этом остаётся на экране, чтобы
                  учитель видел, что именно генерируется. */}
              {(generating || adding) && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-500/20 dark:bg-blue-500/5">
                  <AiWorkProgress
                    currentIndex={workStep}
                    typicalMs={typicalMs}
                    hintElapsed={d.ai.workElapsed}
                    hintUsually={d.ai.workUsually}
                    steps={[
                      { key: "model", label: d.ai.workStepModel },
                      {
                        key: "save",
                        label: d.ai.workStepSaving,
                        detail: totalToSave > 0
                          ? d.ai.workOf.replace("{i}", String(savedCount)).replace("{n}", String(totalToSave))
                          : undefined,
                      },
                      /* Третьего шага «Прикрепляем материалы из библиотеки»
                         здесь больше нет: вместе с ним убрано и само
                         прикрепление (06.09.2026). Шаг рисовался как задумка,
                         хотя учитель книг не просил. */
                    ] as WorkStep[]}
                  />
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
              {phase === "form" && (
                <button
                  onClick={() => void generate()}
                  disabled={generating || adding || !topic.trim() || filesLoading}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:opacity-90 disabled:opacity-50"
                >
                  {(generating || adding) ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {t.creating}</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> {t.proposePlan}</>
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
