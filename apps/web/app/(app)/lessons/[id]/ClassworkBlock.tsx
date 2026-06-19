"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, TestTube2, BookOpen, Code2, Send, CheckCircle, Upload, Clock, Play } from "lucide-react";
import type { Classwork, ClassworkQuestion, ClassworkSubmission, ClassworkType } from "@snr/core";
import { getClasswork, getMyClassworkSubmission, submitClasswork, getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

const TYPE_ICONS: Record<ClassworkType, React.ReactNode> = {
  file:        <FileText className="w-4 h-4" />,
  test:        <TestTube2 className="w-4 h-4" />,
  learning:    <BookOpen className="w-4 h-4" />,
  programming: <Code2 className="w-4 h-4" />,
};

function TestTimer({ endsAt, onTimeout }: { endsAt: number; onTimeout: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, endsAt - Date.now()));
  const firedRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onTimeoutRef.current = onTimeout; });

  useEffect(() => {
    if (firedRef.current) return;
    if (endsAt <= Date.now()) {
      firedRef.current = true;
      onTimeoutRef.current();
      return;
    }
    const id = setInterval(() => {
      const r = Math.max(0, endsAt - Date.now());
      setRemaining(r);
      if (r <= 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(id);
        onTimeoutRef.current();
      }
    }, 500);
    return () => clearInterval(id);
  }, [endsAt]);

  if (remaining <= 0) return null;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const isUrgent = remaining < 60000;
  return (
    <div className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-xl ${
      isUrgent
        ? "bg-red-50 text-red-500 animate-pulse"
        : "bg-[var(--surface-2)] text-[var(--text-2)]"
    }`}>
      <Clock className="w-4 h-4" />
      {mins}:{String(secs).padStart(2, "0")}
    </div>
  );
}

type Props = {
  lessonId: string;
  studentId: string;
};

export function ClassworkBlock({ lessonId, studentId }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const db = createClient();

  const [classwork, setClasswork] = useState<Classwork | null | undefined>(undefined);
  const [submission, setSubmission] = useState<ClassworkSubmission | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [textAnswer, setTextAnswer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [testAnswers, setTestAnswers] = useState<(number | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Test gate + timer
  const [testStarted, setTestStarted] = useState(false);
  const [testStartTime, setTestStartTime] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cw = await getClasswork(db as never, lessonId);
        if (!mounted) return;
        setClasswork(cw);
        if (cw) {
          const sub = await getMyClassworkSubmission(db as never, cw.id);
          if (!mounted) return;
          setSubmission(sub);
          if (cw.work_type === "test") {
            setTestAnswers(new Array(cw.questions.length).fill(null));
            // Restore timer from localStorage if test has a duration and isn't submitted yet
            if (!sub && cw.duration_seconds) {
              const stored = localStorage.getItem(`test_start_${cw.id}`);
              if (stored) {
                setTestStarted(true);
                setTestStartTime(parseInt(stored, 10));
              }
            }
          }
        }
      } catch {
        if (mounted) setClasswork(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null;
  if (!classwork) return null;

  const typeLabel: Record<ClassworkType, string> = {
    file: d.classwork.typeFile,
    test: d.classwork.typeTest,
    learning: d.classwork.typeLearning,
    programming: d.classwork.typeProgramming,
  };

  async function handleSubmit() {
    if (!classwork) return;
    setSubmitting(true);
    setError("");
    try {
      const filteredTestAnswers =
        classwork.work_type === "test" ? testAnswers.map((a) => a ?? -1) : null;
      await submitClasswork(db as never, {
        classworkId: classwork.id,
        studentId,
        textAnswer: classwork.work_type !== "test" ? textAnswer || null : null,
        file: classwork.work_type === "file" ? file : null,
        testAnswers: filteredTestAnswers,
        questions: classwork.work_type === "test" ? classwork.questions : undefined,
      });
      localStorage.removeItem(`test_start_${classwork.id}`);
      const sub = await getMyClassworkSubmission(db as never, classwork.id);
      setSubmission(sub);
    } catch {
      setError(d.classwork.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  function handleStartTest() {
    const now = Date.now();
    localStorage.setItem(`test_start_${classwork!.id}`, String(now));
    setTestStartTime(now);
    setTestStarted(true);
  }

  const testEndsAt =
    testStartTime && classwork.duration_seconds
      ? testStartTime + classwork.duration_seconds * 1000
      : null;

  return (
    <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
              {TYPE_ICONS[classwork.work_type]}
              {typeLabel[classwork.work_type]}
            </span>
          </div>
          <h3 className="text-base font-semibold text-[var(--text-1)]">{classwork.title}</h3>
          {classwork.description && (
            <p className="text-sm text-[var(--text-2)] mt-1">{classwork.description}</p>
          )}
        </div>
        {submission && submission.grade != null && (
          <div className="flex-shrink-0 flex flex-col items-center">
            <span className="text-2xl font-bold text-[var(--accent)]">{submission.grade}</span>
            <span className="text-xs text-[var(--text-3)]">/5</span>
          </div>
        )}
      </div>

      {submission ? (
        /* Already submitted */
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-500 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            {d.classwork.submittedTitle}
          </div>

          {submission.test_score != null && (
            <p className="text-sm text-[var(--text-2)]">
              {d.classwork.testScore
                .replace("{score}", String(submission.test_score))
                .replace("{max}", String(submission.test_max ?? "?"))}
            </p>
          )}

          {submission.text_answer && (
            <div className="text-sm text-[var(--text-2)] bg-[var(--surface-2)] rounded-xl p-3">
              {submission.text_answer}
            </div>
          )}

          {submission.grade != null && (
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3">
              <p className="text-sm font-medium text-green-500 mb-1">
                {d.classwork.yourGrade}: {submission.grade}/5
              </p>
              {submission.teacher_comment && (
                <p className="text-sm text-[var(--text-2)]">{submission.teacher_comment}</p>
              )}
            </div>
          )}
        </div>
      ) : classwork.work_type === "test" ? (
        testStarted ? (
          /* Test form (shown after "Start test" is clicked) */
          <div className="space-y-4">
            {testEndsAt && (
              <div className="flex items-center justify-between">
                <TestTimer endsAt={testEndsAt} onTimeout={handleSubmit} />
                <span className="text-xs text-[var(--text-3)]">
                  {classwork.questions.length} вопросов
                </span>
              </div>
            )}

            {classwork.questions.map((q: ClassworkQuestion, qi: number) => (
              <div key={q.id} className="space-y-2">
                <p className="text-sm font-medium text-[var(--text-1)]">
                  {qi + 1}. {q.question_text}
                </p>
                <div className="space-y-1.5">
                  {q.options.map((opt: string, oi: number) => (
                    <button
                      key={oi}
                      onClick={() => setTestAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))}
                      className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm transition-colors ${
                        testAnswers[qi] === oi
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--text-3)]"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          testAnswers[qi] === oi
                            ? "border-[var(--accent)] bg-[var(--accent)]"
                            : "border-current"
                        }`}
                      >
                        {testAnswers[qi] === oi && <span className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting || testAnswers.some((a) => a === null)}
              className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><Send className="w-4 h-4" />{d.classwork.testComplete}</>
              )}
            </button>
          </div>
        ) : (
          /* Start test gate */
          <div className="text-center py-6 space-y-3">
            <p className="text-sm font-medium text-[var(--text-1)]">Готов начать тест?</p>
            {classwork.duration_seconds && (
              <p className="text-xs text-[var(--text-3)]">
                Время: {Math.round(classwork.duration_seconds / 60)} мин · {classwork.questions.length} вопросов
              </p>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              onClick={handleStartTest}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Play className="w-4 h-4 fill-white" />
              Начать тест
            </button>
          </div>
        )
      ) : (
        /* File / text / learning / programming form */
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">
              {d.classwork.textAnswerLabel}
            </label>
            <textarea
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              placeholder={d.classwork.textAnswerPlaceholder}
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-1)] text-sm resize-none focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {classwork.work_type === "file" && (
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-2)] mb-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                {d.classwork.attachFileLabel}
              </label>
              <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--text-3)] cursor-pointer hover:border-[var(--accent)] transition-colors">
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                {file ? file.name : "…"}
              </label>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting || (!textAnswer.trim() && !file)}
            className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Send className="w-4 h-4" />{d.classwork.submitBtn}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
