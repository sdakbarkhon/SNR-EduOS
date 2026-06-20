"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Play, Send, Download, FileText, Construction, X, Loader2, Code2,
} from "lucide-react";
import {
  getDictionary, getSubjectStyle, submitProgrammingHomework, getHomeworkTestsUrl,
  type HomeworkWithSubmission, type Locale,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { GlassCard, SubjectIcon, useLocale } from "@/components";
import { CodeEditor } from "@/components/CodeEditor";

const DEFAULT: Record<"python" | "cpp", string> = {
  python: "def solve():\n    # Твой код здесь\n    pass\n\nsolve()",
  cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Твой код здесь\n    return 0;\n}",
};

export function ProgrammingIDE({ hw }: { hw: HomeworkWithSubmission }) {
  const router = useRouter();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.homework.programming;
  const sb = createClient();
  const style = getSubjectStyle(hw.group.subject);
  const lang = hw.programming_language ?? "python";

  const [studentId, setStudentId] = useState<string | null>(null);
  const [code, setCode] = useState<string>(hw.submission?.code_text ?? hw.starter_code ?? DEFAULT[lang]);
  const [output, setOutput] = useState("");
  const [runModal, setRunModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

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

  async function downloadTests() {
    if (!hw.tests_attachment_path) return;
    const name = hw.tests_attachment_filename ?? "tests";
    const url = await getHomeworkTestsUrl(sb, hw.tests_attachment_path, name).catch(() => null);
    if (url) window.open(url, "_blank");
  }

  const langLabel = lang === "python" ? "Python" : "C++";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
      <button onClick={() => router.back()} className="mb-5 flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-800">
        <ArrowLeft size={16} /> {d.common.back}
      </button>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* LEFT: condition */}
        <div className="space-y-4">
          <GlassCard className="p-5">
            <div className="flex items-start gap-4">
              <SubjectIcon subject={hw.group.subject} size={48} />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: style.color }}>
                    {style.label} · {hw.group.name}
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

          {hw.expected_output && (
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
              <button onClick={() => setRunModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                <Play size={13} className="fill-white" /> {t.run}
              </button>
              <button onClick={handleSubmit} disabled={submitting || !studentId}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm transition disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)" }}>
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {t.submit}
              </button>
            </div>
          </div>

          <CodeEditor value={code} onChange={setCode} language={lang} minHeight={400} />

          {/* Output panel */}
          <div className="rounded-xl border border-slate-700 bg-[#181818] p-3" style={{ minHeight: 160 }}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{t.output}</p>
            <pre className="text-[13px] text-slate-300" style={{ fontFamily: "'JetBrains Mono','Fira Code',Monaco,monospace", whiteSpace: "pre-wrap" }}>
              {output || <span className="text-slate-600">{t.outputEmpty}</span>}
            </pre>
          </div>
        </div>
      </div>

      {/* Run "coming soon" modal */}
      {runModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={() => setRunModal(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl" style={{ background: "#ffffff" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <Construction size={26} />
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-900">{t.runSoonTitle}</h3>
            <p className="mb-5 text-sm text-slate-500">{t.runSoonBody}</p>
            <button onClick={() => setRunModal(false)} className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-900">
              {t.understood}
            </button>
          </div>
        </div>
      )}

      {/* Sent toast */}
      {sent && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-[14px] bg-slate-800 px-4 py-3 text-[13px] font-medium text-white shadow-xl">
          <Send className="h-4 w-4 text-emerald-400" /> {t.sent}
        </div>
      )}
    </div>
  );
}
