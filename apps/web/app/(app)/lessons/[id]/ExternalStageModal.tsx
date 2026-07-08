"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X, Globe, AlertTriangle, ExternalLink, Upload, Check, Loader2, Save, Send, Maximize2, Minimize2,
} from "lucide-react";
import { getDictionary, uploadStageAttachment, getStageAttachmentUrl, submitStageTask } from "@snr/core";
import type {
  Locale, LessonStageWithProgress, LessonStageProgress,
  ExternalServiceConfig, ExternalServiceSubmission, ExternalServiceType,
} from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_CONFIG, DEFAULT_EXTERNAL_URLS } from "@/lib/external-services";
import { StageActionButton } from "@/components/lesson-stages/StageActionButton";
import { useFullscreenToggle } from "@/lib/useFullscreenToggle";

const GRADE_COLORS: Record<number, string> = {
  5: "bg-emerald-100 text-emerald-700 border-emerald-200",
  4: "bg-blue-100 text-blue-700 border-blue-200",
  3: "bg-yellow-100 text-yellow-700 border-yellow-200",
  2: "bg-orange-100 text-orange-700 border-orange-200",
  1: "bg-red-100 text-red-700 border-red-200",
};

/**
 * External-service (wokwi/codesandbox/geogebra/phet/desmos/
 * blockly_games/visualgo/p5js/excalidraw/learningapps/sqlonline/h5p) embedded
 * directly in the stage card. Owns its full header (title/description/
 * actions on one row), no "Open" gate, no fullscreen modal, no "open in new
 * tab" fallback — all twelve services embed via iframe.
 */
export function ExternalStageModal({
  stage, studentId, onSubmitted,
}: {
  stage: LessonStageWithProgress;
  studentId: string;
  onSubmitted: (progress: LessonStageProgress) => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dx = d.lesson.external;
  const w = d.lesson.workspace;
  const db = createClient();

  const service = stage.content_type as ExternalServiceType;
  const meta = SERVICE_CONFIG[service];
  const cfg = (stage.config ?? {}) as Partial<ExternalServiceConfig>;
  const embeddable = meta.embedSupported;
  const embedUrl = cfg.embed_url || DEFAULT_EXTERNAL_URLS[service] || null;
  const openUrl = cfg.url || DEFAULT_EXTERNAL_URLS[service] || null;
  const iframeSrc = embedUrl;

  const existingSub = (stage.progress?.submission_data ?? null) as ExternalServiceSubmission | null;
  const isSubmitted = !!stage.progress?.submission_data;
  const grade = stage.progress?.grade ?? null;
  const isGraded = grade != null;
  const readOnly = isSubmitted;

  const [link, setLink] = useState(existingSub?.link ?? "");
  const [screenshotPath, setScreenshotPath] = useState<string | null>(existingSub?.screenshot_path ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastOpenedAt, setLastOpenedAt] = useState<string | null>(existingSub?.last_opened_at ?? null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreenToggle<HTMLDivElement>();

  // iframe load tracking (30s timeout → error message, no open-elsewhere fallback).
  const [iframeState, setIframeState] = useState<"loading" | "ok" | "error">("loading");
  useEffect(() => {
    if (!embeddable || !iframeSrc) return;
    const t = setTimeout(() => setIframeState((s) => (s === "loading" ? "error" : s)), 30000);
    return () => clearTimeout(t);
  }, [embeddable, iframeSrc]);

  // Resolve a signed URL for an already-submitted screenshot.
  useEffect(() => {
    if (existingSub?.screenshot_path) {
      getStageAttachmentUrl(db, existingSub.screenshot_path).then(setPreviewUrl).catch(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { path } = await uploadStageAttachment(db, { studentId, stageId: stage.id, file });
      setScreenshotPath(path);
      setPreviewUrl(URL.createObjectURL(file));
    } catch { /* noop */ } finally {
      setUploading(false);
    }
  }

  // Only used by the (currently unreachable — all 4 services embed) non-embeddable fallback below.
  function handleOpenService() {
    if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
    setLastOpenedAt(new Date().toISOString());
  }

  const requiredOk =
    embeddable ||
    ((!cfg.requires_link || link.trim().length > 0) && (!cfg.requires_screenshot || !!screenshotPath));

  async function handleSubmit() {
    // eslint-disable-next-line no-console
    console.log("[Submit] Clicked for stage:", stage.id);
    setSubmitting(true);
    setSubmitError("");
    try {
      const submission: ExternalServiceSubmission = {
        link: link.trim() || undefined,
        screenshot_path: screenshotPath || undefined,
        last_opened_at: lastOpenedAt || new Date().toISOString(),
      };
      const progress = await submitStageTask(db, stage.id, studentId, submission as unknown as Record<string, unknown>);
      onSubmitted(progress);
      setAttachOpen(false);
    } catch (e) {
      console.error("[Submit] error:", e);
      setSubmitError(w.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  const serviceName = meta.name;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Task info strip — mirrors CodeStageView (Iter5 P6) */}
      <div className="flex shrink-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
          <Globe className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100" title={stage.title}>
              {stage.title}
            </h2>
            <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              {serviceName}
            </span>
          </div>
          {stage.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-400" title={stage.description}>
              {stage.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {readOnly ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3.5 py-1.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Check className="h-3.5 w-3.5" /> {w.submitted}
            </span>
          ) : (
            <StageActionButton size="sm" icon={Send} onClick={() => setAttachOpen(true)}>
              {w.submit}
            </StageActionButton>
          )}
        </div>
      </div>

      {/* Grade / submitted banner — compact, only when relevant */}
      {isGraded ? (
        <div className={`shrink-0 rounded-xl border px-4 py-2 text-sm ${GRADE_COLORS[grade] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}>
          <span className="font-bold">{dx.graded}: {grade}/5</span>
          {stage.progress?.teacher_comment && (
            <span className="ml-2 opacity-90">— {stage.progress.teacher_comment}</span>
          )}
        </div>
      ) : isSubmitted ? (
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          <Check className="h-4 w-4" /> {dx.submittedWaiting}
        </div>
      ) : null}

      {/* Body: embedded iframe fills remaining space (or non-embeddable fallback card) */}
      {embeddable ? (
        <div
          ref={fullscreenRef}
          className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-900"
        >
          {iframeState !== "error" && iframeSrc ? (
            <>
              {iframeState === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? dx.exitFullscreen : dx.fullscreen}
                className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-md backdrop-blur transition hover:bg-white dark:bg-slate-800/95 dark:text-slate-200"
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {isFullscreen ? dx.exitFullscreen : dx.fullscreen}
              </button>
              <iframe
                src={iframeSrc}
                title={serviceName}
                onLoad={() => setIframeState("ok")}
                onError={() => setIframeState("error")}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-presentation"
                allow="accelerometer; autoplay; camera; encrypted-media; fullscreen; gyroscope; microphone; clipboard-read; clipboard-write"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-none"
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="h-10 w-10 text-orange-500" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">{dx.loadError}</h4>
              <p className="max-w-md text-sm text-slate-500">{dx.loadErrorBody}</p>
            </div>
          )}
        </div>
      ) : (
        /* Non-embeddable services: a friendly "opens in a new tab" card.
           Currently unreachable — every service in SERVICE_CONFIG embeds —
           kept for forward-compat if a future service can't be framed. */
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 rounded-xl bg-gradient-to-b from-blue-50/60 to-violet-50/40 p-10 text-center dark:from-blue-500/5 dark:to-violet-500/5">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/30">
            <Globe className="h-12 w-12 text-white" strokeWidth={1.75} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">{serviceName}</h3>
            <p className="mx-auto max-w-sm text-base font-medium text-slate-600 dark:text-slate-300">{dx.opensInNewTab}</p>
          </div>
          <button
            onClick={handleOpenService}
            className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-blue-500/30 transition-transform hover:scale-[1.03] active:scale-95"
          >
            <ExternalLink className="h-5 w-5" /> {dx.openService} {serviceName}
          </button>
          <p className="text-sm text-slate-400">{dx.afterWork}</p>
        </div>
      )}

      {/* Read-only: slim bar showing what was attached */}
      {readOnly && (link || previewUrl) && (
        <div className="flex shrink-0 flex-wrap items-center gap-4 rounded-xl border border-slate-100 bg-white px-5 py-2.5 dark:border-white/10 dark:bg-slate-900">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{dx.attachResult}</span>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 truncate text-sm font-semibold text-blue-600 hover:underline">
              <ExternalLink className="h-4 w-4 shrink-0" /> <span className="truncate">{link}</span>
            </a>
          )}
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-9 w-9 rounded-lg object-cover ring-1 ring-slate-200" />
          )}
        </div>
      )}

      {/* Attach + submit mini-modal */}
      {attachOpen && !readOnly && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setAttachOpen(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{w.submit}</h3>
              <button onClick={() => setAttachOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              {embeddable ? dx.attachResultOptional : dx.attachResult}
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {dx.attachLink}{!embeddable && cfg.requires_link ? <span className="text-red-500"> *</span> : null}
                </label>
                <input
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {dx.attachScreenshot}{!embeddable && cfg.requires_screenshot ? <span className="text-red-500"> *</span> : null}
                </label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:border-blue-300 hover:text-blue-500 disabled:opacity-60 dark:border-white/10"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {dx.chooseFile}
                  </button>
                  {previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200" />
                  )}
                </div>
              </div>
            </div>

            {!requiredOk && <p className="mt-3 text-xs text-slate-400">{dx.mustAttachHint}</p>}
            {submitError && (
              <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                {submitError}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setAttachOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                {d.common.cancel}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!requiredOk || submitting || uploading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/25 hover:bg-violet-700 active:scale-95 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {dx.submitAndSave}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
