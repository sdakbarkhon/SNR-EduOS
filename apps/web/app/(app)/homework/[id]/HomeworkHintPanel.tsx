"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Image as ImageIcon, FileText, X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { getDictionary, getHomeworkHintUrl } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { PdfViewer } from "@/components/PdfViewer";

// БОЛЬШОЕ ОБНОВЛЕНИЕ §8.2 — подсказка учителя ПОСТОЯННО рядом с рабочей
// областью, не модалка. Sticky-панель справа (по решению из resheniya.md,
// "Этап 8"): всегда на виду, сворачивается в узкую полоску, изображение
// увеличивается кликом в полноэкранный просмотр.
export function HomeworkHintPanel({
  hintStoragePath,
  hintFilename,
  hintMimeType,
}: {
  hintStoragePath: string | null;
  hintFilename: string | null;
  hintMimeType: string | null;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.homework;

  const [url, setUrl] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    if (!hintStoragePath) return;
    let cancelled = false;
    getHomeworkHintUrl(createClient(), hintStoragePath)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [hintStoragePath]);

  if (!hintStoragePath) return null;

  const isImage = hintMimeType?.startsWith("image/") ?? false;
  const isPdf = hintMimeType === "application/pdf";

  return (
    <>
      {/* Collapsed tab */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          title={t.hintPanelTitle}
          className="fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-2xl border border-r-0 border-amber-200 bg-amber-50 px-2.5 py-4 shadow-lg transition hover:bg-amber-100"
        >
          <span className="flex flex-col items-center gap-2">
            {isImage ? <ImageIcon className="h-4 w-4 text-amber-600" /> : <FileText className="h-4 w-4 text-amber-600" />}
            <span className="text-[11px] font-bold uppercase tracking-wide text-amber-700" style={{ writingMode: "vertical-rl" }}>
              {t.hintPanelTitle}
            </span>
          </span>
        </button>
      )}

      {/* Sticky panel */}
      {!collapsed && (
        <div className="fixed right-4 top-1/2 z-40 hidden w-[300px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-xl lg:flex" style={{ maxHeight: "70vh" }}>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
              {isImage ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
              {t.hintPanelTitle}
            </span>
            <button
              onClick={() => setCollapsed(true)}
              title={t.hintPanelCollapse}
              className="rounded-lg p-1 text-amber-500 hover:bg-amber-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {!url ? (
              <div className="flex h-32 items-center justify-center text-xs text-slate-400">…</div>
            ) : isImage ? (
              <button onClick={() => setLightbox(true)} className="group relative block w-full overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={hintFilename ?? t.hintPanelTitle} className="w-full rounded-xl" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                  <ZoomIn className="h-6 w-6 text-white" />
                </span>
              </button>
            ) : isPdf ? (
              <button
                onClick={() => setLightbox(true)}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-amber-200 bg-amber-50/50 py-8 text-amber-700 transition hover:bg-amber-50"
              >
                <FileText className="h-8 w-8" />
                <span className="max-w-[220px] truncate text-xs font-semibold">{hintFilename ?? "PDF"}</span>
                <span className="text-[11px] text-amber-500">{t.hintPanelOpen}</span>
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && url && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={() => setLightbox(false)}
        >
          <button
            onClick={() => setLightbox(false)}
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div onClick={(e) => e.stopPropagation()} className="h-full max-h-[85vh] w-full max-w-4xl">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={hintFilename ?? t.hintPanelTitle} className="mx-auto h-full max-h-full w-auto object-contain" />
            ) : (
              <PdfViewer url={url} title={hintFilename ?? "PDF"} />
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* Collapse-restore chevron on the panel edge for mobile isn't offered — lg:hidden falls
          back to no panel below the lg breakpoint (adaptation pass is БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 10). */}
      {!collapsed && url && (
        <div className="mb-4 lg:hidden">
          {/* Compact inline card on small screens — panel doesn't fit, still "always visible" not a modal */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
              {isImage ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
              {t.hintPanelTitle}
            </p>
            {isImage ? (
              <button onClick={() => setLightbox(true)} className="block w-full overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={hintFilename ?? t.hintPanelTitle} className="w-full rounded-xl" />
              </button>
            ) : (
              <button
                onClick={() => setLightbox(true)}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-amber-300 bg-white px-4 py-3 text-amber-700"
              >
                <FileText className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{hintFilename ?? "PDF"}</span>
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
