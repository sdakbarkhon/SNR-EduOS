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
//
// 22.08.2026 — КНОПКА «ПЕРЕЗАПУСТИТЬ» ПОДКЛЮЧЕНА. До этого дня она была
// нарисована, но обработчика не имела, и подсказка честно об этом
// предупреждала. Подключена, а не убрана, по простой причине: это
// единственный способ вернуться к этапу, у которого генерация не удалась.
// Страховочного крона в проекте нет (снят 08.08), а обработчик пропускает
// уже обработанный этап — то есть без кнопки «не сгенерилось» означало бы
// «навсегда».
//
// Права. Кнопка рисуется только учителю (isTeacher), но настоящая проверка
// не здесь: маршрут /api/stage-media/generate требует учительскую сессию и
// спрашивает у базы teacher_can_write_lesson — то есть ведёт ли этот учитель
// именно этот урок. Спрятанная кнопка ничего не защищает, защищает маршрут.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageOff, Loader2, RotateCcw } from "lucide-react";

export type StageMediaStatus = "pending" | "generated" | "failed" | null;

export type StageMediaProps = {
  image_url: string | null;
  media_status: StageMediaStatus;
  /** Кнопка «Перезапустить» при failed видна только учителю. */
  isTeacher?: boolean;
  /** Нужен кнопке перезапуска. Без него кнопка не рисуется вовсе — дёргать
   *  маршрут не с чем. */
  stageId?: string;
  /** Момент постановки в очередь (миграция 168). Нужен, чтобы отличить этап,
   *  который РЕАЛЬНО генерируется прямо сейчас, от осиротевшего маркера
   *  media_status='pending' без записи в очередь — такой остался от
   *  прерванного backfill'а 06.08 и висел бы вечным «Генерируется...». */
  media_queued_at?: string | null;
};

export function StageMedia({ image_url, media_status, isTeacher, stageId, media_queued_at }: StageMediaProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [failedAgain, setFailedAgain] = useState(false);

  async function regenerate() {
    if (!stageId || running) return;
    setRunning(true);
    setFailedAgain(false);
    try {
      const res = await fetch("/api/stage-media/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // force — иначе обработчик увидит media_status='failed' и вернёт
        // «уже обработан», ничего не сделав.
        body: JSON.stringify({ stageId, force: true }),
      });
      const answer = (await res.json().catch(() => null)) as { status?: string } | null;
      if (!res.ok || answer?.status === "failed") {
        setFailedAgain(true);
        return;
      }
      // Данные перечитывает сервер: этап и его картинка приходят с серверного
      // экрана, поэтому обновляем страницу, а не правим состояние руками.
      router.refresh();
    } catch {
      setFailedAgain(true);
    } finally {
      setRunning(false);
    }
  }

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
          {failedAgain ? "Снова не получилось" : "Изображение не сгенерилось"}
        </span>
        {isTeacher && stageId && (
          <button
            type="button"
            onClick={regenerate}
            disabled={running}
            title="Сгенерировать изображение заново"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            {running ? "Генерирую..." : "Перезапустить"}
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
