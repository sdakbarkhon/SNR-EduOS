"use client";

import { getDictionary } from "@snr/core";
import type { Locale, LessonSlide } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { SlideViewer } from "./SlideViewer";

/**
 * Крупное отображение активной презентации у ученика — раньше это был
 * fixed inset-0 z-[9999] portal, из которого нельзя было выйти (меню/выход
 * из урока были недоступны, пока учитель не переключит этап); теперь это
 * обычный блок в потоке страницы урока, просто крупнее стандартного
 * инлайн-показа slide (родитель — LessonWorkspaceView — рендерит его вместо
 * маленького SlideViewer, а не поверх страницы).
 *
 * Синхронный показ слайда НЕ меняется: SlideViewer сам подписан на
 * `stage-slide-${stageId}` (Realtime) и остаётся единственным смонтированным
 * инстансом — этот компонент лишь другая обёртка вокруг того же SlideViewer,
 * не второй его источник.
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

  return (
    <div className="rounded-2xl bg-slate-900 p-3 shadow-xl sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <span className="shrink-0 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-red-300">
          LIVE
        </span>
        <span className="truncate text-sm font-medium text-white">{d.lesson.slides.fullscreenTitle}</span>
      </div>
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
  );
}
