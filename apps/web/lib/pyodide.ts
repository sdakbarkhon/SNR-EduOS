"use client";

// Pyodide = CPython compiled to WebAssembly. Loaded lazily from the jsDelivr CDN
// on the student's FIRST code run (≈10 MB WASM, 5–15 s). Cached in-memory after,
// so subsequent runs are instant. We never bundle it — keeps the JS bundle small.

const PYODIDE_VERSION = "0.26.2";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodideInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodidePromise: Promise<any> | null = null;

/** True once Pyodide is loaded — lets the UI show a one-time loading hint. */
export function pyodideReady(): boolean {
  return pyodideInstance !== null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodidePromise) return pyodidePromise;

  pyodidePromise = (async () => {
    // Inject the loader script once.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).loadPyodide) {
      const script = document.createElement("script");
      script.src = `${PYODIDE_CDN}pyodide.js`;
      script.async = true;
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Pyodide script"));
        document.head.appendChild(script);
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pyodide = await (window as any).loadPyodide({
      indexURL: PYODIDE_CDN,
      stdout: () => {},
      stderr: () => {},
    });

    pyodideInstance = pyodide;
    return pyodide;
  })();

  return pyodidePromise;
}

export type RunResult = { stdout: string; stderr: string; error: string | null; exitCode?: number | null };

export async function runPython(code: string, stdin = ""): Promise<RunResult> {
  let pyodide;
  try {
    pyodide = await getPyodide();
  } catch (e) {
    // Reset the cached promise so a flaky network can be retried.
    pyodidePromise = null;
    return { stdout: "", stderr: "", error: `Не удалось загрузить Python: ${msg(e)}` };
  }

  let stdout = "";
  let stderr = "";
  pyodide.setStdout({ batched: (s: string) => { stdout += s + "\n"; } });
  pyodide.setStderr({ batched: (s: string) => { stderr += s + "\n"; } });

  // Feed stdin to input() line by line.
  if (stdin) {
    const lines = stdin.split("\n");
    pyodide.globals.set("__stdin_lines__", lines);
    pyodide.runPython(`
import builtins
__stdin_iter__ = iter(__stdin_lines__)
def input(prompt=""):
    try:
        return next(__stdin_iter__)
    except StopIteration:
        raise EOFError("EOF when reading a line")
builtins.input = input
`);
  } else {
    // Restore a sane input() that raises on read (no stdin provided).
    pyodide.runPython(`
import builtins
def input(prompt=""):
    raise EOFError("EOF when reading a line")
builtins.input = input
`);
  }

  try {
    await pyodide.runPythonAsync(code);
    return { stdout, stderr, error: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { stdout, stderr, error: e?.message || String(e) };
  }
}

function msg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
