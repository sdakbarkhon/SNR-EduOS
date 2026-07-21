"use client";

import type { LessonSlide } from "@snr/core";
import { SlideViewer } from "./SlideViewer";

// Грубая CSS-only оценка "всего остального" над презентацией на странице
// урока (LessonHeaderBar + паддинги/gap колонки) и высоты нижней панели
// навигации SlideViewer (кнопки + точки-индикаторы) — чтобы слайд вписался
// по высоте БЕЗ скролла страницы, без ResizeObserver/JS-измерений.
// SlideViewer сам держит 16:9 (aspect-video) для тела слайда — ограничивая
// max-width контейнера по этой же пропорции от доступной высоты, итоговая
// высота вписывается сама. overflow-y-auto на внешнем контейнере — safety
// net на случай, если оценка констант неточна (тогда скроллится локально
// сам блок презентации, а не вся страница).
const CHROME_ABOVE_PX = 230;
const NAV_PANEL_PX = 90;

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
  return (
    <div
      className="mx-auto w-full overflow-y-auto"
      style={{ maxHeight: `calc(100vh - ${CHROME_ABOVE_PX}px)` }}
    >
      <div
        className="mx-auto"
        style={{ maxWidth: `calc((100vh - ${CHROME_ABOVE_PX}px - ${NAV_PANEL_PX}px) * 16 / 9)` }}
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
    </div>
  );
}
