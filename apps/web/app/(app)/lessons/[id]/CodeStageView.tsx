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
import { FullscreenStageView } from "./FullscreenStageView";
import { runPython, pyodideReady, type RunResult } from "@/lib/pyodide";
import { runCpp } from "@/lib/piston";

const GRADE_COLORS: Record<number, string> = {
  5: "bg-emerald-100 text-emerald-700 border-emerald-200",
  4: "bg-blue-100 text-blue-700 border-blue-200",
  3: "bg-yellow-100 text-yellow-700 border-yellow-200",
  2: "bg-orange-100 text-orange-700 border-orange-200",
  1: "bg-red-100 text-red-700 border-red-200",
};

export function CodeStageView({
  stage, studentId, onBack, onSubmitted,
}: {
  stage: LessonStageWithProgress;
  studentId: string;
  onBack: () => void;
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
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const submission: CodeSubmission = {
        code, stdin, last_output: resultToString(result), language,
      };
      const progress = await submitStageTask(db, stage.id, studentId, submission as unknown as Record<string, unknown>);
      onSubmitted(progress);
    } catch { /* noop */ } finally {
      setSubmitting(false);
    }
  }

  const runLabel = running
    ? (language === "python" && !pyodideReady() ? dc.runFirst : language === "cpp" ? dc.runningCpp : dc.running)
    : dc.run;

  const headerRight = readOnly ? (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
      <Check className="h-4 w-4" /> {w.submitted}
    </span>
  ) : (
    <button
      onClick={() => setConfirmOpen(true)}
      disabled={submitting || running || !code.trim()}
      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/25 transition-all hover:from-violet-700 hover:to-purple-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {w.submit}
    </button>
  );

  return (
    <FullscreenStageView title={stage.title} backLabel={w.backToLesson} onClose={onBack} headerRight={headerRight}>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
          {/* Language chip */}
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              {language === "python" ? dc.python : dc.cpp}
            </span>
          </div>

          {/* Grade banner */}
          {isGraded && (
            <div className={`rounded-2xl border px-5 py-3 ${GRADE_COLORS[grade] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}>
              <p className="text-sm font-bold">{dc.graded}: {grade}/5</p>
              {stage.progress?.teacher_comment && (
                <p className="mt-1 text-sm opacity-90">
                  <span className="font-semibold">{dc.teacherComment}:</span> {stage.progress.teacher_comment}
                </p>
              )}
            </div>
          )}

          {/* Submitted (not yet graded) banner */}
          {isSubmitted && !isGraded && (
            <div className="flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700">
              <Check className="h-4 w-4" />
              {dc.submittedWaiting}
            </div>
          )}

          {/* Problem statement */}
          {stage.description && (
            <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">{dc.problemStatement}</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{stage.description}</p>
            </section>
          )}

          {/* Editor */}
          <section>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">{dc.editorLabel}</h3>
            {readOnly
              ? <CodeViewer value={code} language={language} minHeight={300} />
              : <CodeEditor value={code} onChange={setCode} language={language} minHeight={400} />}
          </section>

          {/* Stdin */}
          <section>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">{dc.stdin}</h3>
            <StdinInput value={stdinValues} onChange={setStdinValues} readOnly={readOnly} />
          </section>

          {/* Run */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRun}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-60"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {runLabel}
            </button>
          </div>

          {/* Output */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{dc.output}</h3>
              {result && (
                <button
                  onClick={() => setResult(null)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-600"
                >
                  <Trash2 className="h-3 w-3" />
                  {dc.clear}
                </button>
              )}
            </div>
            <div
              className="min-h-[120px] max-h-[260px] overflow-auto rounded-xl p-4 font-mono text-[13px] leading-relaxed"
              style={{ background: "#1a1a1a" }}
            >
              {!result ? (
                <span className="text-slate-500">—</span>
              ) : (
                <>
                  {result.stdout && <pre className="whitespace-pre-wrap text-slate-100">{result.stdout}</pre>}
                  {result.stderr && <pre className="whitespace-pre-wrap text-red-400">{result.stderr}</pre>}
                  {result.error && <pre className="whitespace-pre-wrap text-orange-400">{errMessage(result.error)}</pre>}
                  {!result.stdout && !result.stderr && !result.error && (
                    <span className="text-slate-500">{dc.emptyOutput}</span>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </div>

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
    </FullscreenStageView>
  );
}
