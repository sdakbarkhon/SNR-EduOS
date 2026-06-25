"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X, Globe, AlertTriangle, ExternalLink, Upload, Check, Loader2, Save, Image as ImageIcon,
} from "lucide-react";
import { getDictionary, submitStageTask, uploadStageAttachment, getStageAttachmentUrl } from "@snr/core";
import type {
  Locale, LessonStageWithProgress, LessonStageProgress,
  ExternalServiceConfig, ExternalServiceSubmission, ExternalServiceType,
} from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_CONFIG } from "@/lib/external-services";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const GRADE_COLORS: Record<number, string> = {
  5: "bg-emerald-100 text-emerald-700 border-emerald-200",
  4: "bg-blue-100 text-blue-700 border-blue-200",
  3: "bg-yellow-100 text-yellow-700 border-yellow-200",
  2: "bg-orange-100 text-orange-700 border-orange-200",
  1: "bg-red-100 text-red-700 border-red-200",
};

export function ExternalStageModal({
  stage, studentId, onClose, onSubmitted,
}: {
  stage: LessonStageWithProgress;
  studentId: string;
  onClose: () => void;
  onSubmitted: (progress: LessonStageProgress) => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dx = d.lesson.external;
  const db = createClient();

  const service = stage.content_type as ExternalServiceType;
  const meta = SERVICE_CONFIG[service];
  const cfg = (stage.config ?? {}) as Partial<ExternalServiceConfig>;
  const embeddable = meta.embedSupported;
  const embedUrl = cfg.embed_url ?? null;

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // iframe load tracking (30s timeout fallback for embeddable services —
  // Scratch's player can be slow on first load, so give it room).
  const [iframeState, setIframeState] = useState<"loading" | "ok" | "error">(embeddable && embedUrl ? "loading" : "error");
  useEffect(() => {
    if (!embeddable || !embedUrl) return;
    const t = setTimeout(() => setIframeState((s) => (s === "loading" ? "error" : s)), 30000);
    return () => clearTimeout(t);
  }, [embeddable, embedUrl]);

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

  function handleOpenService() {
    window.open(cfg.url, "_blank", "noopener,noreferrer");
    setLastOpenedAt(new Date().toISOString());
  }

  const requiredOk =
    embeddable ||
    ((!cfg.requires_link || link.trim().length > 0) && (!cfg.requires_screenshot || !!screenshotPath));

  async function handleSubmit() {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const submission: ExternalServiceSubmission = {
        link: link.trim() || undefined,
        screenshot_path: screenshotPath || undefined,
        last_opened_at: lastOpenedAt || new Date().toISOString(),
      };
      const progress = await submitStageTask(db, stage.id, studentId, submission as unknown as Record<string, unknown>);
      onSubmitted(progress);
      onClose();
    } catch { /* noop */ } finally {
      setSubmitting(false);
    }
  }

  if (typeof document === "undefined") return null;

  const serviceName = meta.name;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col p-3 sm:p-5">
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
            <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-slate-700">{stage.title}</span>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-violet-700">
                {dx.service}: {serviceName}
              </span>
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto">
            {/* Grade / submitted banners */}
            {isGraded && (
              <div className={`mx-5 mt-4 rounded-xl border px-4 py-2.5 ${GRADE_COLORS[grade] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}>
                <p className="text-sm font-bold">{dx.graded}: {grade}/5</p>
                {stage.progress?.teacher_comment && (
                  <p className="mt-1 text-sm opacity-90"><span className="font-semibold">{dx.teacherComment}:</span> {stage.progress.teacher_comment}</p>
                )}
              </div>
            )}
            {isSubmitted && !isGraded && (
              <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700">
                <Check className="h-4 w-4" /> {dx.submittedWaiting}
              </div>
            )}

            {/* Problem statement */}
            {stage.description && (
              <div className="px-5 pt-4">
                <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">{d.lesson.code.problemStatement}</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{stage.description}</p>
              </div>
            )}

            {/* Embeddable: iframe (or error plate) */}
            {embeddable ? (
              <div className="relative m-5 min-h-[420px] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {iframeState !== "error" && embedUrl ? (
                  <>
                    {iframeState === "loading" && (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    )}
                    <iframe
                      src={embedUrl}
                      title={serviceName}
                      onLoad={() => setIframeState("ok")}
                      onError={() => setIframeState("error")}
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-presentation"
                      allow="accelerometer; autoplay; camera; encrypted-media; fullscreen; gyroscope; microphone; clipboard-read; clipboard-write"
                      referrerPolicy="no-referrer-when-downgrade"
                      style={{ width: "100%", height: "100%", border: "none", minHeight: 420 }}
                    />
                  </>
                ) : (
                  <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-6 text-center">
                    <AlertTriangle className="h-10 w-10 text-orange-500" />
                    <h4 className="text-base font-bold text-slate-800">{dx.loadError}</h4>
                    <p className="max-w-md text-sm text-slate-500">{dx.loadErrorBody}</p>
                    <button
                      onClick={() => window.open(cfg.url, "_blank", "noopener,noreferrer")}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                    >
                      <ExternalLink className="h-4 w-4" /> {dx.openInNewTab}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Non-embeddable (App Inventor / Code Monkey send X-Frame-Options: DENY).
                 We don't fight the server header — we present a friendly, neutral
                 "opens in a new tab" card instead of an error. */
              <div className="m-5 flex flex-1 flex-col items-center justify-center gap-5 rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/60 to-violet-50/40 p-10 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/30">
                  <Globe className="h-12 w-12 text-white" strokeWidth={1.75} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-2xl font-extrabold tracking-tight text-slate-800">{serviceName}</h3>
                  <p className="mx-auto max-w-sm text-base font-medium text-slate-600">{dx.opensInNewTab}</p>
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

            {/* Attach result */}
            {!readOnly && (
              <div className="border-t border-slate-100 px-5 py-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                  {embeddable ? dx.attachResultOptional : dx.attachResult}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      {dx.attachLink}{!embeddable && cfg.requires_link ? <span className="text-red-500"> *</span> : null}
                    </label>
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="https://…"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      {dx.attachScreenshot}{!embeddable && cfg.requires_screenshot ? <span className="text-red-500"> *</span> : null}
                    </label>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:border-blue-300 hover:text-blue-500 disabled:opacity-60"
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
              </div>
            )}

            {/* Read-only: show what was attached */}
            {readOnly && (link || previewUrl) && (
              <div className="border-t border-slate-100 px-5 py-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{dx.attachResult}</h3>
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline">
                    <ExternalLink className="h-4 w-4" /> {link}
                  </a>
                )}
                {previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" className="mt-2 max-h-48 rounded-lg ring-1 ring-slate-200" />
                )}
              </div>
            )}
          </div>

          {/* Footer: submit */}
          {!readOnly && (
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 px-5 py-3">
              {!requiredOk && <span className="text-xs text-slate-400">{dx.mustAttachHint}</span>}
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={!requiredOk || submitting || uploading}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/25 hover:bg-violet-700 active:scale-95 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {dx.submitAndSave}
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSubmit}
        title={dx.submitAndSave}
        message={dx.confirmSubmit}
        variant="warning"
        confirmText={dx.submitAndSave}
        cancelText={d.common.cancel}
      />
    </div>,
    document.body,
  );
}
