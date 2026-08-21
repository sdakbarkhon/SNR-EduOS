"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import type { CodeCompletionGap } from "@snr/core";
import { cn } from "@/lib/cn";

// Drag & Drop заполнение пропусков в коде.
//
// ПЕРЕРАБОТКА (после видео проверки: «ученик не может перетащить варианты»).
// Разведка показала, что дело было НЕ в HTML5-событиях — preventDefault в
// onDragOver стоял. Ломали задачу три вещи:
//
//   1) ГЛАВНОЕ: handleDrop ОТКАЗЫВАЛСЯ класть неправильный вариант — он
//      сравнивал token.text с gap.correct прямо в момент drop, и при
//      несовпадении вариант просто отскакивал с красной вспышкой. То есть
//      «положить» можно было только правильный ответ. Со стороны ученика
//      это выглядит ровно как «перетаскивание не работает»: тянешь — ничего
//      не происходит. Плюс это раскрывало правильный ответ ещё до проверки.
//   2) onDragStart не звал e.dataTransfer.setData(). В Chrome такой drag
//      обычно стартует, а в Firefox — НЕТ вообще (setData в dragstart
//      обязателен по спеке). То есть в FF фича была мертва полностью.
//   3) Нельзя было ни переложить вариант в другой пропуск, ни вернуть его
//      обратно в панель — одна попытка на токен.
//
// Теперь модель простая и предсказуемая: любой вариант кладётся в любой
// пропуск, ничего не проверяется до нажатия «Отправить», после проверки
// показываются зелёные/красные и счёт, есть «Попробовать снова».
//
// Полноценная подсветка синтаксиса (Prism) сознательно не подключена:
// пропуски нужно рендерить как интерактивные drop-зоны МЕЖДУ фрагментами
// текста, а готовые токенайзеры не умеют «разрывать» подсветку React-
// компонентами на произвольных позициях без существенной ручной интеграции.
//
// Дополнительно к перетаскиванию оставлен клик: тап по варианту «берёт» его,
// тап по пропуску — кладёт. HTML5 D&D не работает на тач-экранах в принципе,
// а ученики открывают уроки в том числе с планшета.

type PoolToken = { key: string; text: string };
/** Откуда тащат: из панели вариантов или из уже занятого пропуска. */
type DragSource = { token: PoolToken; from: "pool" | string };

const POOL_ZONE = "__POOL__";

function buildPool(gaps: CodeCompletionGap[]): PoolToken[] {
  const tokens: PoolToken[] = [];
  gaps.forEach((gap, gi) => {
    gap.options.forEach((opt, oi) => tokens.push({ key: `${gap.id}-${gi}-${oi}`, text: opt }));
  });
  for (let i = tokens.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = tokens[i]!;
    tokens[i] = tokens[j]!;
    tokens[j] = tmp;
  }
  return tokens;
}

export function CodeCompletionExercise({
  codeTemplate, gaps, language, taskDescription,
  readOnly = false, initialAnswers = null,
  onSubmit, submitLabel,
}: {
  codeTemplate: string;
  gaps: CodeCompletionGap[];
  language: string;
  taskDescription?: string;
  /** true — учитель/просмотр без своей попытки (только показ шаблона). */
  readOnly?: boolean;
  /** Уже сданный ответ ученика (для повторного открытия после отправки). */
  initialAnswers?: Record<string, string> | null;
  onSubmit?: (result: { answers: Record<string, string>; score: number; total: number }) => void;
  submitLabel?: string;
}) {
  const gapById = useMemo(() => new Map(gaps.map((g) => [g.id, g])), [gaps]);
  const alreadySubmitted = !!initialAnswers;

  const [pool, setPool] = useState<PoolToken[]>(() => (alreadySubmitted ? [] : buildPool(gaps)));
  const [placed, setPlaced] = useState<Record<string, PoolToken | null>>(() => {
    const init: Record<string, PoolToken | null> = {};
    for (const g of gaps) {
      const given = initialAnswers?.[g.id];
      init[g.id] = given != null ? { key: `given-${g.id}`, text: given } : null;
    }
    return init;
  });
  const [drag, setDrag] = useState<DragSource | null>(null);
  const [checked, setChecked] = useState(alreadySubmitted);
  const [result, setResult] = useState<{ score: number; total: number } | null>(() => {
    if (!alreadySubmitted) return null;
    const score = gaps.filter((g) => initialAnswers![g.id] === g.correct).length;
    return { score, total: gaps.length };
  });

  const locked = readOnly || checked;

  /** Кладёт токен в пропуск. Уже стоявший там — возвращается в панель. */
  const placeToken = useCallback((gapId: string, src: DragSource) => {
    setPlaced((prev) => {
      const displaced = prev[gapId] ?? null;
      const next = { ...prev, [gapId]: src.token };
      // Тащили из другого пропуска — освобождаем его.
      if (src.from !== "pool" && src.from !== gapId) next[src.from] = null;
      setPool((p) => {
        let out = src.from === "pool" ? p.filter((t) => t.key !== src.token.key) : p;
        if (displaced && displaced.key !== src.token.key) out = [...out, displaced];
        return out;
      });
      return next;
    });
  }, []);

  /** Возвращает токен из пропуска обратно в панель вариантов. */
  const returnToPool = useCallback((src: DragSource) => {
    if (src.from === "pool") return;
    setPlaced((prev) => ({ ...prev, [src.from]: null }));
    setPool((p) => (p.some((t) => t.key === src.token.key) ? p : [...p, src.token]));
  }, []);

  function handleDropOnGap(gapId: string) {
    if (locked || !drag) return;
    placeToken(gapId, drag);
    setDrag(null);
  }

  function handleDropOnPool() {
    if (locked || !drag) return;
    returnToPool(drag);
    setDrag(null);
  }

  /** Клик — альтернатива перетаскиванию (тач-экраны). */
  function handleGapClick(gapId: string) {
    if (locked) return;
    if (drag) { placeToken(gapId, drag); setDrag(null); return; }
    const tok = placed[gapId];
    if (tok) setDrag({ token: tok, from: gapId });
  }

  function handleSubmit() {
    const total = gaps.length;
    let score = 0;
    const answers: Record<string, string> = {};
    for (const g of gaps) {
      const p = placed[g.id];
      if (p) { answers[g.id] = p.text; if (p.text === g.correct) score++; }
    }
    setResult({ score, total });
    setChecked(true);
    setDrag(null);
    onSubmit?.({ answers, score, total });
  }

  function handleRetry() {
    setPool(buildPool(gaps));
    setPlaced(Object.fromEntries(gaps.map((g) => [g.id, null])));
    setChecked(false);
    setResult(null);
    setDrag(null);
  }

  /**
   * ПУСТОЙ ПРОПУСК ПОДПИСЫВАЕТСЯ НОМЕРОМ — [1], [2], … (20.08.2026).
   *
   * Раньше все пропуски выглядели одинаково — знаком «?», — и ученик не мог
   * сказать, какой из них какой по счёту: ни спросить учителя «не понял
   * третий», ни свериться с условием задачи.
   *
   * ЭТО ТОЛЬКО ПОДПИСЬ ПУСТОГО МЕСТА. Хранимая в базе метка остаётся
   * __GAP1__, и трогать её нельзя: во-первых, по ней разбирается шаблон
   * (регулярка ниже), во-вторых, ключ ответа в сдачах учеников — это gaps[].id
   * («GAP1»), и переименование обнулило бы 130 уже сохранённых работ. Формат
   * со скобками для хранения не годится и вовсе: шаблоны полны настоящих
   * питоновских индексов вроде words[2:5], и разбор спутал бы их с пропусками.
   */
  const parts = useMemo(() => codeTemplate.split(/(__[A-Z0-9]+__)/g), [codeTemplate]);
  const allPlaced = gaps.length > 0 && gaps.every((g) => placed[g.id] != null);

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Код с пропусками */}
      <div className="min-w-0 flex-[3] space-y-3">
        {taskDescription && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
            {taskDescription}
          </p>
        )}
        <div className="overflow-hidden rounded-2xl border border-slate-700">
          <div className="flex h-9 items-center justify-between border-b border-slate-700 bg-[#161616] px-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{language}</span>
            {!locked && (
              <span className="text-[11px] font-medium text-slate-500">
                {gaps.filter((g) => placed[g.id] != null).length} / {gaps.length}
              </span>
            )}
          </div>
          <div
            className="overflow-x-auto p-4 text-[13px] leading-[2.1] text-slate-100"
            style={{ background: "#1e1e1e", fontFamily: "'JetBrains Mono','Fira Code','SF Mono',Monaco,Consolas,monospace" }}
          >
            <pre className="whitespace-pre-wrap break-words">
              {parts.map((part, i) => {
                const m = /^__([A-Z0-9]+)__$/.exec(part);
                const gapKey = m?.[1];
                const gap = gapKey ? gapById.get(gapKey) : undefined;
                if (!gap) return <span key={i}>{part}</span>;
                const gapId = gap.id;
                const tok = placed[gapId];
                const isRight = checked && !!tok && tok.text === gap.correct;
                const isWrong = checked && (!tok || tok.text !== gap.correct);
                const isDragSource = drag?.from === gapId;

                return (
                  <span
                    key={i}
                    // Пропуск — тоже источник перетаскивания: занятый вариант
                    // можно вынуть и переложить в другой пропуск или в панель.
                    draggable={!locked && !!tok}
                    onDragStart={(e) => {
                      if (locked || !tok) return;
                      e.dataTransfer.setData("text/plain", tok.key);
                      e.dataTransfer.effectAllowed = "move";
                      setDrag({ token: tok, from: gapId });
                    }}
                    onDragEnd={() => setDrag(null)}
                    onDragOver={(e) => {
                      if (locked) return;
                      // Без preventDefault браузер не считает элемент
                      // валидной drop-зоной и onDrop не вызовется вовсе.
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => { e.preventDefault(); handleDropOnGap(gapId); }}
                    onClick={() => handleGapClick(gapId)}
                    className={cn(
                      "mx-1 inline-flex min-w-[7ch] items-center justify-center rounded-md border-2 px-2.5 py-1 align-middle font-semibold transition-all",
                      !locked && "cursor-pointer",
                      !locked && !!tok && "cursor-grab active:cursor-grabbing",
                      isDragSource && "opacity-40",
                      isRight ? "border-emerald-400 bg-emerald-500/25 text-emerald-200"
                        : isWrong ? "border-red-400 bg-red-500/25 text-red-200"
                        // До проверки — нейтральный вид: правильность не выдаём.
                        : tok ? "border-violet-400 bg-violet-500/25 text-violet-100"
                        : drag
                          // Подсветка активных целей, пока что-то тащат.
                          ? "border-violet-400 bg-violet-500/10 text-slate-400 ring-2 ring-violet-400/40"
                          : "border-dashed border-slate-400 bg-slate-800 text-slate-500",
                    )}
                  >
                    {tok?.text ?? `[${gaps.findIndex((g) => g.id === gapId) + 1}]`}
                  </span>
                );
              })}
            </pre>
          </div>
        </div>
      </div>

      {/* Панель вариантов */}
      {!(readOnly && !onSubmit) && (
        <div className="w-full shrink-0 lg:w-64">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Варианты</p>
          {!locked && (
            <div
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDrop={(e) => { e.preventDefault(); handleDropOnPool(); }}
              className={cn(
                "flex min-h-[64px] flex-wrap gap-2 rounded-2xl border-2 border-dashed p-3 transition-colors",
                drag && drag.from !== "pool"
                  ? "border-violet-400 bg-violet-50 dark:bg-violet-500/10"
                  : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900",
              )}
            >
              {pool.length === 0 ? (
                <p className="text-xs text-slate-400">
                  {drag && drag.from !== "pool" ? "Отпустите, чтобы вернуть вариант" : "Все варианты использованы"}
                </p>
              ) : pool.map((t) => (
                <span
                  key={t.key}
                  draggable
                  onDragStart={(e) => {
                    // setData обязателен по спеке HTML5: без него Firefox
                    // вообще не начинает перетаскивание.
                    e.dataTransfer.setData("text/plain", t.key);
                    e.dataTransfer.effectAllowed = "move";
                    setDrag({ token: t, from: "pool" });
                  }}
                  onDragEnd={() => setDrag(null)}
                  onClick={() => setDrag((cur) => (cur?.token.key === t.key ? null : { token: t, from: "pool" }))}
                  className={cn(
                    "cursor-grab select-none rounded-lg border-2 px-3 py-1.5 font-mono text-[13px] font-semibold transition-all active:cursor-grabbing",
                    drag?.token.key === t.key
                      ? "border-violet-500 bg-violet-500 text-white shadow-md"
                      : "border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-400 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
                  )}
                >
                  {t.text}
                </span>
              ))}
            </div>
          )}

          {!locked && (
            <button
              onClick={handleSubmit}
              disabled={!allPlaced}
              className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)" }}
            >
              {allPlaced
                ? (submitLabel ?? "Отправить")
                : `Заполните все пропуски (${gaps.filter((g) => placed[g.id] != null).length}/${gaps.length})`}
            </button>
          )}

          {result && (
            <>
              <div className={cn(
                "mt-3 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold",
                result.score === result.total
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700",
              )}>
                {result.score === result.total ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {result.score} из {result.total} правильно
              </div>
              {/* Повторная попытка — только локальный тренажёр (этап урока).
                  Там, где ответ уходит в БД (ДЗ), повторная сдача не
                  предусмотрена, поэтому кнопки нет. */}
              {!readOnly && !alreadySubmitted && (
                <button
                  onClick={handleRetry}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
                >
                  <RotateCcw className="h-4 w-4" /> Попробовать снова
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
