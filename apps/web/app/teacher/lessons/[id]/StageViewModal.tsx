"use client";

import { createPortal } from "react-dom";
import { X, Pencil } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale, LessonStage, LessonStatus } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { StageContentPreview } from "@/components/lesson-stages/StageContentPreview";

// Просмотр этапа во весь экран (БОЛЬШОЕ ОБНОВЛЕНИЕ §7.5). Открывается кликом по
// строке этапа; «Редактировать этап» переключает родителя в правку (StageModal).
//
// 18.08.2026 — тело окна переехало в components/lesson-stages/
// StageContentPreview.tsx. Причина: то же самое содержимое понадобилось
// показывать врезкой прямо в списке этапов, чтобы во время урока учитель не
// открывал по одному этапу окном поверх занятия. Две разметки на один и тот же
// показ разошлись бы через месяц, поэтому она одна, а окно осталось рамкой:
// шапка с названием, кнопка правки и закрытие. Ни одного блока содержимого
// здесь больше нет — и добавлять сюда нельзя, только в компонент.
export function StageViewModal({
  stage,
  lessonStatus,
  onClose,
  onEdit,
}: {
  stage: LessonStage;
  lessonStatus: LessonStatus;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dl = d.lesson;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-[90vw] max-w-[1600px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {stage.stage_type === "task" ? dl.stageBadgeTask : dl.stageBadgeTheory}
            </p>
            <h2 className="truncate text-lg font-bold text-slate-900">{stage.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {lessonStatus !== "completed" && (
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-blue-600"
              >
                <Pencil className="h-4 w-4" /> {dl.stageEditModalTitle}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <StageContentPreview stage={stage} lessonStatus={lessonStatus} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
