"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown, ChevronUp, ExternalLink, Loader2, Check } from "lucide-react";
import { getDictionary, getStageSubmissions, gradeStageTask, getStageAttachmentUrl } from "@snr/core";
import type {
  Locale, LessonStage, LessonStageProgress, ExternalServiceConfig, ExternalServiceSubmission, ExternalServiceType,
} from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_CONFIG } from "@/lib/external-services";

type Row = LessonStageProgress & {
  student: { id: string; full_name: string; avatar_url: string | null };
};

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent",
  });
}

export function ExternalSubmissionsModal({
  stage, teacherId, onClose,
}: {
  stage: LessonStage;
  teacherId: string;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const dx = getDictionary(locale as Locale).lesson.external;
  const db = createClient();

  const service = stage.content_type as ExternalServiceType;
  const meta = SERVICE_CONFIG[service];

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  useEffect(() => {
    getStageSubmissions(db, stage.id)
      .then((data) => setRows((data as Row[]).filter((r) => r.submission_data != null)))
      .catch(() => null)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.id]);

  function applyGrade(studentId: string, grade: number, comment: string | null) {
    setRows((prev) => prev.map((r) =>
      r.student_id === studentId
        ? { ...r, grade, teacher_comment: comment, graded_at: new Date().toISOString(), graded_by: teacherId }
        : r,
    ));
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">{dx.reviewSubmissions}</h3>
            <p className="text-xs text-slate-400">{stage.title} · {meta.name}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-sm text-slate-400">{getDictionary(locale as Locale).lesson.code.loading}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-400">{dx.noSubmissions}</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <ExternalRow
                  key={row.student_id}
                  row={row}
                  expanded={expandedId === row.student_id}
                  onToggle={() => setExpandedId((id) => id === row.student_id ? null : row.student_id)}
                  onGraded={(g, c) => applyGrade(row.student_id, g, c)}
                  onZoom={setZoomUrl}
                  teacherId={teacherId}
                  stageId={stage.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Screenshot zoom overlay */}
      {zoomUrl && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={() => setZoomUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomUrl} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>,
    document.body,
  );
}

function ExternalRow({
  row, expanded, onToggle, onGraded, onZoom, teacherId, stageId,
}: {
  row: Row;
  expanded: boolean;
  onToggle: () => void;
  onGraded: (grade: number, comment: string | null) => void;
  onZoom: (url: string) => void;
  teacherId: string;
  stageId: string;
}) {
  const { locale } = useLocale();
  const dx = getDictionary(locale as Locale).lesson.external;
  const db = createClient();

  const sub = (row.submission_data ?? {}) as ExternalServiceSubmission;
  const [grade, setGrade] = useState<number | null>(row.grade);
  const [comment, setComment] = useState(row.teacher_comment ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shotUrl, setShotUrl] = useState<string | null>(null);

  useEffect(() => {
    if (expanded && sub.screenshot_path && !shotUrl) {
      getStageAttachmentUrl(db, sub.screenshot_path).then(setShotUrl).catch(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  async function handleSaveGrade() {
    if (grade == null) return;
    setSaving(true);
    try {
      await gradeStageTask(db, stageId, row.student_id, teacherId, grade, comment.trim() || null);
      onGraded(grade, comment.trim() || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch { /* noop */ } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
          {row.student.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{row.student.full_name}</p>
          <p className="text-[11px] text-slate-400">
            {dx.submittedAt}: {fmtDateTime(row.completed_at)} · {dx.openedAt}: {fmtDateTime(sub.last_opened_at)}
          </p>
        </div>
        {row.grade != null && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">{row.grade}/5</span>
        )}
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          {/* Link */}
          <div>
            <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{dx.studentLink}</h4>
            {sub.link ? (
              <a href={sub.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline">
                <ExternalLink className="h-4 w-4" /> {dx.openStudentProject}
              </a>
            ) : (
              <p className="text-sm text-slate-400">—</p>
            )}
          </div>

          {/* Screenshot */}
          {sub.screenshot_path && (
            <div>
              <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{dx.studentScreenshot}</h4>
              {shotUrl ? (
                <button onClick={() => onZoom(shotUrl)} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shotUrl} alt="" className="max-h-40 rounded-lg ring-1 ring-slate-200 transition-transform hover:scale-[1.02]" />
                </button>
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
              )}
            </div>
          )}

          {/* Grade */}
          <div className="rounded-xl border border-slate-100 bg-white p-3">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">{dx.gradeField}</label>
            <div className="mb-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((g) => (
                <button
                  key={g}
                  onClick={() => setGrade(g)}
                  className={`h-9 w-9 rounded-lg text-sm font-bold transition-all ${
                    grade === g ? "bg-blue-600 text-white shadow-md shadow-blue-500/25" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">{dx.commentField}</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="mb-3 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSaveGrade}
              disabled={grade == null || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
              {saved ? dx.gradeSaved : dx.saveGrade}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
