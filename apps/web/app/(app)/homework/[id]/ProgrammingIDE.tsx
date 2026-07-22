"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Play, Send, Download, FileText, Loader2, Code2,
} from "lucide-react";
import {
  getDictionary, getSubjectStyle, submitProgrammingHomework, getHomeworkTestsUrl,
  homeworkSubmissionStatusKind,
  type HomeworkWithSubmission, type Locale,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { GlassCard, useLocale } from "@/components";
import { LessonSubjectIcon } from "@/components/LessonSubjectIcon";
import { CodeEditor, CodeViewer } from "@/components/CodeEditor";
import { CODE_LANGUAGE_LABELS, CODE_LANGUAGE_DEFAULT_SNIPPETS, isHtmlLanguage } from "@/lib/code-languages";
import { runCode, isUnsupportedCppFeatureError, type RunResult } from "@/lib/code-runner";
import { pyodideReady } from "@/lib/pyodide";

export function ProgrammingIDE({ hw }: { hw: HomeworkWithSubmission }) {
  const router = useRouter();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.homework.programming;
  const dc = d.lesson.code;
  const sb = createClient();
  // subject_id (migration 107) is the real subject; group.subject is a legacy
  // placeholder ("programming" for every group) — fall back to it only when
  // subject_id is null (pre-migration rows).
  const fallbackStyle = getSubjectStyle(hw.group.subject);
  const subjectLabel = hw.subjectName ?? fallbackStyle.label;
  const subjectColor = hw.subjectColor ?? fallbackStyle.color;
  const lang = hw.programming_language ?? "python";

  const [studentId, setStudentId] = useState<string | null>(null);
  const [code, setCode] = useState<string>(hw.submission?.code_text ?? hw.starter_code ?? CODE_LANGUAGE_DEFAULT_SNIPPETS[lang]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const isHtml = isHtmlLanguage(lang);

  useEffect(() => {
    sb.from("students").select("id").single().then(({ data, error }) => {
      if (!error && data) setStudentId(data.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dueLabel = hw.due_date
    ? new Date(hw.due_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tashkent" })
    : null;

  async function handleSubmit() {
    if (!studentId || submitting) return;
    setSubmitting(true);
    try {
      await submitProgrammingHomework(sb, hw.id, studentId, code);
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } finally {
      setSubmitting(false);
    }
  }

  function errMessage(err: string): string {
    if (err === "compile") return dc.compileError;
    if (err === "timeout") return dc.timeout;
    if (err.startsWith("exit:")) return `${dc.error} (exit ${err.slice(5)})`;
    if (err.startsWith("net:")) return `${dc.error}: ${err.slice(4)}`;
    if (isUnsupportedCppFeatureError(err)) return dc.cppUnsupported;
    return err;
  }

  async function downloadTests() {
    if (!hw.tests_attachment_path) return;
    const name = hw.tests_attachment_filename ?? "tests";
    const url = await getHomeworkTestsUrl(sb, hw.tests_attachment_path, name).catch(() => null);
    if (url) window.open(url, "_blank");
  }

  async function handleRun() {
    // HTML/CSS never goes through code-runner — it renders as a live srcdoc
    // iframe preview, refreshed on every click (УЧ.11 Part 4; runner
    // migration — see resheniya.md).
    if (isHtml) {
      setHtmlPreview(code);
      return;
    }
    setRunning(true);
    try {
      setResult(await runCode({ language: lang, code }));
    } finally {
      setRunning(false);
    }
  }

  const langLabel = CODE_LANGUAGE_LABELS[lang];
  const runLabel = running
    ? (lang === "python" && !pyodideReady() ? dc.runFirst : lang === "cpp" ? dc.runningCpp : t.running)
    : t.run;

  // Статус сдачи — раньше здесь не было НИЧЕГО (ни статуса, ни оценки, ни
  // комментария учителя), даже после того как задание уже оценено (задача
  // "Задания", Часть 2 — единственный тип ДЗ без этого блока).
  const statusKind = homeworkSubmissionStatusKind(hw.submission?.status);
  const statusLabel = statusKind === "graded" ? d.homework.gradedBadgeLabel
    : statusKind === "pending_review" ? d.homework.pendingReviewBadge
    : d.homework.notSubmittedBadge;
  const statusCls = statusKind === "graded" ? "bg-emerald-50 text-emerald-700"
    : statusKind === "pending_review" ? "bg-blue-50 text-blue-700"
    : "bg-slate-100 text-slate-500";
  // HomeworkHintPanel is fixed/z-40 — it already floats above normal-flow
  // content, so no padding reservation is needed: the editor column fills
  // the full width and the panel overlays its right edge.

  return (
    <div className="py-6">
      <button onClick={() => router.back()} className="mb-5 flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-800">
        <ArrowLeft size={16} /> {d.common.back}
      </button>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* LEFT: condition */}
        <div className="space-y-4">
          <GlassCard className="p-5">
            <div className="flex items-start gap-4">
              <LessonSubjectIcon icon={hw.subjectIcon ?? undefined} color={subjectColor} size={48} />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: subjectColor }}>
                    {subjectLabel} · {hw.group.name}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <Code2 size={11} /> {d.homework.typeProgramming}
                  </span>
                </div>
                <h1 className="mb-2 text-xl font-bold text-slate-800">{hw.title}</h1>
                {dueLabel && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-medium">{d.homework.detailDeadline}:</span> {dueLabel}
                  </div>
                )}
              </div>
            </div>
            {hw.description && (
              <p className="mt-4 whitespace-pre-wrap border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-700">
                {hw.description}
              </p>
            )}
          </GlassCard>

          <GlassCard className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
              {d.homework.detailYourSubmission}
            </p>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusCls}`}>
              {statusLabel}
            </span>
            {hw.submission?.submitted_at && (
              <div className="mt-2 text-xs text-slate-400">
                {d.homework.submittedOn.replace(
                  "{date}",
                  new Date(hw.submission.submitted_at).toLocaleDateString("ru-RU", {
                    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tashkent",
                  }),
                )}
              </div>
            )}
            {/* Отправленный код — read-only снимок именно того, что ушло
                учителю. Раньше сданный код только молча подставлялся в рабочий
                редактор справа (hw.submission.code_text в useState), и ученик
                не видел «вот что я отправил», особенно если потом правил
                редактор. Теперь это отдельный read-only блок. */}
            {hw.submission?.code_text && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  {d.homework.submittedCodeLabel}
                </p>
                <CodeViewer value={hw.submission.code_text} language={lang} minHeight={200} />
              </div>
            )}
            {hw.submission?.grade != null && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <span className="text-sm font-semibold text-slate-700">
                  {d.homework.grade}: {hw.submission.grade}
                </span>
              </div>
            )}
            {hw.submission?.teacher_comment && (
              <div className="mt-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
                <span className="font-medium">{d.homework.teacherComment}: </span>
                {hw.submission.teacher_comment}
              </div>
            )}
          </GlassCard>

          {hw.expected_output && !isHtml && (
            <GlassCard className="p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{t.expectedLabel}</p>
              <pre className="overflow-auto rounded-xl bg-[#1e1e1e] p-3 text-[13px] text-slate-100" style={{ fontFamily: "'JetBrains Mono','Fira Code',Monaco,monospace" }}>{hw.expected_output}</pre>
            </GlassCard>
          )}

          {hw.tests_attachment_path && (
            <GlassCard className="p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{t.testsFile}</p>
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/70 p-3">
                <FileText size={16} className="shrink-0 text-emerald-600" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{hw.tests_attachment_filename ?? "tests"}</p>
                <button onClick={downloadTests} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50">
                  <Download size={12} /> {t.download}
                </button>
              </div>
            </GlassCard>
          )}
        </div>

        {/* RIGHT: pseudo-IDE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Code2 size={16} className="text-emerald-600" /> {langLabel}
            </div>
            <div className="flex gap-2">
              <button onClick={handleRun} disabled={running}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60">
                {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="fill-white" />} {runLabel}
              </button>
              <button onClick={handleSubmit} disabled={submitting || !studentId}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm transition disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)" }}>
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {t.submit}
              </button>
            </div>
          </div>

          <CodeEditor value={code} onChange={setCode} language={lang} minHeight={400} />

          {/* Output panel — html renders a live srcdoc iframe preview instead
              of the stdout/stderr terminal (УЧ.11 Part 4). */}
          <div className="rounded-xl border border-slate-700 bg-[#181818] p-3" style={{ minHeight: 160 }}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{t.output}</p>
            {isHtml ? (
              htmlPreview != null ? (
                <iframe
                  srcDoc={htmlPreview}
                  sandbox="allow-scripts"
                  title={t.output}
                  className="w-full rounded-lg bg-white"
                  style={{ minHeight: 300, height: 300 }}
                />
              ) : (
                <p className="text-[13px] text-slate-600">{t.outputEmpty}</p>
              )
            ) : (
            <pre style={{ fontFamily: "'JetBrains Mono','Fira Code',Monaco,monospace", whiteSpace: "pre-wrap", fontSize: 13 }}>
              {!result && !running && <span className="text-slate-600">{t.outputEmpty}</span>}
              {running && <span className="text-slate-500">{runLabel}</span>}
              {result && (
                <>
                  {result.stdout && <span className="text-emerald-400">{result.stdout}</span>}
                  {result.stdout && result.stderr && "\n"}
                  {result.stderr && <span className="text-red-400">{result.stderr}</span>}
                  {result.error && (
                    <span className="text-red-400">{errMessage(result.error)}</span>
                  )}
                  {!result.stdout && !result.stderr && !result.error && (
                    <span className="text-slate-600">{t.outputEmpty}</span>
                  )}
                  {result.exitCode != null && (
                    <div className="mt-2 border-t border-slate-700 pt-2 text-slate-500">
                      {t.exitCode}: {result.exitCode}
                    </div>
                  )}
                </>
              )}
            </pre>
            )}
          </div>
        </div>
      </div>

      {/* Sent toast — same offsets as the AI button's speech bubble
          (bottom-40/md:bottom-24), not bottom-6: the button itself now sits
          at bottom-20/md:bottom-4 (h-14 = 56px tall), so a smaller offset
          would visually overlap it (УЧ.11 Part 1). */}
      {sent && (
        <div className="fixed bottom-40 right-6 z-50 flex items-center gap-2 rounded-[14px] bg-slate-800 px-4 py-3 text-[13px] font-medium text-white shadow-xl md:bottom-24">
          <Send className="h-4 w-4 text-emerald-400" /> {t.sent}
        </div>
      )}
    </div>
  );
}
