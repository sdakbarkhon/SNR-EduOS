"use client";

import { useEffect, useState } from "react";
import { Play, Send, Trash2, Check, FileCode2, Lightbulb } from "lucide-react";
import { getDictionary, submitStageTask } from "@snr/core";
import type {
  Locale, LessonStageWithProgress, CodeStageConfig, CodeSubmission, CodeLanguage, LessonStageProgress,
} from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import { CodeEditor, CodeViewer } from "@/components/CodeEditor";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { runPython, pyodideReady, type RunResult } from "@/lib/pyodide";
import { runCode } from "@/lib/piston";
import { useRealtimeChannel } from "@/lib/realtime";
import { StudentLiveViewer } from "@/components/lesson-stages/StudentLiveViewer";
import { StageActionButton } from "@/components/lesson-stages/StageActionButton";
import { CODE_LANGUAGE_FILENAMES, CODE_LANGUAGE_LABELS, isHtmlLanguage } from "@/lib/code-languages";

const GRADE_COLORS: Record<number, string> = {
  5: "bg-emerald-100 text-emerald-700 border-emerald-200",
  4: "bg-blue-100 text-blue-700 border-blue-200",
  3: "bg-yellow-100 text-yellow-700 border-yellow-200",
  2: "bg-orange-100 text-orange-700 border-orange-200",
  1: "bg-red-100 text-red-700 border-red-200",
};

const FILE_NAMES = CODE_LANGUAGE_FILENAMES;

/**
 * Monaco editor embedded directly in the stage card. Task info sits above an
 * editor+output grid; Очистить/Сдать live in the output header (Iter5 P7).
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
  const dl = d.lesson;
  const w = d.lesson.workspace;
  const db = createClient();
  const showToast = useToast();

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
  // stdin editing UI was removed from this view (Iter5 P7); the field stays
  // in the submission payload (empty unless a pre-P7 submission had it) so
  // CodeSubmission/handleRun/handleSubmit don't need signature changes.
  const [stdinValues] = useState<string[]>(
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
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const isHtml = isHtmlLanguage(language);

  const [isLive, setIsLive] = useState(!!stage.is_live_active);
  const [liveCode, setLiveCodeValue] = useState(stage.live_code ?? "");

  const readOnly = isSubmitted;

  const draftKey = `code-${stage.id}`;

  // Restore the student's own draft after mount (client-only — localStorage
  // isn't available during SSR, and reading it in the initializer would
  // desync server/client render output).
  useEffect(() => {
    if (isSubmitted) return;
    const saved = localStorage.getItem(draftKey);
    if (saved) setCode(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCodeChange(v: string) {
    setCode(v);
    if (!isSubmitted) localStorage.setItem(draftKey, v);
  }

  // Follow the teacher's live-coding broadcast for this stage via Realtime.
  useRealtimeChannel(
    `stage-live-${stage.id}`,
    "lesson_stages",
    `id=eq.${stage.id}`,
    (payload) => {
      const active = payload.new?.is_live_active;
      if (typeof active === "boolean") setIsLive(active);
      const lc = payload.new?.live_code;
      if (typeof lc === "string" || lc === null) setLiveCodeValue(lc ?? "");
    },
  );

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
    // HTML/CSS never goes to Piston/Pyodide — it renders as a live srcdoc
    // iframe preview, refreshed on every click (УЧ.11 Part 4).
    if (isHtml) {
      setHtmlPreview(code);
      return;
    }
    setRunning(true);
    try {
      const r = language === "python" ? await runPython(code, stdin) : await runCode(language, code, stdin);
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
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Task info strip */}
      <div className="flex shrink-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
          <FileCode2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100" title={stage.title}>
              {stage.title}
            </h2>
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              {CODE_LANGUAGE_LABELS[language]}
            </span>
          </div>
          {stage.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-400" title={stage.description}>
              {stage.description}
            </p>
          )}
        </div>
      </div>

      {/* Grade / submitted / error status — informational only, no actions here */}
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
      {submitError && (
        <p className="shrink-0 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {submitError}
        </p>
      )}

      {/* Editor + output grid */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {/* Left: editor + hint stub */}
        <div className="flex min-h-0 min-w-0 flex-[3] flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
            {/* Editor header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-4 dark:border-white/10">
              <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-1.5 dark:border-blue-500/20 dark:bg-blue-500/10">
                <FileCode2 className="h-4 w-4 text-blue-500 dark:text-blue-300" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{FILE_NAMES[language]}</span>
              </div>
              <StageActionButton
                variant="secondary"
                size="sm"
                icon={Play}
                loading={running}
                onClick={handleRun}
              >
                {runLabel}
              </StageActionButton>
            </div>
            {/* Editor body */}
            <div className="min-h-0 flex-1">
              {readOnly
                ? <CodeViewer value={code} language={language} minHeight={300} />
                : <CodeEditor value={code} onChange={handleCodeChange} language={language} height="100%" />}
            </div>
          </div>

          {/* Подсказка — stub only; real AI-hint logic lands in a future prompt */}
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-100 bg-gradient-to-br from-violet-50 to-pink-50 p-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Lightbulb className="h-5 w-5 shrink-0 text-violet-500" />
              <span className="truncate text-sm font-medium text-slate-700">{dl.needHelp}</span>
            </div>
            <StageActionButton
              variant="secondary"
              size="sm"
              onClick={() => showToast(dl.hintComingSoon)}
            >
              {dl.showHint}
            </StageActionButton>
          </div>
        </div>

        {/* Right: output terminal — widened for html so the srcdoc preview
            isn't cramped inside the usual 300px terminal sidebar. */}
        <div className={`flex w-full shrink-0 flex-col gap-2 ${isHtml ? "lg:w-[420px]" : "lg:w-[300px]"}`}>
          <div className="flex items-center justify-between gap-2 px-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{dc.output}</h3>
            <div className="flex shrink-0 items-center gap-2">
              {(result || htmlPreview) && (
                <button
                  onClick={() => { setResult(null); setHtmlPreview(null); }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <Trash2 className="h-3 w-3" />
                  {dc.clear}
                </button>
              )}
              {readOnly ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <Check className="h-3.5 w-3.5" /> {w.submitted}
                </span>
              ) : (
                <StageActionButton
                  size="sm"
                  icon={Send}
                  loading={submitting}
                  disabled={running || !code.trim()}
                  onClick={() => setConfirmOpen(true)}
                >
                  {w.submit}
                </StageActionButton>
              )}
            </div>
          </div>
          {isHtml ? (
            htmlPreview != null ? (
              <iframe
                srcDoc={htmlPreview}
                sandbox="allow-scripts"
                title={dc.output}
                className="min-h-[300px] w-full flex-1 rounded-2xl border border-slate-800 bg-white shadow-inner"
              />
            ) : (
              <div
                className="flex min-h-[180px] flex-1 items-center justify-center rounded-2xl border border-slate-800 p-4 font-mono text-sm leading-relaxed shadow-inner"
                style={{ background: "#1a1b26" }}
              >
                <span className="text-slate-500">{dc.emptyOutput}</span>
              </div>
            )
          ) : (
            <div
              className="min-h-[180px] flex-1 overflow-auto rounded-2xl border border-slate-800 p-4 font-mono text-sm leading-relaxed shadow-inner"
              style={{ background: "#1a1b26" }}
            >
              {result ? (
                <>
                  {result.stdout && <pre className="whitespace-pre-wrap text-slate-100">{result.stdout}</pre>}
                  {result.stderr && <pre className="whitespace-pre-wrap text-red-400">{result.stderr}</pre>}
                  {result.error && <pre className="whitespace-pre-wrap text-orange-400">{errMessage(result.error)}</pre>}
                  {!result.stdout && !result.stderr && !result.error && (
                    <span className="text-slate-500">{dc.emptyOutput}</span>
                  )}
                </>
              ) : (
                <span className="text-slate-500">{dc.emptyOutput}</span>
              )}
            </div>
          )}
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

      {isLive && <StudentLiveViewer code={liveCode} language={language} />}
    </div>
  );
}
