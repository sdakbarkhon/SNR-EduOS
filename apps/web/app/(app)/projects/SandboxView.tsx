"use client";

import { useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft, Play, Loader2, Trash2, AlertTriangle, ExternalLink,
} from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components";
import { SANDBOX_TOOLS, type SandboxTool, type SandboxToolId } from "@/lib/sandbox-tools";
import { getServicesForSubject, SUBJECT_SERVICE_MAP } from "@/lib/external-services";
import { CodeEditor } from "@/components/CodeEditor";
import { StdinInput } from "@/components/StdinInput";
import { runPython, pyodideReady, type RunResult } from "@/lib/pyodide";
import { runCpp } from "@/lib/piston";

// ── Fullscreen shell (no submit — pure sandbox) ────────────────────────────────
function SandboxFullscreen({
  title, backLabel, onClose, children,
}: {
  title: string;
  backLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", handler); document.body.style.overflow = prev; };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-slate-950">
      <div className="flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:px-6">
        <button
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-slate-700 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="hidden sm:inline">{backLabel}</span>
        </button>
        <h2 className="flex-1 truncate text-center text-sm font-medium text-slate-700 dark:text-slate-200">{title}</h2>
        <span className="w-[88px] shrink-0" />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>,
    document.body,
  );
}

// ── Iframe tool (geogebra/phet/desmos/blockly_games/visualgo/p5js/excalidraw/learningapps/sqlonline/wokwi/codesandbox) ───
function IframeSandbox({ tool, name }: { tool: SandboxTool; name: string }) {
  const { locale } = useLocale();
  const dx = getDictionary(locale as Locale).lesson.external;
  const url = tool.embedUrl ?? "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    const t = setTimeout(() => setState((s) => (s === "loading" ? "error" : s)), 30000);
    return () => clearTimeout(t);
  }, []);

  if (state === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-orange-500" />
        <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">{dx.loadError}</h4>
        <p className="max-w-md text-sm text-slate-500">{dx.loadErrorBody}</p>
        <button
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
        >
          <ExternalLink className="h-4 w-4" /> {dx.openInNewTab}
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden bg-slate-50 dark:bg-slate-900">
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      <iframe
        src={url}
        title={name}
        onLoad={() => setState("ok")}
        onError={() => setState("error")}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-presentation"
        allow="accelerometer; autoplay; camera; encrypted-media; fullscreen; gyroscope; microphone; clipboard-read; clipboard-write"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-full w-full border-none"
      />
    </div>
  );
}

// ── Code tool (Monaco + Python/C++ runner) ─────────────────────────────────────
type Lang = "python" | "cpp";

function CodeSandbox() {
  const { locale } = useLocale();
  const dc = getDictionary(locale as Locale).lesson.code;

  const [language, setLanguage] = useState<Lang>("python");
  const [code, setCode] = useState("");
  const [stdinValues, setStdinValues] = useState<string[]>([""]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);

  const stdin = stdinValues.join("\n");

  function errMessage(err: string): string {
    if (err === "compile") return dc.compileError;
    if (err.startsWith("exit:")) return `${dc.error} (exit ${err.slice(5)})`;
    if (err.startsWith("net:")) return `${dc.error}: ${err.slice(4)}`;
    return err;
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

  const runLabel = running
    ? (language === "python" && !pyodideReady() ? dc.runFirst : language === "cpp" ? dc.runningCpp : dc.running)
    : dc.run;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        {/* Language selector */}
        <div className="grid grid-cols-2 gap-3">
          {(["python", "cpp"] as Lang[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguage(lang)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 text-sm font-bold transition-all ${
                language === lang
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300"
              }`}
            >
              {lang === "python" ? dc.python : dc.cpp}
            </button>
          ))}
        </div>

        {/* Editor */}
        <CodeEditor value={code} onChange={setCode} language={language} minHeight={360} />

        {/* Stdin */}
        <section>
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">{dc.stdin}</h3>
          <StdinInput value={stdinValues} onChange={setStdinValues} />
        </section>

        {/* Run */}
        <button
          onClick={handleRun}
          disabled={running || !code.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {runLabel}
        </button>

        {/* Output */}
        <section>
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{dc.output}</h3>
            {result && (
              <button
                onClick={() => setResult(null)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-600"
              >
                <Trash2 className="h-3 w-3" /> {dc.clear}
              </button>
            )}
          </div>
          <div className="min-h-[120px] max-h-[260px] overflow-auto rounded-xl p-4 font-mono text-[13px] leading-relaxed" style={{ background: "#1a1a1a" }}>
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
  );
}

// ── Main sandbox grid ──────────────────────────────────────────────────────────
export function SandboxView({ initialToolId }: { initialToolId?: SandboxToolId } = {}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.sandbox;
  const [active, setActive] = useState<SandboxTool | null>(
    () => SANDBOX_TOOLS.find((tool) => tool.id === initialToolId) ?? null,
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const toolMeta = (id: SandboxToolId) => t.tools[id];

  // БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 5.4 — subject filter above the tool grid.
  // "code" (Python/C++ sandbox) counts as Программирование; "all" (default)
  // shows every tool, unchanged from before this filter existed.
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const subjectOptions = Object.keys(SUBJECT_SERVICE_MAP);
  const visibleTools = subjectFilter === "all"
    ? SANDBOX_TOOLS
    : SANDBOX_TOOLS.filter((tool) =>
        tool.id === "code" ? subjectFilter === "Программирование" : getServicesForSubject(subjectFilter).includes(tool.id),
      );

  return (
    <div>
      <p className="max-w-2xl text-sm text-slate-500">{t.subtitle}</p>

      <label className="mt-4 flex max-w-xs items-center gap-2 text-sm font-medium text-slate-600">
        {t.filterLabel}
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">{t.filterAll}</option>
          {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {visibleTools.map((tool) => {
          const meta = toolMeta(tool.id);
          return (
            <button
              key={tool.id}
              onClick={() => setActive(tool)}
              disabled={!mounted}
              className="group flex flex-col items-start gap-3 rounded-[20px] border border-white bg-white/70 p-5 text-left shadow-md backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-lg disabled:opacity-60"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tool.gradient} text-2xl shadow-sm`}>
                {tool.icon}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{meta.name}</h3>
                <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{meta.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Fullscreen tool runner */}
      {mounted && active && (
        <SandboxFullscreen
          title={toolMeta(active.id).name}
          backLabel={t.backToMenu}
          onClose={() => setActive(null)}
        >
          {active.kind === "code"
            ? <CodeSandbox />
            : <IframeSandbox tool={active} name={toolMeta(active.id).name} />}
        </SandboxFullscreen>
      )}
    </div>
  );
}
