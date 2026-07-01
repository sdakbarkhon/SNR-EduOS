// pdfjs-dist's worker version must exactly match the installed package
// version (react-pdf enforces this). CDNs (cdnjs) lag behind fresh npm
// releases — the exact patch version we install may 404 there. Self-hosting
// from public/ removes the CDN dependency (and any lookup) entirely.
//
// Runs as "prebuild"/"predev" (see package.json) so the file lands in
// public/ BEFORE Next.js/Vercel collects static assets — a next.config.mjs
// side effect fires too late for Vercel's build pipeline (confirmed: the
// file was missing on Vercel even though it worked locally).
//
// Fails loudly (non-zero exit) if the worker can't be found anywhere,
// instead of silently skipping — a missing worker is a blank PDF viewer in
// production, which is much worse than a build that stops with a clear error.
const fs = require("fs");
const path = require("path");

function findWorkerSrc() {
  // require.resolve follows Node's real module resolution (correct
  // regardless of how pnpm hoists in a given environment) — try it first.
  try {
    return require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
  } catch { /* fall through to hardcoded candidates below */ }

  const candidates = [
    path.join(__dirname, "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"),
    path.join(__dirname, "..", "..", "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function copyPdfWorker() {
  const src = findWorkerSrc();
  if (!src) {
    console.error("[copy-pdf-worker] pdf.worker.min.mjs not found in node_modules — aborting build");
    process.exit(1);
  }

  const destDir = path.join(__dirname, "..", "public");
  const dest = path.join(destDir, "pdf.worker.min.mjs");
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[copy-pdf-worker] copied ${src} -> ${dest}`);
}

if (require.main === module) {
  copyPdfWorker();
} else {
  module.exports = { copyPdfWorker };
}
