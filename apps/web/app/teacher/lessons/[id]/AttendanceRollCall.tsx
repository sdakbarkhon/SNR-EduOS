"use client";

import { useEffect, useRef, useState } from "react";
import { Check, UserX, BookMarked, Lock, Star } from "lucide-react";
import {
  getTeacherLessonAttendance,
  markStudentAttendance,
  getLessonGrades,
  getDictionary,
  type AttendanceRollCallRow,
  type AttendanceStatus,
  type LessonGrade,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { cn } from "@/lib/cn";
import { GradeModal } from "./GradeModal";
import { useIsDemoSession } from "@/lib/useIsDemoSession";

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
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dt = d.teacher;
  const db = createClient();
  const isDemoSession = useIsDemoSession();

  const [rows, setRows] = useState<AttendanceRollCallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedId, setSavedId] = useState<string | null>(null);
  // Grades map: studentId → LessonGrade
  const [gradesMap, setGradesMap] = useState<Record<string, LessonGrade>>({});
  // Grade modal state
  const [gradeTarget, setGradeTarget] = useState<{ id: string; name: string } | null>(null);

  const isFinalized = lessonStatus === "completed" || rows.some((r) => r.is_finalized);
  const readOnly = isFinalized;
  // Grade button is ALWAYS active regardless of lesson status

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
    studentId: string, oldStatus: AttendanceStatus | null, next: AttendanceStatus, rowEditBlocked: boolean,
  ) {
    if (readOnly || next === oldStatus || rowEditBlocked) return;
    setRows((prev) =>
      prev.map((r) =>
        r.student_id === studentId ? { ...r, status: next, marked_at: new Date().toISOString() } : r,
      ),
    );
    try {
      await markStudentAttendance(db, lessonId, studentId, next, teacherId);
      setSavedId(studentId);
      setTimeout(() => setSavedId(null), 1500);
    } catch {
      setRows((prev) =>
        prev.map((r) => r.student_id === studentId ? { ...r, status: oldStatus, marked_at: null } : r),
      );
    }
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
            {readOnly ? dt.rollCallFinalizedNote : dt.rollCallSubtitle}
          </p>
        </div>
        {readOnly && <Lock className="h-4 w-4 text-gray-400" />}
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
                Не отмечено: {unmarked}
              </span>
            </>
          )}
        </div>
      )}

      {/* Grade saved toast */}
      {gradeSavedToast && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700">
          ✓ {d.lesson.gradeSaved}
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
            // is_demo === false: реальная запись — демо-сессии её менять нельзя.
            // null (записи нет) или true (уже демо) — можно.
            const rowEditBlocked = isDemoSession && row.is_demo === false;
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
                </span>
                {savedId === row.student_id && (
                  <span className="text-[11px] font-semibold text-emerald-500">{dt.rollCallSaved}</span>
                )}
                {/* Grade button — always active */}
                {(() => {
                  const lg = gradesMap[row.student_id];
                  return lg ? (
                    <button
                      onClick={() => setGradeTarget({ id: row.student_id, name: row.full_name })}
                      className="flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-200 transition-colors"
                    >
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      {lg.grade} ✓
                    </button>
                  ) : (
                    <button
                      onClick={() => setGradeTarget({ id: row.student_id, name: row.full_name })}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                    >
                      <Star className="h-3 w-3" />
                      Оценить
                    </button>
                  );
                })()}
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setStatus(row.student_id, st, "present", rowEditBlocked)}
                    disabled={readOnly || rowEditBlocked}
                    title={rowEditBlocked ? d.demoMode.cannotEditRealData : dt.rollCallPresent}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                      st === "present"
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-500",
                      (readOnly || rowEditBlocked) && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setStatus(row.student_id, st, "absent_excused", rowEditBlocked)}
                    disabled={readOnly || rowEditBlocked}
                    title={rowEditBlocked ? d.demoMode.cannotEditRealData : dt.rollCallExcused}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                      st === "absent_excused"
                        ? "bg-yellow-400 text-white shadow-sm"
                        : "bg-gray-100 text-gray-400 hover:bg-yellow-50 hover:text-yellow-500",
                      (readOnly || rowEditBlocked) && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <BookMarked className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setStatus(row.student_id, st, "absent_unexcused", rowEditBlocked)}
                    disabled={readOnly || rowEditBlocked}
                    title={rowEditBlocked ? d.demoMode.cannotEditRealData : dt.rollCallUnexcused}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                      st === "absent_unexcused"
                        ? "bg-red-500 text-white shadow-sm"
                        : "bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500",
                      (readOnly || rowEditBlocked) && "cursor-not-allowed opacity-60",
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
          studentId={gradeTarget.id}
          studentName={gradeTarget.name}
          existing={gradesMap[gradeTarget.id] ?? null}
          onClose={() => setGradeTarget(null)}
          onSaved={(saved) => {
            setGradesMap((prev) => ({ ...prev, [saved.student_id]: saved }));
            setGradeTarget(null);
            setGradeSavedToast(true);
            setTimeout(() => setGradeSavedToast(false), 2500);
          }}
        />
      )}
    </section>
  );
}
