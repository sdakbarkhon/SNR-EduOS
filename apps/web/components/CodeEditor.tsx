"use client";

// Monaco-based code editor (Prompt 16). Replaces the previous Prism/textarea
// editor so Python/C++ behave like a real IDE: auto-indent after `:` / `{`,
// Tab = 4 spaces, bracket matching, auto-close, Ctrl+/ comment, Ctrl+F search.
//
// Monaco is heavy, so it is loaded lazily (dynamic import, ssr:false) and pulls
// its core from a CDN — the app bundle does not grow by ~2 MB.

import dynamic from "next/dynamic";
import type { EditorProps } from "@monaco-editor/react";

import type { CodeLanguage } from "@snr/core";

type Lang = CodeLanguage;

function Skeleton({ minHeight }: { minHeight: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-slate-700 text-sm text-slate-400"
      style={{ background: "#1e1e1e", minHeight }}
    >
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
        Загрузка редактора…
      </span>
    </div>
  );
}

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  { ssr: false, loading: () => <Skeleton minHeight={300} /> },
);

const BASE_OPTIONS: EditorProps["options"] = {
  minimap: { enabled: false },
  fontSize: 14,
  lineNumbers: "on",
  tabSize: 4,
  insertSpaces: true,
  automaticLayout: true,
  wordWrap: "on",
  scrollBeyondLastLine: false,
  renderWhitespace: "selection",
  fontFamily: "'JetBrains Mono','Fira Code','SF Mono',Monaco,Consolas,monospace",
  padding: { top: 10, bottom: 10 },
  smoothScrolling: true,
  matchBrackets: "always",
};

const MONACO_LANG: Record<Lang, string> = {
  python: "python",
  javascript: "javascript",
  cpp: "cpp",
  java: "java",
};

function monacoLang(lang: Lang): string {
  return MONACO_LANG[lang];
}

export function CodeEditor({
  value, onChange, language, minHeight = 400, height,
}: {
  value: string;
  onChange: (v: string) => void;
  language: Lang;
  minHeight?: number;
  /** Overrides minHeight — e.g. "100%" to fill a sized flex parent. */
  height?: number | string;
}) {
  return (
    <div className="h-full overflow-hidden rounded-xl border border-slate-700" style={{ background: "#1e1e1e" }}>
      <MonacoEditor
        height={height ?? minHeight}
        language={monacoLang(language)}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        theme="vs-dark"
        loading={<Skeleton minHeight={minHeight} />}
        options={BASE_OPTIONS}
      />
    </div>
  );
}

export function CodeViewer({
  value, language, minHeight = 0, height,
}: {
  value: string;
  language: Lang;
  minHeight?: number;
  /** Overrides minHeight — e.g. "100%" to fill a sized flex parent. */
  height?: number | string;
}) {
  const h = height ?? (minHeight || 240);
  return (
    <div className="h-full overflow-hidden rounded-xl border border-slate-700" style={{ background: "#1e1e1e" }}>
      <MonacoEditor
        height={h}
        language={monacoLang(language)}
        value={value}
        theme="vs-dark"
        loading={<Skeleton minHeight={typeof minHeight === "number" ? minHeight : 240} />}
        options={{ ...BASE_OPTIONS, readOnly: true, domReadOnly: true }}
      />
    </div>
  );
}
