"use client";

// Piston is a free, public, no-auth code execution API. We use it to compile +
// run C++ in the lesson code stages (no server-side runtime needed on our side).
// Docs: https://github.com/engineer-man/piston

import type { CodeLanguage } from "@snr/core";
import type { RunResult } from "./pyodide";
import { CODE_LANGUAGE_FILENAMES } from "./code-languages";

const PISTON_URL = "https://emkc.org/api/v2/piston/execute";

// Piston's own language slugs, keyed by our CodeLanguage (python/javascript/
// java match 1:1; c++ is Piston's slug for what we call "cpp").
const PISTON_LANGUAGE: Record<CodeLanguage, string> = {
  python: "python",
  javascript: "javascript",
  cpp: "c++",
  java: "java",
};

/** Runs any of the 4 supported languages via Piston (УЧ.10 Part 6 — homework
 *  "Запустить" button). Unlike runCpp (fixed version "10.2.0"), this uses
 *  version "*" (latest) for every language, per spec. */
export async function runCode(language: CodeLanguage, code: string, stdin = ""): Promise<RunResult> {
  try {
    const res = await fetch(PISTON_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: PISTON_LANGUAGE[language],
        version: "*",
        files: [{ name: CODE_LANGUAGE_FILENAMES[language], content: code }],
        stdin,
        compile_timeout: 10000,
        run_timeout: 5000,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { stdout: "", stderr: "", error: `Piston API ошибка ${res.status}: ${text.slice(0, 200)}`, exitCode: null };
    }

    const data = await res.json();

    if (data.compile && data.compile.code !== 0 && data.compile.stderr) {
      return { stdout: "", stderr: data.compile.stderr, error: "compile", exitCode: data.compile.code };
    }

    const run = data.run ?? {};
    return {
      stdout: run.stdout || "",
      stderr: run.stderr || "",
      error: run.code !== 0 && run.code != null ? `exit:${run.code}` : null,
      exitCode: run.code ?? null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { stdout: "", stderr: "", error: `net:${e?.message || e}`, exitCode: null };
  }
}

export async function runCpp(code: string, stdin = ""): Promise<RunResult> {
  try {
    const res = await fetch(PISTON_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "c++",
        version: "10.2.0",
        files: [{ name: "main.cpp", content: code }],
        stdin,
        compile_timeout: 10000,
        run_timeout: 5000,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { stdout: "", stderr: "", error: `Piston API ошибка ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = await res.json();

    // Compilation failure → surface compiler stderr.
    if (data.compile && data.compile.code !== 0 && data.compile.stderr) {
      return { stdout: "", stderr: data.compile.stderr, error: "compile" };
    }

    const run = data.run ?? {};
    return {
      stdout: run.stdout || "",
      stderr: run.stderr || "",
      error: run.code !== 0 && run.code != null ? `exit:${run.code}` : null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { stdout: "", stderr: "", error: `net:${e?.message || e}` };
  }
}
