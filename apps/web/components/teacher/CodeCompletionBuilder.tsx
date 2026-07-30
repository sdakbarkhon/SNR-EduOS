"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type { CodeCompletionGap, CodeLanguage } from "@snr/core";
import { CODE_LANGUAGES, CODE_LANGUAGE_LABELS } from "@/lib/code-languages";
import { cn } from "@/lib/cn";

// Редактор упражнения «код с пропусками» для УЧИТЕЛЯ.
//
// Один компонент на два места (раньше учитель не мог создать такой контент
// вообще): форма создания ДЗ (CreateHomeworkForm.tsx) и форма этапа урока
// (StageModal внутри TeacherLessonDetailView.tsx). Устроен по образцу уже
// существующего QuizBuilder.tsx — контролируемый, своего состояния данных
// не держит (только какой пропуск раскрыт), все правки уходят через
// onChange. Так его одинаково просто вставить в обе формы.

export const MIN_GAPS = 3;
export const MAX_GAPS = 12;

export function emptyGap(index: number): CodeCompletionGap {
  return { id: `GAP${index + 1}`, correct: "", options: ["", "", "", ""] };
}

/** Плейсхолдеры, реально присутствующие в шаблоне, по порядку появления. */
export function placeholdersIn(codeTemplate: string): string[] {
  const found = codeTemplate.match(/__([A-Z0-9]+)__/g) ?? [];
  return [...new Set(found.map((m) => m.slice(2, -2)))];
}

/** Чистая валидация — та же функция используется и для disabled кнопки, и
 *  для показа причины учителю (см. codeCompletionIssues ниже). */
export function codeCompletionValid(codeTemplate: string, gaps: CodeCompletionGap[]): boolean {
  return codeCompletionIssues(codeTemplate, gaps).length === 0;
}

/** Список человекочитаемых причин, почему упражнение ещё нельзя сохранить. */
export function codeCompletionIssues(codeTemplate: string, gaps: CodeCompletionGap[]): string[] {
  const issues: string[] = [];
  if (!codeTemplate.trim()) issues.push("Шаблон кода пуст.");
  if (gaps.length < MIN_GAPS) issues.push(`Нужно минимум ${MIN_GAPS} пропуска, сейчас ${gaps.length}.`);
  if (gaps.length > MAX_GAPS) issues.push(`Максимум ${MAX_GAPS} пропусков, сейчас ${gaps.length}.`);

  const ids = gaps.map((g) => g.id);
  if (new Set(ids).size !== ids.length) issues.push("Идентификаторы пропусков повторяются.");

  for (const g of gaps) {
    if (!/^[A-Z0-9]+$/.test(g.id)) {
      issues.push(`«${g.id}» — только латиница в верхнем регистре и цифры.`);
      continue;
    }
    if (!codeTemplate.includes(`__${g.id}__`)) issues.push(`В коде нет плейсхолдера __${g.id}__.`);
    if (!g.correct.trim()) issues.push(`У ${g.id} не задан правильный вариант.`);
    const filled = g.options.filter((o) => o.trim());
    if (filled.length < 2) issues.push(`У ${g.id} нужно минимум 2 варианта.`);
    if (g.correct.trim() && !filled.includes(g.correct.trim())) {
      issues.push(`У ${g.id} правильный вариант должен быть среди вариантов.`);
    }
  }

  // Плейсхолдер в коде без описанного пропуска — ученик увидит сырой __GAPn__.
  for (const p of placeholdersIn(codeTemplate)) {
    if (!ids.includes(p)) issues.push(`__${p}__ есть в коде, но такого пропуска нет в списке.`);
  }
  return issues;
}

export function CodeCompletionBuilder({
  codeTemplate, onCodeTemplateChange,
  gaps, onGapsChange,
  language, onLanguageChange,
}: {
  codeTemplate: string;
  onCodeTemplateChange: (v: string) => void;
  gaps: CodeCompletionGap[];
  onGapsChange: (g: CodeCompletionGap[]) => void;
  language: CodeLanguage;
  onLanguageChange: (l: CodeLanguage) => void;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const issues = useMemo(() => codeCompletionIssues(codeTemplate, gaps), [codeTemplate, gaps]);
  const present = useMemo(() => placeholdersIn(codeTemplate), [codeTemplate]);

  function patch(i: number, next: Partial<CodeCompletionGap>) {
    onGapsChange(gaps.map((g, gi) => (gi === i ? { ...g, ...next } : g)));
  }
  function patchOption(i: number, oi: number, value: string) {
    onGapsChange(gaps.map((g, gi) => (gi === i ? { ...g, options: g.options.map((o, k) => (k === oi ? value : o)) } : g)));
  }
  function addGap() {
    if (gaps.length >= MAX_GAPS) return;
    onGapsChange([...gaps, emptyGap(gaps.length)]);
    setOpenIdx(gaps.length);
  }
  function removeGap(i: number) {
    onGapsChange(gaps.filter((_, gi) => gi !== i));
    setOpenIdx(null);
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= gaps.length) return;
    const next = [...gaps];
    const a = next[i]!, b = next[j]!;
    next[i] = b; next[j] = a;
    onGapsChange(next);
    setOpenIdx(j);
  }

  const inputCls = "w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400";

  return (
    <div className="space-y-4">
      {/* Язык */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Язык</label>
        <div className="flex flex-wrap gap-2">
          {CODE_LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onLanguageChange(l)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-semibold transition",
                language === l
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50",
              )}
            >
              {CODE_LANGUAGE_LABELS[l]}
            </button>
          ))}
        </div>
      </div>

      {/* Шаблон кода */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
          Код с пропусками
        </label>
        <textarea
          value={codeTemplate}
          onChange={(e) => onCodeTemplateChange(e.target.value)}
          rows={10}
          spellCheck={false}
          placeholder={'print(__GAP1__("Привет, класс!"))\ntotal = num1 __GAP2__ num2'}
          className="w-full resize-y rounded-xl border border-slate-200 bg-[#1e1e1e] p-3 text-[13px] leading-relaxed text-slate-100 outline-none focus:border-blue-400"
          style={{ fontFamily: "'JetBrains Mono','Fira Code','SF Mono',Monaco,Consolas,monospace" }}
        />
        <p className="mt-1.5 text-[11px] text-slate-500">
          Пропуск обозначайте как <code className="rounded bg-slate-100 px-1">__GAP1__</code>,{" "}
          <code className="rounded bg-slate-100 px-1">__GAP2__</code> и т.д. Имена переменных — латиницей;
          текст в кавычках и комментарии можно по-русски.
        </p>
        {present.length > 0 && (
          <p className="mt-1 text-[11px] text-slate-500">
            Найдено в коде: {present.map((p) => `__${p}__`).join(", ")}
          </p>
        )}
      </div>

      {/* Пропуски */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">
            Пропуски ({gaps.length})
          </span>
          <button
            type="button"
            onClick={addGap}
            disabled={gaps.length >= MAX_GAPS}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Добавить
          </button>
        </div>

        <div className="space-y-2">
          {gaps.map((g, i) => {
            const open = openIdx === i;
            const inCode = codeTemplate.includes(`__${g.id}__`);
            return (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setOpenIdx(open ? null : i)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[11px] font-bold",
                      inCode ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
                    )}>
                      __{g.id}__
                    </span>
                    <span className="truncate text-sm font-semibold text-slate-700">
                      {g.correct.trim() || <span className="text-slate-400">ответ не задан</span>}
                    </span>
                  </button>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    className="rounded p-1 text-slate-400 hover:bg-white disabled:opacity-30">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === gaps.length - 1}
                    className="rounded p-1 text-slate-400 hover:bg-white disabled:opacity-30">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => removeGap(i)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {open && (
                  <div className="space-y-2.5 border-t border-slate-200 px-3 py-3">
                    <div className="flex gap-2">
                      <div className="w-28 shrink-0">
                        <label className="mb-1 block text-[11px] font-semibold text-slate-500">ID</label>
                        <input
                          value={g.id}
                          onChange={(e) => patch(i, { id: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
                          className={cn(inputCls, "font-mono")}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                          Правильный вариант
                        </label>
                        <input
                          value={g.correct}
                          onChange={(e) => patch(i, { correct: e.target.value })}
                          placeholder="print"
                          className={cn(inputCls, "font-mono")}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                        Варианты (правильный должен быть среди них)
                      </label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {g.options.map((o, oi) => (
                          <input
                            key={oi}
                            value={o}
                            onChange={(e) => patchOption(i, oi, e.target.value)}
                            placeholder={oi === 0 ? "print" : "неправильный вариант"}
                            className={cn(
                              inputCls, "font-mono",
                              o.trim() && o.trim() === g.correct.trim() && "border-emerald-400 bg-emerald-50",
                            )}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => patch(i, { options: [...g.options, ""] })}
                        className="mt-1.5 text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        + ещё вариант
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {gaps.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
              Пропусков пока нет — добавьте минимум {MIN_GAPS}.
            </p>
          )}
        </div>
      </div>

      {issues.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800">
          {issues.slice(0, 6).map((m, i) => <li key={i}>• {m}</li>)}
        </ul>
      )}
    </div>
  );
}
