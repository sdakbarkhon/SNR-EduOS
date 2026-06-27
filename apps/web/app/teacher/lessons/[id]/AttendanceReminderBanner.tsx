"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AlertTriangle, AlertCircle, CheckCircle2, ClipboardList, Award } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeChannel } from "@/lib/realtime";

export function AttendanceReminderBanner({
  lessonId,
  endsAt,
  status,
  onScrollToRollCall,
}: {
  lessonId: string;
  endsAt: string | null;
  status: string;
  onScrollToRollCall: () => void;
}) {
  const { locale } = useLocale();
  const dl = getDictionary(locale as Locale).lesson;

  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [hasAttendance, setHasAttendance] = useState(false);
  const dbRef = useRef(createClient());

  // One-time check: any attendance row for this lesson?
  useEffect(() => {
    if (status !== "in_progress") return;
    dbRef.current
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", lessonId)
      .then(({ count }) => setHasAttendance((count ?? 0) > 0), () => { /* noop */ });
  }, [lessonId, status]);

  // Realtime: flip to true on first INSERT
  useRealtimeChannel(
    status === "in_progress" ? `attendance-remind-${lessonId}` : null,
    "attendance",
    `lesson_id=eq.${lessonId}`,
    () => setHasAttendance(true),
  );

  // Update minutesLeft every 30 s
  useEffect(() => {
    if (status !== "in_progress" || !endsAt) return;
    const update = () => {
      setMinutesLeft((new Date(endsAt).getTime() - Date.now()) / 60_000);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [endsAt, status]);

  if (status !== "in_progress" || minutesLeft === null) return null;
  if (minutesLeft > 15 || minutesLeft <= 0) return null;

  const mins = Math.ceil(minutesLeft);
  const title = dl.attendanceReminderTitle.replace("{minutes}", String(mins));

  // 0-5 min, attendance done → yellow "check grades"
  if (minutesLeft <= 5 && hasAttendance) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 shadow-sm">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-800">{title}</p>
          <p className="text-sm text-amber-700">{dl.attendanceMadeCheckOthers}</p>
        </div>
        <Link
          href="/teacher/grades"
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-200"
        >
          <Award className="h-3.5 w-3.5" /> {dl.openGrades}
        </Link>
      </div>
    );
  }

  // 0-5 min, no attendance → RED urgent
  if (minutesLeft <= 5) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 shadow-sm">
        <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-red-800">{title}</p>
          <p className="text-sm text-red-700">{dl.attendanceReminderUrgent}</p>
        </div>
        <button
          onClick={onScrollToRollCall}
          className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-700"
        >
          <ClipboardList className="h-3.5 w-3.5" /> {dl.makeAttendance}
        </button>
      </div>
    );
  }

  // 5-15 min, no attendance → YELLOW hint
  if (!hasAttendance) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 shadow-sm">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-800">{title}</p>
          <p className="text-sm text-amber-700">{dl.attendanceReminderHint}</p>
        </div>
        <button
          onClick={onScrollToRollCall}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-4 py-2 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-200"
        >
          <ClipboardList className="h-3.5 w-3.5" /> {dl.makeAttendance}
        </button>
      </div>
    );
  }

  // 5-15 min, attendance done → no banner
  return null;
}
