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
import { getDictionary, getKahootLeaderboard, gradeFromPercent } from "@snr/core";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getKahootLeaderboard(db, stage.id)
      .then((r) => { if (!cancelled) setRows(r); })
      .catch(() => { if (!cancelled) setRows([]); })
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
                // Процент считаем от максимума по группе: у quiz_attempts нет
                // total_questions в лидерборде, а показывать «сырой» балл без
                // шкалы учителю бесполезно.
                const best = Math.max(...rows.map((x) => x.correct_count), 1);
                const pct = Math.round((r.correct_count / best) * 100);
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
                    <span className="shrink-0 text-xs font-semibold text-slate-500">
                      {r.correct_count} · {r.total_score}
                    </span>
                    <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">
                      {gradeFromPercent(pct)}
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
