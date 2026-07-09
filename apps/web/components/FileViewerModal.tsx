"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { PdfViewer } from "@/components/PdfViewer";

// Shared in-app viewer for Knowledge Base files (Библиотека + Материалы
// группы, student and teacher sides) — routes by file type instead of
// downloading, matching the no-download policy for these two tabs.
// Mirrors the extension-detection approach of lib/material-kind.ts
// (checks both the display name and the resolved signed URL's path, since
// the display name/title alone often has no extension).

export type FileViewerKind = "pdf" | "image" | "office" | "text";

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

function TextPreview({ url }: { url: string }) {
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
    return <p className="p-8 text-sm text-white/70">Не удалось открыть этот файл для просмотра</p>;
  }
  if (text === null) {
    return <p className="p-8 text-sm text-white/60">Загрузка…</p>;
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
  const kind = resolveFileViewerKind(fileName || title, url);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex flex-col"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)" }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="truncate text-sm font-medium text-white">{title}</p>
        <button
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        {kind === "pdf" && <PdfViewer url={url} title={title} />}
        {kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={title} className="max-h-full max-w-full object-contain" />
        )}
        {kind === "office" && (
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
            title={title}
            className="h-full w-full border-0 bg-white"
          />
        )}
        {kind === "text" && <TextPreview url={url} />}
      </div>
    </div>,
    document.body,
  );
}
