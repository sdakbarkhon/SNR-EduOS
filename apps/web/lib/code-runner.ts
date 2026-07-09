"use client";

// Single entry point for every "Запустить" button across the app (homework
// programming IDE, lesson code stages, teacher submission review, projects
// sandbox). Piston (emkc.org) went whitelist-only on 2026-02-15 and started
// returning 401 for every unauthenticated call — see resheniya.md for the
// migration writeup. Every language now runs entirely client-side:
//   - python     → Pyodide (CPython/WASM, lazy CDN load) — unchanged, this
//                  was already client-side before the migration.
//   - javascript → hard-sandboxed iframe (no allow-same-origin), eval'd,
//                  console.* captured via postMessage. See js-sandbox.ts.
//   - cpp        → JSCPP, a pure-JS C++ interpreter, lazy-imported. See
//                  jscpp-runner.ts.
//   - java       → no browser runtime was commissioned for this migration;
//                  returns a clear "not supported" result instead of
//                  silently failing against a dead endpoint.
//   - html       → still rendered directly as a live srcdoc iframe preview by
//                  the calling components — deliberately left untouched (see
//                  resheniya.md). The case below exists only so this switch
//                  is total over CodeLanguage; no call site actually reaches
//                  it, they all special-case isHtmlLanguage() first.

import type { CodeLanguage } from "@snr/core";
import type { RunResult } from "./pyodide";
import { runPython, pyodideReady } from "./pyodide";
import { runJavaScript } from "./js-sandbox";
import { runCpp, isUnsupportedCppFeatureError } from "./jscpp-runner";

export type { RunResult };
export { isUnsupportedCppFeatureError };

const PYTHON_TIMEOUT_MS = 10000;

// Best-effort only: if runPython's promise never settles because Pyodide is
// stuck in a hard synchronous loop (no I/O, nothing to yield on), this timer
// can't force it to stop — same caveat Python has always had before this
// migration. It works correctly for anything that eventually returns.
function withTimeout(promise: Promise<RunResult>, ms: number): Promise<RunResult> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ stdout: "", stderr: "", error: "timeout" });
    }, ms);
    promise.then((r) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    });
  });
}

export async function runCode({ language, code, stdin = "" }: {
  language: CodeLanguage;
  code: string;
  stdin?: string;
}): Promise<RunResult> {
  switch (language) {
    case "python":
      // The 10s timeout is for the student's code, not Pyodide's own one-time
      // environment load (documented at up to ~15s on lib/pyodide.ts) — racing
      // the two would time out almost every first run. Only arm it once
      // Pyodide is already warm.
      return pyodideReady() ? withTimeout(runPython(code, stdin), PYTHON_TIMEOUT_MS) : runPython(code, stdin);
    case "javascript":
      return runJavaScript(code);
    case "cpp":
      return runCpp(code, stdin);
    case "html":
      return { stdout: code, stderr: "", error: null };
    case "java":
      return { stdout: "", stderr: "", error: "Java пока не поддерживается в браузерном режиме." };
    default:
      return { stdout: "", stderr: "", error: `Неизвестный язык: ${language}` };
  }
}
