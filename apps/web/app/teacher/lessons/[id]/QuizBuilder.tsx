"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Check } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale, QuizQuestionInput } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

const OPTION_DOTS = ["🔴", "🔵", "🟡", "🟢"];

export function emptyQuizQuestion(): QuizQuestionInput {
  return { question_text: "", options: ["", "", "", ""], correct_option_index: 0, time_per_question_seconds: 20 };
}

/** True if every question has text, ≥2 non-empty options and a non-empty correct option. */
export function quizQuestionsValid(questions: QuizQuestionInput[]): boolean {
  if (questions.length === 0) return false;
  return questions.every((q) => {
    if (!q.question_text.trim()) return false;
    const nonEmpty = q.options.filter((o) => o.trim()).length;
    if (nonEmpty < 2) return false;
    const correct = q.options[q.correct_option_index];
    return !!correct && !!correct.trim();
  });
}

export function QuizBuilder({
  questions, onChange, isKahoot,
}: {
  questions: QuizQuestionInput[];
  onChange: (q: QuizQuestionInput[]) => void;
  isKahoot: boolean;
}) {
  const { locale } = useLocale();
  const dq = getDictionary(locale as Locale).lesson.quiz;
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  function patch(i: number, p: Partial<QuizQuestionInput>) {
    onChange(questions.map((q, idx) => idx === i ? { ...q, ...p } : q));
  }
  function patchOption(i: number, oi: number, val: string) {
    const q = questions[i];
    if (!q) return;
    patch(i, { options: q.options.map((o, j) => j === oi ? val : o) });
  }
  function addQuestion() {
    onChange([...questions, emptyQuizQuestion()]);
    setOpenIdx(questions.length);
  }
  function remove(i: number) {
    onChange(questions.filter((_, idx) => idx !== i));
    setOpenIdx(null);
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    const a = next[i];
    const b = next[j];
    if (!a || !b) return;
    next[i] = b;
    next[j] = a;
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {questions.map((q, i) => {
        const open = openIdx === i;
        return (
          <div key={i} className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : i)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-100 text-[11px] font-bold text-violet-700">{i + 1}</span>
                <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {q.question_text.trim() || dq.question.replace("{n}", String(i + 1))}
                </span>
              </button>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                <ChevronDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => remove(i)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500" title={dq.deleteQuestion}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {open && (
              <div className="space-y-3 border-t border-slate-100 px-3 py-3 dark:border-white/10">
                <textarea
                  value={q.question_text}
                  onChange={(e) => patch(i, { question_text: e.target.value })}
                  placeholder={dq.questionPlaceholder}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5"
                />
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => patch(i, { correct_option_index: oi })}
                        title={dq.correct}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                          q.correct_option_index === oi
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 text-transparent hover:border-emerald-300"
                        }`}
                      >
                        <Check className="h-4 w-4" strokeWidth={3} />
                      </button>
                      <span className="shrink-0 text-lg">{OPTION_DOTS[oi]}</span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => patchOption(i, oi, e.target.value)}
                        placeholder={`${dq.option} ${oi + 1}`}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5"
                      />
                    </div>
                  ))}
                </div>
                {isKahoot && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{dq.secondsPerQuestion}</label>
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={q.time_per_question_seconds ?? 20}
                      onChange={(e) => patch(i, { time_per_question_seconds: Math.max(5, Math.min(60, Number(e.target.value) || 20)) })}
                      className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/5"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addQuestion}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-sm font-semibold text-slate-500 transition-all hover:border-violet-300 hover:text-violet-600 dark:border-white/10"
      >
        <Plus className="h-4 w-4" /> {dq.addQuestion}
      </button>
    </div>
  );
}
