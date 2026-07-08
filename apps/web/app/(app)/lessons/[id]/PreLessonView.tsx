"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, MapPin, Clock, CalendarX, Calendar, X, ListChecks, Bell,
  Presentation, Code2, ClipboardCheck, Trophy, Puzzle, BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSubjectStyle, formatTime, formatDate, getDictionary } from "@snr/core";
import type { StudentLessonView, ExcuseRequest, Locale, LessonStagePreview, LessonContentType } from "@snr/core";
import {
  getMyExcuseRequest, createExcuseRequest, deleteExcuseRequest, getLessonStagesPreview,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { useRealtimeChannel } from "@/lib/realtime";

function stageTypeIcon(ct: LessonContentType | null): LucideIcon {
  switch (ct) {
    case "presentation": return Presentation;
    case "code": return Code2;
    case "quiz_qia": return ClipboardCheck;
    case "quiz_kahoot": return Trophy;
    case "wokwi": case "codesandbox":
    case "geogebra": case "phet": case "desmos": case "blockly_games": case "visualgo":
    case "p5js": case "excalidraw": case "learningapps": case "sqlonline": case "h5p":
      return Puzzle;
    default: return BookOpen;
  }
}

function stageTypeLabel(ct: LessonContentType | null, dl: ReturnType<typeof getDictionary>["lesson"]): string {
  switch (ct) {
    case "presentation": return dl.stageContentPresentation;
    case "code": return dl.stageContentCode;
    case "quiz_qia": return dl.stageContentQuizQia;
    case "quiz_kahoot": return dl.stageContentQuizKahoot;
    case "wokwi": return dl.stageContentWokwi;
    case "codesandbox": return dl.stageContentCodesandbox;
    case "geogebra": return dl.stageContentGeogebra;
    case "phet": return dl.stageContentPhet;
    case "desmos": return dl.stageContentDesmos;
    case "blockly_games": return dl.stageContentBlocklyGames;
    case "visualgo": return dl.stageContentVisualgo;
    case "p5js": return dl.stageContentP5js;
    case "excalidraw": return dl.stageContentExcalidraw;
    case "learningapps": return dl.stageContentLearningapps;
    case "sqlonline": return dl.stageContentSqlonline;
    case "h5p": return dl.stageContentH5p;
    default: return "";
  }
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

  // Stage plan preview — safe fields only (id/title/content_type/position/
  // duration_min), fetched separately from `lesson.stages` so we never ship
  // config/slides/quiz data to the client before the lesson actually starts.
  const [stages, setStages] = useState<LessonStagePreview[] | null>(null);

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

    getLessonStagesPreview(db, lesson.id)
      .then((s) => setStages(s))
      .catch(() => setStages([]));

    return () => clearInterval(clockId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, studentId]);

  // Realtime: when teacher starts the lesson (status → in_progress), refresh.
  useRealtimeChannel(`lesson-status-${lesson.id}`, "lessons", `id=eq.${lesson.id}`, () => {
    router.refresh();
  });

  // Belt-and-suspenders poll: `router.refresh()` re-fetches the server
  // component, so as soon as the teacher flips status this picks it up even
  // on the (rare) occasion the realtime event above doesn't arrive — the
  // waiting screen must never require an F5 to notice the lesson started.
  useEffect(() => {
    const poll = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(poll);
  }, [router]);

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

  // Countdown display. Format widens as the remaining time grows so the
  // digits stay readable, but the string itself must also stay short enough
  // to fit the ring (see counterSizeClass below) — long labels use a smaller
  // font instead of overflowing the circle.
  const isUrgent = secsUntil !== null && secsUntil < 60;
  const showCounter = secsUntil !== null && secsUntil <= 3600;
  const counterText = (() => {
    if (secsUntil === null) return "—:—";
    if (secsUntil < 60) return `0:${String(secsUntil).padStart(2, "0")}`;
    if (secsUntil < 3600) {
      const mm = Math.floor(secsUntil / 60);
      const ss = secsUntil % 60;
      return `${mm}:${String(ss).padStart(2, "0")}`;
    }
    if (secsUntil < 86400) {
      const hh = Math.floor(secsUntil / 3600);
      const mm = Math.floor((secsUntil % 3600) / 60);
      return `${hh}ч ${String(mm).padStart(2, "0")}м`;
    }
    const dd = Math.floor(secsUntil / 86400);
    const hh = Math.floor((secsUntil % 86400) / 3600);
    return `${dd}д ${String(hh).padStart(2, "0")}ч`;
  })();
  // 3 size tiers by string length so longer formats never overflow the ring:
  // 4 chars ("0:08") → largest; 5 chars ("12:34") → one step down;
  // 6–7 chars ("2д 03ч", "19ч 31м") → smallest.
  const counterSizeClass =
    counterText.length <= 4 ? "text-7xl md:text-8xl"
    : counterText.length === 5 ? "text-6xl md:text-7xl"
    : "text-5xl md:text-6xl";

  // SVG ring (r=140 for the larger w-96 circle)
  const R = 140;
  const C = 2 * Math.PI * R;
  const frac = secsUntil === null ? 1 : Math.min(1, secsUntil / 3600);

  const totalStageMinutes = (stages ?? []).reduce((sum, s) => sum + (s.duration_min ?? 0), 0);
  const planSummary = totalStageMinutes > 0
    ? dl.planStagesSummary.replace("{count}", String((stages ?? []).length)).replace("{minutes}", String(totalStageMinutes))
    : dl.planStagesSummaryNoDuration.replace("{count}", String((stages ?? []).length));

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
          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-teal-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-teal-200 backdrop-blur-md border border-teal-300/30">
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal-300" />
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

          {/* Stage plan preview — titles + type icons only, no content (not
              clickable — nothing to open before the lesson actually starts).
              Rendered for every student once stages have loaded, even when
              empty (placeholder instead), so the layout never differs by
              how much data a given lesson happens to have. */}
          {stages !== null && (
            <div className="mt-8 rounded-2xl border border-white/15 bg-white/[0.07] p-6 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <ListChecks className="h-[21px] w-[21px] text-orange-300" />
                <span className="font-semibold text-[15px] uppercase tracking-wide text-white/80">
                  {dl.workspace.stagePlan}
                </span>
                {stages.length > 0 && (lesson.title || lesson.topic) && (
                  <span className="ml-auto truncate text-sm font-extrabold text-orange-300">
                    {dl.planTopicPrefix} {lesson.title ?? lesson.topic}
                  </span>
                )}
              </div>
              <div className="my-4 h-px bg-white/10" />
              {stages.length > 0 ? (
                <>
                  <div className="flex flex-col gap-4">
                    {stages.map((stage) => {
                      const Icon = stageTypeIcon(stage.content_type);
                      return (
                        <div key={stage.id} className="flex items-center gap-3.5">
                          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] bg-orange-400/20 text-orange-200">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[17px] font-extrabold text-white">{stage.title}</p>
                            <p className="text-[13px] font-semibold text-white/55">
                              {stageTypeLabel(stage.content_type, dl)}
                              {stage.duration_min ? ` · ~${stage.duration_min} ${d.schedule.minShort}` : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 border-t border-white/10 pt-3.5 text-center text-xs font-bold uppercase tracking-wide text-white/45">
                    {planSummary}
                  </div>
                </>
              ) : (
                <p className="py-2 text-center text-sm font-medium text-white/50">
                  {dl.planEmptyPlaceholder}
                </p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Timer + excuse */}
        <div className="flex flex-col items-center gap-6">
          {/* Countdown ring */}
          <div className="relative flex h-72 w-72 items-center justify-center md:h-96 md:w-96">
            <svg viewBox="0 0 320 320" className="absolute inset-0 h-full w-full -rotate-90">
              <defs>
                <linearGradient id="waitRingGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#FFC7A6" />
                  <stop offset="1" stopColor="#FF7A4D" />
                </linearGradient>
              </defs>
              <circle cx="160" cy="160" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
              <circle
                cx="160" cy="160" r={R} fill="none"
                stroke={isUrgent ? "#fb7185" : "url(#waitRingGradient)"}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - frac)}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="flex flex-col items-center justify-center px-6 text-center">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">{dl.untilStart}</span>
              <span
                className={`mt-1.5 whitespace-nowrap font-mono font-extrabold tabular-nums leading-none ${counterSizeClass} ${isUrgent ? "animate-pulse text-rose-300" : ""}`}
                style={isUrgent ? undefined : { background: "linear-gradient(180deg,#FFCFB2,#FF7A4D)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
              >
                {counterText}
              </span>
            </div>
          </div>

          {/* Auto-open note */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/15 px-5 py-2 text-sm font-semibold text-white/70">
            <Bell className="h-[18px] w-[18px] text-orange-300" />
            {dl.autoOpen}
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
