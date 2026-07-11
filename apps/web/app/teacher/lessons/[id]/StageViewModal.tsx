"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Pencil, ExternalLink } from "lucide-react";
import { getDictionary, getQuizQuestions, getKahootLeaderboard, getMaterialDownloadUrl } from "@snr/core";
import type { Locale, LessonStage, LessonStatus, QuizQuestion, QuizLeaderboardEntry } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_CONFIG, DEFAULT_EXTERNAL_URLS, isExternalService } from "@/lib/external-services";
import { SlideViewer } from "@/components/lesson-stages/SlideViewer";
import { useIsDemoSession } from "@/lib/useIsDemoSession";

const LIVE_SCORES_POLL_MS = 12000;

// Read-only view of a lesson stage (БОЛЬШОЕ ОБНОВЛЕНИЕ §7.5). Opened by clicking
// a stage row; "Редактировать этап" switches the parent to edit mode (StageModal).
// For quiz_qia/quiz_kahoot stages, also polls live per-student scores while the
// lesson is in_progress (§7.7) — quiz_attempts/quiz_answers are shared by both
// content types, so getKahootLeaderboard works unmodified here despite its name.
export function StageViewModal({
  stage,
  lessonStatus,
  onClose,
  onEdit,
}: {
  stage: LessonStage;
  lessonStatus: LessonStatus;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dl = d.lesson;
  const db = createClient();
  const isDemoSession = useIsDemoSession();
  const editBlocked = isDemoSession && !stage.is_demo;

  const isQuizType = stage.content_type === "quiz_qia" || stage.content_type === "quiz_kahoot";
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loadingQuiz, setLoadingQuiz] = useState(isQuizType);
  const [scores, setScores] = useState<QuizLeaderboardEntry[]>([]);

  // БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 12 — teacher's own read-only preview previously
  // had no branch at all for a manually-uploaded .pptx (stage.slides is
  // only populated for AI-generated presentations), so the teacher never
  // saw their own uploaded file here. Same Office Online embed as the
  // student-facing LessonWorkspaceView.
  const presentationFile = (stage.config as { presentation_file?: { storagePath: string; filename: string } } | null)?.presentation_file ?? null;
  const [presentationUrl, setPresentationUrl] = useState<string | null>(null);
  const [presentationFailed, setPresentationFailed] = useState(false);

  useEffect(() => {
    if (!presentationFile) return;
    let cancelled = false;
    setPresentationUrl(null);
    setPresentationFailed(false);
    getMaterialDownloadUrl(db, presentationFile.storagePath, presentationFile.filename)
      .then((u) => { if (!cancelled) setPresentationUrl(u); })
      .catch(() => { if (!cancelled) setPresentationFailed(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationFile?.storagePath, presentationFile?.filename]);

  useEffect(() => {
    if (!isQuizType) return;
    let cancelled = false;
    getQuizQuestions(db, stage.id)
      .then((qs) => { if (!cancelled) setQuestions(qs); })
      .catch(() => null)
      .finally(() => { if (!cancelled) setLoadingQuiz(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.id]);

  useEffect(() => {
    if (!isQuizType || lessonStatus !== "in_progress") return;
    let cancelled = false;
    const load = () => getKahootLeaderboard(db, stage.id).then((rows) => { if (!cancelled) setScores(rows); }).catch(() => null);
    load();
    const id = setInterval(load, LIVE_SCORES_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.id, lessonStatus]);

  const config = stage.config as { url?: string };
  const serviceMeta = isExternalService(stage.content_type) ? SERVICE_CONFIG[stage.content_type] : null;
  // §9.1 — teacher's own read-only view falls back to the same default as
  // the student-facing ExternalStageModal when no custom URL was set.
  const serviceUrl = config?.url || (isExternalService(stage.content_type) ? DEFAULT_EXTERNAL_URLS[stage.content_type] : null);

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-[75vw] max-w-[1400px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ height: "80vh", maxHeight: 900 }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {stage.stage_type === "task" ? dl.stageBadgeTask : dl.stageBadgeTheory}
            </p>
            <h2 className="truncate text-lg font-bold text-slate-900">{stage.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {lessonStatus !== "completed" && (
              <button
                onClick={() => { if (editBlocked) return; onEdit(); }}
                disabled={editBlocked}
                title={editBlocked ? d.demoMode.cannotEditRealData : undefined}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-blue-600"
              >
                <Pencil className="h-4 w-4" /> {dl.stageEditModalTitle}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          {stage.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{stage.description}</p>
          )}

          {stage.slides && stage.slides.length > 0 && (
            <div className="h-[50vh] min-h-[360px] overflow-hidden rounded-xl border border-slate-100">
              <SlideViewer slides={stage.slides} canExport={false} onExportPptx={() => {}} />
            </div>
          )}

          {presentationFile && (
            presentationFailed ? (
              <div className="flex h-[50vh] min-h-[360px] items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-sm text-orange-700">
                {d.common.error}
              </div>
            ) : !presentationUrl ? (
              <div className="flex h-[50vh] min-h-[360px] items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-400">
                {d.common.loading}
              </div>
            ) : (
              <div className="h-[50vh] min-h-[360px] overflow-hidden rounded-xl border border-slate-100">
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(presentationUrl)}`}
                  title={presentationFile.filename}
                  className="h-full w-full border-0 bg-white"
                />
              </div>
            )
          )}

          {stage.content_type === "code" && (
            <div className="space-y-3">
              {stage.programming_language && (
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {stage.programming_language}
                </p>
              )}
              <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
                <code>{stage.starter_code || "—"}</code>
              </pre>
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
            <div className="space-y-2">
              <div className="h-[50vh] min-h-[360px] overflow-hidden rounded-xl border border-slate-100">
                <iframe
                  src={serviceUrl}
                  title={serviceMeta.name}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-presentation"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-full w-full border-0 bg-white"
                />
              </div>
              <a
                href={serviceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"
              >
                <ExternalLink className="h-4 w-4" /> {serviceMeta.name}
              </a>
            </div>
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
                  {questions.map((q, i) => (
                    <li key={q.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-800">{i + 1}. {q.question_text}</p>
                      <ul className="mt-2 space-y-1">
                        {q.options.map((opt, oi) => (
                          <li
                            key={oi}
                            className={`rounded-lg px-3 py-1.5 text-sm ${
                              oi === q.correct_option_index
                                ? "bg-emerald-100 font-semibold text-emerald-800"
                                : "bg-white text-slate-600"
                            }`}
                          >
                            {opt}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}

              {lessonStatus === "in_progress" && (
                <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-violet-700">{dl.liveScores.title}</h3>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-500">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" /> {dl.liveScores.updating}
                    </span>
                  </div>
                  {scores.length === 0 ? (
                    <p className="text-sm text-violet-400">{dl.liveScores.empty}</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-violet-500">
                          <th className="pb-2">{dl.liveScores.student}</th>
                          <th className="pb-2">{dl.liveScores.correct}</th>
                          <th className="pb-2">{dl.liveScores.grade}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-violet-100">
                        {scores.map((s) => (
                          <tr key={s.student_id}>
                            <td className="py-2 font-semibold text-slate-800">{s.full_name}</td>
                            <td className="py-2 text-slate-600">{s.correct_count}/{questions.length || "—"}</td>
                            <td className="py-2 font-bold text-violet-700">{s.total_score}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
