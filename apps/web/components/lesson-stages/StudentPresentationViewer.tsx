"use client";

import type { LessonSlide } from "@snr/core";
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
 *
 * Занимает всю доступную ширину колонки (крупный слайд, без узких боковых
 * полей — раньше ширина была искусственно ограничена через 16:9-математику
 * от высоты, из-за чего слайд получался мелким). Высота ограничена
 * доступным пространством экрана (chromeAbovePx — сколько "остального" над
 * презентацией: шапка урока в обычном режиме, почти ничего в фокус-режиме,
 * см. LessonWorkspaceView.tsx); если контент всё же не влезает —
 * скроллится ЛОКАЛЬНО сам этот блок (overflow-y-auto), не вся страница.
 * Скроллбар скрыт визуально через существующий .scrollbar-hide (globals.css),
 * скролл при этом работает как обычно.
 */
export function StudentPresentationViewer({
  slides, stageId, initialSlide, lessonStatus, onExportPptx, chromeAbovePx,
}: {
  slides: LessonSlide[];
  stageId: string;
  initialSlide: number;
  lessonStatus: string;
  onExportPptx: () => void;
  chromeAbovePx: number;
}) {
  return (
    <div
      className="scrollbar-hide w-full overflow-y-auto"
      style={{ maxHeight: `calc(100vh - ${chromeAbovePx}px)` }}
    >
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
