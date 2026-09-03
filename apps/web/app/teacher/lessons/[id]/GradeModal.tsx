"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Star, Check, Loader2 } from "lucide-react";
import { getDictionary, getLessonStageGrades, gradeStudentForLesson, isMarkLockedError, markLockState } from "@snr/core";
import type { Locale, LessonGrade, LessonLockStatus, LessonStageGrade } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

const GRADE_COLORS: Record<number, { bg: string; text: string; ring: string }> = {
  1: { bg: "bg-red-500",    text: "text-white", ring: "ring-red-400" },
  2: { bg: "bg-orange-500", text: "text-white", ring: "ring-orange-400" },
  3: { bg: "bg-yellow-400", text: "text-slate-900", ring: "ring-yellow-300" },
  4: { bg: "bg-blue-500",   text: "text-white", ring: "ring-blue-400" },
  5: { bg: "bg-emerald-500",text: "text-white", ring: "ring-emerald-400" },
};

/**
 * Кого оцениваем. Разделено типом, а не флагом, чтобы «одного» и «всех» нельзя
 * было перепутать местами: у одного есть прежняя оценка и замок, у всех —
 * список тех, кого ещё не оценивали, и замка на них по определению нет.
 */
export type GradeTarget =
  | { kind: "one"; studentId: string; studentName: string; existing: LessonGrade | null }
  | { kind: "all"; students: Array<{ id: string; name: string }> };

type Props = {
  lessonId: string;
  teacherId: string;
  target: GradeTarget;
  /** Статус урока: пока он идёт, замка нет (миграция 245). */
  lessonStatus: LessonLockStatus;
  onClose: () => void;
  /** Массив, а не одна оценка: при «оценить остальных» их несколько, и экран
   *  должен показать даже те, что прошли при частичном отказе. */
  onSaved: (grades: LessonGrade[]) => void;
};

export function GradeModal({ lessonId, teacherId, target, lessonStatus, onClose, onSaved }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dl = d.lesson;
  const db = createClient();

  const один = target.kind === "one" ? target : null;
  const всех = target.kind === "all" ? target.students : null;
  const existing = один?.existing ?? null;

  const [grade, setGrade] = useState<number | null>(existing?.grade ?? null);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customText, setCustomText] = useState<string>(existing?.comment ?? "");
  const [isOther, setIsOther] = useState(false);
  const [saving, setSaving] = useState(false);
  // Почему «Сохранить» не сработало.
  //   "locked" — база сказала mark_locked;
  //   "failed" — любой другой её отказ.
  // 31.08.2026. Раньше вторая ветка уходила только в console.error, окно
  // оставалось открытым и молчало. Так восемь дней пряталась поломка
  // миграции 225: база падала сырой ошибкой, а учитель видел пустоту.
  const [saveError, setSaveError] = useState<null | "locked" | "failed">(null);
  /** Частичный отказ при «оценить остальных»: сколько прошло из скольких. */
  const [partial, setPartial] = useState<{ ok: number; all: number } | null>(null);

  /**
   * ОЦЕНКИ ЗА ЭТАПЫ ЭТОГО УРОКА — ЕДИНСТВЕННОЕ МЕСТО, ГДЕ ОНИ ОСТАЛИСЬ У
   * УЧИТЕЛЯ. 03.09.2026.
   *
   * Со всех экранов «Оценки» они убраны: третья сущность путала. Но здесь она
   * не третья, а ПОДСПОРЬЕ: учитель ставит оценку за урок и видит рядом, как
   * ученик работал на этапах.
   *
   * Только при оценке ОДНОГО: у «оценить остальных» учеников много, и десять
   * столбиков этапов превратили бы окно в таблицу.
   */
  const [stageGrades, setStageGrades] = useState<LessonStageGrade[] | null>(null);

  useEffect(() => {
    if (!один) return;
    let жив = true;
    getLessonStageGrades(db, lessonId, один.studentId)
      .then((r) => { if (жив) setStageGrades(r); })
      // Подсказка — не право: не загрузилась, значит её просто нет, а окно
      // работает. Ронять выставление оценки из-за неё было бы нелепо.
      .catch(() => { if (жив) setStageGrades([]); });
    return () => { жив = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, один?.studentId]);

  /**
   * СРЕДНЕЕ ИЗ ЭТАПОВ — ЭТО НЕ СРЕДНИЙ БАЛЛ ПРОДУКТА.
   *
   * Считается здесь и только для показа. Общее правило (utils/gradeAverage)
   * этапы в средний балл не пускает — и не должно; звать его отсюда нельзя,
   * иначе через месяц кто-нибудь решит, что этапы всё-таки считаются. Имя у
   * подсказки поэтому своё: «среднее из этапов», а не «средний балл».
   */
  const среднееИзЭтапов = stageGrades && stageGrades.length > 0
    ? Math.round((stageGrades.reduce((n, g) => n + g.grade, 0) / stageGrades.length) * 10) / 10
    : null;

  // Замок миграций 203 и 245. Правило целиком живёт в markLockState — здесь
  // только вопрос и ответ, своей копии отсчёта у экрана нет. Комментарий не
  // запирается никогда: его правят и после того, как оценка заперлась.
  // При «оценить остальных» список составлен из тех, у кого оценки НЕТ, —
  // значит отметки времени нет тоже, и замку не за что цепляться. Правило
  // одно и то же, зовём его одинаково, а не заводим второй ответ.
  const lock = markLockState({ stamp: existing?.graded_at ?? null, lesson: lessonStatus });

  // preset comments keyed by grade (1-5)
  const presets = grade ? (dl.gradeComments as Record<string, string[]>)[String(grade)] ?? [] : [];

  const comment = isOther ? customText : (selectedPreset != null ? presets[selectedPreset] ?? null : null);
  // Оценку менять нельзя, если запись заперта; комментарий — можно.
  const gradeChanged = grade !== (existing?.grade ?? null);
  const canSave =
    grade != null
    && (selectedPreset != null || (isOther && customText.trim().length > 0))
    && !(lock.locked && gradeChanged);

  async function handleSave() {
    if (!canSave || !grade) return;
    setSaving(true);
    setSaveError(null);
    setPartial(null);
    try {
      if (один) {
        const saved = await gradeStudentForLesson(db, lessonId, teacherId, один.studentId, grade, comment);
        onSaved([saved]);
        onClose();
        return;
      }

      // ── «Оценить остальных» ──────────────────────────────────────────────
      // КАЖДЫЙ УЧЕНИК ОТДЕЛЬНО, И ПАДЕНИЕ ОДНОГО НЕ РОНЯЕТ ОСТАЛЬНЫХ.
      // allSettled, а не all: у оценок нет ни транзакции, ни порядка, и терять
      // девять сохранённых из-за одного отказа было бы хуже всего. Прошедшие
      // уходят на экран сразу, непрошедшие остаются в списке — их видно и
      // можно поставить по одному.
      const итоги = await Promise.allSettled(
        (всех ?? []).map((st) => gradeStudentForLesson(db, lessonId, teacherId, st.id, grade, comment)),
      );
      const прошли = итоги.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      const отказы = итоги.flatMap((r) => (r.status === "rejected" ? [r.reason] : []));
      if (прошли.length) onSaved(прошли);

      if (отказы.length === 0) { onClose(); return; }
      // Отказ базы обязан доехать до человека — и назваться своим именем.
      if (отказы.some((e) => isMarkLockedError(e))) setSaveError("locked");
      else { setSaveError("failed"); console.error("[GradeModal] часть оценок не сохранилась:", отказы[0]); }
      setPartial({ ok: прошли.length, all: итоги.length });
    } catch (err) {
      // Молчать здесь нельзя: запертую запись сервер отклоняет, и учитель
      // должен понять, почему кнопка «не сработала».
      if (isMarkLockedError(err)) setSaveError("locked");
      else { setSaveError("failed"); console.error("[GradeModal] сохранить не удалось:", err); }
    } finally {
      setSaving(false);
    }
  }

  function selectGrade(g: number) {
    setGrade(g);
    setSelectedPreset(null);
    setIsOther(false);
    setCustomText("");
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="truncate text-sm font-bold text-slate-700">
            {один
              ? <>{dl.gradeStudent} <span className="text-brand-blue">{один.studentName}</span></>
              : <>{d.teacher.rollCallGradeAll} <span className="text-brand-blue">({всех?.length ?? 0})</span></>}
          </p>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Состояние замка. Заперто — говорим, к кому идти; урок идёт —
              говорим, что отсчёта нет; иначе показываем, сколько времени ещё
              есть. Молчаливого отказа нет ни в одной ветке.

              saveError === "locked" идёт первым вместе с lock.locked: если база
              всё-таки отказала, её слово главнее нашего счёта — экран не спорит. */}
          {(lock.locked || saveError === "locked") ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-xs font-bold text-amber-800">{dl.markLockedTitle}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-amber-700">{dl.markLockedBody}</p>
              <p className="mt-1 text-[11px] text-amber-600">{dl.markCommentAlways}</p>
            </div>
          ) : lock.freeWhileLesson ? (
            <p className="text-[11px] font-medium text-emerald-600">{dl.markFreeWhileLesson}</p>
          ) : !lock.notSetYet ? (
            <p className="text-[11px] font-medium text-slate-500">
              {dl.markWindowLeft.replace("{n}", String(lock.minutesLeft))}
            </p>
          ) : null}

          {/* ── КАК УЧЕНИК РАБОТАЛ НА ЭТАПАХ ────────────────────────────
              Единственное место у учителя, где оценки за этапы остались.
              Показ, а не оценка: «среднее из этапов» можно подставить одним
              нажатием, но поставить учитель волен что угодно. */}
          {stageGrades && stageGrades.length > 0 && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">
                {dl.stageGradesTitle}
              </p>
              <ul className="mt-1.5 space-y-1">
                {stageGrades.map((g) => (
                  <li key={g.stageId} className="flex items-baseline justify-between gap-2 text-[11.5px]">
                    <span className="min-w-0 flex-1 truncate text-slate-600">{g.title}</span>
                    {g.detail && (
                      <span className="shrink-0 text-slate-400">
                        {dl.stageGradesOf
                          .replace("{correct}", String(g.detail.correct))
                          .replace("{total}", String(g.detail.total))}
                      </span>
                    )}
                    <span className="shrink-0 font-bold text-violet-700">{g.grade}</span>
                  </li>
                ))}
              </ul>
              {среднееИзЭтапов != null && (
                <button
                  type="button"
                  onClick={() => selectGrade(Math.round(среднееИзЭтапов))}
                  disabled={lock.locked}
                  className="mt-2 w-full rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-40"
                >
                  {dl.stageGradesSuggest
                    .replace("{avg}", String(среднееИзЭтапов))
                    .replace("{grade}", String(Math.round(среднееИзЭтапов)))}
                </button>
              )}
            </div>
          )}

          {/* Частичный отказ при «оценить остальных»: часть прошла, часть нет.
              Молчать нельзя — иначе человек решит, что оценены все. */}
          {partial && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-[11px] leading-snug text-amber-800">
                {d.teacher.bulkPartialSaved
                  .replace("{ok}", String(partial.ok))
                  .replace("{all}", String(partial.all))}
              </p>
            </div>
          )}

          {/* Любой другой отказ базы: окно не закрылось — надо сказать почему. */}
          {saveError === "failed" && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
              <p className="text-xs font-bold text-red-700">{d.common.error}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-red-600">{d.common.retry}</p>
            </div>
          )}

          {/* Grade picker */}
          <div>
            <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">{dl.gradeChoose}</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((g) => {
                const c = GRADE_COLORS[g]!;
                const active = grade === g;
                return (
                  <button
                    key={g}
                    onClick={() => selectGrade(g)}
                    className={cn(
                      "flex h-14 w-14 flex-col items-center justify-center rounded-2xl font-extrabold text-xl transition-all active:scale-95",
                      c.bg, c.text,
                      active ? `ring-2 ring-offset-2 ${c.ring} scale-110 shadow-lg` : "opacity-70 hover:opacity-90",
                    )}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment presets */}
          {grade != null && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Комментарий</p>
              <div className="space-y-1.5">
                {presets.map((text, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedPreset(i); setIsOther(false); setCustomText(""); }}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all",
                      selectedPreset === i && !isOther
                        ? "border-brand-blue bg-blue-50 text-brand-blue"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    {selectedPreset === i && !isOther && <Check className="mr-1.5 inline h-3.5 w-3.5" />}
                    {text}
                  </button>
                ))}
                <button
                  onClick={() => { setIsOther(true); setSelectedPreset(null); }}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all",
                    isOther
                      ? "border-brand-blue bg-blue-50 text-brand-blue"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  {isOther && <Check className="mr-1.5 inline h-3.5 w-3.5" />}
                  {dl.gradeOther}
                </button>
                {isOther && (
                  <textarea
                    autoFocus
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder={dl.gradeOtherPlaceholder}
                    rows={2}
                    className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-blue/90 active:scale-95 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
            {dl.gradeSave}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
