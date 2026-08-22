"use client";

// 07.08.2026 — просмотр результатов теста (quiz_qia) и игры (quiz_kahoot) у
// учителя. До этого кнопка «Проверить» была только у программирования и
// внешних сервисов: у них сдачи лежат в lesson_stage_progress и их показывают
// CodeStageSubmissionsModal / ExternalSubmissionsModal. Квизы хранятся иначе —
// в quiz_attempts/quiz_answers, — поэтому те модалки для них показали бы
// пустой список.
//
// Источник данных — getKahootLeaderboard(db, stageId). Несмотря на название,
// функция работает для ОБОИХ типов квизов: quiz_attempts/quiz_answers общие,
// это уже задокументировано в StageViewModal.tsx, который тем же вызовом
// показывает живые баллы во время урока. Ничего нового в БД не заводится.
//
// Оценка не выставляется: у квизов балл считается автоматически
// (gradeFromPercent по проценту правильных), в отличие от заданий из
// lesson_stage_progress, где учитель ставит оценку руками.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Trophy } from "lucide-react";
import { getDictionary, getKahootLeaderboard, getQuizQuestions, gradeFromPercent } from "@snr/core";
import type { Locale, LessonStage, QuizLeaderboardEntry } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";

export function QuizResultsModal({
  stage,
  onClose,
}: {
  stage: LessonStage;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dq = d.lesson.quiz;
  const db = createClient();

  const [rows, setRows] = useState<QuizLeaderboardEntry[]>([]);
  // Сколько вопросов в квизе — знаменатель процента. Лидерборд его не
  // приносит (см. тип QuizLeaderboardEntry: там только сумма баллов и число
  // верных), поэтому берём отдельным запросом. Ровно так же считает
  // finishKahootGame, когда выставляет настоящие оценки.
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getKahootLeaderboard(db, stage.id), getQuizQuestions(db, stage.id)])
      .then(([r, qs]) => { if (!cancelled) { setRows(r); setTotalQuestions(qs.length); } })
      .catch(() => { if (!cancelled) { setRows([]); setTotalQuestions(0); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900">{dq.results}</h2>
            <p className="truncate text-xs text-slate-400">{stage.title}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">{dq.noAttempts}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((r, i) => {
                // total_score — сумма баллов, correct_count — верных ответов.
                //
                // 22.08.2026 — ПРОЦЕНТ СЧИТАЛСЯ ОТ ЛУЧШЕГО В ГРУППЕ, и это
                // была ошибка, а не задумка: делили на максимум по строкам
                // (`Math.max(...rows)`), поэтому первый в списке ВСЕГДА
                // получал 100% и пятёрку — даже ответив верно на один вопрос
                // из десяти, если остальные ответили хуже. А последний
                // получал долю не от знаний, а от чужого результата.
                // Прежняя причина («в лидерборде нет числа вопросов») снята:
                // число вопросов запрашивается выше отдельно.
                //
                // Теперь знаменатель — сколько вопросов в квизе, то есть та
                // же шкала, по которой ставится настоящая оценка.
                const pct = totalQuestions > 0
                  ? Math.round((r.correct_count / totalQuestions) * 100)
                  : 0;
                return (
                  <div
                    key={r.student_id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
                    }`}>
                      {i === 0 ? <Trophy className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{r.full_name}</span>
                    {/* Знаменатель показан рядом с числом верных: без него
                        «3 · 5» ничего не говорит, а теперь по нему видно, из
                        скольких. Оценка справа считается от того же числа. */}
                    <span className="shrink-0 text-xs font-semibold text-slate-500">
                      {totalQuestions > 0 ? `${r.correct_count}/${totalQuestions}` : r.correct_count} · {r.total_score}
                    </span>
                    <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">
                      {totalQuestions > 0 ? gradeFromPercent(pct) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
