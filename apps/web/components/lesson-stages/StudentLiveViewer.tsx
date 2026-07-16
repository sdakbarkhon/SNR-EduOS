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
 *
 * Пачка 3, Задача 3 — `output` (опционально): результат последнего Run
 * учителя, транслируется отдельным broadcast-каналом (не postgres_changes —
 * см. CodeStageView.tsx). Панель "Вывод" скрыта, если output пустой/не задан.
 */
export function StudentLiveViewer({ code, language, output }: { code: string; language: CodeLanguage; output?: string }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dc = d.lesson.code;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-900">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-slate-900/95 px-6 py-3 backdrop-blur">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <span className="shrink-0 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-red-300">
          LIVE
        </span>
        <span className="truncate text-sm font-medium text-white">{d.lesson.live.title}</span>
        <span className="ml-auto shrink-0 text-xs text-white/50">{d.demo.onlyTeacherCanClose}</span>
      </div>
      <div className={`min-h-0 ${output ? "flex-[3]" : "flex-1"}`}>
        <CodeViewer value={code} language={language} height="100%" />
      </div>
      {output && (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 border-t border-white/10 bg-slate-950/60 px-6 py-3">
          <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-white/40">{dc.output}</span>
          <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap text-xs text-slate-100">{output}</pre>
        </div>
      )}
    </div>,
    document.body,
  );
}
