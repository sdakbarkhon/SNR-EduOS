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
 * PDF page synced across teacher/students during a live class demo. The
 * teacher drives (arrows, keyboard, click) via onPageChange; students only
 * ever receive `currentPage` as a prop and re-render — no controls at all.
 */
export function SyncedPdfViewerInner({
  url, isTeacher, currentPage, onPageChange,
}: {
  url: string;
  isTeacher: boolean;
  currentPage: number;
  onPageChange?: (page: number) => void;
}) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).demo;
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-fit page width to the container.
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

  // Keyboard navigation — teacher only.
  useEffect(() => {
    if (!isTeacher || !onPageChange) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && currentPage > 1) onPageChange(currentPage - 1);
      if (e.key === "ArrowRight" && currentPage < numPages) onPageChange(currentPage + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isTeacher, currentPage, numPages, onPageChange]);

  return (
    <div ref={containerRef} className="flex h-full flex-col items-center bg-slate-100">
      <div className="flex flex-1 items-start justify-center overflow-auto py-4">
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={<div className="p-8 text-slate-500">{t.loading}</div>}
          error={<div className="p-8 text-red-500">{t.loadError}</div>}
        >
          <Page pageNumber={currentPage} width={pageWidth} className="shadow-2xl" />
        </Document>
      </div>

      <div className="flex w-full items-center justify-center gap-4 border-t border-slate-200 bg-white p-4">
        {isTeacher && (
          <button
            onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="rounded-lg bg-slate-200 p-2 hover:bg-slate-300 disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        <span className="text-sm font-medium text-slate-700">
          {t.pageOf.replace("{current}", String(currentPage)).replace("{total}", String(numPages))}
        </span>

        {isTeacher && (
          <button
            onClick={() => onPageChange?.(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages}
            className="rounded-lg bg-violet-600 p-2 text-white hover:bg-violet-700 disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
