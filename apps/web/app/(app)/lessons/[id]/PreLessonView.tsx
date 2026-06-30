"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MapPin, Clock, CalendarX, Calendar, X } from "lucide-react";
import { getSubjectStyle, formatTime, formatDate, getDictionary } from "@snr/core";
import type { StudentLessonView, ExcuseRequest, Locale } from "@snr/core";
import {
  getMyExcuseRequest, createExcuseRequest, deleteExcuseRequest,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { useRealtimeChannel } from "@/lib/realtime";

export function PreLessonView({
  lesson,
  studentId,
}: {
  lesson: StudentLessonView;
  studentId: string | null;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dl = d.lesson;
  const router = useRouter();
  const dbRef = useRef<ReturnType<typeof createClient> | null>(null);
  const style = getSubjectStyle(lesson.group.subject);

  // Live clock (client-only — null on SSR to avoid hydration mismatch)
  const [nowMs, setNowMs] = useState<number | null>(null);

  // Excuse request state
  const [excuse, setExcuse] = useState<ExcuseRequest | null | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // createClient() must run only in the browser (accesses document.cookie)
    const db = createClient();
    dbRef.current = db;

    setNowMs(Date.now());
    const clockId = setInterval(() => setNowMs(Date.now()), 1000);

    if (studentId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getMyExcuseRequest(db as any, lesson.id, studentId)
        .then((e) => setExcuse(e))
        .catch(() => setExcuse(null));
    } else {
      setExcuse(null);
    }

    return () => clearInterval(clockId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, studentId]);

  // Realtime: when teacher starts the lesson (status → in_progress), refresh
  useRealtimeChannel(`lesson-status-${lesson.id}`, "lessons", `id=eq.${lesson.id}`, () => {
    router.refresh();
  });

  const startMs = new Date(lesson.starts_at).getTime();
  const secsUntil = nowMs === null ? null : Math.max(0, Math.floor((startMs - nowMs) / 1000));

  // When countdown reaches zero, refresh once
  const firedRef = useRef(false);
  useEffect(() => {
    if (secsUntil === 0 && !firedRef.current) {
      firedRef.current = true;
      router.refresh();
    }
  }, [secsUntil, router]);

  async function submitExcuse() {
    const db = dbRef.current;
    if (!studentId || !db) return;
    if (reason.trim().length < 5) { setError(dl.excuse.minLengthError); return; }
    setSubmitting(true);
    setError("");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await createExcuseRequest(db as any, lesson.id, studentId, reason);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = await getMyExcuseRequest(db as any, lesson.id, studentId);
      setExcuse(e);
      setModalOpen(false);
      setReason("");
    } catch {
      setError(d.common.error ?? "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelExcuse() {
    const db = dbRef.current;
    if (!studentId || !db) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await deleteExcuseRequest(db as any, lesson.id, studentId);
      setExcuse(null);
    } catch { /* noop */ }
  }

  const heroTitle = lesson.subjectName ?? style.label;
  const timeRange = lesson.ends_at
    ? `${formatTime(lesson.starts_at)} — ${formatTime(lesson.ends_at)}`
    : formatTime(lesson.starts_at);
  const dateStr = formatDate(lesson.starts_at);

  // Countdown display
  const isUrgent = secsUntil !== null && secsUntil < 60;
  const showCounter = secsUntil !== null && secsUntil <= 3600;
  const mm = secsUntil !== null ? Math.floor(secsUntil / 60) : 0;
  const ss = secsUntil !== null ? secsUntil % 60 : 0;
  const hours = secsUntil !== null ? Math.floor(secsUntil / 3600) : 0;
  const counterText =
    secsUntil === null ? "—:—"
    : showCounter ? `${mm}:${String(ss).padStart(2, "0")}`
    : hours > 0 ? `${hours} ч ${Math.floor((secsUntil % 3600) / 60)} м`
    : `${mm} м`;

  // SVG ring (r=140 for the larger w-96 circle)
  const R = 140;
  const C = 2 * Math.PI * R;
  const frac = secsUntil === null ? 1 : Math.min(1, secsUntil / 3600);

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 text-white">
      {/* Back link */}
      <Link
        href="/schedule"
        className="absolute left-6 top-6 z-10 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white/80 backdrop-blur-md transition hover:bg-white/20"
      >
        <ChevronLeft className="h-4 w-4" />
        {dl.back}
      </Link>

      {/* 2-column grid */}
      <div className="grid min-h-screen grid-cols-1 gap-10 px-6 pb-16 pt-24 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-16 lg:py-16">

        {/* LEFT: Info */}
        <div className="flex flex-col">
          {/* Live badge */}
          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-cyan-200 backdrop-blur-md">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
            {dl.nowStarting}
          </span>

          {/* Subject name */}
          <h1 className="mb-4 text-5xl font-black leading-tight tracking-tight md:text-6xl lg:text-7xl">
            {heroTitle}
          </h1>

          {/* Group · Teacher */}
          <p className="mb-8 text-xl font-medium text-white/70 md:text-2xl">
            {lesson.group.name}
            {lesson.teacher ? ` · ${lesson.teacher.full_name}` : ""}
          </p>

          {/* Date / Time / Room pills */}
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2 text-sm font-medium backdrop-blur-md">
              <Calendar className="h-4 w-4 text-white/60" />
              {dateStr}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2 text-sm font-medium backdrop-blur-md">
              <Clock className="h-4 w-4 text-white/60" />
              {timeRange}
            </span>
            {lesson.room && (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2 text-sm font-medium backdrop-blur-md">
                <MapPin className="h-4 w-4 text-white/60" />
                {dl.cabinet} {lesson.room}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT: Timer + excuse */}
        <div className="flex flex-col items-center gap-6">
          {/* Countdown ring */}
          <div className="relative flex h-72 w-72 items-center justify-center md:h-96 md:w-96">
            <svg viewBox="0 0 320 320" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="160" cy="160" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
              <circle
                cx="160" cy="160" r={R} fill="none"
                stroke={isUrgent ? "#fb7185" : "#67e8f9"}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - frac)}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <span className={`font-mono text-7xl font-extrabold tabular-nums leading-none md:text-8xl ${isUrgent ? "animate-pulse text-rose-300" : "text-white"}`}>
              {counterText}
            </span>
          </div>

          {/* Excuse button (replaces the old "Перейти сейчас") */}
          {studentId && excuse !== undefined && !excuse && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/20 px-6 py-2.5 text-sm font-semibold text-cyan-200 backdrop-blur-md transition hover:bg-cyan-400/30"
            >
              <CalendarX className="h-4 w-4" />
              {dl.excuse.button}
            </button>
          )}
          {studentId && excuse && (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm text-white/80 backdrop-blur-md">
              <CalendarX className="h-4 w-4 text-white/50" />
              {dl.excuse.requestedTitle}
              <button onClick={cancelExcuse} className="ml-1 text-white/40 hover:text-white/80">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Excuse modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#1e293b] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between">
              <h3 className="text-lg font-bold text-white">{dl.excuse.title}</h3>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 text-white/40 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-white/60">{dl.excuse.subtitle}</p>
            <label className="mb-1.5 block text-sm font-medium text-white/80">{dl.excuse.reasonLabel}</label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (error) setError(""); }}
              placeholder={dl.excuse.reasonPlaceholder}
              rows={3}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
            />
            {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/5"
              >
                {dl.excuse.cancel}
              </button>
              <button
                onClick={submitExcuse}
                disabled={submitting || reason.trim().length < 5}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? dl.excuse.sending : dl.excuse.submit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
