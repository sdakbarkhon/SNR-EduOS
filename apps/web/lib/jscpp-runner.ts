"use client";

// C++ runner used by code-runner.ts. JSCPP (github.com/felixhao28/JSCPP) is a
// pure-JS C++ interpreter — no compiler, no server round-trip. Lazy-imported
// so it never lands in the shared bundle, only the chunk for pages that
// actually run C++.

import type { RunResult } from "./pyodide";

const CPP_TIMEOUT_MS = 5000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let jscppPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getJscpp(): Promise<any> {
  if (!jscppPromise) {
    jscppPromise = import("JSCPP").then((m) => (m as { default?: unknown }).default ?? m);
  }
  return jscppPromise;
}

// JSCPP throws plain Error(message) for every failure — verified against its
// source (lib/rt.js raiseException, lib/launcher.js parse failure). These two
// patterns are the ones it produces specifically when a language/library
// feature was never implemented (missing #include, unimplemented operator) —
// as opposed to a genuine bug in the student's own code, which JSCPP also
// reports as a plain Error but with a different message shape.
const UNSUPPORTED_PATTERNS = [/^cannot find library:/i, /not implemented/i];

export function isUnsupportedCppFeatureError(message: string): boolean {
  return UNSUPPORTED_PATTERNS.some((p) => p.test(message));
}

export async function runCpp(code: string, stdin = ""): Promise<RunResult> {
  const JSCPP = await getJscpp();
  let stdout = "";
  try {
    // JSCPP's own maxTimeout is a wall-clock check the interpreter's run loop
    // makes between generator steps, so — unlike a Promise.race from the
    // outside — it reliably interrupts a synchronous `while(true){}` in the
    // student's C++ without needing the browser event loop to be free.
    JSCPP.run(code, stdin, {
      stdio: { write: (s: string) => { stdout += s; } },
      maxTimeout: CPP_TIMEOUT_MS,
    });
    return { stdout, stderr: "", error: null };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (raw === "Time limit exceeded.") {
      return { stdout, stderr: "", error: "timeout" };
    }
    // Parsing failures happen before main() ever runs — surface them the same
    // way Piston's compile-stage errors used to (error: "compile" + the
    // message in stderr) so the existing UI's dc.compileError branch, which
    // renders result.stderr as the compiler output, keeps working unchanged.
    if (/^ERROR: Parsing Failure/.test(raw)) {
      return { stdout: "", stderr: raw, error: "compile" };
    }
    return { stdout, stderr: "", error: raw };
  }
}
