"use client";

// react-pdf + pdfjs-dist are heavy — code-split behind next/dynamic so pages
// that never show a PDF don't pay for it in the initial bundle (same pattern
// as CodeEditor.tsx's Monaco loading).
import dynamic from "next/dynamic";

export const PdfViewer = dynamic(
  () => import("./PdfViewerInner").then((m) => m.PdfViewerInner),
  {
    ssr: false,
    loading: () => <div className="flex h-full items-center justify-center bg-slate-100 text-slate-400">…</div>,
  },
);
