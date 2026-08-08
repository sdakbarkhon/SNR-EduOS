"use client";

// 08.08.2026 — общий вид «разбора теста»: список вопросов с вариантами,
// доступный только на чтение.
//
// Было в четырёх местах одинаково и одинаково скучно: белый прямоугольник на
// вопрос, варианты строками списка, правильный подсвечен бледно-зелёным и
// больше ничем — заказчик на это и пожаловался. Причём разметка была
// скопирована между экранами почти дословно, то есть пятой копии тут ждать
// оставалось недолго.
//
// Данные у экранов разные: у квиза этапа `options: string[]` плюс
// `correct_option_index`, у теста домашки — массив объектов с `is_correct`.
// Поэтому компонент принимает УЖЕ приведённую форму, а сведение делает каждый
// вызывающий (это две строки map и никакой общей зависимости от схемы).
//
// Разметку текста рисует MarkdownInline — формулы и инлайн-код в вопросах
// встречаются и там, и там.

import { Check, X } from "lucide-react";
import { MarkdownInline } from "@/components/markdown-plugins";
import { OPTION_LETTERS } from "@/components/quiz/QuizChoiceTile";

export type QuizReviewOption = {
  text: string;
  /** Правильный вариант. */
  correct: boolean;
  /** Что выбрал ученик. Не задано — экран без ответов (превью у учителя). */
  picked?: boolean;
};

export type QuizReviewQuestion = {
  key: string;
  text: string;
  options: QuizReviewOption[];
  /** Свободный ответ вместо вариантов (открытый вопрос теста). */
  openAnswer?: string | null;
};

/** Подпись «твой ответ» — у ученика и учителя формулировки разные, поэтому
 *  приходит снаружи, а не зашита здесь. */
export function QuizReviewList({
  questions,
  pickedLabel,
  emptyAnswerLabel,
}: {
  questions: QuizReviewQuestion[];
  pickedLabel?: string;
  emptyAnswerLabel?: string;
}) {
  return (
    <ol className="space-y-3">
      {questions.map((q, i) => (
        <li
          key={q.key}
          className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-[13px] font-black text-white shadow-sm">
              {i + 1}
            </span>
            <MarkdownInline
              text={q.text}
              className="pt-0.5 text-[14px] font-bold leading-snug text-slate-800"
            />
          </div>

          {q.openAnswer !== undefined ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-700">
              {q.openAnswer ? (
                <MarkdownInline text={q.openAnswer} />
              ) : (
                <span className="italic text-slate-400">{emptyAnswerLabel ?? "—"}</span>
              )}
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {q.options.map((o, oi) => {
                // Порядок веток важен: выбранный НЕверный вариант должен быть
                // виден даже когда рядом подсвечен правильный.
                const wrongPick = !!o.picked && !o.correct;
                return (
                  <div
                    key={oi}
                    className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] transition ${
                      o.correct
                        ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-900"
                        : wrongPick
                          ? "border-rose-300 bg-rose-50 font-semibold text-rose-900"
                          : "border-slate-200 bg-slate-50/70 text-slate-600"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-black ${
                        o.correct
                          ? "bg-emerald-500 text-white"
                          : wrongPick
                            ? "bg-rose-500 text-white"
                            : "bg-white text-slate-500 ring-1 ring-slate-200"
                      }`}
                    >
                      {o.correct ? <Check className="h-3 w-3" strokeWidth={3} />
                        : wrongPick ? <X className="h-3 w-3" strokeWidth={3} />
                        : (OPTION_LETTERS[oi] ?? oi + 1)}
                    </span>
                    <MarkdownInline text={o.text} className="min-w-0 flex-1" />
                    {o.picked && pickedLabel && (
                      <span className="ml-1 shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-wide opacity-60">
                        {pickedLabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
