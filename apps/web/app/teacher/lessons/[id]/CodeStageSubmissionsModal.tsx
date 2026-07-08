"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown, ChevronUp, Play, Loader2, Check } from "lucide-react";
import { getDictionary, getStageSubmissions, gradeStageTask } from "@snr/core";
import type {
  Locale, LessonStage, LessonStageProgress, CodeStageConfig, CodeSubmission, CodeLanguage,
} from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { CodeViewer } from "@/components/CodeEditor";
import { runPython, pyodideReady, type RunResult } from "@/lib/pyodide";
import { runCode } from "@/lib/piston";
import { CODE_LANGUAGE_LABELS, isHtmlLanguage } from "@/lib/code-languages";

type Row = LessonStageProgress & {
  student: { id: string; full_name: string; avatar_url: string | null };
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent",
  });
}

export function CodeStageSubmissionsModal({
  stage, teacherId, onClose,
}: {
  stage: LessonStage;
  teacherId: string;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const dc = getDictionary(locale as Locale).lesson.code;
  const db = createClient();

  // migration 62 promoted this to a top-level column; config.language is only
  // a fallback for stages created before the migration (pre-existing bug fixed
  // here — this modal was reading only cfg.language, so isHtml/CodeViewer/
  // "Run here" all silently treated every non-legacy stage as Python).
  const cfg = (stage.config ?? {}) as Partial<CodeStageConfig>;
  const language: CodeLanguage = (stage.programming_language as CodeLanguage | null) ?? cfg.language ?? "python";

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
            <h3 className="text-base font-bold text-slate-900">{dc.reviewSubmissions}</h3>
            <p className="text-xs text-slate-400">{stage.title} · {CODE_LANGUAGE_LABELS[language]}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-sm text-slate-400">{dc.loading}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-400">{dc.noSubmissions}</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <SubmissionRow
                  key={row.student_id}
                  row={row}
                  language={language}
                  expanded={expandedId === row.student_id}
                  onToggle={() => setExpandedId((id) => id === row.student_id ? null : row.student_id)}
                  onGraded={(g, c) => applyGrade(row.student_id, g, c)}
                  teacherId={teacherId}
                  stageId={stage.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SubmissionRow({
  row, language, expanded, onToggle, onGraded, teacherId, stageId,
}: {
  row: Row;
  language: CodeLanguage;
  expanded: boolean;
  onToggle: () => void;
  onGraded: (grade: number, comment: string | null) => void;
  teacherId: string;
  stageId: string;
}) {
  const { locale } = useLocale();
  const dc = getDictionary(locale as Locale).lesson.code;
  const db = createClient();

  const sub = (row.submission_data ?? {}) as CodeSubmission;
  const [grade, setGrade] = useState<number | null>(row.grade);
  const [comment, setComment] = useState(row.teacher_comment ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Run-here (optional): re-execute the student's code with editable stdin.
  const [runStdin, setRunStdin] = useState(sub.stdin ?? "");
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const isHtml = isHtmlLanguage(language);

  async function handleRunHere() {
    // HTML/CSS never goes to Piston — show a live srcdoc preview instead.
    if (isHtml) {
      setHtmlPreview(sub.code ?? "");
      return;
    }
    setRunning(true);
    try {
      const r = language === "python" ? await runPython(sub.code ?? "", runStdin) : await runCode(language, sub.code ?? "", runStdin);
      setResult(r);
    } catch (e) {
      setResult({ stdout: "", stderr: "", error: String(e) });
    } finally {
      setRunning(false);
    }
  }

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

  const runLabel = running
    ? (language === "python" && !pyodideReady() ? dc.runFirst : language === "cpp" ? dc.runningCpp : dc.running)
    : dc.runHere;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Header row */}
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
          {row.student.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{row.student.full_name}</p>
          <p className="text-[11px] text-slate-400">{dc.submittedAt}: {fmtDateTime(row.completed_at)}</p>
        </div>
        {row.grade != null && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
            {row.grade}/5
          </span>
        )}
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          {/* Student code */}
          <div>
            <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{dc.studentCode}</h4>
            <CodeViewer value={sub.code ?? ""} language={language} minHeight={120} />
          </div>

          {/* Student stdin + output */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{dc.studentStdin}</h4>
              <pre className="max-h-28 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-[12px] text-slate-700">{sub.stdin || "—"}</pre>
            </div>
            <div>
              <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{dc.studentOutput}</h4>
              <pre className="max-h-28 overflow-auto rounded-xl p-3 font-mono text-[12px] text-slate-100" style={{ background: "#1a1a1a" }}>{sub.last_output || "—"}</pre>
            </div>
          </div>

          {/* Run here — html shows a live srcdoc preview instead of a stdin+
              stdout run, since Piston can't execute it (УЧ.11 Part 4). */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex flex-wrap items-end gap-3">
              {!isHtml && (
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">{dc.studentStdin}</label>
                  <textarea
                    value={runStdin}
                    onChange={(e) => setRunStdin(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] outline-none focus:border-blue-500"
                  />
                </div>
              )}
              <button
                onClick={handleRunHere}
                disabled={running}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {runLabel}
              </button>
            </div>
            {isHtml ? (
              htmlPreview != null && (
                <iframe
                  srcDoc={htmlPreview}
                  sandbox="allow-scripts"
                  title={dc.output}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white"
                  style={{ minHeight: 300 }}
                />
              )
            ) : (
              result && (
                <pre className="mt-2 max-h-32 overflow-auto rounded-lg p-3 font-mono text-[12px] text-slate-100" style={{ background: "#1a1a1a" }}>
                  {result.stdout}
                  {result.stderr && `\n[stderr]\n${result.stderr}`}
                  {result.error && `\n[${result.error}]`}
                  {!result.stdout && !result.stderr && !result.error && dc.emptyOutput}
                </pre>
              )
            )}
          </div>

          {/* Grade */}
          <div className="rounded-xl border border-slate-100 bg-white p-3">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">{dc.gradeField}</label>
            <div className="mb-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((g) => (
                <button
                  key={g}
                  onClick={() => setGrade(g)}
                  className={`h-9 w-9 rounded-lg text-sm font-bold transition-all ${
                    grade === g
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">{dc.commentField}</label>
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
              {saved ? dc.gradeSaved : dc.saveGrade}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
