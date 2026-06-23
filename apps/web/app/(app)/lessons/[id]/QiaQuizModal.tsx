"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Check, Clock, Loader2, PartyPopper } from "lucide-react";
import {
  getDictionary, getQuizQuestions, getStudentQuizAttempt, startQuizAttempt,
  submitQuizAnswer, finalizeQuizAttempt, getQuizAttemptResults,
} from "@snr/core";
import type {
  Locale, LessonStageWithProgress, LessonStageProgress, QuizQuestion, QuizAttempt, QuizConfigForStage,
} from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const OPT = [
  { dot: "🔴", on: "bg-red-500 text-white border-red-500",       off: "bg-red-50 border-red-200 text-red-800 hover:border-red-400" },
  { dot: "🔵", on: "bg-blue-500 text-white border-blue-500",     off: "bg-blue-50 border-blue-200 text-blue-800 hover:border-blue-400" },
  { dot: "🟡", on: "bg-yellow-400 text-white border-yellow-400", off: "bg-yellow-50 border-yellow-200 text-yellow-800 hover:border-yellow-400" },
  { dot: "🟢", on: "bg-green-500 text-white border-green-500",   off: "bg-green-50 border-green-200 text-green-800 hover:border-green-400" },
];

const GRADE_COLORS: Record<number, string> = {
  5: "text-emerald-600", 4: "text-blue-600", 3: "text-yellow-600", 2: "text-orange-600", 1: "text-red-600",
};

export function QiaQuizModal({
  stage, studentId, onClose, onSubmitted,
}: {
  stage: LessonStageWithProgress;
  studentId: string;
  onClose: () => void;
  onSubmitted: (progress: LessonStageProgress) => void;
}) {
  const { locale } = useLocale();
  const dq = getDictionary(locale as Locale).lesson.quiz;
  const dCommon = getDictionary(locale as Locale).common;
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
  const [confirmOpen, setConfirmOpen] = useState(false);
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
    setConfirmOpen(false);
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

  if (typeof document === "undefined") return null;

  const total = questions.length;
  const q = questions[idx];
  const answeredCount = Object.values(answers).filter((v) => v != null).length;
  const mm = secsLeft != null ? Math.floor(secsLeft / 60) : 0;
  const ss = secsLeft != null ? secsLeft % 60 : 0;
  const timerColor = secsLeft == null ? "" : secsLeft < 30 ? "text-red-500" : secsLeft < 60 ? "text-orange-500" : "text-slate-600";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col p-3 sm:p-5">
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="shrink-0 border-b border-slate-100 px-5 py-3">
            <div className="flex items-center justify-between">
              <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
              <span className="truncate text-sm font-bold text-slate-700">{dq.test}: {stage.title}</span>
              {secsLeft != null && !result ? (
                <span className={`flex items-center gap-1 font-mono text-sm font-bold tabular-nums ${timerColor}`}>
                  <Clock className="h-4 w-4" /> {mm}:{String(ss).padStart(2, "0")}
                </span>
              ) : <span className="w-8" />}
            </div>
            {!result && total > 0 && (
              <div className="mt-2">
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
                </div>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">{dq.questionOf.replace("{n}", String(idx + 1)).replace("{total}", String(total))}</p>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : result ? (
            <ResultView questions={questions} answers={answers} result={result} dq={dq} onClose={onClose} />
          ) : q ? (
            <>
              <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6">
                <h2 className="text-center text-xl font-extrabold leading-snug text-slate-800 md:text-2xl">{q.question_text}</h2>
                <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                  {q.options.map((opt, oi) => {
                    const c = OPT[oi];
                    if (!opt || !c) return null;
                    const sel = answers[q.id] === oi;
                    return (
                      <button
                        key={oi}
                        onClick={() => choose(oi)}
                        className={`flex items-center gap-3 rounded-2xl border-2 px-5 py-4 text-left text-base font-bold shadow-sm transition-all active:scale-95 ${sel ? c.on : c.off}`}
                      >
                        <span className="text-xl">{c.dot}</span>
                        <span className="flex-1">{opt}</span>
                        {sel && <Check className="h-5 w-5" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer nav */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
                <div className="flex gap-2">
                  <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                    <ChevronLeft className="h-4 w-4" /> {dq.prev}
                  </button>
                  <button onClick={() => setIdx((i) => Math.min(total - 1, i + 1))} disabled={idx >= total - 1}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                    {dq.next} <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <button onClick={() => setConfirmOpen(true)} disabled={finalizing}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2 text-sm font-bold text-white shadow-md shadow-emerald-500/25 hover:bg-emerald-700 active:scale-95 disabled:opacity-60">
                  {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {dq.finish}
                  <span className="opacity-80">({answeredCount}/{total})</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-slate-400">—</div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={doFinalize}
        title={dq.finish} message={dq.confirmFinish} variant="warning"
        confirmText={dq.finish} cancelText={dCommon.cancel}
      />
    </div>,
    document.body,
  );
}

function ResultView({
  questions, answers, result, dq, onClose,
}: {
  questions: QuizQuestion[];
  answers: Record<string, number | null>;
  result: { correct: number; total: number; grade: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dq: any;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6">
      <div className="mb-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-2 text-3xl font-extrabold text-slate-800">
          <PartyPopper className="h-8 w-8 text-amber-500" /> {dq.resultTitle}
        </div>
        <p className="mt-3 text-sm text-slate-500">{dq.youAnsweredCorrectly}</p>
        <p className="my-1 text-4xl font-extrabold text-slate-900">
          {dq.ofTotal.replace("{correct}", String(result.correct)).replace("{total}", String(result.total))}
        </p>
        <p className={`text-lg font-bold ${GRADE_COLORS[result.grade] ?? "text-slate-600"}`}>{dq.grade}: {result.grade}</p>
      </div>

      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{dq.review}</h3>
      <ul className="space-y-2">
        {questions.map((q, i) => {
          const sel = answers[q.id];
          const ok = sel === q.correct_option_index;
          return (
            <li key={q.id} className={`rounded-xl border px-4 py-2.5 text-sm ${ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
              <span className={`font-bold ${ok ? "text-emerald-700" : "text-red-700"}`}>
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

      <button onClick={onClose} className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700">
        {dq.closeReturn}
      </button>
    </div>
  );
}
