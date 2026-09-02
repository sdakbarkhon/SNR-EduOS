"use client";

import { useEffect, useRef, useState } from "react";
import { Check, UserX, BookMarked, Lock, Star } from "lucide-react";
import {
  getTeacherLessonAttendance,
  markStudentAttendance,
  getLessonGrades,
  getDictionary,
  isMarkLockedError,
  markLockState,
  type AttendanceRollCallRow,
  type AttendanceStatus,
  type LessonGrade,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useSchoolNowSnapshot } from "@/components/SchoolTimeProvider";
import { useLocale } from "@/components/LocaleProvider";
import { cn } from "@/lib/cn";
import { GradeModal, type GradeTarget } from "./GradeModal";

type Props = {
  lessonId: string;
  teacherId: string;
  lessonStatus: "scheduled" | "in_progress" | "completed";
  /** Map of studentId → excuse reason; rows get a red stripe + tooltip. */
  excused?: Record<string, string>;
  /** Called whenever rows change; parent can use to check completeness. */
  onStatusChange?: (allMarked: boolean, unmarkedNames: string[]) => void;
};

export function AttendanceRollCall({ lessonId, teacherId, lessonStatus, excused, onStatusChange }: Props) {
  // Z.3, заход 3 — школьное «сейчас» для обработчика.
  const schoolNowMs = useSchoolNowSnapshot();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dt = d.teacher;
  const db = createClient();

  const [rows, setRows] = useState<AttendanceRollCallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedId, setSavedId] = useState<string | null>(null);
  // Почему кнопка не сработала. Молча откатывать нельзя — учитель должен
  // понять, что произошло.
  //   "locked" — замок миграций 203/245: база сказала mark_locked;
  //   "failed" — любой другой отказ базы.
  // 31.08.2026. Раньше вторая ветка уходила только в console.error, и экран
  // не показывал ничего. Так восемь дней пряталась поломка миграции 225:
  // база падала сырой ошибкой, а учитель видел просто «ничего не произошло».
  const [notice, setNotice] = useState<null | "locked" | "failed">(null);
  // Grades map: studentId → LessonGrade
  const [gradesMap, setGradesMap] = useState<Record<string, LessonGrade>>({});
  // Grade modal state
  const [gradeTarget, setGradeTarget] = useState<GradeTarget | null>(null);
  // Массовое действие: идёт ли и чем кончилось (пункт 15).
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkPartial, setBulkPartial] = useState<{ ok: number; all: number } | null>(null);
  const [bulkDone, setBulkDone] = useState<number | null>(null);

  const isFinalized = lessonStatus === "completed" || rows.some((r) => r.is_finalized);
  const readOnly = isFinalized;
  // Grade button is ALWAYS active regardless of lesson status

  // 23.08.2026 (миграция 225) — МАШИННЫЙ ПРОГУЛ.
  // Закрывая урок, автозавершение ставит «Пропуск без причины» каждому
  // неотмеченному и тут же запирает всю перекличку. Автора у такой строки нет:
  // marked_by остаётся пустым, потому что её никто не нажимал. Для учителя это
  // не чужая проверка, а всё тот же неотмеченный ученик — поэтому исправить её
  // он вправе и после запирания. База разрешает по тому же признаку.
  const isMachineMark = (r: AttendanceRollCallRow) => r.status !== null && r.marked_by === null;
  // Заперта СТРОКА, а не весь список: запирать нечего там, где отметку никто не
  // ставил. Иначе выходило так: учитель исправил машинный прогул, промахнулся
  // кнопкой — и снова заперт, потому что вся перекличка помечена финализованной.
  //
  // ЭТО НЕ ЗАМОК ПЯТНАДЦАТИ МИНУТ, А ЗЕРКАЛО ПРАВИЛА ДОСТУПА. Правило
  // «teacher updates attendance» пускает учителя при is_finalized = false ЛИБО
  // marked_by IS NULL. Миграция 245 его не трогала, поэтому и здесь ничего не
  // меняется: отпустить кнопку на идущем уроке значило бы дать учителю нажать
  // и молча ничего не получить — правило вернуло бы ноль строк без ошибки.
  // Финализованную перекличку проставляет только автозавершение и только
  // завершённому уроку, так что на идущем уроке эта ветка не срабатывает.
  const rowLocked = (r: AttendanceRollCallRow) => r.is_finalized && !isMachineMark(r);
  const hasFixableRows = readOnly && rows.some((r) => !rowLocked(r));

  /**
   * МОЖНО ЛИ МЕНЯТЬ ЭТУ СТРОКУ — ОДИН ОТВЕТ НА ВЕСЬ ЭКРАН.
   *
   * 02.09.2026, пункт 15. Массовая отметка обязана слушаться того же правила,
   * что и одиночная, и брать его ОТСЮДА, а не заводить свою копию: и правило
   * доступа (rowLocked), и замок пятнадцати минут (markLockState из
   * packages/core) спрашиваются в одном месте, обоими путями.
   */
  const canChange = (r: AttendanceRollCallRow) => {
    if (rowLocked(r)) return false;
    // Часы машинной отметки завела машина — считать по ним нельзя (миграция 225).
    if (isMachineMark(r)) return true;
    return !markLockState({ stamp: r.marked_at, lesson: lessonStatus }).locked;
  };

  /**
   * ЧЬЕГО РЕШЕНИЯ ЕЩЁ НЕТ. Массовая отметка трогает только этих.
   *
   * Два случая, и оба означают «учитель сюда ещё не решал»:
   *   • отметки нет вовсе (status === null);
   *   • отметку раздало автозавершение (машинный прогул, marked_by пуст) —
   *     миграция 225 прямо называет её правку ПЕРВЫМ выставлением человеком.
   *
   * Уже отмеченных массовое действие НЕ переписывает. Это решение, а не
   * упрощение: учитель отметил двоих отсутствующими, потом нажал «отметить
   * остальных» — и если бы кнопка перебила его работу, восстанавливать её
   * было бы нечем. Заодно кнопка никогда не упирается в замок: у строки без
   * отметки нет и отметки времени, а машинная отметка из-под замка выведена
   * миграцией 225. Менять уже отмеченного — по одному, как и раньше.
   */
  const pending = (r: AttendanceRollCallRow) => (r.status === null || isMachineMark(r)) && canChange(r);
  const pendingRows = rows.filter(pending);

  // Notify parent whenever rows change. The callback is kept in a ref and is NOT
  // an effect dependency: callers often pass an inline arrow (new reference every
  // render), which — combined with the fresh `names` array we hand back — would
  // otherwise put parent and child in an infinite render loop. Depend on `rows`
  // only, so this fires exactly when the roll-call data actually changes.
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; });
  useEffect(() => {
    if (rows.length === 0) return;
    const unmarked = rows.filter((r) => r.status === null);
    onStatusChangeRef.current?.(unmarked.length === 0, unmarked.map((r) => r.full_name));
  }, [rows]);

  useEffect(() => {
    getTeacherLessonAttendance(db, lessonId)
      .then(setRows)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [lessonId]);

  useEffect(() => {
    getLessonGrades(db, lessonId)
      .then((grades) => {
        const map: Record<string, LessonGrade> = {};
        grades.forEach((g) => { map[g.student_id] = g; });
        setGradesMap(map);
      })
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function setStatus(
    studentId: string, oldStatus: AttendanceStatus | null, next: AttendanceStatus,
  ) {
    if (next === oldStatus) return;
    const current = rows.find((r) => r.student_id === studentId);
    if (!current || rowLocked(current)) return;
    // Часы замка машинной отметки завела машина — считать по ним нельзя, иначе
    // прогул, поставленный час назад, оказывается запертым ещё до нажатия.
    //
    // 31.08.2026 (миграция 245). В markLockState уходит и статус урока: пока
    // урок идёт, замка нет, и экран обязан это знать. Своего отсчёта здесь нет
    // и не должно быть — правило записано один раз, в packages/core.
    if (!canChange(current)) { setNotice("locked"); return; }
    setNotice(null);
    setRows((prev) =>
      prev.map((r) =>
        r.student_id === studentId
          ? {
              ...r,
              status: next,
              marked_at: new Date(schoolNowMs()).toISOString(),
              // Исправленная строка перестаёт быть машинной: у неё появляется
              // автор, и дальше действует обычное правило пятнадцати минут.
              marked_by: teacherId,
              is_finalized: false,
            }
          : r,
      ),
    );
    try {
      await markStudentAttendance(db, lessonId, studentId, next, teacherId);
      setSavedId(studentId);
      setTimeout(() => setSavedId(null), 1500);
    } catch (err) {
      // Возвращаем строку целиком, а не одно поле: иначе откат затирал бы
      // marked_at и признак автора значениями, которых в базе не было.
      setRows((prev) => prev.map((r) => (r.student_id === studentId ? current : r)));
      if (isMarkLockedError(err)) setNotice("locked");
      else { setNotice("failed"); console.error("[AttendanceRollCall] отметка не сохранилась:", err); }
    }
  }

  /**
   * ОТМЕТИТЬ ОСТАЛЬНЫХ (02.09.2026, пункт 15).
   *
   * ЧАСТИЧНЫЙ ОТКАЗ НЕ РОНЯЕТ ВСЁ. allSettled, а не all: у отметок нет ни
   * транзакции, ни порядка, и терять девять сохранённых из-за одного отказа
   * было бы хуже всего. Прошедшие остаются на экране, у непрошедших строка
   * возвращается к прежнему виду, и человеку говорят числом, сколько прошло.
   *
   * МАШИННЫЙ ПРИЗНАК СНИМАЕТСЯ ПРАВИЛЬНО. markStudentAttendance пишет
   * marked_by = teacherId и is_finalized = false — та же функция, что и у
   * одиночной кнопки. Значит, исправленный машинный прогул становится
   * учительской отметкой, и дальше на неё действует обычное правило
   * пятнадцати минут, как обещала миграция 225.
   */
  async function markAll(next: AttendanceStatus) {
    const цели = rows.filter(pending);
    if (цели.length === 0) return;
    setNotice(null);
    setBulkPartial(null);
    setBulkDone(null);
    setBulkBusy(true);

    const было = new Map(цели.map((r) => [r.student_id, r]));
    setRows((prev) =>
      prev.map((r) => (было.has(r.student_id)
        ? {
            ...r,
            status: next,
            marked_at: new Date(schoolNowMs()).toISOString(),
            // Отметка перестаёт быть машинной: у неё появляется автор.
            marked_by: teacherId,
            is_finalized: false,
          }
        : r)),
    );

    const итоги = await Promise.allSettled(
      цели.map((r) => markStudentAttendance(db, lessonId, r.student_id, next, teacherId)),
    );
    setBulkBusy(false);

    const упавшие = цели.filter((_, i) => итоги[i]!.status === "rejected");
    if (упавшие.length === 0) {
      // Молчаливого успеха быть не должно: строки, конечно, перекрасились, но
      // сказать «сохранено, столько-то» дешевле, чем заставлять пересчитывать
      // глазами. Одиночная кнопка так и делает — «Сохранено» у строки.
      setBulkDone(цели.length);
      setTimeout(() => setBulkDone(null), 2500);
      return;
    }
    // Возвращаем ТОЛЬКО непрошедшие строки целиком — прошедшие остаются
    // такими, какими их приняла база.
    const вернуть = new Map(упавшие.map((r) => [r.student_id, r]));
    setRows((prev) => prev.map((r) => вернуть.get(r.student_id) ?? r));

    const причины = итоги.flatMap((r) => (r.status === "rejected" ? [r.reason] : []));
    if (причины.some((e) => isMarkLockedError(e))) setNotice("locked");
    else { setNotice("failed"); console.error("[AttendanceRollCall] часть отметок не сохранилась:", причины[0]); }
    setBulkPartial({ ok: цели.length - упавшие.length, all: цели.length });
  }

  const [gradeSavedToast, setGradeSavedToast] = useState(false);

  const present     = rows.filter((r) => r.status === "present").length;
  const excusedCount = rows.filter((r) => r.status === "absent_excused").length;
  const unexcused   = rows.filter((r) => r.status === "absent_unexcused").length;
  const unmarked  = rows.filter((r) => r.status === null).length;

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl">
        <p className="text-sm text-gray-400">{d.common.loading}</p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">
            {dt.rollCallTitle}
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">
            {!readOnly
              ? dt.rollCallSubtitle
              : hasFixableRows
                ? dt.rollCallAutoFixNote
                : dt.rollCallFinalizedNote}
          </p>
        </div>
        {/* Замок только там, где правда заперто: машинные прогулы ещё правятся. */}
        {readOnly && !hasFixableRows && <Lock className="h-4 w-4 text-gray-400" />}
      </div>

      {/* Stats */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600">
            <Check className="h-3.5 w-3.5" /> {dt.rollCallPresent}: {present}
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-yellow-600">
            <BookMarked className="h-3.5 w-3.5" /> {dt.rollCallExcused}: {excusedCount}
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-red-500">
            <UserX className="h-3.5 w-3.5" /> {dt.rollCallUnexcused}: {unexcused}
          </span>
          {!readOnly && unmarked > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-[12px] font-semibold text-gray-400">
                {d.lesson.attendanceUnmarkedCount.replace("{count}", String(unmarked))}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Массовые действия (02.09.2026, пункт 15) ─────────────────────────
          Трогают ТОЛЬКО тех, чьего решения ещё нет: неотмеченных и машинные
          прогулы. Уже отмеченных не переписывают — их меняют по одному, как и
          раньше. Поэтому кнопки исчезают, когда трогать некого. */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
              {dt.rollCallMarkAll}
            </span>
            {pendingRows.length === 0 ? (
              <span className="text-[12px] font-medium text-gray-400">{dt.rollCallMarkAllNone}</span>
            ) : (
              <>
                {([
                  ["present", dt.rollCallPresent, Check, "hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"],
                  ["absent_excused", dt.rollCallExcused, BookMarked, "hover:bg-yellow-50 hover:text-yellow-600 hover:border-yellow-200"],
                  ["absent_unexcused", dt.rollCallUnexcused, UserX, "hover:bg-red-50 hover:text-red-500 hover:border-red-200"],
                ] as Array<[AttendanceStatus, string, typeof Check, string]>).map(([st, label, Icon, hover]) => (
                  <button
                    key={st}
                    onClick={() => markAll(st)}
                    disabled={bulkBusy}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition-colors disabled:opacity-50",
                      hover,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
                <button
                  onClick={() => setGradeTarget({
                    kind: "all",
                    students: rows
                      .filter((r) => !gradesMap[r.student_id])
                      .map((r) => ({ id: r.student_id, name: r.full_name })),
                  })}
                  disabled={bulkBusy || rows.every((r) => gradesMap[r.student_id])}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                >
                  <Star className="h-3.5 w-3.5" /> {dt.rollCallGradeAll}
                </button>
              </>
            )}
          </div>
          {pendingRows.length > 0 && (
            <p className="mt-1.5 text-[11px] leading-snug text-gray-400">
              {dt.rollCallMarkAllHint.replace("{n}", String(pendingRows.length))}
            </p>
          )}
        </div>
      )}

      {/* Массовое действие прошло целиком. */}
      {bulkDone !== null && (
        <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
          <Check className="h-4 w-4" /> {dt.rollCallSaved}: {bulkDone}
        </div>
      )}

      {/* Частичный отказ массового действия: часть прошла, часть нет. */}
      {bulkPartial && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <p className="text-[11px] leading-snug text-amber-800">
            {dt.bulkPartialSaved
              .replace("{ok}", String(bulkPartial.ok))
              .replace("{all}", String(bulkPartial.all))}
          </p>
        </div>
      )}

      {/* Замок: прошло больше 15 минут, урок уже не идёт — правит администратор. */}
      {notice === "locked" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <p className="text-xs font-bold text-amber-800">{d.lesson.markLockedTitle}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-amber-700">{d.lesson.markLockedBody}</p>
        </div>
      )}
      {/* Любой другой отказ базы: молчать нельзя, кнопка ведь откатилась. */}
      {notice === "failed" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <p className="text-xs font-bold text-red-700">{d.common.error}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-red-600">{d.common.retry}</p>
        </div>
      )}

      {/* Grade saved toast */}
      {gradeSavedToast && (
        <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700">
          <Check className="h-4 w-4" /> {d.lesson.gradeSaved}
        </div>
      )}

      {/* Student list */}
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">{d.common.none}</p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden bg-white">
          {rows.map((row) => {
            const st = row.status;
            const excuseReason = excused?.[row.student_id];
            return (
              <div
                key={row.student_id}
                title={excuseReason ? `${d.lesson.excuse.reasonPrefix} ${excuseReason}` : undefined}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  excuseReason && "border-l-4 border-red-400 bg-red-50/40",
                )}
              >
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                  st === null ? "bg-slate-100 text-slate-400" : "bg-slate-100 text-slate-600",
                )}>
                  {row.full_name.charAt(0).toUpperCase()}
                </div>
                <span className={cn(
                  "flex-1 text-[13px] font-semibold truncate",
                  st === null ? "text-slate-400" : "text-slate-800",
                )}>
                  {row.full_name}
                  {st === null && !readOnly && (
                    <span className="ml-2 text-[10px] font-medium text-orange-400">не отмечен</span>
                  )}
                  {/* Отметку поставила машина — учителю видно, что это не его рука. */}
                  {isMachineMark(row) && (
                    <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-50 text-orange-500">
                      {dt.rollCallAutoMarked}
                    </span>
                  )}
                </span>
                {savedId === row.student_id && (
                  <span className="text-[11px] font-semibold text-emerald-500">{dt.rollCallSaved}</span>
                )}
                {/* Grade button — выставление и перевыставление оценки всегда доступны. */}
                {(() => {
                  const lg = gradesMap[row.student_id];
                  if (!lg) {
                    return (
                      <button
                        onClick={() => setGradeTarget({ kind: "one", studentId: row.student_id, studentName: row.full_name, existing: null })}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                      >
                        <Star className="h-3 w-3" />
                        Оценить
                      </button>
                    );
                  }
                  return (
                    <button
                      onClick={() => setGradeTarget({ kind: "one", studentId: row.student_id, studentName: row.full_name, existing: lg })}
                      className="flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-200"
                    >
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      {lg.grade} <Check className="h-3 w-3" />
                    </button>
                  );
                })()}
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setStatus(row.student_id, st, "present")}
                    disabled={rowLocked(row)}
                    title={dt.rollCallPresent}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                      st === "present"
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-500",
                      rowLocked(row) && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setStatus(row.student_id, st, "absent_excused")}
                    disabled={rowLocked(row)}
                    title={dt.rollCallExcused}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                      st === "absent_excused"
                        ? "bg-yellow-400 text-white shadow-sm"
                        : "bg-gray-100 text-gray-400 hover:bg-yellow-50 hover:text-yellow-500",
                      rowLocked(row) && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <BookMarked className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setStatus(row.student_id, st, "absent_unexcused")}
                    disabled={rowLocked(row)}
                    title={dt.rollCallUnexcused}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                      st === "absent_unexcused"
                        ? "bg-red-500 text-white shadow-sm"
                        : "bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500",
                      rowLocked(row) && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <UserX className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grade modal */}
      {gradeTarget && (
        <GradeModal
          lessonId={lessonId}
          teacherId={teacherId}
          target={gradeTarget}
          lessonStatus={lessonStatus}
          onClose={() => setGradeTarget(null)}
          onSaved={(saved) => {
            // Массив: при «оценить остальных» приходят все прошедшие разом, а
            // при частичном отказе — только они. Окно в этом случае остаётся
            // открытым и само скажет, сколько не прошло.
            setGradesMap((prev) => {
              const next = { ...prev };
              for (const g of saved) next[g.student_id] = g;
              return next;
            });
            setGradeSavedToast(true);
            setTimeout(() => setGradeSavedToast(false), 2500);
          }}
        />
      )}
    </section>
  );
}
