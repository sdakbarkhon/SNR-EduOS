"use client";

import { createPortal } from "react-dom";
import { getDictionary } from "@snr/core";
import type { Locale, LessonSlide } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { SlideViewer } from "./SlideViewer";

/**
 * Auto-fullscreen wrapper for the student's presentation slide view — Часть 2
 * (fullscreen презентации у ученика). Purely a layout/portal shell: the
 * parent (LessonWorkspaceView) decides WHEN this renders (derived from
 * activeStageId — same realtime-synced state that already drives
 * centerStages, no new subscription here), and this component renders the
 * SAME <SlideViewer> instance/props the inline path used, just portaled to
 * fullscreen. SlideViewer itself is untouched — its own Realtime slide-index
 * sync (`stage-slide-${stageId}`) keeps working exactly as before, since it's
 * still the one and only mounted instance (LessonWorkspaceView skips the
 * inline render while this is showing, see isPresentationFullscreen there).
 *
 * No close control, same as StudentLiveViewer/demoMaterialId fullscreen:
 * only the teacher activating a different stage (which flips
 * isPresentationFullscreen back to false) dismisses this.
 */
export function StudentPresentationViewer({
  slides, stageId, initialSlide, lessonStatus, onExportPptx,
}: {
  slides: LessonSlide[];
  stageId: string;
  initialSlide: number;
  lessonStatus: string;
  onExportPptx: () => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

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
        <span className="truncate text-sm font-medium text-white">{d.lesson.slides.fullscreenTitle}</span>
        <span className="ml-auto shrink-0 text-xs text-white/50">{d.demo.onlyTeacherCanClose}</span>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto p-4 sm:p-8">
        <div className="w-full max-w-6xl">
          <SlideViewer
            slides={slides}
            canExport
            onExportPptx={onExportPptx}
            isTeacher={false}
            stageId={stageId}
            initialSlide={initialSlide}
            lessonStatus={lessonStatus}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
