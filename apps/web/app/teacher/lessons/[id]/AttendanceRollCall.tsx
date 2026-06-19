"use client";

import { useEffect, useState } from "react";
import { Check, UserX, BookMarked, Lock } from "lucide-react";
import {
  getTeacherLessonAttendance,
  markStudentAttendance,
  getDictionary,
  type AttendanceRollCallRow,
  type AttendanceStatus,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { cn } from "@/lib/cn";

type Props = {
  lessonId: string;
  teacherId: string;
  lessonStatus: "scheduled" | "in_progress" | "completed";
};

export function AttendanceRollCall({ lessonId, teacherId, lessonStatus }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dt = d.teacher;
  const db = createClient();

  const [rows, setRows] = useState<AttendanceRollCallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedId, setSavedId] = useState<string | null>(null);

  const isFinalized = lessonStatus === "completed" || rows.some((r) => r.is_finalized);
  const readOnly = isFinalized;

  useEffect(() => {
    getTeacherLessonAttendance(db, lessonId)
      .then(setRows)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [lessonId]);

  async function setStatus(studentId: string, oldStatus: AttendanceStatus | null, next: AttendanceStatus) {
    if (readOnly || next === oldStatus) return;
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

  const present   = rows.filter((r) => r.status === "present").length;
  const excused   = rows.filter((r) => r.status === "absent_excused").length;
  const unexcused = rows.filter((r) => r.status === "absent_unexcused").length;

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
            <BookMarked className="h-3.5 w-3.5" /> {dt.rollCallExcused}: {excused}
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-red-500">
            <UserX className="h-3.5 w-3.5" /> {dt.rollCallUnexcused}: {unexcused}
          </span>
        </div>
      )}

      {/* Student list */}
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">{d.common.none}</p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden bg-white">
          {rows.map((row) => {
            const st = row.status;
            return (
              <div key={row.student_id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[12px] font-bold text-slate-600">
                  {row.full_name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 text-[13px] font-semibold text-slate-800 truncate">
                  {row.full_name}
                </span>
                {savedId === row.student_id && (
                  <span className="text-[11px] font-semibold text-emerald-500">{dt.rollCallSaved}</span>
                )}
                <div className="flex shrink-0 gap-1">
                  {/* Present */}
                  <button
                    onClick={() => setStatus(row.student_id, st, "present")}
                    disabled={readOnly}
                    title={dt.rollCallPresent}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                      st === "present"
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-500",
                      readOnly && "cursor-default opacity-60",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  {/* Excused */}
                  <button
                    onClick={() => setStatus(row.student_id, st, "absent_excused")}
                    disabled={readOnly}
                    title={dt.rollCallExcused}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                      st === "absent_excused"
                        ? "bg-yellow-400 text-white shadow-sm"
                        : "bg-gray-100 text-gray-400 hover:bg-yellow-50 hover:text-yellow-500",
                      readOnly && "cursor-default opacity-60",
                    )}
                  >
                    <BookMarked className="h-3.5 w-3.5" />
                  </button>
                  {/* Unexcused */}
                  <button
                    onClick={() => setStatus(row.student_id, st, "absent_unexcused")}
                    disabled={readOnly}
                    title={dt.rollCallUnexcused}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                      st === "absent_unexcused"
                        ? "bg-red-500 text-white shadow-sm"
                        : "bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500",
                      readOnly && "cursor-default opacity-60",
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
    </section>
  );
}
