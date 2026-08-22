"use client";

import { useState } from "react";
import { Sparkles, Loader2, Check, AlertTriangle } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

// Кнопка к разгребателю очереди эмбеддингов.
//
// ЗАЧЕМ ЦИКЛ, А НЕ ОДНО НАЖАТИЕ. Маршрут за вызов берёт двадцать записей —
// столько, чтобы уложиться в отведённое серверу время — и возвращает остаток.
// Поэтому здесь цикл: жмём один раз, страница сама дёргает маршрут, пока
// остаток не станет нулём, и показывает ход. Иначе админу пришлось бы жать
// пятнадцать раз подряд, а до сегодняшнего дня — вообще слать запрос руками
// снаружи, потому что кнопки не существовало.
//
// ПРЕДОХРАНИТЕЛЬ. Цикл ограничен сверху: если маршрут вдруг начнёт возвращать
// один и тот же остаток, страница остановится сама, а не будет ходить по
// кругу вечно, тратя деньги на модель.
const MAX_ROUNDS = 200;

type BatchAnswer = {
  processed: number;
  failed: number;
  remaining: number;
  total_done: number;
};

export function AdminRagView({
  queued,
  stuck,
  indexed,
}: {
  queued: number;
  stuck: number;
  indexed: number;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).admin;

  const [left, setLeft] = useState(queued);
  const [chunks, setChunks] = useState(indexed);
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run() {
    setRunning(true);
    setFailed(false);
    setFinished(false);
    setDone(0);
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const res = await fetch("/api/admin/rag/process-batch", { method: "POST" });
        if (!res.ok) throw new Error(String(res.status));
        const answer = (await res.json()) as BatchAnswer;

        setDone((prev) => prev + answer.processed);
        setLeft(answer.remaining);
        setChunks(answer.total_done);

        if (answer.remaining <= 0) break;
        // Весь заход упал — дальше давить бессмысленно: это почти всегда
        // предел обращений к модели за сутки. Ещё и вредно: у каждой записи
        // растёт счётчик неудач, и после третьей она выпадет из разбора.
        if (answer.processed === 0) throw new Error("no progress");
      }
      setFinished(true);
    } catch {
      setFailed(true);
    } finally {
      setRunning(false);
    }
  }

  const nothingToDo = left <= 0 && !running;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      {/* Шапка */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
            <Sparkles className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{d.ragTitle}</h1>
            <p className="max-w-2xl text-sm text-zinc-500">{d.ragSubtitle}</p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={running || nothingToDo}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-violet-700 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {running ? d.ragRunning : d.ragRun}
        </button>
      </div>

      {/* Числа */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-3xl font-bold text-zinc-900">{left}</div>
          <div className="mt-1 text-sm text-zinc-500">{d.ragQueued}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-3xl font-bold text-zinc-900">{chunks}</div>
          <div className="mt-1 text-sm text-zinc-500">{d.ragIndexed}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-3xl font-bold text-zinc-900">{stuck}</div>
          <div className="mt-1 text-sm text-zinc-500">{d.ragStuck}</div>
        </div>
      </div>

      {/* Ход работы */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm shadow-sm">
        {running && (
          <p className="flex items-center gap-2 text-zinc-700">
            <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
            {d.ragProgress.replace("{done}", String(done)).replace("{left}", String(left))}
          </p>
        )}
        {!running && finished && (
          <p className="flex items-center gap-2 font-medium text-emerald-700">
            <Check className="h-4 w-4" /> {d.ragDone}
          </p>
        )}
        {!running && failed && (
          <p className="flex items-center gap-2 font-medium text-amber-700">
            <AlertTriangle className="h-4 w-4" /> {d.ragFailed}
          </p>
        )}
        {!running && !finished && !failed && nothingToDo && (
          <p className="text-zinc-500">{d.ragEmpty}</p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">{d.ragNote}</p>
        {stuck > 0 && <p className="mt-2 text-xs leading-relaxed text-amber-600">{d.ragStuckNote}</p>}
      </div>
    </div>
  );
}
