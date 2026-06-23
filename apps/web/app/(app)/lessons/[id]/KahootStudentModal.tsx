"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Check, Loader2, Trophy, Hourglass, Gamepad2 } from "lucide-react";
import {
  getDictionary, getQuizQuestions, getKahootSession, startQuizAttempt,
  submitKahootAnswer, getKahootLeaderboard, gradeFromPercent,
} from "@snr/core";
import type {
  Locale, LessonStageWithProgress, LessonStageProgress, QuizQuestion, KahootSession,
  QuizAttempt, QuizLeaderboardEntry,
} from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { useRealtimeChannel } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";

const OPT = [
  { dot: "🔴", on: "bg-red-500 text-white border-red-500",       off: "bg-red-50 border-red-200 text-red-800 hover:border-red-400" },
  { dot: "🔵", on: "bg-blue-500 text-white border-blue-500",     off: "bg-blue-50 border-blue-200 text-blue-800 hover:border-blue-400" },
  { dot: "🟡", on: "bg-yellow-400 text-white border-yellow-400", off: "bg-yellow-50 border-yellow-200 text-yellow-800 hover:border-yellow-400" },
  { dot: "🟢", on: "bg-green-500 text-white border-green-500",   off: "bg-green-50 border-green-200 text-green-800 hover:border-green-400" },
];
const MEDALS = ["🥇", "🥈", "🥉"];

export function KahootStudentModal({
  stage, studentId, onClose, onSubmitted,
}: {
  stage: LessonStageWithProgress;
  studentId: string;
  onClose: () => void;
  onSubmitted: (progress: LessonStageProgress) => void;
}) {
  const { locale } = useLocale();
  const dq = getDictionary(locale as Locale).lesson.quiz;
  const db = createClient();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [session, setSession] = useState<KahootSession | null>(null);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  // answers this student gave, keyed by question index: { selected, score, correct }
  const [answered, setAnswered] = useState<Record<number, { selected: number; score: number; correct: boolean }>>({});
  const [board, setBoard] = useState<QuizLeaderboardEntry[]>([]);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const finishedNotified = useRef(false);

  useEffect(() => {
    (async () => {
      const qs = await getQuizQuestions(db, stage.id);
      setQuestions(qs);
      const att = await startQuizAttempt(db, stage.id, studentId, qs.length);
      setAttempt(att);
      setSession(await getKahootSession(db, stage.id));
      setLoading(false);
    })().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // realtime: react to teacher-driven session changes
  useRealtimeChannel(`kahoot-student-${stage.id}`, "kahoot_sessions", `stage_id=eq.${stage.id}`, () => {
    getKahootSession(db, stage.id).then((s) => setSession(s)).catch(() => null);
  });

  const status = session?.status ?? "lobby";
  const qIdx = session?.current_question_index ?? -1;
  const currentQ = qIdx >= 0 ? questions[qIdx] : undefined;

  // on reveal / finished → refresh leaderboard (for my total + place)
  useEffect(() => {
    if (status === "question_revealed" || status === "finished") {
      getKahootLeaderboard(db, stage.id).then(setBoard).catch(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, qIdx]);

  // on finished → notify parent once with computed grade
  useEffect(() => {
    if (status === "finished" && !finishedNotified.current) {
      finishedNotified.current = true;
      const total = questions.length;
      const me = board.find((e) => e.student_id === studentId);
      const correct = me?.correct_count ?? 0;
      const grade = gradeFromPercent(total > 0 ? (correct / total) * 100 : 0);
      const now = new Date().toISOString();
      onSubmitted({
        id: stage.progress?.id ?? "", stage_id: stage.id, student_id: studentId,
        is_completed: true, completed_at: now,
        submission_data: { kind: "kahoot", correct, total },
        grade, teacher_comment: null, graded_at: now, graded_by: null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, board]);

  const limitS = currentQ?.time_per_question_seconds ?? 20;
  const startedMs = session?.question_started_at ? new Date(session.question_started_at).getTime() : null;
  const secsLeft = status === "question_active" && startedMs != null && nowMs != null
    ? Math.max(0, Math.ceil((startedMs + limitS * 1000 - nowMs) / 1000)) : null;

  async function answer(optIdx: number) {
    if (!attempt || !currentQ || answered[qIdx]) return;
    const correct = optIdx === currentQ.correct_option_index;
    const responseTimeMs = startedMs != null ? Date.now() - startedMs : limitS * 1000;
    const score = await submitKahootAnswer(db, {
      stageId: stage.id, attemptId: attempt.id, questionId: currentQ.id,
      selectedIndex: optIdx, isCorrect: correct, responseTimeMs, timeLimitSeconds: limitS,
    }).catch(() => 0);
    setAnswered((a) => ({ ...a, [qIdx]: { selected: optIdx, score, correct } }));
  }

  if (typeof document === "undefined") return null;

  const total = questions.length;
  const myAns = answered[qIdx];
  const me = board.find((e) => e.student_id === studentId);
  const myPlace = me ? board.findIndex((e) => e.student_id === studentId) + 1 : null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col p-3 sm:p-5">
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
            <span className="truncate text-sm font-bold text-slate-700">Kahoot: {stage.title}</span>
            <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : status === "lobby" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
              <Hourglass className="h-12 w-12 animate-pulse text-violet-500" />
              <h2 className="text-2xl font-extrabold text-slate-800">{dq.waitingTeacher}</h2>
              <p className="text-sm text-slate-500">{dq.teacherWillStart}</p>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-5 py-2 text-sm font-bold text-emerald-700">
                <Gamepad2 className="h-4 w-4" /> {dq.ready}
              </span>
            </div>
          ) : status === "question_active" && currentQ ? (
            myAns ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <Check className="h-12 w-12 text-emerald-500" />
                <h2 className="text-xl font-extrabold text-slate-800">{dq.answerRecorded}</h2>
                <p className="text-sm text-slate-500">{dq.waitingOthers}</p>
                <p className="text-sm font-semibold text-slate-700">
                  {dq.yourAnswer}: {OPT[myAns.selected]?.dot} {currentQ.options[myAns.selected]}
                </p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col p-6">
                <div className="mb-3 flex items-center justify-between text-sm font-bold text-slate-500">
                  <span>{dq.questionOf.replace("{n}", String(qIdx + 1)).replace("{total}", String(total))}</span>
                  <span className={`font-mono ${secsLeft != null && secsLeft <= 5 ? "text-red-500" : "text-slate-700"}`}>0:{String(secsLeft ?? 0).padStart(2, "0")}</span>
                </div>
                <h2 className="mb-6 text-center text-xl font-extrabold text-slate-800 md:text-2xl">{currentQ.question_text}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {currentQ.options.map((o, oi) => {
                    const c = OPT[oi];
                    if (!o || !c) return null;
                    return (
                      <button key={oi} onClick={() => answer(oi)}
                        className={`flex items-center gap-3 rounded-2xl border-2 px-5 py-5 text-left text-base font-bold shadow-sm transition-all active:scale-95 ${c.off}`}>
                        <span className="text-xl">{c.dot}</span> {o}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          ) : status === "question_revealed" && currentQ ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">{dq.correctAnswer}</p>
              <p className="text-2xl font-extrabold text-emerald-700">{OPT[currentQ.correct_option_index]?.dot} {currentQ.options[currentQ.correct_option_index]}</p>
              {myAns ? (
                myAns.correct ? (
                  <p className="text-lg font-bold text-emerald-600">{dq.correctPlus.replace("{n}", String(myAns.score))}</p>
                ) : (
                  <p className="text-lg font-bold text-red-500">{dq.wrongAnswer}</p>
                )
              ) : <p className="text-sm text-slate-400">{dq.wrongAnswer}</p>}
              {me && <p className="text-sm text-slate-600">{dq.totalScore}: <span className="font-bold">{me.total_score}</span></p>}
              {myPlace && <p className="text-sm text-slate-600">{dq.yourPlace}: <span className="font-bold">{myPlace} / {board.length}</span></p>}
              <p className="mt-2 text-xs text-slate-400">{dq.waitingNext}</p>
            </div>
          ) : (
            /* finished */
            <div className="flex flex-1 flex-col overflow-y-auto p-6">
              <div className="mb-6 text-center">
                <Trophy className="mx-auto h-10 w-10 text-amber-500" />
                <h2 className="mt-2 text-2xl font-extrabold text-slate-800">{dq.gameOver}</h2>
                {myPlace && <p className="mt-2 text-lg font-bold text-slate-700">{dq.yourResult}: {myPlace} {dq.place}</p>}
                {me && <p className="text-amber-600 font-bold">{me.total_score} {dq.points}</p>}
                {me && <p className={`font-bold`}>{dq.grade}: {gradeFromPercent(total > 0 ? (me.correct_count / total) * 100 : 0)}</p>}
              </div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{dq.leaderboard}</h3>
              <ul className="space-y-2">
                {board.map((e, i) => {
                  const isMe = e.student_id === studentId;
                  return (
                    <li key={e.student_id} className={`flex items-center gap-3 rounded-xl px-4 py-2.5 ${isMe ? "bg-violet-100" : "bg-slate-50"}`}>
                      <span className="w-6 text-center">{i < 3 ? MEDALS[i] : i + 1}</span>
                      <span className="flex-1 text-sm font-semibold text-slate-800">{isMe ? dq.you : e.full_name}</span>
                      <span className="font-mono text-sm font-bold text-slate-600">{e.total_score}</span>
                    </li>
                  );
                })}
              </ul>
              <button onClick={onClose} className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700">{dq.close}</button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
