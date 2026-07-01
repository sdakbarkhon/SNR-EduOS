// pdfjs-dist's worker version must exactly match the installed package
// version (react-pdf enforces this). CDNs (cdnjs) lag behind fresh npm
// releases — the exact patch version we install may 404 there. Self-hosting
// from public/ removes the CDN dependency (and any lookup) entirely.
//
// Run standalone (`node scripts/copy-pdf-worker.js`) or required from
// next.config.mjs — either way it's synchronous and idempotent.
const fs = require("fs");
const path = require("path");

function copyPdfWorker() {
  const src = path.join(__dirname, "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
  const destDir = path.join(__dirname, "..", "public");
  const dest = path.join(destDir, "pdf.worker.min.mjs");

  if (!fs.existsSync(src)) {
    console.warn("[copy-pdf-worker] pdfjs-dist worker not found at", src, "— skipping");
    return;
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log("[copy-pdf-worker] copied pdf.worker.min.mjs -> apps/web/public/");
}

if (require.main === module) {
  copyPdfWorker();
} else {
  module.exports = { copyPdfWorker };
}
