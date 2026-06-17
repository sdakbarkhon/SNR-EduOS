"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getDictionary, gradeSubmission, getSubjectConfig,
  getTestAnswersForSubmission,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Question = {
  id: string;
  question_text: string;
  question_type: string;
  order_index: number;
  options: Array<{ id: string; option_text: string; is_correct: boolean }>;
};
type Submission = {
  id: string; student_id: string; status: string;
  submitted_at: string | null; answer_text: string | null;
  grade: number | null; teacher_comment: string | null;
  student: { id: string; full_name: string; avatar_url: string | null };
};
type TestSub = {
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
type HW = {
  id: string; title: string; description: string | null;
  content_type: string; due_date: string | null;
  group: { id: string; name: string; subject: string };
};

interface Props {
  hw: HW;
  submissions: Submission[];
  testSubs: TestSub[];
  questions: Question[];
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) return <img src={url} alt={name} className="h-9 w-9 rounded-full object-cover" />;
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue/20 text-[13px] font-bold text-brand-blue">
      {initials}
    </div>
  );
}

/** Modal for reviewing file-submission answers and setting grade. */
function ReviewModal({ submission, onClose, onGraded }: {
  submission: Submission; onClose: () => void;
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

/** Modal for reviewing test answers (single_choice + open). */
function TestReviewModal({ testSub, questions, onClose, onGraded }: {
  testSub: TestSub;
  questions: Question[];
  onClose: () => void;
  onGraded: (score: number, maxScore: number) => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const supabase = createClient();
  const [answers, setAnswers] = useState<TestAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [openScoreAdj, setOpenScoreAdj] = useState(0); // extra points for open questions
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoScore = testSub.score ?? 0;
  const autoMaxScore = testSub.max_score ?? 0;
  const openQuestions = questions.filter(q => q.question_type === "open");
  const hasOpen = openQuestions.length > 0;

  useEffect(() => {
    (async () => {
      try {
        const data = await (getTestAnswersForSubmission(supabase as never, testSub.id) as unknown as Promise<unknown>);
        setAnswers(data as TestAnswer[]);
      } catch {
        // silently ignore — answers stay empty
      } finally {
        setLoading(false);
      }
    })();
  }, [testSub.id]);

  function getAnswerForQuestion(questionId: string): TestAnswer | undefined {
    return answers.find(a => a.question_id === questionId);
  }

  async function save() {
    setSaving(true);
    try {
      const newScore = autoScore + openScoreAdj;
      const newMax = autoMaxScore + openQuestions.length;
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
                              studentChose ? "bg-red-50 text-red-600" : "text-brand-ink-muted"
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
                        <input type="number" min={0} max={1} defaultValue={0}
                          className="w-16 rounded-[8px] border border-slate-200 bg-white px-2 py-1 text-[13px] font-bold text-brand-ink focus:outline-none"
                          onChange={(e) => setOpenScoreAdj(Number(e.target.value))} />
                      </label>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div className="rounded-[12px] bg-slate-50 px-4 py-2.5 text-[13px] font-semibold text-brand-ink">
            Авто-балл: {autoScore}/{autoMaxScore}
            {hasOpen && <span className="ml-2 text-brand-blue">+ {openScoreAdj} за открытый вопрос</span>}
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

export function TeacherHomeworkDetailView({ hw, submissions, testSubs, questions }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const router = useRouter();

  const [reviewSub, setReviewSub] = useState<Submission | null>(null);
  const [reviewTestSub, setReviewTestSub] = useState<TestSub | null>(null);
  const [localSubs, setLocalSubs] = useState(submissions);
  const [localTestSubs, setLocalTestSubs] = useState(testSubs);

  const cfg = getSubjectConfig(hw.group.subject);

  // A test has open questions if any question is of type "open"
  const hasOpenQuestions = questions.some(q => q.question_type === "open");

  // Average grade: combine file-submission grades (1-5) + test scores (normalized to 5)
  const fileGrades = localSubs
    .filter(s => s.grade != null)
    .map(s => Number(s.grade));
  const testGrades = localTestSubs
    .filter(s => s.max_score != null && s.max_score > 0)
    .map(s => ((s.score ?? 0) / s.max_score!) * 5);
  const allGrades = [...fileGrades, ...testGrades];
  const avgGrade = allGrades.length > 0
    ? allGrades.reduce((a, b) => a + b, 0) / allGrades.length
    : 0;

  const submittedCount = localSubs.length + localTestSubs.length;
  const gradedCount = localSubs.filter(s => s.status === "graded").length
    + (hasOpenQuestions ? 0 : localTestSubs.length); // auto-graded only if no open questions

  function statusChip(status: string, isTest = false, pending = false) {
    if (isTest) {
      if (pending) {
        return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          {d.teacher.statusPending}
        </span>;
      }
      return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        {d.teacher.statusGraded}
      </span>;
    }
    const map: Record<string, string> = {
      graded: "bg-emerald-100 text-emerald-700",
      submitted: "bg-amber-100 text-amber-700",
      overdue: "bg-red-100 text-red-700",
    };
    const labels: Record<string, string> = {
      graded: d.teacher.statusGraded,
      submitted: d.teacher.statusPending,
    };
    return (
      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", map[status] ?? "bg-slate-100 text-slate-600")}>
        {labels[status] ?? status}
      </span>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/teacher/homework" className="rounded-xl p-2 text-brand-ink-muted hover:bg-white/60">
          <ChevronLeft size={20} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-bold text-brand-ink">{hw.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[12px] text-brand-ink-muted">{hw.group.name}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
              hw.content_type === "test" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700")}>
              {hw.content_type === "test" ? d.homework.typeTest : d.homework.typeFile}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: d.teacher.detailSubmitted, value: submittedCount },
          { label: d.teacher.detailAvgScore, value: avgGrade > 0 ? avgGrade.toFixed(1) : "—" },
          {
            label: d.teacher.statsPending,
            value: localSubs.filter(s => s.status === "submitted").length
              + (hasOpenQuestions ? localTestSubs.length : 0)
          },
        ].map((item) => (
          <div key={item.label} className="rounded-[16px] bg-white/70 border border-white/80 p-4 text-center"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
            <div className="text-[24px] font-bold text-brand-ink">{item.value}</div>
            <div className="text-[12px] text-brand-ink-muted">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Description */}
      {hw.description && (
        <div className="rounded-[16px] bg-white/70 border border-white/80 p-4 text-[14px] text-brand-ink">
          {hw.description}
        </div>
      )}

      {/* Test questions (teacher view with correct answers) */}
      {hw.content_type === "test" && questions.length > 0 && (
        <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5 space-y-3"
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
          <h2 className="text-[15px] font-bold text-brand-ink">Вопросы ({questions.length})</h2>
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-[14px] bg-slate-50 p-3 space-y-2">
              <div className="text-[13px] font-semibold text-brand-ink">{i + 1}. {q.question_text}</div>
              {q.question_type === "single_choice" && (
                <div className="space-y-1">
                  {q.options.map((o) => (
                    <div key={o.id} className={cn("flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12px]",
                      o.is_correct ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-brand-ink-muted")}>
                      <span className={cn("h-3 w-3 rounded-full border-2 shrink-0",
                        o.is_correct ? "border-emerald-500 bg-emerald-500" : "border-slate-300")} />
                      {o.option_text}
                      {o.is_correct && <span className="ml-auto text-[10px] font-bold text-emerald-600">{d.teacher.reviewCorrect}</span>}
                    </div>
                  ))}
                </div>
              )}
              {q.question_type === "open" && (
                <div className="text-[12px] text-brand-ink-muted italic">Открытый вопрос — оценивается учителем</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Submissions list */}
      <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
        <h2 className="mb-4 text-[15px] font-bold text-brand-ink">{d.teacher.detailStudents}</h2>
        {localSubs.length === 0 && localTestSubs.length === 0 ? (
          <p className="text-[14px] text-brand-ink-muted">{d.teacher.noActivity}</p>
        ) : (
          <div className="space-y-2">
            {/* File submissions */}
            {localSubs.map((sub) => (
              <div key={sub.id}
                className="flex cursor-pointer items-center gap-3 rounded-[14px] bg-white/60 p-3 transition-colors hover:bg-white/90"
                onClick={() => setReviewSub(sub)}>
                <Avatar name={sub.student.full_name} url={sub.student.avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-brand-ink">{sub.student.full_name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {statusChip(sub.status)}
                    {sub.grade != null && (
                      <span className="text-[12px] font-bold text-emerald-600">{sub.grade}/5</span>
                    )}
                  </div>
                </div>
                {sub.status === "submitted" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setReviewSub(sub); }}
                    className="shrink-0 rounded-[10px] bg-brand-blue/10 px-3 py-1.5 text-[12px] font-semibold text-brand-blue hover:bg-brand-blue/20">
                    {d.teacher.reviewBtn}
                  </button>
                )}
                {sub.status === "graded" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setReviewSub(sub); }}
                    className="shrink-0 rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-ink-muted hover:bg-slate-50">
                    Открыть
                  </button>
                )}
              </div>
            ))}

            {/* Test submissions */}
            {localTestSubs.map((sub) => {
              const needsReview = hasOpenQuestions;
              return (
                <div key={sub.id}
                  className="flex cursor-pointer items-center gap-3 rounded-[14px] bg-white/60 p-3 transition-colors hover:bg-white/90"
                  onClick={() => setReviewTestSub(sub)}>
                  <Avatar name={sub.student.full_name} url={sub.student.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-brand-ink">{sub.student.full_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {statusChip("", true, needsReview)}
                      {sub.score !== null && sub.max_score !== null && (
                        <span className="text-[12px] font-bold text-emerald-600">
                          {sub.score}/{sub.max_score}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setReviewTestSub(sub); }}
                    className={cn(
                      "shrink-0 rounded-[10px] px-3 py-1.5 text-[12px] font-semibold",
                      needsReview
                        ? "bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20"
                        : "border border-slate-200 bg-white text-brand-ink-muted hover:bg-slate-50"
                    )}>
                    {needsReview ? d.teacher.reviewBtn : "Открыть"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* File submission review modal */}
      {reviewSub && (
        <ReviewModal
          submission={reviewSub}
          onClose={() => setReviewSub(null)}
          onGraded={(grade, comment) => {
            setLocalSubs(subs => subs.map(s =>
              s.id === reviewSub.id ? { ...s, status: "graded", grade, teacher_comment: comment } : s
            ));
            setReviewSub(null);
            router.refresh();
          }}
        />
      )}

      {/* Test submission review modal */}
      {reviewTestSub && (
        <TestReviewModal
          testSub={reviewTestSub}
          questions={questions}
          onClose={() => setReviewTestSub(null)}
          onGraded={(score, maxScore) => {
            setLocalTestSubs(subs => subs.map(s =>
              s.id === reviewTestSub.id ? { ...s, score, max_score: maxScore } : s
            ));
            setReviewTestSub(null);
          }}
        />
      )}
    </div>
  );
}
