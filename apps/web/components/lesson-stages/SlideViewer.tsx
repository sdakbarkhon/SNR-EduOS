"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, Maximize2, X } from "lucide-react";
import { getDictionary, setCurrentSlide } from "@snr/core";
import type { Locale, LessonSlide } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeChannel } from "@/lib/realtime";
import { SlideBody } from "./SlideBody";

/** Высота панели навигации ниже кадра слайда (px-6 py-4 border-t + кнопка
 *  px-4 py-2 с иконкой 20px) — используется только чтобы вписать кадр в
 *  доступную высоту (frameMaxHeight ниже), саму панель не затрагивает. */
const NAV_BAR_PX = 72;

export function SlideViewer({
  slides,
  onExportPptx,
  canExport,
  isTeacher = false,
  stageId,
  initialSlide = 0,
  lessonStatus,
  viewerOnly = false,
  chromeAbovePx,
  autoFullscreen = false,
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
  /** Большой фикс, Блок 3 (правило 3-го урока) — true только для демо-школы,
   *  студент на 3+ уроке дня: форсирует canNavigate/syncsWrite в false
   *  независимо от lessonStatus — ученик только смотрит (realtime-подписка
   *  на current_slide_index остаётся активной, так что слайд всё равно
   *  синхронно следует за учителем/другими участниками). Никогда не
   *  задаётся для isTeacher или для post-completion review. */
  viewerOnly?: boolean;
  /** Сколько "остального" над этим SlideViewer в текущем макете (шапка
   *  урока в обычном режиме / почти ничего в фокус-режиме — см.
   *  LessonWorkspaceView.tsx PRESENTATION_CHROME_ABOVE_PX). Когда задан,
   *  16:9-кадр слайда вписывается в calc(100vh - chromeAbovePx - navbar),
   *  сохраняя пропорции (ширина уменьшается, если ограничивает высота) —
   *  слайд гарантированно виден целиком без скролла даже на 3440. Не
   *  задан — прежнее поведение (во всю ширину колонки, высота от
   *  aspect-ratio), для обычных (не во весь экран) мест использования. */
  chromeAbovePx?: number;
  /** 07.08.2026 — открывать презентацию сразу во весь экран. Ставится только
   *  там, где слайды И ЕСТЬ содержимое экрана: презентация этапа урока у
   *  ученика (StudentPresentationViewer) и у учителя (StageViewModal). Для
   *  инлайновых мест (материалы, превью в списке этапов) не ставится — там
   *  слайд лишь часть страницы.
   *
   *  Режим ВСЕГДА обратим — Esc и кнопка закрытия в правом верхнем углу. Это
   *  принципиально: до 06.08 презентация у ученика была `fixed inset-0
   *  z-[9999]` БЕЗ выхода, из-за чего ученик оказывался заперт в ней, пока
   *  учитель не переключит этап (см. StudentPresentationViewer.tsx). Тогда
   *  полноэкранный режим убрали целиком; теперь он вернулся вместе с выходом,
   *  которого не хватало. */
  autoFullscreen?: boolean;
}) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).lesson.slides;
  const [current, setCurrent] = useState(Math.min(initialSlide, Math.max(0, slides.length - 1)));
  // Migration 150 — student gets the same live nav as the teacher while the
  // lesson is actually ongoing (RLS scopes the write to the student's own
  // group + the lesson's currently-active stage); "completed" review mode
  // is unchanged (navigate locally, never write).
  const canNavigate = !viewerOnly && (isTeacher || lessonStatus === "completed" || lessonStatus === "in_progress");
  // Writes to the shared current_slide_index: teacher always (unchanged —
  // e.g. prepping a not-yet-started lesson), student only while the lesson
  // is actually live. Completed-review browsing for a student stays purely
  // local, exactly as before.
  const syncsWrite = !viewerOnly && (isTeacher || lessonStatus === "in_progress");
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

  // 07.08.2026 — полноэкранный показ. Живёт здесь, а не в обёртках, чтобы
  // учитель и ученик получили ровно один и тот же режим: обёртки у них разные
  // (StudentPresentationViewer / StageViewModal), а SlideViewer — общий.
  const [isFull, setIsFull] = useState(autoFullscreen);

  useEffect(() => {
    if (!isFull) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFull(false); };
    window.addEventListener("keydown", onKey);
    // Пока слайд во весь экран, страница под ним скроллиться не должна.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isFull]);

  const slide = slides[current];
  if (!slide) return null;

  // Во весь экран бюджет высоты считается от вьюпорта целиком: над кадром
  // ничего нет, поэтому chromeAbovePx (высота шапки урока в обычном режиме)
  // здесь не применяется — иначе кадр остался бы меньше, чем мог быть.
  const frameMaxHeight = isFull
    ? `calc(100vh - ${NAV_BAR_PX}px)`
    : chromeAbovePx != null ? `calc(100vh - ${chromeAbovePx + NAV_BAR_PX}px)` : undefined;

  const body = (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden shadow-xl",
        isFull ? "h-full justify-center rounded-none" : "rounded-2xl",
      )}>
      {/* Slide body — fixed 16:9 frame, SlideBody scales its content to fit
          (never scroll — the whole slide should be visible at once).
          chromeAbovePx задан: кадр вписывается в доступную высоту (ширина
          уменьшается пропорционально, если ограничивает высота, а не
          растягивается на всю колонку — раньше на широких/невысоких
          вьюпортах кадр от w-full мог быть выше viewport и требовал
          скролла, см. StudentPresentationViewer.tsx). */}
      <div
        className={cn("mx-auto aspect-video overflow-hidden", !frameMaxHeight && "w-full")}
        style={frameMaxHeight ? { maxHeight: frameMaxHeight, width: `min(100%, calc(${frameMaxHeight} * 16 / 9))` } : undefined}
      >
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

  if (!isFull) {
    return (
      <div className="relative">
        {body}
        {/* Кнопка «во весь экран» — в кадре, поверх слайда. Доступна везде и
            одинаково у учителя и ученика, включая места, где презентация
            открывается инлайново. */}
        <button
          onClick={() => setIsFull(true)}
          title={t.fullscreen}
          aria-label={t.fullscreen}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-black/40 text-white opacity-0 backdrop-blur-sm transition hover:bg-black/60 focus-visible:opacity-100 group-hover:opacity-100 [.relative:hover>&]:opacity-100"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (typeof document === "undefined") return body;

  // Портал в <body>: иначе кадр остался бы внутри своего контейнера (модалка
  // этапа у учителя, колонка урока у ученика) и никакой z-index не вывел бы
  // его поверх — у предков есть и overflow-hidden, и свои stacking-контексты.
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-900">
      <button
        onClick={() => setIsFull(false)}
        title={t.exitFullscreen}
        aria-label={t.exitFullscreen}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="flex min-h-0 flex-1 flex-col justify-center">{body}</div>
    </div>,
    document.body,
  );
}
