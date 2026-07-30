"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import type { CodeCompletionGap } from "@snr/core";
import { cn } from "@/lib/cn";

// Большой фикс, Блок 6.5 — Drag & Drop заполнение пропусков в коде.
// Нативный HTML5 D&D (draggable/onDragStart/onDragOver/onDrop) — тот же
// подход, что уже используется в этом кодбейзе для перетаскивания
// (CurriculumPlansView.tsx, единственный прецедент D&D в проекте), без
// внешней библиотеки. Полноценная подсветка синтаксиса (Prism) сюда
// сознательно не подключена — вариант токенов внутри code_template нужно
// рендерить как интерактивные drop-зоны МЕЖДУ фрагментами текста, а
// готовые токенайзеры Prism не умеют "разрывать" подсветку React-
// компонентами на произвольных позициях без существенной ручной интеграции;
// промт явно разрешает "простое стилизование через CSS" как альтернативу —
// моноширинный шрифт + тёмный фон в стиле CodeEditor.tsx/CodeStageView.tsx
// достаточно для читаемости кода с пропусками.

type PoolToken = { key: string; text: string };

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
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [dragToken, setDragToken] = useState<PoolToken | null>(null);
  const [checked, setChecked] = useState(alreadySubmitted);
  const [result, setResult] = useState<{ score: number; total: number } | null>(() => {
    if (!alreadySubmitted) return null;
    const score = gaps.filter((g) => initialAnswers![g.id] === g.correct).length;
    return { score, total: gaps.length };
  });

  const locked = readOnly || checked;

  function handleDrop(gapId: string) {
    if (locked || !dragToken) return;
    const gap = gapById.get(gapId);
    if (!gap) return;
    const token = dragToken;
    setDragToken(null);
    if (token.text === gap.correct) {
      setPlaced((p) => ({ ...p, [gapId]: token }));
      setPool((p) => p.filter((t) => t.key !== token.key));
    } else {
      setWrongFlash(gapId);
      setTimeout(() => setWrongFlash((cur) => (cur === gapId ? null : cur)), 500);
    }
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
    onSubmit?.({ answers, score, total });
  }

  const parts = useMemo(() => codeTemplate.split(/(__[A-Z0-9]+__)/g), [codeTemplate]);
  const anyPlaced = gaps.some((g) => placed[g.id] != null);

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
          </div>
          <div
            className="overflow-x-auto p-4 text-[13px] leading-relaxed text-slate-100"
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
                const isCheckedRight = checked && !!tok && tok.text === gap.correct;
                const isCheckedWrong = checked && (!tok || tok.text !== gap.correct);
                return (
                  <span
                    key={i}
                    onDragOver={(e) => { if (!locked) e.preventDefault(); }}
                    onDrop={(e) => { e.preventDefault(); handleDrop(gapId); }}
                    className={cn(
                      "mx-0.5 inline-flex min-w-[3ch] items-center justify-center rounded-md border px-2 py-0.5 align-middle font-semibold transition-colors",
                      isCheckedRight ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                        : isCheckedWrong ? "border-red-400 bg-red-500/15 text-red-300"
                        : wrongFlash === gapId ? "border-red-400 bg-red-500/30 text-red-200"
                        : tok ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                        : "border-dashed border-slate-500 bg-slate-800/60 text-slate-500",
                    )}
                  >
                    {tok?.text ?? "   "}
                  </span>
                );
              })}
            </pre>
          </div>
        </div>
      </div>

      {/* Панель вариантов */}
      {!(readOnly && !onSubmit) && (
        <div className="w-full shrink-0 lg:w-60">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Варианты</p>
          {!locked && (
            <div className="flex min-h-[52px] flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
              {pool.length === 0 ? (
                <p className="text-xs text-slate-400">Все варианты использованы</p>
              ) : pool.map((t) => (
                <span
                  key={t.key}
                  draggable
                  onDragStart={() => setDragToken(t)}
                  onDragEnd={() => setDragToken(null)}
                  className="cursor-grab select-none rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 font-mono text-[13px] font-semibold text-violet-700 active:cursor-grabbing dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"
                >
                  {t.text}
                </span>
              ))}
            </div>
          )}

          {!locked && (
            <button
              onClick={handleSubmit}
              disabled={!anyPlaced}
              className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)" }}
            >
              {submitLabel ?? "Проверить"}
            </button>
          )}

          {result && (
            <div className={cn(
              "mt-3 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold",
              result.score === result.total
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700",
            )}>
              {result.score === result.total ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {result.score} из {result.total} правильно
            </div>
          )}
        </div>
      )}
    </div>
  );
}
