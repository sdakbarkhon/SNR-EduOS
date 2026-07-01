"use client";

// react-pdf + pdfjs-dist are heavy — code-split behind next/dynamic so
// students who never see a PDF demo don't pay for it in the initial bundle
// (same pattern as CodeEditor.tsx's Monaco loading).
import dynamic from "next/dynamic";

export const SyncedPdfViewer = dynamic(
  () => import("./SyncedPdfViewerInner").then((m) => m.SyncedPdfViewerInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-100 text-slate-400">
        …
      </div>
    ),
  },
);
