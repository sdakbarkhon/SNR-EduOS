"use client";

import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-python";

type Lang = "python" | "cpp";

const MONO = "'JetBrains Mono','Fira Code','SF Mono',Monaco,Consolas,monospace";
const FS = 13;
const LH = 1.55;

function grammar(lang: Lang): Prism.Grammar {
  return (lang === "cpp" ? Prism.languages.cpp : Prism.languages.python) as Prism.Grammar;
}

// VSCode-dark token colors, scoped under .snr-code (avoids importing a global theme).
function TokenStyles() {
  return (
    <style>{`
      .snr-code .token.comment,.snr-code .token.prolog,.snr-code .token.doctype,.snr-code .token.cdata{color:#6a9955}
      .snr-code .token.punctuation{color:#d4d4d4}
      .snr-code .token.keyword,.snr-code .token.boolean{color:#569cd6}
      .snr-code .token.string,.snr-code .token.char,.snr-code .token.attr-value{color:#ce9178}
      .snr-code .token.number{color:#b5cea8}
      .snr-code .token.function{color:#dcdcaa}
      .snr-code .token.operator{color:#d4d4d4}
      .snr-code .token.builtin,.snr-code .token.class-name,.snr-code .token.macro{color:#4ec9b0}
      .snr-code .token.preprocessor,.snr-code .token.directive{color:#c586c0}
    `}</style>
  );
}

function Gutter({ count }: { count: number }) {
  return (
    <div
      aria-hidden
      className="select-none py-3 pl-3 pr-2 text-right"
      style={{ color: "#5a5a5a", fontFamily: MONO, fontSize: FS, lineHeight: LH, background: "#1a1a1a" }}
    >
      {Array.from({ length: count }, (_, i) => <div key={i}>{i + 1}</div>)}
    </div>
  );
}

export function CodeEditor({
  value, onChange, language, minHeight = 400,
}: {
  value: string;
  onChange: (v: string) => void;
  language: Lang;
  minHeight?: number;
}) {
  const lines = Math.max(1, value.split("\n").length);
  return (
    <div className="snr-code overflow-hidden rounded-xl border border-slate-700" style={{ background: "#1e1e1e" }}>
      <TokenStyles />
      <div className="flex" style={{ minHeight }}>
        <Gutter count={lines} />
        <Editor
          value={value}
          onValueChange={onChange}
          highlight={(code) => Prism.highlight(code, grammar(language), language)}
          padding={12}
          textareaClassName="focus:outline-none"
          style={{ fontFamily: MONO, fontSize: FS, lineHeight: LH, color: "#d4d4d4", flex: 1, minHeight }}
        />
      </div>
    </div>
  );
}

export function CodeViewer({
  value, language, minHeight = 0,
}: {
  value: string;
  language: Lang;
  minHeight?: number;
}) {
  const lines = Math.max(1, value.split("\n").length);
  const html = Prism.highlight(value || "", grammar(language), language);
  return (
    <div className="snr-code overflow-auto rounded-xl border border-slate-700" style={{ background: "#1e1e1e", minHeight }}>
      <TokenStyles />
      <div className="flex">
        <Gutter count={lines} />
        <pre className="flex-1 py-3 pr-3 pl-3" style={{ fontFamily: MONO, fontSize: FS, lineHeight: LH, color: "#d4d4d4", margin: 0 }}>
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </div>
    </div>
  );
}
