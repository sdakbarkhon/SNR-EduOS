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
 * Ширина кадра — сколько поместится по высоте (chromeAbovePx — сколько
 * "остального" над презентацией: шапка урока в обычном режиме, почти ничего
 * в фокус-режиме, см. LessonWorkspaceView.tsx), с сохранением 16:9 —
 * SlideViewer сам вписывает кадр в calc(100vh - chromeAbovePx - navbar) и
 * уменьшает ширину, если ограничивает высота (см. SlideViewer.tsx). Раньше
 * ширина всегда была на всю колонку, высота считалась от неё через
 * aspect-ratio — на широких/невысоких вьюпортах кадр получался выше
 * доступного пространства и требовал скролла, чтобы увидеть слайд целиком.
 * Внешний maxHeight/overflow-y-auto ниже остаётся защитным запасом (на
 * случай очень нестандартных пропорций), но в норме уже не должен
 * срабатывать — кадр сам укладывается в бюджет высоты.
 */
export function StudentPresentationViewer({
  slides, stageId, initialSlide, lessonStatus, onExportPptx, chromeAbovePx, viewerOnly = false,
  locked = false,
}: {
  slides: LessonSlide[];
  stageId: string;
  initialSlide: number;
  lessonStatus: string;
  onExportPptx: () => void;
  chromeAbovePx: number;
  /** Большой фикс, Блок 3 — см. SlideViewer.tsx. */
  viewerOnly?: boolean;
  /** Выход только удержанием Esc, пока этап активен (07.08.2026). Считает
   *  родитель — см. LessonWorkspaceView.tsx, presentationLocked. */
  locked?: boolean;
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
        chromeAbovePx={chromeAbovePx}
        viewerOnly={viewerOnly}
        // 07.08.2026 — презентация этапа открывается сразу во весь экран.
        // Это возврат к тому, что было до 06.08, но уже С ВЫХОДОМ: Esc и
        // кнопка закрытия в SlideViewer. Именно отсутствие выхода было
        // причиной, по которой полноэкранный режим тогда убрали (см.
        // комментарий к компоненту выше) — теперь ученик не заперт.
        autoFullscreen
        // 07.08.2026, вторая правка того же дня — заказчик попросил, чтобы
        // ученик не выходил, пока идёт этап. Сделан «выход с усилием»
        // (удержать Esc), а НЕ полный запрет: полного запрета система не
        // выдерживает, признак «этап кончился» приходит только от нажатия
        // человека. Разбор — в комментарии к пропу в SlideViewer.tsx и в
        // resheniya_2.md. Не «доделывать до конца» — это вернёт ловушку,
        // из-за которой полноэкранный режим уже убирали.
        lockedUntilStageEnds={locked}
      />
    </div>
  );
}
