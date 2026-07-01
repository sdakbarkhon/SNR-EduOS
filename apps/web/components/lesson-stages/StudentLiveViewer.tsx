"use client";

import { createPortal } from "react-dom";
import { getDictionary } from "@snr/core";
import type { Locale, CodeLanguage } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { CodeViewer } from "@/components/CodeEditor";

/**
 * Fullscreen read-only view of the teacher's live code. Purely presentational —
 * the parent (CodeStageView) owns the Realtime subscription on lesson_stages
 * and passes the current `code` down as a prop, so this component re-renders
 * with fresh content on every teacher keystroke without managing its own
 * fetch/subscription. No close control: only the teacher stopping live
 * (is_live_active → false, synced via Realtime) dismisses it.
 */
export function StudentLiveViewer({ code, language }: { code: string; language: CodeLanguage }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
      <div className="flex shrink-0 items-center gap-3 bg-black px-6 py-3 text-white">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" />
        <span className="truncate text-sm font-medium">{d.lesson.live.title}</span>
        <span className="ml-auto shrink-0 text-xs text-white/60">{d.demo.onlyTeacherCanClose}</span>
      </div>
      <div className="min-h-0 flex-1">
        <CodeViewer value={code} language={language} height="100%" />
      </div>
    </div>,
    document.body,
  );
}
