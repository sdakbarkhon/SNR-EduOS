"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, Sparkles, Loader2, Trash2, Edit2, Check,
  BookOpen, Code2, TestTube2, Gamepad2,
} from "lucide-react";
import { addLessonStage, replaceQuizQuestions, getDictionary } from "@snr/core";
import type { Locale, QuizQuestionInput } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

// ── Types ────────────────────────────────────────────────────────────────────

type StageTypeOpt = "theory" | "code" | "quiz_qia" | "quiz_kahoot";

interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_option_index: number;
  time_per_question_seconds?: number;
}

interface GeneratedStage {
  stage_type: "theory" | "task";
  content_type: "presentation" | "code" | "quiz_qia" | "quiz_kahoot";
  title: string;
  description?: string;
  config?: {
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
}

// ── Stage type icon helper ────────────────────────────────────────────────────

function stageIcon(ct: GeneratedStage["content_type"]) {
  if (ct === "presentation") return <BookOpen className="h-4 w-4" />;
  if (ct === "code") return <Code2 className="h-4 w-4" />;
  if (ct === "quiz_qia") return <TestTube2 className="h-4 w-4" />;
  if (ct === "quiz_kahoot") return <Gamepad2 className="h-4 w-4" />;
  return null;
}

// ── Edit sub-form ─────────────────────────────────────────────────────────────

function StageEditRow({
  stage,
  index,
  t,
  onUpdate,
  onRemove,
}: {
  stage: GeneratedStage;
  index: number;
  t: ReturnType<typeof getDictionary>["ai"]["generate"];
  onUpdate: (s: GeneratedStage) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(stage.title);
  const [desc, setDesc] = useState(stage.description ?? "");
  const [starter, setStarter] = useState(stage.config?.starter_code ?? "");

  const ctLabels: Record<string, string> = {
    presentation: t.theory,
    code: t.code,
    quiz_qia: t.quizQia,
    quiz_kahoot: t.quizKahoot,
  };

  function save() {
    const updated: GeneratedStage = {
      ...stage,
      title: title.trim() || stage.title,
      description: desc.trim() || stage.description,
      config: stage.config
        ? { ...stage.config, starter_code: starter || stage.config.starter_code }
        : stage.config,
    };
    onUpdate(updated);
    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      {editing ? (
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder="Название"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder="Описание"
          />
          {stage.content_type === "code" && (
            <textarea
              value={starter}
              onChange={(e) => setStarter(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Стартовый код"
            />
          )}
          <button
            onClick={save}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
          >
            <Check className="h-3 w-3" /> Сохранить
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10">
            {stageIcon(stage.content_type)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {ctLabels[stage.content_type] ?? stage.content_type}
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
  const [grade, setGrade] = useState(7);
  const [types, setTypes] = useState<StageTypeOpt[]>(["theory"]);
  const [quizCount, setQuizCount] = useState(5);
  const [kahootCount, setKahootCount] = useState(5);

  // Generation state
  const [phase, setPhase] = useState<"form" | "preview" | "added">("form");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [stages, setStages] = useState<GeneratedStage[]>([]);
  const [adding, setAdding] = useState(false);

  const toggleType = useCallback((t: StageTypeOpt) => {
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }, []);

  const generate = useCallback(async () => {
    if (!topic.trim() || types.length === 0) return;
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/ai/generate-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson_id: lessonId,
          topic: topic.trim(),
          grade,
          stage_types: types,
          quiz_questions_count: quizCount,
          kahoot_questions_count: kahootCount,
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
  }, [topic, grade, types, quizCount, kahootCount, lessonId, t.error]);

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
        }
        if (s.content_type === "quiz_qia" && s.config) {
          config.time_limit_minutes = s.config.time_limit_minutes ?? null;
          config.points_per_question = s.config.points_per_question ?? 1;
        }
        const stage = await addLessonStage(db, lessonId, {
          stageType: s.stage_type,
          contentType: s.content_type,
          title: s.title,
          description: s.description ?? null,
          config,
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
      setTimeout(() => {
        onAdded();
        onClose();
      }, 1200);
    } catch {
      setGenError(t.error);
    } finally {
      setAdding(false);
    }
  }, [db, lessonId, stages, onAdded, onClose, t.error]);

  if (typeof document === "undefined") return null;

  const TYPES: { key: StageTypeOpt; label: string; icon: React.ReactNode }[] = [
    { key: "theory",      label: t.theory,      icon: <BookOpen className="h-3.5 w-3.5" /> },
    { key: "code",        label: t.code,        icon: <Code2 className="h-3.5 w-3.5" /> },
    { key: "quiz_qia",   label: t.quizQia,     icon: <TestTube2 className="h-3.5 w-3.5" /> },
    { key: "quiz_kahoot", label: t.quizKahoot, icon: <Gamepad2 className="h-3.5 w-3.5" /> },
  ];

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
          {/* ── FORM phase ── */}
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

              {/* Grade */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t.grade}
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={grade}
                  onChange={(e) => setGrade(Number(e.target.value))}
                  className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Stage types */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t.stageTypes}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES.map(({ key, label, icon }) => {
                    const active = types.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleType(key)}
                        className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-all ${
                          active
                            ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                            : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:text-slate-400"
                        }`}
                      >
                        {icon}
                        {label}
                        {active && <Check className="ml-auto h-3 w-3 text-blue-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Counts */}
              {types.includes("quiz_qia") && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    {t.quizCount}
                  </label>
                  <input
                    type="number" min={1} max={20} value={quizCount}
                    onChange={(e) => setQuizCount(Number(e.target.value))}
                    className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              )}
              {types.includes("quiz_kahoot") && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    {t.kahootCount}
                  </label>
                  <input
                    type="number" min={1} max={20} value={kahootCount}
                    onChange={(e) => setKahootCount(Number(e.target.value))}
                    className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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

          {/* ── PREVIEW phase ── */}
          {phase === "preview" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t.preview.replace("{n}", String(stages.length))}
              </p>
              <div className="space-y-2">
                {stages.map((s, i) => (
                  <StageEditRow
                    key={i}
                    stage={s}
                    index={i}
                    t={t}
                    onUpdate={(updated) =>
                      setStages((prev) => prev.map((x, j) => (j === i ? updated : x)))
                    }
                    onRemove={() =>
                      setStages((prev) => prev.filter((_, j) => j !== i))
                    }
                  />
                ))}
              </div>
              {result && (result.lesson_title_suggestion || result.lesson_description_suggestion) && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-500/20 dark:bg-blue-500/5">
                  {result.lesson_title_suggestion && (
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                      💡 {result.lesson_title_suggestion}
                    </p>
                  )}
                  {result.lesson_description_suggestion && (
                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
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

          {/* ── ADDED phase ── */}
          {phase === "added" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                <Check className="h-7 w-7" />
              </div>
              <p className="text-base font-bold text-slate-800 dark:text-slate-100">{t.added}</p>
            </div>
          )}
        </div>

        {/* Footer buttons */}
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
                  disabled={generating || !topic.trim() || types.length === 0}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:opacity-90 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.generating}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {t.button}
                    </>
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
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.adding}
                    </>
                  ) : (
                    t.addToLesson
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
