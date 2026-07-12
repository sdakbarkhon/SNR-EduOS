"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

pdfjs.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

/**
 * Plain, single-user PDF preview (rendered via pdf.js canvas, not a browser
 * <iframe>/<object> — Chrome's native PDF handler doesn't reliably activate
 * for iframed cross-origin signed URLs and instead shows its own download
 * fallback UI). No page-turn sync between clients — each viewer owns its own
 * page number locally.
 */
export function PdfViewerInner({ url, title }: { url: string; title?: string }) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).demo;
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageWidth, setPageWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth - 32;
        setPageWidth(Math.min(w, 1200));
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setPageNumber((p) => Math.max(1, p - 1));
      if (e.key === "ArrowRight") setPageNumber((p) => Math.min(numPages, p + 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [numPages]);

  return (
    <div ref={containerRef} className="flex h-full flex-col items-center bg-slate-100" aria-label={title}>
      <div className="flex flex-1 items-start justify-center overflow-auto py-4">
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={<div className="p-8 text-slate-500">{t.pdfLoading}</div>}
          error={<div className="p-8 text-red-500">{t.pdfLoadError}</div>}
        >
          <Page pageNumber={pageNumber} width={pageWidth} className="shadow-2xl" />
        </Document>
      </div>

      {numPages > 1 && (
        // shrink-0: страница с кнопками навигации не должна сжиматься на
        // короткой высоте модалки (планшет) — всегда видна внизу.
        <div className="flex w-full shrink-0 items-center justify-center gap-4 border-t border-slate-200 bg-white p-4">
          <button
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="rounded-lg bg-slate-200 p-2 hover:bg-slate-300 disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <span className="text-sm font-medium text-slate-700">
            {t.pdfPageOf.replace("{current}", String(pageNumber)).replace("{total}", String(numPages))}
          </span>

          <button
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            className="rounded-lg bg-violet-600 p-2 text-white hover:bg-violet-700 disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
