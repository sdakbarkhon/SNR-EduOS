"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Download, AlertTriangle, Loader2, FileText } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeChannel } from "@/lib/realtime";
import { заказБрошен } from "@/lib/plan-draft-stale";

/**
 * ФАЙЛЫ УЧЕБНЫХ ПЛАНОВ — список заказов на разбор учебника. 06.09.2026.
 *
 * ═══ ЗАЧЕМ ОН НУЖЕН, ЕСЛИ ЕСТЬ ОКНО ═══════════════════════════════════════
 *
 * Разбор идёт минутами, и держать учителя у окна всё это время нельзя. Список
 * и есть ответ на «закрыл вкладку и вернулся»: заказ лежит в базе, а не в
 * памяти вкладки, и файл находится здесь же.
 *
 * ═══ ЧТО ВИДНО В КАЖДОМ СОСТОЯНИИ ═════════════════════════════════════════
 *
 *   идёт      — процент и стадия словами («читаем текст», «модель составляет
 *               темы»), чтобы экран не выглядел замершим;
 *   готово    — сколько тем и кнопка «Скачать файл»;
 *   не вышло  — ПРИЧИНА словами, а не «не получилось»: «модель не ответила»,
 *               «из книги не удалось извлечь текст».
 *
 * ═══ ЧТО ДЕЛАТЬ ДАЛЬШЕ ════════════════════════════════════════════════════
 *
 * После скачивания под строкой появляется подсказка: открыть файл, поправить
 * темы и принести обратно второй кнопкой. Без неё файл — это тупик: учитель
 * получил его и не знает, что план из него создаётся другой кнопкой.
 */

export type PlanDraft = {
  id: string;
  title: string;
  status: "queued" | "running" | "done" | "failed";
  progress_percent: number;
  progress_stage: string | null;
  error_message: string | null;
  result_path: string | null;
  topics_count: number | null;
  created_at: string;
};

/** Одно понятие состояния на весь экран: и кнопка, и строка судят по нему. */
export type СостояниеЗаказа = "идёт" | "брошен" | "готово" | "отказ";

/**
 * ЧТО НА САМОМ ДЕЛЕ С ЗАКАЗОМ.
 *
 * «Брошен» — это `queued`/`running`, который старше срока (см.
 * lib/plan-draft-stale.ts, там же довод про десять минут). В базе он до ночи
 * так и числится идущим; на экране он идущим не считается НИГДЕ — иначе вышло
 * бы ровно то, чего быть не должно: кнопка ожила, а рядом крутится «модель
 * составляет темы».
 */
export function состояниеЗаказа(x: PlanDraft, сейчас = Date.now()): СостояниеЗаказа {
  if (x.status === "done") return "готово";
  if (x.status === "failed") return "отказ";
  return заказБрошен(x.created_at, сейчас) ? "брошен" : "идёт";
}

/**
 * ЖИВОЙ СПИСОК ЗАКАЗОВ. Хук, а не состояние внутри списка.
 *
 * ПОЧЕМУ ХУК. Заказы нужны ДВОИМ: списку — чтобы рисовать, экрану — чтобы
 * гасить первую кнопку, пока заказ жив. Если состояние живёт внутри списка,
 * экран остаётся при серверном снимке: кнопка гаснет по router.refresh() и
 * больше не оживает, потому что «готово» приходит опросом внутрь списка, а
 * экран об этом не знает. Учителю пришлось бы жать F5.
 */
export function usePlanDrafts(initialDrafts: PlanDraft[]) {
  const db = createClient();
  const [drafts, setDrafts] = useState(initialDrafts);
  useEffect(() => { setDrafts(initialDrafts); }, [initialDrafts]);

  // Живым считается только то, что действительно идёт. Брошенный заказ кнопку
  // больше не держит: его добьёт сторож, а учителю ждать ночи незачем.
  //
  // Возраст пересчитывается сам собой: пока есть идущий заказ, опрос ниже
  // каждые пять секунд кладёт в состояние новый список и вызывает перерисовку.
  // Как только последний идущий перешагнул срок, опрос гаснет вместе с ним —
  // ждать больше нечего.
  const живые = drafts.some((x) => состояниеЗаказа(x) === "идёт");

  /** Свежий список. Зовётся и по подписке, и по таймеру: см. ниже. */
  const обновить = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (db as any)
      .from("curriculum_plan_drafts")
      .select("id, title, status, progress_percent, progress_stage, error_message, result_path, topics_count, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setDrafts(data as PlanDraft[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Подписка на свои заказы. Правило доступа отдаёт только их, поэтому
  // фильтровать на клиенте нечего.
  //
  // ДО МИГРАЦИИ 264 ОНА МОЛЧАЛА: таблицы не было в публикации
  // supabase_realtime, канал не приносил ни одного события, и всю работу делал
  // опрос ниже. 264 добавляет таблицу в публикацию и ставит ей REPLICA
  // IDENTITY FULL — без неё правило чтения, которое смотрит на teacher_id,
  // не вычисляется, и события молча теряются.
  useRealtimeChannel(
    живые ? "plan-drafts" : null,
    "curriculum_plan_drafts",
    undefined,
    обновить,
  );

  // ЗАПАСНОЙ ОПРОС РАЗ В ПЯТЬ СЕКУНД, пока есть живой заказ. Подписка —
  // основной путь, но фон пишет служебным ключом с другого вызова, и одна
  // потерянная весть оставила бы учителя перед застывшим процентом на все
  // минуты разбора. Опрос стоит один запрос в пять секунд и только пока есть
  // что ждать.
  useEffect(() => {
    if (!живые) return;
    const id = setInterval(() => { void обновить(); }, 5000);
    return () => clearInterval(id);
  }, [живые, обновить]);

  return { drafts, живые, обновить };
}

export function PlanDraftsList({ drafts }: { drafts: PlanDraft[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).curriculum;
  const db = createClient();
  const [скачан, setСкачан] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function скачать(draft: PlanDraft) {
    if (!draft.result_path) return;
    setBusy(draft.id);
    try {
      const { data, error } = await db.storage
        .from("curriculum-plans").createSignedUrl(draft.result_path, 300, {
          download: `${draft.title}.csv`,
        });
      if (error || !data) throw error ?? new Error("нет ссылки");
      window.location.href = data.signedUrl;
      setСкачан(draft.id);
    } catch {
      setСкачан(null);
    } finally {
      setBusy(null);
    }
  }

  function стадия(x: PlanDraft): string {
    switch (x.progress_stage) {
      case "download": return d.draftStageDownload;
      case "extract": return d.draftStageExtract;
      case "outline": return d.draftStageOutline;
      case "model": return d.draftStageModel;
      case "file": return d.draftStageFile;
      default: return d.draftStageQueued;
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{d.draftsTitle}</h2>
      </div>

      {drafts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-center text-sm text-slate-400">
          {d.draftsEmpty}
        </p>
      ) : (
        <ul className="space-y-2">
          {drafts.map((x) => {
          // Состояние считается ОДИН раз на строку и дальше решает всё: и текст,
          // и значок, и полосу. Разные ветки, спрашивающие x.status напрямую,
          // разъехались бы с кнопкой — брошенный заказ снова «шёл бы».
          const состояние = состояниеЗаказа(x);
          return (
            <li key={x.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <BookOpen className="h-4 w-4 shrink-0 text-slate-300" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900">{x.title}</span>

                  {состояние === "идёт" && (
                    <span className="mt-1 block text-xs text-slate-500">{стадия(x)}</span>
                  )}
                  {состояние === "брошен" && (
                    <span className="mt-1 flex items-start gap-1.5 text-xs text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {d.draftStalled}
                    </span>
                  )}
                  {состояние === "готово" && (
                    <span className="mt-1 block text-xs text-slate-500">
                      {d.draftTopicsCount.replace("{n}", String(x.topics_count ?? 0))}
                    </span>
                  )}
                  {состояние === "отказ" && (
                    <span className="mt-1 flex items-start gap-1.5 text-xs text-red-600">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {x.error_message || d.draftFailedTitle}
                    </span>
                  )}
                </span>

                {состояние === "идёт" && (
                  <span className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {x.progress_percent}%
                  </span>
                )}
                {состояние === "готово" && x.result_path && (
                  <button
                    onClick={() => void скачать(x)}
                    disabled={busy === x.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    <Download className="h-3.5 w-3.5" /> {d.draftDownload}
                  </button>
                )}
              </div>

              {состояние === "идёт" && (
                <>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${Math.max(5, x.progress_percent)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">{d.draftRunningHint}</p>
                </>
              )}

              {/* Что делать со скачанным файлом. Без этой строки он тупик. */}
              {скачан === x.id && (
                <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-800">
                  {d.draftsNext}
                </p>
              )}
            </li>
          );
          })}
        </ul>
      )}
    </section>
  );
}
