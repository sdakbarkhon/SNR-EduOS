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
// ═══ 04.09.2026 — СЛОЙ ВО ВСЮ ШИРИНУ, А НЕ ОКНО ═══════════════════════════
//
// Было окно 90 % ширины с отступом, скруглением и затемнением по краям — на
// этапе со слайдами и кодом в нём тесно. Стало полотно от края до края:
// содержимому достаётся весь экран, шапка прижата сверху, закрытие — крестиком
// в углу.
//
// ПОЧЕМУ СЛОЙ, А НЕ ОТДЕЛЬНАЯ СТРАНИЦА. Отдельный адрес пришлось бы заново
// снабжать всем, чем живёт экран урока: подпиской на статус, активным этапом,
// перекличкой, поднятыми руками. Учитель ушёл бы со страницы урока и вернулся
// бы на неё заново — с потерей прокрутки и раскрытых врезок. Слой ничего этого
// не трогает: экран урока под ним живой, и закрытие возвращает ровно то, что
// было.
//
// ═══ КЛАВИША ВЫХОДА ═══════════════════════════════════════════════════════
//
// Своего обработчика Esc у слоя НЕТ, и это намеренно. Внутри может быть
// открыт полноэкранный показ слайдов, и у него Esc свой. Повесь мы второй —
// одно нажатие закрыло бы разом и показ, и слой, и учитель не понял бы, что
// произошло. Выход здесь один и явный: крестик.
//
// С выходом удержанием Esc из полноэкранного урока это не спорит вовсе:
// удержание включается только у УЧЕНИКА (SlideViewer: holdToExit = isFull &&
// lockedUntilStageEnds && !isTeacher), на учительском экране его нет.
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
      className="fixed inset-0"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      {/* Полотно во всю ширину и высоту. Щелчка по фону здесь нет намеренно:
          фона не осталось, а случайное касание края не должно закрывать то,
          что учитель показывает классу. */}
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-white">
        {/* Header */}
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-white px-6 py-4">
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
              title={d.common.close}
              aria-label={d.common.close}
              className="rounded-full border border-slate-200 p-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
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
