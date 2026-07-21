"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, FileText, Download, ExternalLink } from "lucide-react";
import { getSubjectConfig, getGradeSubmissionDetail } from "@snr/core";
import type { Dictionary, StudentGradeItem, GradeSubmissionDetail } from "@snr/core";
import { SubjectIcon } from "@/components/SubjectIcon";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

function gradeColor(g5: number | null): string {
  if (g5 == null) return "text-slate-400";
  const pct = g5 / 5;
  if (pct >= 0.8) return "text-emerald-600";
  if (pct >= 0.5) return "text-amber-600";
  return "text-red-500";
}

export function GradeDetailModal({
  grade,
  locale,
  t,
  kindLabelText,
  kindBadgeClass,
  onClose,
}: {
  grade: StudentGradeItem;
  locale: string;
  t: Dictionary["grades"]["detailModal"];
  kindLabelText: string;
  kindBadgeClass: string;
  onClose: () => void;
}) {
  const cfg = getSubjectConfig(grade.subject);
  const category = grade.sourceTable === "homework_submissions" || grade.sourceTable === "test_submissions" || grade.sourceTable === "project_submissions"
    ? "assignment" as const
    : "lesson" as const;

  const [detail, setDetail] = useState<GradeSubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    const db = createClient();
    getGradeSubmissionDetail(db, grade.sourceTable, grade.id, grade.kind)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => {
        console.error("[GradeDetailModal] getGradeSubmissionDetail failed:", (e as Error)?.message ?? e);
        if (!cancelled) setDetail(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [grade.sourceTable, grade.id, grade.kind]);

  const hasTestResult = detail && (detail.testScore != null || detail.testMaxScore != null);
  const hasSubmission = detail && (detail.answerText || detail.codeText || detail.fileUrl);
  const hasExternalLink = detail && detail.externalLink;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <SubjectIcon subject={grade.subject} size={44} />
            <div>
              <p className="text-[15px] font-extrabold leading-tight text-slate-900">{grade.title}</p>
              <p className="text-[13px] font-semibold text-slate-400">{cfg.label}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex rounded-[9px] px-2.5 py-1 text-[11.5px] font-bold", kindBadgeClass)}>{kindLabelText}</span>
          <span className="inline-flex rounded-[9px] bg-slate-100 px-2.5 py-1 text-[11.5px] font-bold text-slate-500">
            {category === "assignment" ? t.typeAssignment : t.typeLesson}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.dateLabel}</p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {grade.date ? new Date(grade.date).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) : "—"}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.gradeLabel}</p>
            <p className={cn("mt-1 text-lg font-black", gradeColor(grade.grade5))}>{grade.display}</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-400">
            {t.loadingLabel}
          </div>
        ) : (
          <>
            {hasTestResult && (
              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.testResultLabel}</p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {detail?.testScore ?? "—"}/{detail?.testMaxScore ?? "—"}
                </p>
              </div>
            )}

            {category === "assignment" && !hasTestResult && (
              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3.5">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.submissionLabel}</p>
                {hasSubmission ? (
                  <div className="flex flex-col gap-2.5">
                    {detail?.answerText && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{detail.answerText}</p>
                    )}
                    {detail?.codeText && (
                      <pre className="max-h-64 overflow-auto rounded-xl bg-slate-900 p-3 text-[12.5px] leading-relaxed text-slate-100">
                        <code className="font-mono">{detail.codeText}</code>
                      </pre>
                    )}
                    {detail?.fileUrl && (
                      <a
                        href={detail.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-violet-600 transition-colors hover:border-violet-300"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">{detail.fileName ?? t.fileLabel}</span>
                        <Download className="ml-auto h-4 w-4 shrink-0" />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{t.noSubmission}</p>
                )}
              </div>
            )}

            {grade.kind === "external" && (
              <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3.5">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.externalLinkLabel}</p>
                {hasExternalLink ? (
                  <a
                    href={detail!.externalLink!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    <span className="truncate">{detail!.externalLink}</span>
                  </a>
                ) : (
                  <p className="text-sm text-slate-400">{t.noExternalLink}</p>
                )}
              </div>
            )}
          </>
        )}

        <div className="mt-3 rounded-2xl bg-violet-50/60 px-4 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-violet-400">{t.commentLabel}</p>
          <p className="mt-1.5 text-sm italic leading-relaxed text-slate-700">
            {grade.comment ? `«${grade.comment}»` : t.noComment}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          {t.closeBtn}
        </button>
      </div>
    </div>,
    document.body,
  );
}
