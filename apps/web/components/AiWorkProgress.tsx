"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";

/**
 * Показ долгой работы ИИ: какой шаг идёт, сколько уже прошло и сколько это
 * обычно занимает.
 *
 * ЗАЧЕМ. Учитель нажимал «Создать этапы с ИИ» и полминуты смотрел на крутящийся
 * кружок. Тридцать секунд без единого слова человек читает как «зависло» — и
 * жмёт ещё раз или уходит со страницы.
 *
 * ЧЕСТНО ПРО МЕХАНИЗМ. Это НЕ тот же способ, что у учебного плана. Там разбор
 * идёт отдельным фоновым вызовом, у плана есть строка в базе, сервер пишет в
 * неё стадию, а экран читает её через Realtime. Здесь писать некуда: генерация
 * этапов — один запрос от браузера, и до её конца в базе не появляется ничего,
 * куда можно было бы положить прогресс. Поэтому шаги здесь те, которые ВИДИТ
 * КЛИЕНТ, потому что сам их и запускает.
 *
 * Из-за этого один шаг — обращение к модели — остаётся непрозрачным: браузер
 * знает только, что запрос ушёл. Врать про его внутренние стадии не будем.
 * Вместо этого показываем прошедшее время и типичную длительность, взятую из
 * НАСТОЯЩИХ замеров (ai_usage_events.duration_ms), а не придуманную. Пока
 * замеров нет, число просто не показывается — придумывать «обычно 40 секунд»
 * было бы ровно тем враньём, от которого мы уходим.
 */

export type WorkStep = {
  key: string;
  /** Что происходит, словами. */
  label: string;
  /** Уточнение вида «3 из 7» — если шаг умеет считать. */
  detail?: string;
};

export function AiWorkProgress({
  steps,
  currentIndex,
  /** Типичная длительность в миллисекундах из настоящих замеров. null — замеров
   *  ещё нет, число не показываем. */
  typicalMs,
  hintUsually,
  hintElapsed,
}: {
  steps: WorkStep[];
  currentIndex: number;
  typicalMs?: number | null;
  /** «обычно ≈ {n} с» */
  hintUsually: string;
  /** «прошло {n} с» */
  hintElapsed: string;
}) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setElapsedSec(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={s.key} className="flex items-center gap-2.5 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              {done ? (
                <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />
              ) : active ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              )}
            </span>
            <span className={done ? "text-slate-400 line-through" : active ? "font-semibold text-slate-800" : "text-slate-400"}>
              {s.label}
              {s.detail && active && <span className="ml-1 font-normal text-slate-500">{s.detail}</span>}
            </span>
          </div>
        );
      })}

      <p className="pt-1 text-xs text-slate-400">
        {hintElapsed.replace("{n}", String(elapsedSec))}
        {typicalMs != null && typicalMs > 0 && (
          <> · {hintUsually.replace("{n}", String(Math.round(typicalMs / 1000)))}</>
        )}
      </p>
    </div>
  );
}

/**
 * Типичная длительность задачи по настоящим замерам.
 *
 * Спрашивает сервер, который берёт медиану из ai_usage_events — таблицы учёта
 * расходов, куда duration_ms пишется на каждом обращении к модели. Замеров
 * нет — возвращается null, и число не показывается.
 */
export function useTypicalDuration(task: string): number | null {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ai/typical-duration?task=${encodeURIComponent(task)}`)
      .then((r) => (r.ok ? r.json() : { medianMs: null }))
      .then((j: { medianMs?: number | null }) => { if (!cancelled) setMs(j.medianMs ?? null); })
      .catch(() => { /* не показать число — не беда */ });
    return () => { cancelled = true; };
  }, [task]);
  return ms;
}
