"use client";

import { useState, useEffect, useRef } from "react";
import { Check, Loader2, Trophy, Hourglass, Gamepad2, Triangle, Diamond, Circle, Square, Flame, Medal } from "lucide-react";
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
  { Icon: Triangle, bg: "#E21B3C", shadow: "rgba(226,27,60,.45)" },
  { Icon: Diamond, bg: "#1368CE", shadow: "rgba(19,104,206,.45)" },
  { Icon: Circle, bg: "#E0A211", shadow: "rgba(224,162,17,.45)" },
  { Icon: Square, bg: "#26890C", shadow: "rgba(38,137,12,.45)" },
];
const MEDAL_COLORS = ["text-yellow-500", "text-slate-400", "text-amber-700"];

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/**
 * Inline-embedded Kahoot stage (Iter5 P13, Claude Design). Was previously a
 * fullscreen dark-overlay modal; now rendered directly in the lesson's
 * center-stage slot, same as CodeStageView/ExternalStageModal. Only the
 * "question_active" stage has a Claude Design reference — lobby/revealed/
 * finished are restyled lightly with the same color tokens, not redesigned
 * wholesale (no source screens exist for them).
 */
export function KahootStudentModal({
  stage, studentId, onSubmitted,
}: {
  stage: LessonStageWithProgress;
  studentId: string;
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

  // Real streak: consecutive correct answers ending at the most recently answered question.
  const answeredIdxs = Object.keys(answered).map(Number).sort((a, b) => a - b);
  let streak = 0;
  for (let i = answeredIdxs.length - 1; i >= 0; i--) {
    const key = answeredIdxs[i];
    if (key === undefined) break;
    if (answered[key]?.correct) streak++; else break;
  }

  async function answer(optIdx: number) {
    if (!currentQ || answered[qIdx]) return;
    // Defensive (Iter5 hotfix P14.2): see QiaQuizModal's choose() for why
    // `attempt` can still be null right after the stage becomes active.
    let att = attempt;
    if (!att) {
      try {
        att = await startQuizAttempt(db, stage.id, studentId, questions.length);
        setAttempt(att);
      } catch {
        return;
      }
    }
    const correct = optIdx === currentQ.correct_option_index;
    const responseTimeMs = startedMs != null ? Date.now() - startedMs : limitS * 1000;
    const score = await submitKahootAnswer(db, {
      stageId: stage.id, attemptId: att.id, questionId: currentQ.id,
      selectedIndex: optIdx, isCorrect: correct, responseTimeMs, timeLimitSeconds: limitS,
    }).catch(() => 0);
    setAnswered((a) => ({ ...a, [qIdx]: { selected: optIdx, score, correct } }));
  }

  const total = questions.length;
  const myAns = answered[qIdx];
  const me = board.find((e) => e.student_id === studentId);
  const myPlace = me ? board.findIndex((e) => e.student_id === studentId) + 1 : null;
  const myName = me?.full_name ?? "";

  if (loading) {
    return (
      <div className="flex min-h-[300px] flex-1 items-center justify-center text-[#9CA0B4]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (status === "lobby") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 rounded-[24px] border border-[#ECEDF4] bg-white p-10 text-center shadow-sm">
        <Hourglass className="h-12 w-12 animate-pulse text-[#6A4FE6]" />
        <h2 className="text-2xl font-black text-[#242A45]">{dq.waitingTeacher}</h2>
        <p className="text-sm text-[#9CA0B4]">{dq.teacherWillStart}</p>
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-5 py-2 text-sm font-extrabold text-emerald-700">
          <Gamepad2 className="h-4 w-4" /> {dq.ready}
        </span>
      </div>
    );
  }

  if (status === "question_active" && currentQ) {
    if (myAns) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[24px] border border-[#ECEDF4] bg-white p-10 text-center shadow-sm">
          <Check className="h-12 w-12 text-emerald-500" />
          <h2 className="text-xl font-black text-[#242A45]">{dq.answerRecorded}</h2>
          <p className="text-sm text-[#9CA0B4]">{dq.waitingOthers}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-1 flex-col gap-4">
        <div
          className="relative flex flex-1 flex-col items-center overflow-hidden rounded-[24px] px-6 py-5"
          style={{
            background: "radial-gradient(circle at 14% 22%, rgba(124,99,240,.14), transparent 42%), " +
              "radial-gradient(circle at 88% 82%, rgba(226,27,60,.08), transparent 46%), " +
              "linear-gradient(155deg,#ECE7F7 0%,#F1E8F0 52%,#F7EEF0 100%)",
          }}
        >
          <div className="relative z-[2] font-black text-[30px] tracking-tight text-[#46178F]" style={{ textShadow: "0 2px 0 rgba(70,23,143,.12)" }}>
            Kahoot!
          </div>

          <div className="relative z-[2] mt-3.5 flex w-full items-center justify-center gap-5">
            <div
              className="flex h-[92px] w-[92px] shrink-0 flex-col items-center justify-center rounded-full text-white"
              style={{ background: "linear-gradient(135deg,#7C63F0,#5B3FD4)", boxShadow: "0 14px 30px -8px rgba(91,63,212,.6)" }}
            >
              <span className="text-[28px] font-black leading-none">{secsLeft ?? 0}</span>
              <span className="mt-0.5 text-[11px] font-bold opacity-90">{dq.timeLabel.toLowerCase()}</span>
            </div>
            <div className="max-w-[560px] flex-1 rounded-[20px] bg-white px-6 py-4" style={{ boxShadow: "0 16px 40px -12px rgba(70,23,143,.22)" }}>
              <p className="text-center text-[19px] font-black text-[#232A45]">{currentQ.question_text}</p>
            </div>
            <div className="flex h-[78px] w-[78px] shrink-0 flex-col items-center justify-center rounded-full bg-white" style={{ boxShadow: "0 10px 26px -8px rgba(70,23,143,.2)" }}>
              <span className="text-[24px] font-black leading-none text-[#242A45]">{qIdx + 1}</span>
              <span className="text-[10.5px] font-bold text-[#9CA0B4]">/ {total}</span>
            </div>
          </div>

          <div className="relative z-[2] mt-4 grid w-full max-w-[900px] grid-cols-1 gap-3 sm:grid-cols-2">
            {currentQ.options.map((o, oi) => {
              const c = OPT[oi];
              if (!o || !c) return null;
              const Icon = c.Icon;
              return (
                <button
                  key={oi}
                  onClick={() => answer(oi)}
                  className="flex h-[72px] items-center gap-4 rounded-[14px] px-5 text-white transition-transform active:scale-[0.98]"
                  style={{ background: c.bg, boxShadow: `inset 0 -5px 0 rgba(0,0,0,.18), 0 8px 18px -8px ${c.shadow}` }}
                >
                  <Icon className="h-5 w-5 shrink-0" fill="currentColor" />
                  <span className="flex-1 text-left text-[16px] font-bold">{o}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-[16px] border border-[#ECEDF4] bg-white px-5 py-3 shadow-sm">
          <div className="flex items-center gap-2.5 border-r border-[#EEF0F5] pr-4">
            <div className="flex h-[36px] w-[36px] items-center justify-center rounded-[10px] text-[13px] font-black text-white" style={{ background: "linear-gradient(135deg,#8B6BF0,#6A4FE6)" }}>
              {initials(myName || dq.you)}
            </div>
            <div>
              <p className="text-[10.5px] font-bold text-[#9CA0B4]">{myName || dq.you}</p>
            </div>
          </div>
          {me && (
            <div className="flex flex-1 items-center justify-around gap-3 text-center">
              {myPlace && (
                <div><p className="text-[10.5px] font-bold text-[#9CA0B4]">{dq.yourPlace}</p><p className="text-[14px] font-black text-[#242A45]">{myPlace} / {board.length}</p></div>
              )}
              <div><p className="text-[10.5px] font-bold text-[#9CA0B4]">{dq.points}</p><p className="text-[14px] font-black text-[#242A45]">{me.total_score}</p></div>
              {streak > 0 && (
                <div className="flex items-center gap-1.5"><Flame className="h-4 w-4 text-orange-500" /><span className="text-[14px] font-black text-[#242A45]">{streak}</span></div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === "question_revealed" && currentQ) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[24px] border border-[#ECEDF4] bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-extrabold uppercase tracking-widest text-[#9CA0B4]">{dq.correctAnswer}</p>
        <p className="text-2xl font-black text-emerald-700">{currentQ.options[currentQ.correct_option_index]}</p>
        {myAns ? (
          myAns.correct ? (
            <p className="text-lg font-extrabold text-emerald-600">{dq.correctPlus.replace("{n}", String(myAns.score))}</p>
          ) : (
            <p className="text-lg font-extrabold text-red-500">{dq.wrongAnswer}</p>
          )
        ) : <p className="text-sm text-[#9CA0B4]">{dq.wrongAnswer}</p>}
        {me && <p className="text-sm text-[#5B6178]">{dq.totalScore}: <span className="font-extrabold">{me.total_score}</span></p>}
        {myPlace && <p className="text-sm text-[#5B6178]">{dq.yourPlace}: <span className="font-extrabold">{myPlace} / {board.length}</span></p>}
        <p className="mt-2 text-xs text-[#B0B4C6]">{dq.waitingNext}</p>
      </div>
    );
  }

  /* finished */
  return (
    <div className="flex flex-1 flex-col overflow-y-auto rounded-[24px] border border-[#ECEDF4] bg-white p-6 shadow-sm">
      <div className="mb-6 text-center">
        <Trophy className="mx-auto h-10 w-10 text-amber-500" />
        <h2 className="mt-2 text-2xl font-black text-[#242A45]">{dq.gameOver}</h2>
        {myPlace && <p className="mt-2 text-lg font-extrabold text-[#5B6178]">{dq.yourResult}: {myPlace} {dq.place}</p>}
        {me && <p className="font-extrabold text-amber-600">{me.total_score} {dq.points}</p>}
        {me && <p className="font-extrabold text-[#242A45]">{dq.grade}: {gradeFromPercent(total > 0 ? (me.correct_count / total) * 100 : 0)}</p>}
      </div>
      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-[#9CA0B4]">{dq.leaderboard}</h3>
      <ul className="space-y-2">
        {board.map((e, i) => {
          const isMe = e.student_id === studentId;
          return (
            <li key={e.student_id} className={`flex items-center gap-3 rounded-[14px] px-4 py-2.5 ${isMe ? "bg-[#F2EFFE]" : "bg-slate-50"}`}>
              <span className="flex w-6 items-center justify-center">{i < 3 ? <Medal className={`h-4 w-4 ${MEDAL_COLORS[i]}`} /> : i + 1}</span>
              <span className="flex-1 text-sm font-bold text-[#242A45]">{isMe ? dq.you : e.full_name}</span>
              <span className="font-mono text-sm font-extrabold text-[#5B6178]">{e.total_score}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
