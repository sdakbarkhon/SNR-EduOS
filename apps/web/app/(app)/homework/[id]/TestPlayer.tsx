"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, Circle, XCircle, Loader2, Play, Clock, ChevronDown } from "lucide-react";
import {
  getDictionary,
  getTestQuestions,
  getTestSubmission,
  getTestAnswersForSubmission,
  startHomeworkTest,
  submitTest,
  type HomeworkWithSubmission,
  type TestQuestion,
  type TestSubmission,
  type TestAnswer,
  type TestAnswerInput,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { GlassCard, useLocale } from "@/components";
import { cn } from "@/lib/cn";

const sb = createClient();

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Countdown driven by the DB started_at (survives F5 — no localStorage needed). */
function TestTimer({ endsAt, onTimeout, label }: { endsAt: number; onTimeout: () => void; label: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, endsAt - Date.now()));
  const fired = useRef(false);
  const cb = useRef(onTimeout);
  useEffect(() => { cb.current = onTimeout; });
  useEffect(() => {
    if (endsAt <= Date.now()) { if (!fired.current) { fired.current = true; cb.current(); } return; }
    const id = setInterval(() => {
      const r = Math.max(0, endsAt - Date.now());
      setRemaining(r);
      if (r <= 0 && !fired.current) { fired.current = true; clearInterval(id); cb.current(); }
    }, 500);
    return () => clearInterval(id);
  }, [endsAt]);
  const secs = Math.floor(remaining / 1000);
  const urgent = secs < 60;
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold tabular-nums",
      urgent ? "bg-red-50 text-red-600 animate-pulse" : "bg-slate-100 text-slate-700",
    )}>
      <Clock size={15} />
      {label}: {fmt(secs)}
    </div>
  );
}

function Results({
  hw, questions, submission, answers, locale,
}: {
  hw: HomeworkWithSubmission;
  questions: TestQuestion[];
  submission: TestSubmission;
  answers: TestAnswer[];
  locale: Locale;
}) {
  const d = getDictionary(locale);
  const t = d.homework.test;
  const [open, setOpen] = useState(false);
  const score = submission.score ?? 0;
  const max = submission.max_score ?? 0;
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;

  // Ответ ученика по каждому вопросу (selected_option_id / open_text).
  const answerByQuestion = new Map(answers.map((a) => [a.question_id, a]));
  // Раньше блок раскрывался в пустоту, когда вопросы не грузились (у сдачи не
  // было started_at → RLS скрывал вопросы) и/или не было ни одной строки
  // test_answers. Показываем разбор только когда реально есть что показать.
  const canShowAnswers = questions.length > 0 && answers.length > 0;

  return (
    <GlassCard className="p-6">
      <p className="text-[15px] font-semibold text-slate-700">
        {t.resultLine
          .replace("{score}", String(score))
          .replace("{max}", String(max))
          .replace("{pct}", String(pct))}
      </p>

      {submission.grade != null ? (
        <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2">
          <span className="text-2xl font-black text-emerald-600">{submission.grade}</span>
          <span className="text-sm font-semibold text-emerald-500">/ 5</span>
        </div>
      ) : (
        <div className="mt-3 inline-flex rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
          {t.awaitingReview}
        </div>
      )}

      {canShowAnswers ? (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
          >
            <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
            {t.viewAnswers}
          </button>

          {open && (
            <div className="mt-4 flex flex-col gap-4">
              {questions.map((q, idx) => {
                const ans = answerByQuestion.get(q.id);
                return (
                  <div key={q.id} className="rounded-xl border border-slate-100 bg-white/80 p-4">
                    <div className="mb-3 flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 text-xs font-bold text-slate-400">{idx + 1}.</span>
                      <p className="text-sm font-semibold text-slate-700">{q.question_text}</p>
                    </div>
                    {q.question_type === "single_choice" && (
                      <div className="flex flex-col gap-1.5">
                        {q.options.slice().sort((a, b) => a.order_index - b.order_index).map((opt) => {
                          const isPicked = ans?.selected_option_id === opt.id;
                          const isCorrect = opt.is_correct;
                          // green = верный; red = ученик выбрал неверный; нейтральный — остальные.
                          const cls = isCorrect
                            ? "bg-green-50 text-green-700 font-semibold"
                            : isPicked
                              ? "bg-red-50 text-red-700 font-semibold"
                              : "text-slate-600";
                          const Icon = isCorrect ? CheckCircle : isPicked ? XCircle : Circle;
                          const iconCls = isCorrect ? "text-green-600" : isPicked ? "text-red-500" : "text-slate-300";
                          return (
                            <div key={opt.id} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm", cls)}>
                              <Icon size={14} className={cn("shrink-0", iconCls)} />
                              {opt.option_text}
                              {isCorrect && <span className="ml-1 text-xs text-green-600">— {t.correctAnswer}</span>}
                              {isPicked && !isCorrect && <span className="ml-1 text-xs text-red-500">— {t.yourAnswer}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {q.question_type === "open" && (
                      <div className="flex flex-col gap-1.5">
                        {ans?.open_text && (
                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            <span className="mr-1 text-xs font-semibold text-slate-400">{t.yourAnswer}:</span>
                            {ans.open_text}
                          </div>
                        )}
                        <span className="text-xs font-semibold text-amber-600">{d.homework.testReview}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <p className="mt-5 text-sm italic text-slate-400">{t.answersUnavailable}</p>
      )}
    </GlassCard>
  );
}

export function TestPlayer({ hw }: { hw: HomeworkWithSubmission }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.homework.test;

  const [studentId, setStudentId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [submission, setSubmission] = useState<TestSubmission | null>(hw.test_submission ?? null);
  const [answers, setAnswers] = useState<Map<string, TestAnswerInput>>(new Map());
  // Сданные ответы по вопросам (для разбора «Просмотреть свои ответы»).
  const [submittedAnswers, setSubmittedAnswers] = useState<TestAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Разбор ответов сданного теста — свои строки видит сам ученик (RLS
  // "student reads own test answers", миграция 17/71). .error не глотаем.
  const loadSubmittedAnswers = useCallback(async (submissionId: string) => {
    try {
      const rows = (await getTestAnswersForSubmission(sb, submissionId)) as TestAnswer[];
      setSubmittedAnswers(rows ?? []);
    } catch (e) {
      console.error("[TestPlayer] getTestAnswersForSubmission failed:", (e as Error)?.message ?? e);
      setSubmittedAnswers([]);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const sres = await sb.from("students").select("id").single();
      if (!sres.error) setStudentId(sres.data.id);
      const sub = hw.test_submission ?? (await getTestSubmission(sb, hw.id));
      setSubmission(sub);
      // Questions are only readable (RLS) once the student has started.
      if (sub?.started_at) {
        setQuestions(await getTestQuestions(sb, hw.id));
      }
      // Уже сдан → подтягиваем разбор ответов по вопросам.
      if (sub?.score != null) {
        await loadSubmittedAnswers(sub.id);
      }
    } finally {
      setLoading(false);
    }
  }, [hw.id, hw.test_submission, loadSubmittedAnswers]);

  useEffect(() => { load(); }, [load]);

  const isSubmitted = submission != null && submission.score != null;
  const isInProgress = submission != null && submission.started_at != null && submission.score == null;

  const setOption = (questionId: string, selectedOptionId: string) =>
    setAnswers((prev) => new Map(prev).set(questionId, { questionId, selectedOptionId }));
  const setOpenText = (questionId: string, openText: string) =>
    setAnswers((prev) => new Map(prev).set(questionId, { questionId, openText }));

  async function handleStart() {
    if (!studentId) return;
    setStarting(true);
    setError("");
    try {
      const s = await startHomeworkTest(sb, hw.id, studentId);
      setSubmission(s);
      setQuestions(await getTestQuestions(sb, hw.id));
    } catch (e) {
      setError((e as Error).message ?? d.common.error);
    } finally {
      setStarting(false);
    }
  }

  const handleSubmit = useCallback(async (auto = false) => {
    if (!studentId || submitting) return;
    const answerList = Array.from(answers.values());
    if (!auto && answerList.length === 0) { setError("Ответьте хотя бы на один вопрос"); return; }
    setSubmitting(true);
    setError("");
    try {
      const result = await submitTest(sb, { homeworkId: hw.id, studentId, answers: answerList });
      setSubmission(result);
      await loadSubmittedAnswers(result.id);
    } catch (e) {
      setError((e as Error).message ?? d.common.error);
    } finally {
      setSubmitting(false);
    }
  }, [studentId, submitting, answers, hw.id, d.common.error, loadSubmittedAnswers]);

  if (loading) {
    return (
      <GlassCard className="p-8 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 size={18} className="animate-spin" />
        {d.common.loading}
      </GlassCard>
    );
  }

  // Already submitted → results
  if (isSubmitted && submission) {
    return <Results hw={hw} questions={questions} submission={submission} answers={submittedAnswers} locale={locale as Locale} />;
  }

  // Not started → start gate
  if (!isInProgress) {
    const durMin = hw.test_duration_seconds ? Math.round(hw.test_duration_seconds / 60) : null;
    return (
      <GlassCard className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
          <Play size={28} className="fill-violet-600" />
        </div>
        <p className="text-sm text-slate-500">
          {t.meta
            .replace("{q}", String(hw.test_submission ? questions.length : "?"))
            .replace("{min}", durMin ? String(durMin) : "—")}
        </p>
        <p className="mt-2 mb-5 text-xs text-slate-400 max-w-sm mx-auto">{t.startWarning}</p>
        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
        <button
          onClick={handleStart}
          disabled={starting || !studentId}
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-md transition disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)" }}
        >
          {starting ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
          {t.start}
        </button>
      </GlassCard>
    );
  }

  // In progress → timer + questions
  const endsAt = submission?.started_at && hw.test_duration_seconds
    ? new Date(submission.started_at).getTime() + hw.test_duration_seconds * 1000
    : null;

  return (
    <GlassCard className="p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-800">{d.nav.homework}</h2>
        {endsAt && <TestTimer endsAt={endsAt} onTimeout={() => handleSubmit(true)} label={t.timeLeft} />}
      </div>

      <div className="flex flex-col gap-6">
        {questions.map((q, idx) => (
          <div key={q.id}>
            <p className="mb-3 text-sm font-semibold text-slate-700">
              <span className="mr-1 text-slate-400">{idx + 1}.</span>
              {q.question_text}
            </p>
            {q.question_type === "single_choice" && (
              <fieldset className="flex flex-col gap-2">
                {q.options.slice().sort((a, b) => a.order_index - b.order_index).map((opt) => {
                  const selected = answers.get(q.id)?.selectedOptionId === opt.id;
                  return (
                    <label key={opt.id} className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all",
                      selected ? "border-blue-500 bg-blue-50 font-semibold text-blue-700" : "border-slate-200 bg-white/80 text-slate-600 hover:border-blue-300",
                    )}>
                      <input type="radio" name={`q-${q.id}`} value={opt.id} checked={selected}
                        onChange={() => setOption(q.id, opt.id)} className="sr-only" />
                      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2", selected ? "border-blue-500" : "border-slate-300")}>
                        {selected && <span className="h-2 w-2 rounded-full bg-blue-500" />}
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
        onClick={() => handleSubmit(false)}
        disabled={submitting}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-md transition disabled:opacity-60"
        style={{ background: "linear-gradient(135deg,#1D6FF5 0%,#0B3EDB 100%)" }}
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        {submitting ? d.homework.formSubmitting : t.finish}
      </button>
    </GlassCard>
  );
}
