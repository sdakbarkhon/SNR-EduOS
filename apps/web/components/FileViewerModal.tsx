"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { PdfViewer } from "@/components/PdfViewer";

// Shared in-app viewer for Knowledge Base files (Библиотека + Материалы
// группы, student and teacher sides) — routes by file type instead of
// downloading, matching the no-download policy for these two tabs.
// Mirrors the extension-detection approach of lib/material-kind.ts
// (checks both the display name and the resolved signed URL's path, since
// the display name/title alone often has no extension).
//
// Пачка 3, Задача 4 — зум/панорамирование. Контейнер уже был fixed inset-0
// (полноэкранный) до этой задачи — добавлен только зум (Ctrl+Scroll/+/-/
// кнопки/100%) и drag-панорамирование при zoom>1. Реализация различается
// по типу:
//   - pdf: react-pdf's нативный `scale` проп (Page width×scale) — чётче
//     CSS-transform (canvas перерисовывается на реальном разрешении), плюс
//     у PdfViewerInner уже есть свой overflow-auto скролл-контейнер —
//     панорамирование зумленной страницы получаем бесплатно через него,
//     свой drag-handler сюда НЕ вешаем (не хотим конфликтовать с текстовым
//     выделением/навигацией по страницам внутри react-pdf).
//   - image / office (iframe): CSS transform: scale() + translate() на
//     обёртке — свой drag-pan (mousedown/move/up), т.к. у них нет
//     собственного скролла после transform.
//   - text: зум не применяется (не входит в "PDF/изображения/презентации"
//     из ТЗ) — тулбар зума для этого типа скрыт.

export type FileViewerKind = "pdf" | "image" | "office" | "text";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function extOf(s: string): string {
  return (s.split(".").pop() ?? "").toLowerCase();
}

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "avif"];
const OFFICE_EXTS = ["pptx", "docx", "ppt", "doc", "xlsx", "xls"];

export function resolveFileViewerKind(name: string, url?: string | null): FileViewerKind {
  const exts = [extOf(name)];
  if (url) {
    try { exts.push(extOf(new URL(url).pathname)); } catch { /* not absolute — ignore */ }
  }
  if (exts.includes("pdf")) return "pdf";
  if (exts.some((e) => IMAGE_EXTS.includes(e))) return "image";
  if (exts.some((e) => OFFICE_EXTS.includes(e))) return "office";
  return "text";
}

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function TextPreview({ url }: { url: string }) {
  const { locale } = useLocale();
  const dv = getDictionary(locale as Locale).viewer;
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
      .then((t) => { if (!cancelled) setText(t); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [url]);

  if (failed) {
    return <p className="p-8 text-sm text-white/70">{dv.loadFailed}</p>;
  }
  if (text === null) {
    return <p className="p-8 text-sm text-white/60">{dv.loading}</p>;
  }
  return (
    <pre className="h-full w-full overflow-auto whitespace-pre-wrap break-words bg-white p-6 text-sm text-slate-800">
      {text}
    </pre>
  );
}

export function FileViewerModal({
  url,
  title,
  fileName,
  onClose,
}: {
  url: string;
  title: string;
  fileName?: string | null;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const dv = getDictionary(locale as Locale).viewer;
  const kind = resolveFileViewerKind(fileName || title, url);
  const zoomable = kind !== "text";

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Новый файл — сбрасываем зум/пан, чтобы не унаследовать состояние
  // предыдущего просмотра.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [url]);

  const zoomIn = useCallback(() => setZoom((z) => clampZoom(z + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const next = clampZoom(z - ZOOM_STEP);
      if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);
  const resetZoom = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (!zoomable) return;
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomIn(); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomOut(); }
      else if (e.key === "0") { e.preventDefault(); resetZoom(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, zoomable, zoomIn, zoomOut, resetZoom]);

  // Ctrl+Scroll — зум (как в браузере). Обычный scroll не перехватывается,
  // чтобы не сломать внутреннюю прокрутку PDF/office-iframe.
  function handleWheel(e: React.WheelEvent) {
    if (!zoomable || !e.ctrlKey) return;
    e.preventDefault();
    if (e.deltaY < 0) zoomIn(); else zoomOut();
  }

  // Drag-панорамирование — только для image/office (у pdf свой скролл).
  const dragEnabled = zoomable && kind !== "pdf" && zoom > 1;

  function handleMouseDown(e: React.MouseEvent) {
    if (!dragEnabled) return;
    draggingRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    setIsDragging(true);
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!draggingRef.current) return;
    const d = draggingRef.current;
    setPan({ x: d.panX + (e.clientX - d.startX), y: d.panY + (e.clientY - d.startY) });
  }
  function endDrag() {
    draggingRef.current = null;
    setIsDragging(false);
  }

  if (typeof document === "undefined") return null;

  const transformStyle: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "center center",
    transition: draggingRef.current ? "none" : "transform 0.15s ease-out",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex flex-col"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)" }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">{title}</p>
        {zoomable && (
          <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 p-1">
            <button
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              aria-label={dv.zoomOut}
              title={dv.zoomOut}
              className="flex h-7 w-7 items-center justify-center rounded-md text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={resetZoom}
              aria-label={dv.resetZoom}
              title={dv.resetZoom}
              className="min-w-[3.5rem] rounded-md px-2 py-1 text-center text-xs font-bold text-white transition-colors hover:bg-white/20"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              aria-label={dv.zoomIn}
              title={dv.zoomIn}
              className="flex h-7 w-7 items-center justify-center rounded-md text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          onClick={onClose}
          aria-label={dv.close}
          title={dv.close}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        className="flex flex-1 items-center justify-center overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={dragEnabled ? { cursor: isDragging ? "grabbing" : "grab" } : undefined}
      >
        {kind === "pdf" && <PdfViewer url={url} title={title} scale={zoom} />}
        {kind === "image" && (
          <div style={transformStyle} className="pointer-events-none select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={title} className="max-h-[calc(100vh-4rem)] max-w-[calc(100vw-2rem)] object-contain" draggable={false} />
          </div>
        )}
        {kind === "office" && (
          <div style={{ ...transformStyle, width: "100%", height: "100%" }}>
            {/* pointer-events:none во время drag — иначе курсор "теряется" на
                границе iframe (мышь над iframe шлёт события в ЕГО документ,
                не родителю) и панорамирование обрывается на полпути. */}
            <iframe
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
              title={title}
              className="h-full w-full border-0 bg-white"
              style={isDragging ? { pointerEvents: "none" } : undefined}
            />
          </div>
        )}
        {kind === "text" && <TextPreview url={url} />}
      </div>
    </div>,
    document.body,
  );
}
