"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check, Clock, Loader2, PartyPopper, Lightbulb } from "lucide-react";
import {
  getDictionary, getQuizQuestions, getStudentQuizAttempt, startQuizAttempt,
  submitQuizAnswer, finalizeQuizAttempt, getQuizAttemptResults,
} from "@snr/core";
import type {
  Locale, LessonStageWithProgress, LessonStageProgress, QuizQuestion, QuizAttempt, QuizConfigForStage,
} from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { useToast } from "@/components/Toast";
import { StageActionButton } from "@/components/lesson-stages/StageActionButton";
import { createClient } from "@/lib/supabase/client";

const LETTERS = ["A", "B", "C", "D"] as const;
const GRADE_COLORS: Record<number, string> = {
  5: "text-emerald-600", 4: "text-blue-600", 3: "text-yellow-600", 2: "text-orange-600", 1: "text-red-600",
};

/** Renders as a dark monospace block when the question text looks like code
 * (multi-line) — no fake syntax highlighting, just real question content in
 * the visual treatment the Claude Design mock uses for code snippets. */
function QuestionText({ text }: { text: string }) {
  if (!text.includes("\n")) {
    return <h2 className="mt-3.5 text-center text-[22px] font-black leading-snug text-[#232A45] md:text-[27px]">{text}</h2>;
  }
  return (
    <div className="mt-4 rounded-2xl bg-[#0F1629] px-5 py-4">
      <pre className="whitespace-pre-wrap font-mono text-[14px] leading-relaxed text-[#C7CCE0]">{text}</pre>
    </div>
  );
}

/**
 * Inline-embedded QIA quiz stage (Iter5 P13, Claude Design). Was previously a
 * fullscreen dark-overlay modal; now rendered directly in the lesson's
 * center-stage slot, same as CodeStageView/ExternalStageModal, since the
 * design shows the sidebar/header visible around it (not a modal).
 */
export function QiaQuizModal({
  stage, studentId, onSubmitted,
}: {
  stage: LessonStageWithProgress;
  studentId: string;
  onSubmitted: (progress: LessonStageProgress) => void;
}) {
  const { locale } = useLocale();
  const dq = getDictionary(locale as Locale).lesson.quiz;
  const dl = getDictionary(locale as Locale).lesson;
  const dCommon = getDictionary(locale as Locale).common;
  const showToast = useToast();
  const db = createClient();
  const cfg = (stage.config ?? {}) as QuizConfigForStage;
  const limitMin = cfg.time_limit_minutes;

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState<{ correct: number; total: number; grade: number } | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);

  // initial load
  useEffect(() => {
    (async () => {
      const qs = await getQuizQuestions(db, stage.id);
      setQuestions(qs);
      let att = await getStudentQuizAttempt(db, stage.id, studentId);
      if (att?.is_finalized) {
        const res = await getQuizAttemptResults(db, att.id);
        const map: Record<string, number | null> = {};
        res.answers.forEach((a) => { map[a.question_id] = a.selected_option_index; });
        setAnswers(map);
        setAttempt(att);
        setResult({ correct: att.correct_count, total: att.total_questions, grade: stage.progress?.grade ?? 0 });
      } else {
        if (!att) att = await startQuizAttempt(db, stage.id, studentId, qs.length);
        setAttempt(att);
        const res = await getQuizAttemptResults(db, att.id);
        const map: Record<string, number | null> = {};
        res.answers.forEach((a) => { map[a.question_id] = a.selected_option_index; });
        setAnswers(map);
      }
      setLoading(false);
    })().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // countdown timer
  useEffect(() => {
    if (limitMin == null) return;
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [limitMin]);

  const deadlineMs = limitMin != null && attempt ? new Date(attempt.started_at).getTime() + limitMin * 60000 : null;
  const secsLeft = deadlineMs != null && nowMs != null ? Math.max(0, Math.floor((deadlineMs - nowMs) / 1000)) : null;
  const totalSecs = limitMin != null ? limitMin * 60 : null;
  const ringDeg = totalSecs != null && secsLeft != null ? Math.max(0, Math.min(360, ((totalSecs - secsLeft) / totalSecs) * 360)) : 0;

  // auto-finalize on timeout
  useEffect(() => {
    if (secsLeft === 0 && attempt && !attempt.is_finalized && !result && !finalizing) {
      void doFinalize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secsLeft]);

  async function choose(optIdx: number) {
    const q = questions[idx];
    if (!q || !attempt || result || finalizing) return;
    setAnswers((a) => ({ ...a, [q.id]: optIdx }));
    await submitQuizAnswer(db, attempt.id, q.id, optIdx).catch(() => null);
  }

  async function doFinalize() {
    if (!attempt) return;
    setConfirmStep(false);
    setFinalizing(true);
    try {
      const r = await finalizeQuizAttempt(db, attempt.id, studentId);
      setResult(r);
      const now = new Date().toISOString();
      onSubmitted({
        id: stage.progress?.id ?? "", stage_id: stage.id, student_id: studentId,
        is_completed: true, completed_at: now,
        submission_data: { kind: "quiz", correct: r.correct, total: r.total },
        grade: r.grade, teacher_comment: null, graded_at: now, graded_by: null,
      });
      if (r.grade >= 4 && typeof window !== "undefined") {
        import("canvas-confetti").then((m) => {
          m.default({ particleCount: 140, spread: 75, origin: { y: 0.6 } });
          setTimeout(() => m.default({ particleCount: 80, spread: 100, origin: { y: 0.5 } }), 350);
        }).catch(() => null);
      }
    } finally {
      setFinalizing(false);
    }
  }

  const total = questions.length;
  const q = questions[idx];
  const answeredCount = Object.values(answers).filter((v) => v != null).length;
  const mm = secsLeft != null ? Math.floor(secsLeft / 60) : 0;
  const ss = secsLeft != null ? secsLeft % 60 : 0;
  const timerColor = secsLeft == null ? "" : secsLeft < 30 ? "text-red-500" : secsLeft < 60 ? "text-orange-500" : "text-[#242A45]";

  if (loading) {
    return (
      <div className="flex min-h-[300px] flex-1 items-center justify-center text-[#9CA0B4]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (result) {
    return <ResultView questions={questions} answers={answers} result={result} dq={dq} />;
  }

  if (!q) {
    return <div className="flex flex-1 items-center justify-center text-[#9CA0B4]">—</div>;
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        {/* Question card */}
        <div className="flex flex-1 flex-col rounded-[24px] border border-[#ECEDF4] bg-white p-6 shadow-sm">
          <span className="self-center rounded-full bg-[#EEEAFD] px-4 py-1.5 text-[13px] font-extrabold text-[#6A4FE6]">
            {dq.questionOf.replace("{n}", String(idx + 1)).replace("{total}", String(total))}
          </span>
          <QuestionText text={q.question_text} />

          <div className="mt-5 flex flex-1 flex-col gap-2.5">
            {q.options.map((opt, oi) => {
              const letter = LETTERS[oi];
              if (!opt || !letter) return null;
              const sel = answers[q.id] === oi;
              return (
                <button
                  key={oi}
                  onClick={() => choose(oi)}
                  className={`flex items-center gap-4 rounded-[15px] border-2 px-5 py-3.5 text-left text-[16px] font-bold transition-all active:scale-[0.98] ${
                    sel ? "border-[#6A4FE6] bg-gradient-to-b from-[#F7F5FF] to-white shadow-[0_10px_24px_-12px_rgba(106,79,230,0.5)]" : "border-[#ECEEF4] bg-white hover:border-[#D9C8FB]"
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold ${
                    sel ? "bg-[#6A4FE6] text-white" : "bg-[#F1F2F7] text-[#9096AC]"
                  }`}>
                    {letter}
                  </span>
                  <span className="flex-1 text-[#2B3149]">{opt}</span>
                  {sel && (
                    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#6A4FE6] text-white">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Info card: timer ring + hint stub */}
        <div className="flex w-full flex-col rounded-[24px] border border-[#ECEDF4] bg-white p-5 shadow-sm lg:w-[220px]">
          {limitMin != null && (
            <>
              <div
                className="relative mx-auto h-[110px] w-[110px] shrink-0 rounded-full"
                style={{ background: `conic-gradient(#6A4FE6 ${ringDeg}deg, #ECEAFB ${ringDeg}deg)` }}
              >
                <div className="absolute inset-[8px] flex flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-[11px] font-bold text-[#9CA0B4]">{dq.timeLabel}</span>
                  <span className={`font-mono text-[20px] font-black tabular-nums ${timerColor}`}>{mm}:{String(ss).padStart(2, "0")}</span>
                </div>
              </div>
              <div className="my-4 h-px bg-[#EEF0F5]" />
            </>
          )}
          <div className="flex items-center gap-2">
            <Lightbulb className="h-[18px] w-[18px] shrink-0 text-[#F2B84B]" />
            <span className="text-[13.5px] font-extrabold text-[#242A45]">{dl.showHint}</span>
          </div>
          <StageActionButton
            variant="secondary"
            size="sm"
            className="mt-2.5"
            onClick={() => showToast(dl.hintComingSoon)}
          >
            {dl.showHint}
          </StageActionButton>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#ECEDF4] bg-white px-5 py-3.5 shadow-sm">
        {confirmStep ? (
          <>
            <p className="text-sm font-bold text-[#5B6178]">{dq.confirmFinish}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirmStep(false)}
                className="rounded-[12px] border border-[#E6E7EF] px-4 py-2.5 text-sm font-bold text-[#5B6178] hover:bg-slate-50">
                {dCommon.cancel}
              </button>
              <button onClick={doFinalize} disabled={finalizing}
                className="inline-flex items-center gap-2 rounded-[12px] bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md shadow-emerald-500/25 hover:bg-emerald-700 active:scale-95 disabled:opacity-60">
                {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {dq.finish}
              </button>
            </div>
          </>
        ) : (
          <>
            <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
              className="inline-flex items-center gap-1.5 rounded-[14px] border border-[#E6E7EF] px-4 py-3 text-[14.5px] font-extrabold text-[#5B6178] hover:bg-slate-50 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" /> {dq.prev}
            </button>
            <div className="flex items-center gap-2">
              {questions.map((qq, i) => (
                <span key={qq.id} className={`rounded-full transition-all ${i === idx ? "h-2 w-[26px] bg-[#6A4FE6]" : "h-2 w-2 bg-[#D6D8E4]"}`} />
              ))}
            </div>
            {idx >= total - 1 ? (
              <button onClick={() => setConfirmStep(true)} disabled={finalizing}
                className="inline-flex items-center gap-2 rounded-[14px] bg-[#6A4FE6] px-6 py-3 text-[14.5px] font-extrabold text-white shadow-[0_12px_24px_-10px_rgba(106,79,230,0.7)] active:scale-95 disabled:opacity-60">
                {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {dq.finish}
                <span className="opacity-80">({answeredCount}/{total})</span>
              </button>
            ) : (
              <button onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
                className="inline-flex items-center gap-1.5 rounded-[14px] bg-[#6A4FE6] px-6 py-3 text-[14.5px] font-extrabold text-white shadow-[0_12px_24px_-10px_rgba(106,79,230,0.7)] active:scale-95">
                {dq.next} <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ResultView({
  questions, answers, result, dq,
}: {
  questions: QuizQuestion[];
  answers: Record<string, number | null>;
  result: { correct: number; total: number; grade: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dq: any;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto rounded-[24px] border border-[#ECEDF4] bg-white p-6 shadow-sm">
      <div className="mb-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-2 text-[28px] font-black text-[#242A45]">
          <PartyPopper className="h-8 w-8 text-amber-500" /> {dq.resultTitle}
        </div>
        <p className="mt-3 text-sm text-[#9CA0B4]">{dq.youAnsweredCorrectly}</p>
        <p className="my-1 text-4xl font-black text-[#242A45]">
          {dq.ofTotal.replace("{correct}", String(result.correct)).replace("{total}", String(result.total))}
        </p>
        <p className={`text-lg font-extrabold ${GRADE_COLORS[result.grade] ?? "text-slate-600"}`}>{dq.grade}: {result.grade}</p>
      </div>

      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-[#9CA0B4]">{dq.review}</h3>
      <ul className="space-y-2">
        {questions.map((q, i) => {
          const sel = answers[q.id];
          const ok = sel === q.correct_option_index;
          return (
            <li key={q.id} className={`rounded-[14px] border px-4 py-2.5 text-sm ${ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
              <span className={`font-extrabold ${ok ? "text-emerald-700" : "text-red-700"}`}>
                {ok ? "✓" : "✗"} {dq.question.replace("{n}", String(i + 1))}:
              </span>{" "}
              {ok ? (
                <span className="text-emerald-700">{dq.correctLabel}</span>
              ) : (
                <span className="text-red-700">{dq.correctAnswerWas} «{q.options[q.correct_option_index]}»</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
