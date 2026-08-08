"use client";

// Часть 5, StageMedia backfill (05.08.2026) — рендер AI-картинки этапа.
//
// 08.08.2026 — рендер mermaid-схем удалён. Генератор системно выдавал
// невалидный синтаксис, и mermaid при разборе САМ вставляет в DOM свою
// картинку с бомбой и надписью «Syntax error» — до того, как выбросит
// исключение. Наш catch прятал только собственный контейнер, бомба
// оставалась на экране у ученика. Убрано целиком, вместе с зависимостью.
// Подключается между заголовком этапа и его содержимым в StageViewModal,
// LessonWorkspaceView (ученик), TeacherLessonDetailView (учитель).
import { ImageOff, Loader2, RotateCcw } from "lucide-react";

export type StageMediaStatus = "pending" | "generated" | "failed" | null;

export type StageMediaProps = {
  image_url: string | null;
  media_status: StageMediaStatus;
  /** Кнопка "Перезапустить" при failed видна только учителю. Пока без
   *  обработчика (TODO) — по спеке backfill'а это просто заглушка кнопки. */
  isTeacher?: boolean;
  /** Момент постановки в очередь (миграция 168). Нужен, чтобы отличить этап,
   *  который РЕАЛЬНО генерируется прямо сейчас, от осиротевшего маркера
   *  media_status='pending' без записи в очередь — такой остался от
   *  прерванного backfill'а 06.08 и висел бы вечным «Генерируется...». */
  media_queued_at?: string | null;
};

export function StageMedia({ image_url, media_status, isTeacher, media_queued_at }: StageMediaProps) {
  if (media_status === "pending") {
    // Осиротевший маркер: статус pending, но в очередь этап так и не попал.
    // Такой остался в демо-школе от прерванного backfill'а (этап
    // «Практическая работа», Робототехника 7-А, 29.07 — то есть ровно
    // замороженный демо-день), и без этой проверки он показывал бы
    // «Генерируется...» вечно. Рендерим как «медиа нет» — ровно так же, как
    // 711 остальных этапов без медиа. Данные не трогаем: скрипт backfill'а
    // подхватит этот этап вместе с остальными 90, когда до них дойдут руки.
    if (!media_queued_at) return null;
    return (
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Генерируется...
      </div>
    );
  }

  if (media_status === "failed") {
    return (
      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
        <span className="flex items-center gap-2">
          <ImageOff className="h-4 w-4 shrink-0" />
          Изображение не сгенерилось
        </span>
        {isTeacher && (
          <button
            type="button"
            title="Перезапуск генерации медиа пока не подключён"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Перезапустить
          </button>
        )}
      </div>
    );
  }

  if (!image_url) return null;

  return (
    <div className="mb-3 flex flex-col gap-3">
      {image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image_url}
          alt=""
          className="mx-auto max-h-[400px] w-auto rounded-xl border border-slate-200 object-contain dark:border-slate-700"
        />
      )}
    </div>
  );
}
