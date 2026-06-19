"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MapPin, Calendar, Clock, CalendarX, X } from "lucide-react";
import { getSubjectStyle, formatTime, formatDate, getDictionary } from "@snr/core";
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
  const heroSub = lesson.title ?? lesson.topic ?? `${dl.lessonOf.replace("{date}", formatDate(lesson.starts_at))}`;
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
    <div className="mx-auto max-w-5xl space-y-6 text-[#1a1b21]">
      <Link
        href="/schedule"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" />
        {dl.back}
      </Link>

      {/* Hero (design lesson_start: deep blue → purple glass) */}
      <div
        className="anim-fade-up relative overflow-hidden rounded-[32px] p-8 text-white shadow-2xl md:p-10"
        style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #4f2fae 55%, #7c3aed 100%)",
          boxShadow: "0 30px 60px -20px rgba(80,40,180,0.45)",
        }}
      >
        {/* luminous glow */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-10 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          {/* Left: info */}
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200 backdrop-blur-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
              {secsUntil !== null && secsUntil <= 3600 ? dl.nowStarting : `${style.label} · ${lesson.group.name}`}
            </span>

            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight md:text-[42px] md:leading-[1.1]">
              {heroTitle}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85 md:text-base">
              {heroSub}
            </p>
            {lesson.description && (
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">{lesson.description}</p>
            )}

            {/* Chips */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-medium backdrop-blur-sm">
                <Calendar className="h-4 w-4 text-white/70" />
                {fullDate(lesson.starts_at)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-medium backdrop-blur-sm">
                <Clock className="h-4 w-4 text-white/70" />
                {timeRange}
              </span>
              {lesson.room && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-medium backdrop-blur-sm">
                  <MapPin className="h-4 w-4 text-white/70" />
                  {dl.cabinet} {lesson.room}
                </span>
              )}
            </div>

            {/* Teacher chip */}
            {lesson.teacher && (
              <div className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-2.5 backdrop-blur-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                  {initials(lesson.teacher.full_name)}
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{lesson.teacher.full_name}</p>
                  <p className="text-[11px] text-white/60">{d.teacher.role}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right: countdown ring */}
          <div className="flex shrink-0 flex-col items-center gap-3">
            <div className="relative h-[160px] w-[160px]">
              <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
                <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="8" />
                <circle
                  cx="80" cy="80" r={R} fill="none"
                  stroke={isUrgent ? "#fb7185" : "#67e8f9"}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C - dash}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`font-mono text-3xl font-extrabold tabular-nums ${isUrgent ? "animate-pulse text-rose-300" : "text-white"}`}>
                  {counterText}
                </span>
              </div>
            </div>
            <p className="max-w-[180px] text-center text-[12px] leading-snug text-white/70">
              {secsUntil !== null
                ? dl.countdownNote.replace("{n}", String(secsUntil))
                : dl.startsInLabel.replace("{time}", "—")}
            </p>
            <button
              onClick={() => router.refresh()}
              className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/30 transition-transform hover:scale-105 active:scale-95"
            >
              {dl.goToLesson} <span className="opacity-80">{dl.goToLessonNow}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Excuse section */}
      {studentId && excuse !== undefined && (
        <div className="anim-fade-up anim-delay-1">
          {excuse ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <CalendarX className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">{dl.excuse.requestedTitle}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {dl.excuse.reasonPrefix} {excuse.reason}
                  </p>
                </div>
              </div>
              <button
                onClick={cancelExcuse}
                className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                {dl.excuse.cancelRequest}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-xl transition-all hover:border-blue-300 hover:text-blue-600"
            >
              <CalendarX className="h-4 w-4" />
              {dl.excuse.button}
            </button>
          )}
        </div>
      )}

      {/* Excuse modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{ background: "#ffffff" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between">
              <h3 className="text-lg font-bold text-slate-900">{dl.excuse.title}</h3>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-500">{dl.excuse.subtitle}</p>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">{dl.excuse.reasonLabel}</label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (error) setError(""); }}
              placeholder={dl.excuse.reasonPlaceholder}
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                {dl.excuse.cancel}
              </button>
              <button
                onClick={submitExcuse}
                disabled={submitting || reason.trim().length < 5}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-700 disabled:opacity-50"
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
