"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";

/**
 * Edge-to-edge fullscreen shell for a task stage (code / external service).
 * Renders over the whole app (sidebar + topbar hidden) via a portal to <body>.
 * Layout: [← back] [title] [headerRight slot] + full-bleed content below.
 * ESC closes; body scroll is locked while open.
 */
export function FullscreenStageView({
  title,
  backLabel,
  onClose,
  headerRight,
  children,
}: {
  title: string;
  backLabel: string;
  onClose: () => void;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-slate-950">
      {/* Top bar */}
      <div className="flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:px-6">
        <button
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-slate-700 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="hidden sm:inline">{backLabel}</span>
        </button>

        <h2 className="flex-1 truncate text-center text-sm font-medium text-slate-700 dark:text-slate-200">
          {title}
        </h2>

        <div className="flex shrink-0 items-center justify-end">{headerRight}</div>
      </div>

      {/* Content fills the rest */}
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>,
    document.body,
  );
}
