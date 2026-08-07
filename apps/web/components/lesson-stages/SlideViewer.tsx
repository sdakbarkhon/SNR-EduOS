"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, Lock, Maximize2, X } from "lucide-react";
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

/** Сколько держать Esc, чтобы выйти из презентации, пока идёт этап. */
const EXIT_HOLD_MS = 2000;
/** Через сколько после входа проявляется кнопка закрытия. До этого выход
 *  только удержанием — чтобы в первые секунды объяснения крестик не тянул
 *  на себя внимание класса. */
const EXIT_BUTTON_DELAY_MS = 20000;
/** Сколько висит подсказка после короткого нажатия Esc. */
const HINT_MS = 3500;

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
  lockedUntilStageEnds = false,
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
  /** 07.08.2026 — «выход с усилием» у ученика, пока этап активен: короткий Esc
   *  не выводит (вместо этого подсказка), нужно УДЕРЖАТЬ Esc ~2 с; кнопка
   *  закрытия появляется только через 20 с. На учителя не действует ни при
   *  каких значениях — ниже стоит явный `!isTeacher`.
   *
   *  ПОЧЕМУ УСИЛИЕ, А НЕ ПОЛНЫЙ ЗАПРЕТ — не «недоделали», а осознанный отказ,
   *  подробности в resheniya_2.md (07.08.2026). Коротко: полного запрета
   *  система не выдерживает. Признак «этап кончился» в БД появляется ТОЛЬКО
   *  от нажатия человека — `lessons.active_stage_id` пишет один
   *  setActiveStage(), endLesson() его не очищает, а у демо-школы отключено
   *  и авто-завершение (`autostart_enabled=false`), и ночной крон
   *  (`nightly_close_enabled=false`). Учитель закрыл ноутбук, не переключив
   *  этап, — сигнала не будет никогда, и при полном запрете ученик заперт
   *  навсегда. Ровно из-за этого полноэкранный режим уже убирали 06.08.
   *  Удержание закрывает просьбу заказчика (случайно не выйдешь, посреди
   *  объяснения не «отщёлкнешься»), но ловушку сделать не даёт. */
  lockedUntilStageEnds?: boolean;
}) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).lesson.slides;
  const [current, setCurrent] = useState(Math.min(initialSlide, Math.max(0, slides.length - 1)));
  // Migration 150 — student gets the same live nav as the teacher while the
  // lesson is actually ongoing (RLS scopes the write to the student's own
  // group + the lesson's currently-active stage); "completed" review mode
  // is unchanged (navigate locally, never write).
  const canNavigate = !viewerOnly && (isTeacher || lessonStatus === "completed" || lessonStatus === "in_progress");
  // Writes to the shared current_slide_index — ТОЛЬКО пока урок реально идёт,
  // одинаково для учителя и ученика.
  //
  // 07.08.2026: было `isTeacher || lessonStatus === "in_progress"`, то есть
  // учитель писал ВСЕГДА, в том числе готовясь к ещё не начатому уроку. Его
  // перелистывания при подготовке уходили в общий current_slide_index и
  // долетали до всех, кто уже открыл урок. Теперь до старта (и после
  // завершения) учитель листает локально — материал его, но трансляции быть
  // не должно. Живой урок не затронут: там lessonStatus === "in_progress" и
  // синхронизация работает как раньше.
  const syncsWrite = !viewerOnly && lessonStatus === "in_progress";
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

  // Учителя не запираем никогда — см. комментарий к пропу. Флаг приходит
  // обычным пропом, поэтому снятие блокировки (этап кончился, урок завершён,
  // потеряна связь с сервером) сразу возвращает обычные Esc и кнопку.
  const holdToExit = isFull && lockedUntilStageEnds && !isTeacher;

  useEffect(() => {
    if (!isFull) return;
    // При holdToExit коротким Esc не выходим — этим занимается эффект ниже.
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !holdToExit) setIsFull(false); };
    window.addEventListener("keydown", onKey);
    // Пока слайд во весь экран, страница под ним скроллиться не должна.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // holdToExit в зависимостях обязателен: иначе обработчик остался бы
    // замкнут на старое значение и Esc не заработал бы обратно после снятия.
  }, [isFull, holdToExit]);

  // ── Выход удержанием Esc ────────────────────────────────────────────────────
  // 0 → не держим, 1 → додержал. Считаем реальными часами: getDemoNow() —
  // это константа для дат уроков (lib/demo-date.ts), Date.now() ею НЕ
  // подменяется и для измерения интервалов подходит.
  const [holdProgress, setHoldProgress] = useState(0);
  // Счётчик коротких нажатий: каждое новое перезапускает таймер подсказки
  // (обычный boolean не перезапустил бы — состояние не изменилось бы).
  const [hintTick, setHintTick] = useState(0);

  useEffect(() => {
    if (!holdToExit) { setHoldProgress(0); return; }
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let startedAt = 0;
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      raf = 0; timer = undefined; startedAt = 0;
      setHoldProgress(0);
    };
    // Сам выход держится на setTimeout, а rAF рисует ТОЛЬКО полоску. Раньше
    // порог срабатывал внутри rAF — и это ловилось на проверке: если страница
    // не отрисовывается, rAF не вызывается вовсе, прогресс стоит на нуле и
    // выйти нельзя. Выход — функция, а не анимация, и от отрисовки зависеть
    // не должен.
    const tick = () => {
      setHoldProgress(Math.min(1, (Date.now() - startedAt) / EXIT_HOLD_MS));
      raf = requestAnimationFrame(tick);
    };
    const onDown = (e: KeyboardEvent) => {
      // e.repeat — автоповтор при зажатой клавише, начинать отсчёт заново
      // нельзя; startedAt страхует на случай браузера без repeat.
      if (e.key !== "Escape" || e.repeat || startedAt) return;
      e.preventDefault();
      startedAt = Date.now();
      timer = setTimeout(() => { stop(); setIsFull(false); }, EXIT_HOLD_MS);
      raf = requestAnimationFrame(tick);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !startedAt) return;
      const held = Date.now() - startedAt;
      stop();
      if (held < EXIT_HOLD_MS) setHintTick((n) => n + 1);
    };
    // Уход со вкладки во время удержания не должен «дожать» выход втихую.
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", stop);
      if (raf) cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, [holdToExit]);

  useEffect(() => {
    if (hintTick === 0) return;
    const id = setTimeout(() => setHintTick(0), HINT_MS);
    return () => clearTimeout(id);
  }, [hintTick]);

  // Кнопка закрытия: у учителя и у разблокированного ученика — сразу, у
  // запертого — через EXIT_BUTTON_DELAY_MS.
  // Инициализация не `false`: у учителя и в незапертых местах кнопка должна
  // быть с первого кадра, а не появляться после первого эффекта.
  const [exitButtonReady, setExitButtonReady] = useState(!(lockedUntilStageEnds && !isTeacher));
  useEffect(() => {
    if (!holdToExit) { setExitButtonReady(true); return; }
    setExitButtonReady(false);
    const id = setTimeout(() => setExitButtonReady(true), EXIT_BUTTON_DELAY_MS);
    return () => clearTimeout(id);
  }, [holdToExit]);

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
      {exitButtonReady && (
        <button
          onClick={() => setIsFull(false)}
          title={t.exitFullscreen}
          aria-label={t.exitFullscreen}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* Индикатор удержания — без него непонятно, что нажатие вообще
          засчиталось и сколько ещё держать. */}
      {holdProgress > 0 && (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2 rounded-2xl bg-black/70 px-4 py-2.5 backdrop-blur-sm"
        >
          <p className="mb-1.5 text-center text-xs font-medium text-white/90">{t.holdingExit}</p>
          <div className="h-1 w-40 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${Math.round(holdProgress * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Подсказка на короткое нажатие — единственное место, где ученик
          узнаёт про удержание, поэтому текст называет клавишу явно. */}
      {hintTick > 0 && holdProgress === 0 && (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-black/70 px-4 py-2.5 text-xs font-medium text-white/90 backdrop-blur-sm"
        >
          <Lock className="h-4 w-4 shrink-0" />
          {t.lockedHint}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col justify-center">{body}</div>
    </div>,
    document.body,
  );
}
