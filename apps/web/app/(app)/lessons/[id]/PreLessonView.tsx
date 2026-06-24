"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MapPin, Clock, CalendarX, X } from "lucide-react";
import { getSubjectStyle, formatTime, getDictionary } from "@snr/core";
import type { StudentLessonView, ExcuseRequest, Locale } from "@snr/core";
import {
  getMyExcuseRequest, createExcuseRequest, deleteExcuseRequest,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { useRealtimeChannel } from "@/lib/realtime";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric", weekday: "long", timeZone: "Asia/Tashkent",
  });
}

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
  const db = createClient();
  const style = getSubjectStyle(lesson.group.subject);

  // Live clock (client-only → null on first paint to avoid hydration mismatch)
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Excuse request state
  const [excuse, setExcuse] = useState<ExcuseRequest | null | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId) { setExcuse(null); return; }
    getMyExcuseRequest(db as never, lesson.id, studentId)
      .then((e) => setExcuse(e))
      .catch(() => setExcuse(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, studentId]);

  // Realtime: when the teacher starts the lesson (status → in_progress), refresh
  // so the page re-renders into the live-lesson workspace.
  useRealtimeChannel(`lesson-status-${lesson.id}`, "lessons", `id=eq.${lesson.id}`, () => {
    router.refresh();
  });

  const startMs = new Date(lesson.starts_at).getTime();
  const secsUntil = nowMs === null ? null : Math.max(0, Math.floor((startMs - nowMs) / 1000));

  // When the countdown hits zero, refresh once (teacher may have just started).
  const firedRef = useRef(false);
  useEffect(() => {
    if (secsUntil === 0 && !firedRef.current) {
      firedRef.current = true;
      router.refresh();
    }
  }, [secsUntil, router]);

  async function submitExcuse() {
    if (!studentId) return;
    if (reason.trim().length < 5) { setError(dl.excuse.minLengthError); return; }
    setSubmitting(true);
    setError("");
    try {
      await createExcuseRequest(db as never, lesson.id, studentId, reason);
      const e = await getMyExcuseRequest(db as never, lesson.id, studentId);
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
    if (!studentId) return;
    try {
      await deleteExcuseRequest(db as never, lesson.id, studentId);
      setExcuse(null);
    } catch { /* noop */ }
  }

  const heroTitle = style.label;
  const timeRange = lesson.ends_at
    ? `${formatTime(lesson.starts_at)} — ${formatTime(lesson.ends_at)}`
    : formatTime(lesson.starts_at);

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

  // Ring progress (fraction of the final hour remaining)
  const R = 70;
  const C = 2 * Math.PI * R;
  const frac = secsUntil === null ? 1 : Math.min(1, secsUntil / 3600);
  const dash = C * frac;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)",
      }}
    >
      {/* Glow blobs */}
      <div className="pointer-events-none absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-1/4 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />

      {/* Back link */}
      <Link
        href="/schedule"
        className="absolute left-6 top-6 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white/80 backdrop-blur-md transition hover:bg-white/20"
      >
        <ChevronLeft className="h-4 w-4" />
        {dl.back}
      </Link>

      {/* Live badge */}
      <span className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-cyan-300 backdrop-blur-md">
        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
        {dl.nowStarting}
      </span>

      {/* Subject */}
      <p className="mb-2 text-3xl font-bold tracking-tight">{heroTitle}</p>

      {/* Group · Teacher */}
      <p className="mb-10 text-xl font-medium text-white/60">
        {lesson.group.name}
        {lesson.teacher ? ` · ${lesson.teacher.full_name}` : ""}
      </p>

      {/* Countdown ring + text-8xl number */}
      <div className="relative mb-8 flex h-64 w-64 items-center justify-center">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="6" />
          <circle
            cx="100" cy="100" r="90" fill="none"
            stroke={isUrgent ? "#fb7185" : "#67e8f9"}
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 90}
            strokeDashoffset={2 * Math.PI * 90 * (1 - frac)}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <span className={`font-mono text-8xl font-extrabold tabular-nums leading-none ${isUrgent ? "animate-pulse text-rose-300" : "text-white"}`}>
          {counterText}
        </span>
      </div>

      {/* Room + time */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-sm backdrop-blur-md">
          <Clock className="h-4 w-4 text-white/60" />
          {timeRange}
        </span>
        {lesson.room && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-sm backdrop-blur-md">
            <MapPin className="h-4 w-4 text-white/60" />
            {dl.cabinet} {lesson.room}
          </span>
        )}
      </div>

      {/* Refresh + excuse actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.refresh()}
          className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/30 transition-transform hover:scale-105 active:scale-95"
        >
          {dl.goToLesson} <span className="opacity-80">{dl.goToLessonNow}</span>
        </button>

        {studentId && excuse !== undefined && !excuse && (
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white/80 backdrop-blur-md transition hover:bg-white/20"
          >
            <CalendarX className="h-4 w-4" />
            {dl.excuse.button}
          </button>
        )}
        {studentId && excuse && (
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/80 backdrop-blur-md">
            <CalendarX className="h-4 w-4 text-white/50" />
            {dl.excuse.requestedTitle}
            <button onClick={cancelExcuse} className="ml-1 text-white/40 hover:text-white/80">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
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
