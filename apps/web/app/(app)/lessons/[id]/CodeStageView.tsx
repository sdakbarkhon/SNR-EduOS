"use client";

import { useState } from "react";
import { Play, Save, Trash2, Loader2, Check } from "lucide-react";
import { getDictionary, submitStageTask } from "@snr/core";
import type {
  Locale, LessonStageWithProgress, CodeStageConfig, CodeSubmission, CodeLanguage, LessonStageProgress,
} from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { CodeEditor, CodeViewer } from "@/components/CodeEditor";
import { StdinInput } from "@/components/StdinInput";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { runPython, pyodideReady, type RunResult } from "@/lib/pyodide";
import { runCpp } from "@/lib/piston";

const GRADE_COLORS: Record<number, string> = {
  5: "bg-emerald-100 text-emerald-700 border-emerald-200",
  4: "bg-blue-100 text-blue-700 border-blue-200",
  3: "bg-yellow-100 text-yellow-700 border-yellow-200",
  2: "bg-orange-100 text-orange-700 border-orange-200",
  1: "bg-red-100 text-red-700 border-red-200",
};

/**
 * Monaco editor embedded directly in the stage card. Owns its full header
 * (title/description/actions on one row) instead of relying on the parent
 * card, so the editor gets the maximum vertical space below it.
 */
export function CodeStageView({
  stage, studentId, onSubmitted,
}: {
  stage: LessonStageWithProgress;
  studentId: string;
  onSubmitted: (progress: LessonStageProgress) => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dc = d.lesson.code;
  const w = d.lesson.workspace;
  const db = createClient();

  // migration 62 promoted these to top-level columns; config is a fallback
  // for stages created before the migration.
  const cfg = (stage.config ?? {}) as Partial<CodeStageConfig>;
  const language: CodeLanguage = (stage.programming_language as CodeLanguage | null) ?? cfg.language ?? "python";
  const starter = stage.starter_code ?? cfg.starter_code ?? "";

  const existingSub = (stage.progress?.submission_data ?? null) as CodeSubmission | null;
  const isSubmitted = !!stage.progress?.submission_data;
  const grade = stage.progress?.grade ?? null;
  const isGraded = grade != null;

  const [code, setCode] = useState(existingSub?.code ?? starter);
  // stdin is stored as a newline-joined string but edited as one value per cell.
  const [stdinValues, setStdinValues] = useState<string[]>(
    existingSub?.stdin ? existingSub.stdin.split("\n") : [""],
  );
  const stdin = stdinValues.join("\n");
  const [result, setResult] = useState<RunResult | null>(
    existingSub?.last_output ? { stdout: existingSub.last_output, stderr: "", error: null } : null,
  );
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const readOnly = isSubmitted;

  function errMessage(err: string): string {
    if (err === "compile") return dc.compileError;
    if (err.startsWith("exit:")) return `${dc.error} (exit ${err.slice(5)})`;
    if (err.startsWith("net:")) return `${dc.error}: ${err.slice(4)}`;
    return err; // raw Python traceback message
  }

  function resultToString(r: RunResult | null): string {
    if (!r) return "";
    let s = "";
    if (r.stdout) s += r.stdout;
    if (r.stderr) s += `\n[stderr]\n${r.stderr}`;
    if (r.error) s += `\n[${errMessage(r.error)}]`;
    return s.trim();
  }

  async function handleRun() {
    setRunning(true);
    try {
      const r = language === "python" ? await runPython(code, stdin) : await runCpp(code, stdin);
      setResult(r);
    } catch (e) {
      setResult({ stdout: "", stderr: "", error: String(e) });
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit() {
    // eslint-disable-next-line no-console
    console.log("[Submit] Clicked for stage:", stage.id);
    setConfirmOpen(false);
    setSubmitting(true);
    setSubmitError("");
    try {
      const submission: CodeSubmission = {
        code, stdin, last_output: resultToString(result), language,
      };
      const progress = await submitStageTask(db, stage.id, studentId, submission as unknown as Record<string, unknown>);
      onSubmitted(progress);
    } catch (e) {
      console.error("[Submit] error:", e);
      setSubmitError(w.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  const runLabel = running
    ? (language === "python" && !pyodideReady() ? dc.runFirst : language === "cpp" ? dc.runningCpp : dc.running)
    : dc.run;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header — one row: title/description | actions */}
      <div className="flex items-center gap-4 border-b border-slate-200 pb-3 dark:border-white/10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100" title={stage.title}>
              {stage.title}
            </h2>
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              {language === "python" ? dc.python : dc.cpp}
            </span>
          </div>
          {stage.description && (
            <p className="truncate text-sm text-slate-500 dark:text-slate-400" title={stage.description}>
              {stage.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {runLabel}
          </button>
          {readOnly ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3.5 py-1.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Check className="h-3.5 w-3.5" /> {w.submitted}
            </span>
          ) : (
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={submitting || running || !code.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-3.5 py-1.5 text-sm font-bold text-white shadow-md shadow-violet-500/25 transition-all hover:from-violet-700 hover:to-purple-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {w.submit}
            </button>
          )}
        </div>
      </div>

      {/* Grade / submitted banner — compact, only when relevant */}
      {isGraded ? (
        <div className={`shrink-0 rounded-xl border px-4 py-2 text-sm ${GRADE_COLORS[grade] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}>
          <span className="font-bold">{dc.graded}: {grade}/5</span>
          {stage.progress?.teacher_comment && (
            <span className="ml-2 opacity-90">— {stage.progress.teacher_comment}</span>
          )}
        </div>
      ) : isSubmitted ? (
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          <Check className="h-4 w-4" /> {dc.submittedWaiting}
        </div>
      ) : null}

      {/* Editor — fills remaining space */}
      <div className="min-h-0 flex-1">
        {readOnly
          ? <CodeViewer value={code} language={language} minHeight={300} />
          : <CodeEditor value={code} onChange={setCode} language={language} height="100%" />}
      </div>

      {/* Stdin */}
      <section className="shrink-0">
        <h3 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">{dc.stdin}</h3>
        <StdinInput value={stdinValues} onChange={setStdinValues} readOnly={readOnly} />
      </section>

      {/* Output */}
      {(result || submitError) && (
        <section className="shrink-0">
          {result && (
            <>
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{dc.output}</h3>
                <button
                  onClick={() => setResult(null)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-600"
                >
                  <Trash2 className="h-3 w-3" />
                  {dc.clear}
                </button>
              </div>
              <div
                className="max-h-[200px] overflow-auto rounded-lg p-3 font-mono text-sm leading-relaxed"
                style={{ background: "#1a1a1a" }}
              >
                {result.stdout && <pre className="whitespace-pre-wrap text-slate-100">{result.stdout}</pre>}
                {result.stderr && <pre className="whitespace-pre-wrap text-red-400">{result.stderr}</pre>}
                {result.error && <pre className="whitespace-pre-wrap text-orange-400">{errMessage(result.error)}</pre>}
                {!result.stdout && !result.stderr && !result.error && (
                  <span className="text-slate-500">{dc.emptyOutput}</span>
                )}
              </div>
            </>
          )}
          {submitError && (
            <p className="mt-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {submitError}
            </p>
          )}
        </section>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSubmit}
        title={dc.submit}
        message={dc.confirmSubmit}
        variant="warning"
        confirmText={dc.submit}
        cancelText={d.common.cancel}
      />
    </div>
  );
}
