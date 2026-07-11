"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink } from "lucide-react";
import {
  getDictionary, getQuizQuestions, getStudentQuizAttempt, getQuizAttemptResults,
} from "@snr/core";
import type {
  Locale, LessonStageWithProgress, QuizQuestion, QuizAnswer, CodeSubmission,
} from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_CONFIG, DEFAULT_EXTERNAL_URLS, isExternalService } from "@/lib/external-services";
import { SlideViewer } from "@/components/lesson-stages/SlideViewer";

// Read-only review of a lesson stage after the lesson has completed —
// student-side equivalent of teacher/lessons/[id]/StageViewModal.tsx (not
// reused directly: that file is teacher-only — onEdit/live-scores don't
// apply here, and this shows the STUDENT's OWN past answers/code instead of
// just the stage's starter content).
export function StudentStageReviewModal({
  stage,
  studentId,
  onClose,
  lessonStatus,
}: {
  stage: LessonStageWithProgress;
  studentId: string;
  onClose: () => void;
  /** Always "completed" in practice (this modal only renders post-lesson) —
   *  passed explicitly rather than assumed, so SlideViewer can allow free
   *  slide navigation for review instead of the live-lesson teacher-only lock. */
  lessonStatus?: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dl = d.lesson;
  const db = createClient();

  const isQuizType = stage.content_type === "quiz_qia" || stage.content_type === "quiz_kahoot";
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [myAnswers, setMyAnswers] = useState<Map<string, QuizAnswer>>(new Map());
  const [loadingQuiz, setLoadingQuiz] = useState(isQuizType);

  useEffect(() => {
    if (!isQuizType) return;
    let cancelled = false;
    (async () => {
      try {
        const qs = await getQuizQuestions(db, stage.id);
        if (cancelled) return;
        setQuestions(qs);
        const attempt = await getStudentQuizAttempt(db, stage.id, studentId);
        if (!attempt || cancelled) return;
        const { answers } = await getQuizAttemptResults(db, attempt.id);
        if (cancelled) return;
        setMyAnswers(new Map(answers.map((a) => [a.question_id, a])));
      } catch { /* leave empty — rendered as "no data" below */ }
      finally { if (!cancelled) setLoadingQuiz(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.id, studentId]);

  const config = stage.config as { url?: string };
  const serviceMeta = isExternalService(stage.content_type) ? SERVICE_CONFIG[stage.content_type] : null;
  const serviceUrl = config?.url || (isExternalService(stage.content_type) ? DEFAULT_EXTERNAL_URLS[stage.content_type] : null);

  const codeSubmission = stage.progress?.submission_data as CodeSubmission | null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-[90vw] max-w-[1600px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {stage.stage_type === "task" ? dl.stageBadgeTask : dl.stageBadgeTheory}
            </p>
            <h2 className="truncate text-lg font-bold text-slate-900">{stage.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          {stage.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{stage.description}</p>
          )}

          {stage.slides && stage.slides.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <SlideViewer slides={stage.slides} canExport={false} onExportPptx={() => {}} lessonStatus={lessonStatus} />
            </div>
          )}

          {stage.content_type === "code" && (
            <div className="space-y-3">
              {stage.programming_language && (
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {stage.programming_language}
                </p>
              )}
              <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
                <code>{codeSubmission?.code || stage.starter_code || "—"}</code>
              </pre>
              {codeSubmission?.last_output && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {dl.code.output}
                  </p>
                  <pre className="overflow-x-auto rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                    {codeSubmission.last_output}
                  </pre>
                </div>
              )}
              {stage.expected_output && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {dl.code.expectedOutput}
                  </p>
                  <pre className="overflow-x-auto rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                    {stage.expected_output}
                  </pre>
                </div>
              )}
            </div>
          )}

          {serviceMeta && serviceUrl && (
            <a
              href={serviceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100"
            >
              <ExternalLink className="h-4 w-4" /> {serviceMeta.name}
            </a>
          )}

          {isQuizType && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{dl.quiz.test}</h3>
              {loadingQuiz ? (
                <p className="text-sm text-slate-400">…</p>
              ) : questions.length === 0 ? (
                <p className="text-sm text-slate-400">—</p>
              ) : (
                <ol className="space-y-3">
                  {questions.map((q, i) => {
                    const mine = myAnswers.get(q.id);
                    return (
                      <li key={q.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-800">{i + 1}. {q.question_text}</p>
                        <ul className="mt-2 space-y-1">
                          {q.options.map((opt, oi) => {
                            const isCorrectOpt = oi === q.correct_option_index;
                            const isMyPick = mine?.selected_option_index === oi;
                            return (
                              <li
                                key={oi}
                                className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                                  isCorrectOpt
                                    ? "bg-emerald-100 font-semibold text-emerald-800"
                                    : isMyPick
                                      ? "bg-red-100 font-semibold text-red-700"
                                      : "bg-white text-slate-600"
                                }`}
                              >
                                <span>{opt}</span>
                                {isMyPick && (
                                  <span className="ml-2 shrink-0 text-[11px] font-bold uppercase tracking-wide opacity-70">
                                    {dl.quiz.yourAnswer}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
