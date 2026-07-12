"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { LessonSlide } from "@snr/core";
import { SlideViewer } from "@/components/lesson-stages/SlideViewer";

// Read-only slide-presentation viewer for Knowledge Base "Материалы группы" —
// AI-generated presentation stages have no storage_path/link_url (their
// content is lesson_stages.slides jsonb, fetched via getMaterialSlides), so
// they can't go through FileViewerModal's url-based Pdf/image/office paths.
// Mirrors FileViewerModal's dark-backdrop shell for visual consistency.
export function SlidesViewerModal({
  slides,
  title,
  onClose,
}: {
  slides: LessonSlide[];
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-4xl flex-col">
        <div className="mb-3 flex items-center justify-between">
          <p className="truncate text-sm font-medium text-white">{title}</p>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SlideViewer
          slides={slides}
          isTeacher={false}
          lessonStatus="completed"
          canExport={false}
          onExportPptx={() => {}}
        />
      </div>
    </div>,
    document.body,
  );
}
