"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, Circle, Loader2 } from "lucide-react";
import {
  getDictionary,
  getTestQuestions,
  getTestSubmission,
  submitTest,
  type HomeworkWithSubmission,
  type TestQuestion,
  type TestSubmission,
  type TestAnswerInput,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { GlassCard, useLocale } from "@/components";
import { cn } from "@/lib/cn";

const sb = createClient();

function ResultsScreen({
  questions,
  submission,
  answers,
  locale,
}: {
  questions: TestQuestion[];
  submission: TestSubmission;
  answers: Map<string, TestAnswerInput>;
  locale: Locale;
}) {
  const d = getDictionary(locale);
  const score = submission.score ?? 0;
  const maxScore = submission.max_score ?? 0;
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return (
    <GlassCard className="p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-1">{d.homework.testResults}</h2>
      <div className="mb-6">
        <span className="text-3xl font-black text-blue-600">{score}</span>
        <span className="text-slate-400 font-semibold text-lg"> / {maxScore}</span>
        <span className="ml-3 text-sm text-slate-500">({pct}%)</span>
      </div>

      <div className="flex flex-col gap-4">
        {questions.map((q, idx) => {
          const ans = answers.get(q.id);
          const isCorrect = q.question_type === "single_choice"
            ? q.options.find((o) => o.id === ans?.selectedOptionId)?.is_correct ?? false
            : null;

          return (
            <div key={q.id} className="rounded-xl border border-slate-100 bg-white/80 p-4">
              <div className="flex items-start gap-2 mb-3">
                <span className="text-xs font-bold text-slate-400 mt-0.5 shrink-0">
                  {idx + 1}.
                </span>
                <p className="text-sm font-semibold text-slate-700">{q.question_text}</p>
                {q.question_type === "single_choice" && (
                  <span
                    className={cn(
                      "ml-auto shrink-0 text-xs font-bold px-2 py-0.5 rounded-full",
                      isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600",
                    )}
                  >
                    {isCorrect ? "✓" : "✗"}
                  </span>
                )}
                {q.question_type === "open" && (
                  <span className="ml-auto shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {d.homework.testReview}
                  </span>
                )}
              </div>

              {q.question_type === "single_choice" && (
                <div className="flex flex-col gap-1.5">
                  {q.options.map((opt) => {
                    const selected = ans?.selectedOptionId === opt.id;
                    return (
                      <div
                        key={opt.id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                          opt.is_correct
                            ? "bg-green-50 text-green-700 font-semibold"
                            : selected && !opt.is_correct
                            ? "bg-red-50 text-red-600"
                            : "text-slate-600",
                        )}
                      >
                        {opt.is_correct ? (
                          <CheckCircle size={14} className="text-green-600 shrink-0" />
                        ) : (
                          <Circle size={14} className="text-slate-300 shrink-0" />
                        )}
                        {opt.option_text}
                        {opt.is_correct && (
                          <span className="ml-1 text-xs text-green-600">
                            — {d.homework.testCorrect}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {q.question_type === "open" && ans?.openText && (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {ans.openText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

export function TestPlayer({ hw }: { hw: HomeworkWithSubmission }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [existingSubmission, setExistingSubmission] = useState<TestSubmission | null>(
    hw.test_submission ?? null,
  );
  const [answers, setAnswers] = useState<Map<string, TestAnswerInput>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<TestSubmission | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [qs, sub] = await Promise.all([
        getTestQuestions(sb, hw.id),
        hw.test_submission ? Promise.resolve(hw.test_submission) : getTestSubmission(sb, hw.id),
      ]);
      setQuestions(qs);
      setExistingSubmission(sub);
    } finally {
      setLoading(false);
    }
  }, [hw.id, hw.test_submission]);

  useEffect(() => { load(); }, [load]);

  const setOption = (questionId: string, selectedOptionId: string) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, { questionId, selectedOptionId });
      return next;
    });
  };

  const setOpenText = (questionId: string, openText: string) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, { questionId, openText });
      return next;
    });
  };

  const handleSubmit = async () => {
    setError("");
    const answerList = Array.from(answers.values());
    if (answerList.length === 0) {
      setError("Ответьте хотя бы на один вопрос");
      return;
    }
    setSubmitting(true);
    try {
      const studentRes = await sb.from("students").select("id").single();
      if (studentRes.error) throw studentRes.error;
      const result = await submitTest(sb, {
        homeworkId: hw.id,
        studentId: studentRes.data.id,
        answers: answerList,
      });
      setSubmitted(result);
    } catch (e) {
      setError((e as Error).message ?? "Ошибка отправки");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <GlassCard className="p-8 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 size={18} className="animate-spin" />
        {d.common.loading}
      </GlassCard>
    );
  }

  const finalSubmission = submitted ?? existingSubmission;
  if (finalSubmission) {
    return (
      <ResultsScreen
        questions={questions}
        submission={finalSubmission}
        answers={answers}
        locale={locale as Locale}
      />
    );
  }

  return (
    <GlassCard className="p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-6">{d.nav.homework}</h2>

      <div className="flex flex-col gap-6">
        {questions.map((q, idx) => (
          <div key={q.id}>
            <p className="text-sm font-semibold text-slate-700 mb-3">
              <span className="text-slate-400 mr-1">{idx + 1}.</span>
              {q.question_text}
            </p>

            {q.question_type === "single_choice" && (
              <fieldset className="flex flex-col gap-2">
                {q.options
                  .slice()
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((opt) => {
                    const selected = answers.get(q.id)?.selectedOptionId === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all text-sm",
                          selected
                            ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                            : "border-slate-200 bg-white/80 text-slate-600 hover:border-blue-300",
                        )}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt.id}
                          checked={selected}
                          onChange={() => setOption(q.id, opt.id)}
                          className="sr-only"
                        />
                        <span
                          className={cn(
                            "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                            selected ? "border-blue-500" : "border-slate-300",
                          )}
                        >
                          {selected && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 block" />
                          )}
                        </span>
                        {opt.option_text}
                      </label>
                    );
                  })}
              </fieldset>
            )}

            {q.question_type === "open" && (
              <textarea
                value={answers.get(q.id)?.openText ?? ""}
                onChange={(e) => setOpenText(q.id, e.target.value)}
                placeholder="Введите ответ…"
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
              />
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-8 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-md transition disabled:opacity-60"
        style={{ background: "linear-gradient(135deg,#1D6FF5 0%,#0B3EDB 100%)" }}
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        {submitting ? d.homework.formSubmitting : d.homework.testSubmit}
      </button>
    </GlassCard>
  );
}
