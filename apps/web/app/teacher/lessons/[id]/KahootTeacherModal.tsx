"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Play, ChevronRight, Trophy, Clock, Users, Loader2 } from "lucide-react";
import {
  getDictionary, getQuizQuestions, createKahootSession, getKahootSession,
  startKahootGame, showNextKahootQuestion, revealKahootAnswer, finishKahootGame,
  getKahootParticipants, getKahootAnswerCount, getKahootLeaderboard, gradeFromPercent,
} from "@snr/core";
import type { Locale, LessonStage, QuizQuestion, KahootSession, QuizLeaderboardEntry } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";

const OPT = [
  { dot: "🔴", cls: "bg-red-500" }, { dot: "🔵", cls: "bg-blue-500" },
  { dot: "🟡", cls: "bg-yellow-400" }, { dot: "🟢", cls: "bg-green-500" },
];
const MEDALS = ["🥇", "🥈", "🥉"];

export function KahootTeacherModal({
  stage, onClose,
}: {
  stage: LessonStage;
  teacherId: string;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const dq = getDictionary(locale as Locale).lesson.quiz;
  const db = createClient();

  const [session, setSession] = useState<KahootSession | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [participants, setParticipants] = useState<Array<{ student_id: string; full_name: string }>>([]);
  const [answered, setAnswered] = useState(0);
  const [board, setBoard] = useState<QuizLeaderboardEntry[]>([]);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const revealedRef = useRef<number>(-1);

  // init
  useEffect(() => {
    (async () => {
      const [qs, s] = await Promise.all([getQuizQuestions(db, stage.id), createKahootSession(db, stage.id)]);
      setQuestions(qs);
      setSession(s);
      // If reopening a finished session, pre-populate leaderboard
      if ((s as KahootSession | null)?.status === "finished") {
        const lb = await getKahootLeaderboard(db, stage.id);
        setBoard(lb);
      }
    })().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tick
  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const status = session?.status ?? "lobby";
  const qIdx = session?.current_question_index ?? -1;
  const currentQ = qIdx >= 0 ? questions[qIdx] : undefined;

  // lobby polling: participants
  useEffect(() => {
    if (status !== "lobby") return;
    const poll = () => getKahootParticipants(db, stage.id).then(setParticipants).catch(() => null);
    poll();
    const t = setInterval(poll, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, stage.id]);

  // active polling: answered count
  useEffect(() => {
    if (status !== "question_active" || !currentQ) return;
    const poll = () => getKahootAnswerCount(db, currentQ.id).then(setAnswered).catch(() => null);
    poll();
    const t = setInterval(poll, 1500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, currentQ?.id]);

  // question timer → auto reveal
  const limitS = currentQ?.time_per_question_seconds ?? 20;
  const startedMs = session?.question_started_at ? new Date(session.question_started_at).getTime() : null;
  const secsLeft = status === "question_active" && startedMs != null && nowMs != null
    ? Math.max(0, Math.ceil((startedMs + limitS * 1000 - nowMs) / 1000)) : null;

  useEffect(() => {
    if (status === "question_active" && secsLeft === 0 && session && revealedRef.current !== qIdx) {
      revealedRef.current = qIdx;
      void doReveal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secsLeft, status]);

  async function refetchSession() {
    const s = await getKahootSession(db, stage.id);
    if (s) setSession(s);
  }

  async function doStart() {
    if (!session) return;
    setBusy(true);
    try { await startKahootGame(db, session.id); await refetchSession(); } finally { setBusy(false); }
  }
  async function doReveal() {
    if (!session) return;
    setBusy(true);
    try {
      await revealKahootAnswer(db, session.id);
      setBoard(await getKahootLeaderboard(db, stage.id));
      await refetchSession();
    } finally { setBusy(false); }
  }
  async function doNext() {
    if (!session) return;
    setBusy(true);
    try {
      if (qIdx + 1 < questions.length) {
        await showNextKahootQuestion(db, session.id, qIdx + 1);
        revealedRef.current = -1;
        setAnswered(0);
      } else {
        await finishKahootGame(db, session.id);
        setBoard(await getKahootLeaderboard(db, stage.id));
      }
      await refetchSession();
    } finally { setBusy(false); }
  }

  if (typeof document === "undefined") return null;
  const total = questions.length;
  const totalPlayers = participants.length;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col p-3 sm:p-5">
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
            <span className="truncate text-sm font-bold text-slate-700">Kahoot: {stage.title}</span>
            <div className="flex items-center gap-3">
              {status === "lobby" && (
                <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                  <Users className="h-4 w-4" /> {dq.players}: {totalPlayers}
                </span>
              )}
              <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {!session ? (
            <div className="flex flex-1 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : status === "lobby" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
              <h2 className="text-2xl font-extrabold text-slate-800">{dq.waitingStudents}</h2>
              <div className="flex max-w-xl flex-wrap justify-center gap-2">
                {participants.map((p) => (
                  <span key={p.student_id} className="rounded-full bg-violet-100 px-3 py-1.5 text-sm font-semibold text-violet-700">👤 {p.full_name}</span>
                ))}
                {participants.length === 0 && <span className="text-sm text-slate-400">{dq.waitingStudents}</span>}
              </div>
              <button onClick={doStart} disabled={busy || total === 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3 text-base font-bold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-700 active:scale-95 disabled:opacity-50">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />} {dq.startGame}
              </button>
            </div>
          ) : status === "question_active" && currentQ ? (
            <div className="flex flex-1 flex-col p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500">{dq.questionOf.replace("{n}", String(qIdx + 1)).replace("{total}", String(total))}</span>
                <span className={`flex items-center gap-1 font-mono text-lg font-extrabold tabular-nums ${secsLeft != null && secsLeft <= 5 ? "text-red-500" : "text-slate-700"}`}>
                  <Clock className="h-5 w-5" /> 0:{String(secsLeft ?? 0).padStart(2, "0")}
                </span>
              </div>
              <h2 className="mb-6 text-center text-2xl font-extrabold text-slate-800">{currentQ.question_text}</h2>
              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {currentQ.options.map((o, oi) => o ? (
                  <div key={oi} className={`flex items-center gap-3 rounded-2xl px-5 py-4 text-base font-bold text-white ${OPT[oi]?.cls}`}>
                    <span className="text-xl">{OPT[oi]?.dot}</span> {o}
                  </div>
                ) : null)}
              </div>
              <div className="mt-auto">
                <p className="mb-1 text-sm font-semibold text-slate-600">{dq.answeredCount}: {answered} / {totalPlayers}</p>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                    style={{ width: `${totalPlayers > 0 ? (answered / totalPlayers) * 100 : 0}%` }} />
                </div>
                <button onClick={doReveal} disabled={busy}
                  className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  {dq.correctAnswer} →
                </button>
              </div>
            </div>
          ) : status === "question_revealed" && currentQ ? (
            <div className="flex flex-1 flex-col p-6">
              <div className="mb-5 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 text-center">
                <p className="text-sm font-bold uppercase tracking-widest text-emerald-600">{dq.correctAnswer}</p>
                <p className="mt-1 text-2xl font-extrabold text-emerald-700">
                  {OPT[currentQ.correct_option_index]?.dot} {currentQ.options[currentQ.correct_option_index]}
                </p>
              </div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{dq.topThree}</h3>
              <ul className="space-y-2">
                {board.slice(0, 3).map((e, i) => (
                  <li key={e.student_id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-2.5">
                    <span className="text-xl">{MEDALS[i]}</span>
                    <span className="flex-1 text-sm font-semibold text-slate-800">{e.full_name}</span>
                    <span className="font-mono text-sm font-bold text-slate-600">{e.total_score}</span>
                  </li>
                ))}
              </ul>
              <button onClick={doNext} disabled={busy}
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50">
                {qIdx + 1 < total ? <>{dq.nextQuestion} <ChevronRight className="h-4 w-4" /></> : dq.finish}
              </button>
            </div>
          ) : (
            /* finished */
            <div className="flex flex-1 flex-col overflow-y-auto p-6">
              <div className="mb-6 text-center">
                <div className="mb-2 flex items-center justify-center gap-2 text-2xl font-extrabold text-slate-800">
                  <Trophy className="h-8 w-8 text-amber-500" /> {dq.gameOver}
                </div>
                {board[0] && (
                  <>
                    <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-slate-400">{dq.winner}</p>
                    <p className="text-3xl font-extrabold text-slate-900">🥇 {board[0].full_name}</p>
                    <p className="text-lg font-bold text-amber-600">{board[0].total_score} {dq.points}</p>
                  </>
                )}
              </div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{dq.leaderboard}</h3>
              <ul className="space-y-2">
                {board.map((e, i) => {
                  const grade = gradeFromPercent(total > 0 ? (e.correct_count / total) * 100 : 0);
                  return (
                    <li key={e.student_id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-2.5">
                      <span className="w-6 text-center text-sm font-bold text-slate-400">{i < 3 ? MEDALS[i] : i + 1}</span>
                      <span className="flex-1 text-sm font-semibold text-slate-800">{e.full_name}</span>
                      <span className="font-mono text-sm font-bold text-slate-600">{e.total_score}</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">{dq.grade}: {grade}</span>
                    </li>
                  );
                })}
              </ul>
              <button onClick={onClose} className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700">
                {dq.close}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
