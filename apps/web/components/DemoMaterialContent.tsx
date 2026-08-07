"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { PdfViewer } from "@/components/PdfViewer";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Ночной прогон, ЧАСТЬ 5 — локальный, чисто визуальный зум (CSS
// transform: scale) для "Учитель показывает материал классу". Общий для
// учительского самопросмотра (TeacherLessonDetailView) и трансляции у
// ученика (LessonWorkspaceView) — раньше обе стороны дублировали один и тот
// же switch по kind без какого-либо зума.
//
// НЕ трогает demo_material_id/Realtime: КАКОЙ материал показан решает тот
// канал (не меняется здесь); масштаб — чисто локальный useState в каждом
// браузере, никуда не транслируется и не влияет на других участников.
//
// Тот же UX (кнопки +/−/сброс, Ctrl+Scroll, +/-/0 с клавиатуры, drag-pan
// при zoom>1 для image/office), что уже был у FileViewerModal.tsx (Пачка 3,
// Задача 4, зум для Базы знаний) — паттерн зеркалирован, а не импортирован
// напрямую: тот компонент — целый модал со своим заголовком/крестиком
// закрытия, а здесь нужен только зумируемый контент внутри уже существующих
// fullscreen-оверлеев.
//
// kind="other" (неподдерживаемый формат) намеренно не обрабатывается здесь —
// вызывающий код показывает свой текст ошибки (d.demo.unsupportedFormat),
// незачем тащить этот i18n-срез в общий компонент.

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/** Порог рассинхрона, при котором ученику двигают позицию. Меньше — не
 *  трогаем: постановка допускает расхождение до 2 с, а дёргать currentTime
 *  на каждое сообщение значит подвешивать плеер рывками. */
const VIDEO_SYNC_THRESHOLD_S = 1;

type VideoSyncPayload = {
  action: "play" | "pause" | "seek";
  position: number;
  timestamp: number;
};

export function DemoMaterialContent({
  url, title, kind, lessonId, canControl = false, isDemoSchool = false,
}: {
  url: string;
  title: string;
  kind: "pdf" | "video" | "image" | "office" | "embed";
  /** Урок, в рамках которого идёт показ. Задаёт broadcast-канал
   *  `lesson-video-<lessonId>`. Не задан — синхронизации нет (компонент
   *  используется и вне урока). */
  lessonId?: string;
  /** true у УЧИТЕЛЯ: его play/pause/seek транслируются классу. */
  canControl?: boolean;
  /** Демо-школа (schools.is_demo). У ученика демо-школы остаются собственные
   *  контролы — он может поставить на паузу локально, но его действия НЕ
   *  транслируются. В реальной школе контролы у ученика убраны совсем. */
  isDemoSchool?: boolean;
}) {
  const { locale } = useLocale();
  const dv = getDictionary(locale as Locale).viewer;
  const zoomable = kind === "pdf" || kind === "image" || kind === "office";

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Новый материал — сбрасываем зум/пан, чтобы не унаследовать состояние
  // предыдущего показа.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [url]);

  /* ─── Синхронизация видео учитель → ученики ────────────────────────────
   * Тот же приём, что у live-кода (TeacherLiveCodeControl → CodeStageView):
   * эфемерный broadcast-канал Supabase, без записи в БД и без миграции.
   * Учитель шлёт события своего <video>, ученик применяет их к своему.
   * Ученик ничего не шлёт — трансляция строго односторонняя, поэтому эха и
   * циклов «применил → отправил → применил» не возникает в принципе. */
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  /* Пока применяем удалённое событие, свои обработчики play/pause молчат —
   * иначе учитель, догоняющий чужую позицию, ретранслировал бы её обратно. */
  const applyingRef = useRef(false);

  const syncEnabled = kind === "video" && Boolean(lessonId);

  useEffect(() => {
    if (!syncEnabled || !lessonId) return;
    const db = createClient();
    // Ровно та же форма вызова, что в CodeStageView: .channel().on().subscribe()
    // одной цепочкой. Если разорвать её (сохранить канал и вызвать .on()
    // отдельно или собрать через тернарник), TS выбирает "system"-перегрузку
    // и отвергает событие "broadcast".
    const channel = db
      .channel(`lesson-video-${lessonId}`)
      .on(
        "broadcast",
        { event: "video" },
        (msg: { payload?: Partial<VideoSyncPayload> }) => {
        // Учитель — источник; собственные события применять не нужно.
        if (canControl) return;
        const p = msg.payload;
        const el = videoRef.current;
        if (!p || !el) return;
        applyingRef.current = true;
        try {
          if (typeof p.position === "number" && Math.abs(el.currentTime - p.position) > VIDEO_SYNC_THRESHOLD_S) {
            el.currentTime = p.position;
          }
          if (p.action === "play") void el.play().catch(() => null);
          else if (p.action === "pause") el.pause();
        } finally {
          // play/pause прилетает асинхронно после вызова — снимаем флаг
          // следующим тиком, а не сразу.
          setTimeout(() => { applyingRef.current = false; }, 0);
        }
        },
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      db.removeChannel(channel);
      channelRef.current = null;
    };
  }, [syncEnabled, lessonId, canControl]);

  const broadcast = useCallback((action: VideoSyncPayload["action"]) => {
    if (!canControl || applyingRef.current) return;
    const el = videoRef.current;
    if (!el) return;
    void channelRef.current?.send({
      type: "broadcast",
      event: "video",
      payload: { action, position: el.currentTime, timestamp: Date.now() } satisfies VideoSyncPayload,
    });
  }, [canControl]);

  // Ученик реальной школы смотрит без контролов; в демо-школе контролы
  // остаются — он может поставить на паузу, но это чисто локально.
  const videoControls = canControl || isDemoSchool || !syncEnabled;

  const zoomIn = useCallback(() => setZoom((z) => clampZoom(z + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const next = clampZoom(z - ZOOM_STEP);
      if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);
  const resetZoom = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  useEffect(() => {
    if (!zoomable) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomIn(); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomOut(); }
      else if (e.key === "0") { e.preventDefault(); resetZoom(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomable, zoomIn, zoomOut, resetZoom]);

  function handleWheel(e: React.WheelEvent) {
    if (!zoomable || !e.ctrlKey) return;
    e.preventDefault();
    if (e.deltaY < 0) zoomIn(); else zoomOut();
  }

  // Drag-панорамирование — только для image/office (у pdf свой скролл,
  // как в FileViewerModal).
  const dragEnabled = zoomable && kind !== "pdf" && zoom > 1;

  function handleMouseDown(e: React.MouseEvent) {
    if (!dragEnabled) return;
    draggingRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    setIsDragging(true);
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!draggingRef.current) return;
    const d = draggingRef.current;
    setPan({ x: d.panX + (e.clientX - d.startX), y: d.panY + (e.clientY - d.startY) });
  }
  function endDrag() {
    draggingRef.current = null;
    setIsDragging(false);
  }

  const transformStyle: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "center center",
    transition: draggingRef.current ? "none" : "transform 0.15s ease-out",
  };

  return (
    <div className="relative flex h-full w-full flex-col">
      {zoomable && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg bg-black/60 p-1 backdrop-blur-sm">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label={dv.zoomOut}
            title={dv.zoomOut}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={resetZoom}
            aria-label={dv.resetZoom}
            title={dv.resetZoom}
            className="min-w-[3.5rem] rounded-md px-2 py-1 text-center text-xs font-bold text-white transition-colors hover:bg-white/20"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label={dv.zoomIn}
            title={dv.zoomIn}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      )}
      <div
        className="flex flex-1 items-center justify-center overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={dragEnabled ? { cursor: isDragging ? "grabbing" : "grab" } : undefined}
      >
        {kind === "pdf" && <PdfViewer url={url} title={title} scale={zoom} />}
        {kind === "video" && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={videoRef}
            src={url}
            controls={videoControls}
            onPlay={() => broadcast("play")}
            onPause={() => broadcast("pause")}
            onSeeked={() => broadcast("seek")}
            className="h-full w-full object-contain"
          />
        )}
        {kind === "embed" && (
          <iframe
            src={url}
            title={title}
            className="h-full w-full border-0 bg-black"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
        {kind === "image" && (
          <div style={transformStyle} className="pointer-events-none select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={title} className="mx-auto h-full max-h-full w-full object-contain" draggable={false} />
          </div>
        )}
        {kind === "office" && (
          <div style={{ ...transformStyle, width: "100%", height: "100%" }}>
            {/* pointer-events:none во время drag — та же причина, что в
                FileViewerModal.tsx: иначе курсор "теряется" на границе
                iframe и панорамирование обрывается на полпути. */}
            <iframe
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
              title={title}
              className="h-full w-full border-0 bg-white"
              style={isDragging ? { pointerEvents: "none" } : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
