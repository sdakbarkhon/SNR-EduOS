"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { getDictionary, setCurrentSlide } from "@snr/core";
import type { Locale, LessonSlide } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeChannel } from "@/lib/realtime";
import { SlideBody } from "./SlideBody";

export function SlideViewer({
  slides,
  onExportPptx,
  canExport,
  isTeacher = false,
  stageId,
  initialSlide = 0,
  lessonStatus,
}: {
  slides: LessonSlide[];
  onExportPptx: () => void;
  canExport: boolean;
  /** Teacher: navigation controls active + writes current_slide_index, any lessonStatus (unchanged). Student: same live controls + write, but ONLY while lessonStatus="in_progress" (synchronous slide nav, migration 150) — OR read-only free browsing once lessonStatus="completed" (post-lesson review, see canNavigate below), which never writes. */
  isTeacher?: boolean;
  /** Required when isTeacher or a live (in_progress) student — the stage whose current_slide_index is updated on nav. */
  stageId?: string;
  /** Starting slide (current_slide_index at mount, e.g. rejoining a lesson). */
  initialSlide?: number;
  /** "in_progress": student gets the same live nav as the teacher, writes sync to everyone via Realtime. "completed": students browse freely for review — same as teacher nav, but never writes current_slide_index (that's live-lesson-only state). */
  lessonStatus?: string;
}) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).lesson.slides;
  const [current, setCurrent] = useState(Math.min(initialSlide, Math.max(0, slides.length - 1)));
  // Migration 150 — student gets the same live nav as the teacher while the
  // lesson is actually ongoing (RLS scopes the write to the student's own
  // group + the lesson's currently-active stage); "completed" review mode
  // is unchanged (navigate locally, never write).
  const canNavigate = isTeacher || lessonStatus === "completed" || lessonStatus === "in_progress";
  // Writes to the shared current_slide_index: teacher always (unchanged —
  // e.g. prepping a not-yet-started lesson), student only while the lesson
  // is actually live. Completed-review browsing for a student stays purely
  // local, exactly as before.
  const syncsWrite = isTeacher || lessonStatus === "in_progress";
  // Solo (unsynced) review is the ONLY case where nobody else can move this
  // slide — everyone else (teacher during any status, or a student during a
  // live lesson) must stay subscribed so they see every participant's clicks,
  // not just their own.
  const soloReview = !isTeacher && lessonStatus === "completed";

  const goTo = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, idx));
    setCurrent(clamped);
    if (syncsWrite && stageId) {
      setCurrentSlide(createClient() as never, stageId, clamped).catch(() => null);
    }
  }, [slides.length, syncsWrite, stageId]);

  // Everyone but a solo-reviewing student follows current_slide_index via
  // Realtime — including the teacher now that a student's click can also
  // move the slide (migration 150: single shared "who moved it last" state,
  // not "teacher broadcasts, others just listen").
  useRealtimeChannel(
    stageId && !soloReview ? `stage-slide-${stageId}` : null,
    "lesson_stages",
    stageId ? `id=eq.${stageId}` : undefined,
    (payload) => {
      const idx = payload.new?.current_slide_index;
      if (typeof idx === "number") setCurrent(Math.max(0, Math.min(slides.length - 1, idx)));
    },
  );

  // Keyboard navigation — teacher or post-completion student review.
  useEffect(() => {
    if (!canNavigate) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goTo(current - 1);
      if (e.key === "ArrowRight") goTo(current + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canNavigate, current, goTo]);

  const slide = slides[current];
  if (!slide) return null;

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-2xl shadow-xl">
      {/* Slide body — fixed 16:9 frame, SlideBody scales its content to fit
          (never scroll — the whole slide should be visible at once). */}
      <div className="aspect-video w-full overflow-hidden">
        <SlideBody slide={slide} current={current} total={slides.length} />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-white/10 dark:bg-slate-800">
        {canNavigate ? (
          <button
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-slate-200"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="hidden sm:inline">{t.back}</span>
          </button>
        ) : (
          <span className="text-xs text-slate-400">{t.teacherOnly}</span>
        )}

        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {slides.map((_, idx) =>
              canNavigate ? (
                <button
                  key={idx}
                  onClick={() => goTo(idx)}
                  aria-label={`${idx + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    idx === current ? "w-6 bg-violet-600" : "w-2 bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              ) : (
                <span
                  key={idx}
                  aria-hidden
                  className={`h-2 rounded-full transition-all ${
                    idx === current ? "w-6 bg-violet-600" : "w-2 bg-slate-300"
                  }`}
                />
              ),
            )}
          </div>
          <span className="ml-1 text-sm text-slate-500">
            {t.slideOf.replace("{current}", String(current + 1)).replace("{total}", String(slides.length))}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canExport && (
            <button
              onClick={onExportPptx}
              title={t.exportPptx}
              className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-transparent dark:text-slate-200"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          {canNavigate && (
            <button
              onClick={() => goTo(current + 1)}
              disabled={current === slides.length - 1}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="hidden sm:inline">{t.next}</span>
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
