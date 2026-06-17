"use client";

import { useState, useEffect } from "react";
import { getDictionary, gradeSubmission, getTestAnswersForSubmission } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export type ReviewQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  order_index: number;
  options: Array<{ id: string; option_text: string; is_correct: boolean }>;
};
export type ReviewSubmission = {
  id: string; student_id: string; status: string;
  submitted_at: string | null; answer_text: string | null;
  grade: number | null; teacher_comment: string | null;
  student: { id: string; full_name: string; avatar_url: string | null };
};
export type ReviewTestSub = {
  id: string; student_id: string;
  score: number | null; max_score: number | null;
  submitted_at: string;
  student: { id: string; full_name: string; avatar_url: string | null };
};
type TestAnswer = {
  id: string;
  question_id: string;
  selected_option_id: string | null;
  open_text: string | null;
  is_correct: boolean | null;
  question: { question_text: string; question_type: string; order_index: number };
};

/** Модалка проверки файловой работы + выставление оценки 1–5. */
export function ReviewModal({ submission, onClose, onGraded }: {
  submission: ReviewSubmission; onClose: () => void;
  onGraded: (grade: number, comment: string) => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const supabase = createClient();
  const [grade, setGrade] = useState(submission.grade != null ? String(submission.grade) : "");
  const [comment, setComment] = useState(submission.teacher_comment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const gradeNum = Number(grade.trim());
    if (!grade.trim() || isNaN(gradeNum) || gradeNum < 1 || gradeNum > 5) {
      setError("Введите оценку от 1 до 5");
      return;
    }
    setSaving(true);
    try {
      await gradeSubmission(supabase, { submissionId: submission.id, grade: gradeNum, comment: comment.trim() });
      onGraded(gradeNum, comment.trim());
    } catch (e: unknown) {
      setError((e as Error).message ?? d.common.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg overflow-hidden rounded-[24px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold text-brand-ink">{d.teacher.reviewTitle}</h2>
            <p className="text-[12px] text-brand-ink-muted mt-0.5">{submission.student.full_name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto max-h-[60vh] px-6 py-4 space-y-4">
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-brand-ink-muted">{d.teacher.reviewAnswers}</h3>
            {submission.answer_text ? (
              <div className="rounded-[12px] bg-slate-50 p-3 text-[13px] text-brand-ink whitespace-pre-wrap">
                {submission.answer_text}
              </div>
            ) : (
              <p className="text-[13px] text-brand-ink-muted">{d.homework.noFile}</p>
            )}
          </div>
          <div className="space-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-brand-ink-muted">{d.teacher.reviewGrade} (1–5)</span>
              <input type="number" min={1} max={5} value={grade} onChange={(e) => setGrade(e.target.value)}
                className="w-24 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[14px] font-bold text-brand-ink focus:outline-none focus:border-brand-blue/50" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-brand-ink-muted">{d.teacher.reviewComment}</span>
              <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
                className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-brand-ink focus:outline-none focus:border-brand-blue/50 resize-none" />
            </label>
          </div>
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>
        <div className="border-t border-slate-100 px-6 py-4">
          <button onClick={submit} disabled={saving}
            className="w-full rounded-[12px] py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)" }}>
            {saving ? d.common.loading : d.teacher.reviewSend}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Модалка проверки теста (single_choice авто + open вручную). Идемпотентный счёт. */
export function TestReviewModal({ testSub, questions, onClose, onGraded }: {
  testSub: ReviewTestSub;
  questions: ReviewQuestion[];
  onClose: () => void;
  onGraded: (score: number, maxScore: number) => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const supabase = createClient();
  const [answers, setAnswers] = useState<TestAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [openScores, setOpenScores] = useState<Record<string, number>>({});
  const [computedAutoScore, setComputedAutoScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openQuestions = questions.filter((q) => q.question_type === "open");
  const hasOpen = openQuestions.length > 0;
  const totalMax = questions.length;

  useEffect(() => {
    (async () => {
      try {
        const data = await (getTestAnswersForSubmission(supabase as never, testSub.id) as unknown as Promise<unknown>);
        const loaded = data as TestAnswer[];
        setAnswers(loaded);
        const auto = loaded.filter((a) => a.is_correct === true).length;
        setComputedAutoScore(auto);
        const storedOpen = Math.max(0, (testSub.score ?? 0) - auto);
        const init: Record<string, number> = {};
        openQuestions.forEach((q, i) => { init[q.id] = storedOpen > i ? 1 : 0; });
        setOpenScores(init);
      } catch {
        setComputedAutoScore(0);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testSub.id]);

  function getAnswerForQuestion(questionId: string): TestAnswer | undefined {
    return answers.find((a) => a.question_id === questionId);
  }

  async function save() {
    const auto = computedAutoScore ?? 0;
    const openTotal = Object.values(openScores).reduce((a, b) => a + b, 0);
    const newScore = auto + openTotal;
    const newMax = totalMax;
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from("test_submissions")
        .update({ score: newScore, max_score: newMax })
        .eq("id", testSub.id);
      if (err) throw err;
      onGraded(newScore, newMax);
    } catch (e: unknown) {
      setError((e as Error).message ?? d.common.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg overflow-hidden rounded-[24px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-[16px] font-bold text-brand-ink">{d.teacher.reviewTitle}</h2>
            <p className="text-[12px] text-brand-ink-muted mt-0.5">{testSub.student.full_name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] px-6 py-4 space-y-4">
          {loading ? (
            <p className="text-[13px] text-brand-ink-muted text-center py-4">{d.common.loading}</p>
          ) : (
            questions.map((q, i) => {
              const ans = getAnswerForQuestion(q.id);
              return (
                <div key={q.id} className="rounded-[14px] bg-slate-50 p-3 space-y-2">
                  <div className="text-[13px] font-semibold text-brand-ink">{i + 1}. {q.question_text}</div>
                  {q.question_type === "single_choice" && (
                    <div className="space-y-1">
                      {q.options.map((opt) => {
                        const studentChose = ans?.selected_option_id === opt.id;
                        return (
                          <div key={opt.id} className={cn(
                            "flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12px]",
                            opt.is_correct ? "bg-emerald-50 text-emerald-700 font-semibold" :
                              studentChose ? "bg-red-50 text-red-600" : "text-brand-ink-muted",
                          )}>
                            <span className={cn("h-3 w-3 rounded-full border-2 shrink-0",
                              opt.is_correct ? "border-emerald-500 bg-emerald-500" :
                                studentChose ? "border-red-400 bg-red-400" : "border-slate-300")} />
                            {opt.option_text}
                            {opt.is_correct && <span className="ml-auto text-[10px] text-emerald-600">{d.teacher.reviewCorrect}</span>}
                            {studentChose && !opt.is_correct && <span className="ml-auto text-[10px] text-red-500">Ответ ученика</span>}
                            {studentChose && opt.is_correct && <span className="ml-auto mr-1 text-[10px] text-emerald-600">Ответ ученика</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {q.question_type === "open" && (
                    <div className="space-y-1.5">
                      <div className="rounded-[10px] border border-slate-200 bg-white p-2.5 text-[13px] text-brand-ink min-h-[48px]">
                        {ans?.open_text || <span className="text-brand-ink-muted italic">Нет ответа</span>}
                      </div>
                      <label className="flex items-center gap-2 text-[12px] text-brand-ink-muted">
                        Зачтено (0 или 1):
                        <input
                          type="number" min={0} max={1}
                          value={openScores[q.id] ?? 0}
                          className="w-16 rounded-[8px] border border-slate-200 bg-white px-2 py-1 text-[13px] font-bold text-brand-ink focus:outline-none"
                          onChange={(e) => setOpenScores((prev) => ({ ...prev, [q.id]: Math.min(1, Math.max(0, Number(e.target.value))) }))} />
                      </label>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div className="rounded-[12px] bg-slate-50 px-4 py-2.5 text-[13px] font-semibold text-brand-ink">
            {loading ? (
              <span className="text-brand-ink-muted">Загрузка...</span>
            ) : (
              <>
                Авто-балл (тест): {computedAutoScore ?? "?"}/{questions.filter((q) => q.question_type === "single_choice").length}
                {hasOpen && (
                  <span className="ml-2 text-brand-blue">
                    + {Object.values(openScores).reduce((a, b) => a + b, 0)} за открытые →{" "}
                    итого {(computedAutoScore ?? 0) + Object.values(openScores).reduce((a, b) => a + b, 0)}/{totalMax}
                  </span>
                )}
              </>
            )}
          </div>

          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>

        <div className="border-t border-slate-100 px-6 py-4 flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-[12px] border border-slate-200 py-2.5 text-[14px] font-semibold text-brand-ink hover:bg-slate-50">
            Закрыть
          </button>
          {hasOpen && (
            <button onClick={save} disabled={saving}
              className="flex-1 rounded-[12px] py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)" }}>
              {saving ? d.common.loading : "Сохранить балл"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
