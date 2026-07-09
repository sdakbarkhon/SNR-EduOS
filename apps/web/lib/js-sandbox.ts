"use client";

// JavaScript runner used by code-runner.ts. Runs student code inside an
// iframe with sandbox="allow-scripts" and deliberately NO allow-same-origin —
// that gives the frame a unique opaque origin with zero access to our DOM,
// cookies, or storage. console.* is intercepted inside the frame and shipped
// back via postMessage; if the frame never reports back (e.g. an infinite
// loop) the parent force-removes it after JS_TIMEOUT_MS.

import type { RunResult } from "./pyodide";

const JS_TIMEOUT_MS = 5000;

function buildSrcDoc(code: string): string {
  // JSON.stringify safely escapes the code for embedding as a JS string
  // literal (quotes, backslashes, newlines, unicode); the extra </script
  // replace stops the student's code from prematurely closing our wrapper
  // <script> tag if it contains that literal substring.
  const encodedCode = JSON.stringify(code).replace(/<\/script/gi, "<\\/script");
  return `<!DOCTYPE html><html><head></head><body><script>
(function () {
  var logs = [];
  var errs = [];
  function fmt(args) {
    var parts = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (typeof a === "string") { parts.push(a); continue; }
      try { parts.push(JSON.stringify(a)); } catch (e) { parts.push(String(a)); }
    }
    return parts.join(" ");
  }
  console.log = console.info = function () { logs.push(fmt(arguments)); };
  console.warn = function () { logs.push(fmt(arguments)); };
  console.error = function () { errs.push(fmt(arguments)); };
  var error = null;
  try {
    (0, eval)(${encodedCode});
  } catch (e) {
    error = (e && e.message) ? String(e.message) : String(e);
  }
  parent.postMessage({ __codeRunnerOutput: true, stdout: logs.join("\\n"), stderr: errs.join("\\n"), error: error }, "*");
})();
</script></body></html>`;
}

export function runJavaScript(code: string): Promise<RunResult> {
  return new Promise((resolve) => {
    let settled = false;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden;";

    function finish(result: RunResult) {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      iframe.remove();
      resolve(result);
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as { __codeRunnerOutput?: boolean; stdout?: string; stderr?: string; error?: string | null } | null;
      if (!data || !data.__codeRunnerOutput) return;
      finish({ stdout: data.stdout ?? "", stderr: data.stderr ?? "", error: data.error ?? null });
    }

    // Timer + listener are armed before the iframe is ever inserted, so a
    // frame that finishes instantly can never race past us unheard.
    const timer = setTimeout(() => finish({ stdout: "", stderr: "", error: "timeout" }), JS_TIMEOUT_MS);
    window.addEventListener("message", onMessage);

    iframe.srcdoc = buildSrcDoc(code);
    document.body.appendChild(iframe);
  });
}
