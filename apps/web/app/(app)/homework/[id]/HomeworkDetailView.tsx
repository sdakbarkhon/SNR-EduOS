"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText, Maximize2, Minimize2, Paperclip, Send, X } from "lucide-react";
import {
  getDictionary,
  getSubjectStyle,
  submitHomeworkWithFile,
  getHomeworkFileUrl,
  getHomeworkAttachmentUrl,
  getSubmissionFileUrl,
  type HomeworkWithSubmission,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { GlassCard, SubjectIcon, useLocale } from "@/components";
import { TestPlayer } from "./TestPlayer";
import { ProgrammingIDE } from "./ProgrammingIDE";
import { BundleSolver } from "./BundleSolver";
import { SERVICE_CONFIG, DEFAULT_EXTERNAL_URLS, isExternalService } from "@/lib/external-services";
import { useFullscreenToggle } from "@/lib/useFullscreenToggle";

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function downloadViaLink(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

/** Card for the teacher's attachment on a homework. */
function TeacherAttachmentCard({ hw }: { hw: HomeworkWithSubmission }) {
  const sb = createClient();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const [downloading, setDownloading] = useState(false);

  if (!hw.attachment_storage_path) return null;

  const name = hw.attachment_filename ?? hw.attachment_storage_path.split("/").pop() ?? "file";
  const size = hw.attachment_size_bytes ? formatBytes(hw.attachment_size_bytes) : null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = await getHomeworkAttachmentUrl(sb, hw.attachment_storage_path!, name);
      downloadViaLink(url, name);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <GlassCard className="mb-4 p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
        {d.homework.teacherFile}
      </p>
      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/80 p-3">
        <FileText size={16} className="flex-shrink-0 text-brand-blue" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-700">{name}</p>
          {size && <p className="text-xs text-slate-400">{size}</p>}
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-brand-blue transition hover:bg-blue-50 disabled:opacity-50"
        >
          <Download size={12} />
          {d.homework.detailDownload}
        </button>
      </div>
    </GlassCard>
  );
}

/** Old-style attachment item (jsonb attachments field — legacy). */
function LegacyAttachmentItem({ name, path }: { name: string; path: string }) {
  const sb = createClient();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const url = await getHomeworkFileUrl(sb, path);
      downloadViaLink(url, name);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/80 p-3">
      <FileText size={16} className="flex-shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{name}</span>
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-blue transition hover:bg-blue-50 disabled:opacity-50"
      >
        <Download size={12} />
        {d.homework.detailDownload}
      </button>
    </div>
  );
}

function SubmissionBlock({
  hw,
  onResubmit,
}: {
  hw: HomeworkWithSubmission;
  onResubmit: () => void;
}) {
  const sb = createClient();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const sub = hw.submission!;
  const [dlLoading, setDlLoading] = useState(false);

  const handleFileDownload = async () => {
    if (!sub.file_storage_path) return;
    setDlLoading(true);
    try {
      const url = await getSubmissionFileUrl(sb, sub.file_storage_path, sub.file_original_name ?? undefined);
      downloadViaLink(url, sub.file_original_name ?? "work");
    } finally {
      setDlLoading(false);
    }
  };

  return (
    <GlassCard className="p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
        {d.homework.detailYourSubmission}
      </p>
      {sub.answer_text ? (
        <div className="mb-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          {sub.answer_text}
        </div>
      ) : (
        <p className="mb-2 text-sm italic text-slate-400">{d.homework.noFile}</p>
      )}

      {/* New storage-backed file */}
      {sub.file_storage_path && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-slate-100 bg-white/80 p-2.5">
          <Paperclip size={14} className="flex-shrink-0 text-brand-blue" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-700">
              {sub.file_original_name ?? sub.file_storage_path.split("/").pop()}
            </p>
            {sub.file_size_bytes && (
              <p className="text-[10px] text-slate-400">{formatBytes(sub.file_size_bytes)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleFileDownload}
            disabled={dlLoading}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-brand-blue hover:bg-blue-50 disabled:opacity-50"
          >
            <Download size={11} />
            {d.homework.detailDownload}
          </button>
        </div>
      )}

      {/* Legacy file_url */}
      {sub.file_url && !sub.file_storage_path && (
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
          <Paperclip size={12} />
          <span>{sub.file_url.split("/").pop()}</span>
        </div>
      )}

      <div className="text-xs text-slate-400">
        {d.homework.submittedOn.replace(
          "{date}",
          new Date(sub.submitted_at).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Asia/Tashkent",
          }),
        )}
      </div>
      {sub.grade != null && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <span className="text-sm font-semibold text-slate-700">
            {d.homework.grade}: {sub.grade}
          </span>
        </div>
      )}
      {sub.teacher_comment && (
        <div className="mt-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
          <span className="font-medium">{d.homework.teacherComment}: </span>
          {sub.teacher_comment}
        </div>
      )}

      {sub.status !== "graded" && (
        <button
          type="button"
          onClick={onResubmit}
          className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          {d.homework.resubmitBtn}
        </button>
      )}
    </GlassCard>
  );
}

function SubmitForm({
  hw,
  onSuccess,
}: {
  hw: HomeworkWithSubmission;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const sb = createClient();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_FILE_BYTES) {
      setErrMsg(`Файл больше 50 МБ`);
      e.target.value = "";
      return;
    }
    setErrMsg("");
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setErrMsg(`Файл больше 50 МБ`);
      return;
    }
    setErrMsg("");
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !file) {
      setErrMsg(d.homework.formValidation);
      return;
    }
    setStatus("submitting");
    setErrMsg("");
    try {
      const { data: studentData } = await sb.from("students").select("id").single();
      if (!studentData) throw new Error("Student not found");
      const studentId = (studentData as { id: string }).id;

      await submitHomeworkWithFile(sb, {
        homeworkId: hw.id,
        studentId,
        teacherId: hw.teacher_id,
        textAnswer: text.trim() || undefined,
        file: file ?? undefined,
        fileName: file?.name,
      });

      setStatus("success");
      onSuccess?.();
      router.refresh();
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <GlassCard className="p-5 text-center text-sm font-medium text-green-700">
        {d.homework.formSuccess}
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
        {d.homework.submit}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={d.homework.answerPlaceholder}
          rows={4}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-blue focus:outline-none"
        />

        {/* File drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="relative"
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png,video/mp4"
            onChange={handleFileChange}
            className="hidden"
            id="hw-file-upload"
          />
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-brand-blue/40 bg-blue-50/60 px-4 py-2.5">
              <Paperclip size={14} className="flex-shrink-0 text-brand-blue" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-brand-blue">{file.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="flex-shrink-0 text-slate-400 hover:text-red-500"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label
              htmlFor="hw-file-upload"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 transition hover:border-brand-blue hover:text-brand-blue"
            >
              <Paperclip size={14} />
              {status === "submitting" && file ? d.homework.uploadingFile : d.homework.attachFile}
              <span className="text-xs text-slate-400 ml-1">PDF, DOCX, PPTX, XLSX, JPG, PNG, MP4 · до 50 МБ</span>
            </label>
          )}
        </div>

        {errMsg && <p className="text-xs text-red-500">{errMsg}</p>}
        {status === "error" && <p className="text-xs text-red-500">{d.homework.formError}</p>}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-md transition disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#1D6FF5 0%,#0B3EDB 100%)" }}
        >
          {status === "submitting" ? (
            <span>{d.homework.formSubmitting}</span>
          ) : (
            <>
              <Send size={14} />
              {d.homework.send}
            </>
          )}
        </button>
      </form>
    </GlassCard>
  );
}

/** External-service homework (wokwi/codesandbox/geogebra/.../h5p): teacher's
 *  project link embedded as an iframe, with a fullscreen toggle (УЧ.10 Part 5).
 *  Submission itself still goes through the generic SubmitForm/SubmissionBlock
 *  below (text/file "mark done"), same as the plain "file" homework type. */
function ExternalServiceCard({ hw }: { hw: HomeworkWithSubmission }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dx = d.lesson.external;
  const service = hw.content_type as Exclude<HomeworkWithSubmission["content_type"], "file" | "test" | "programming" | "bundle">;
  const meta = SERVICE_CONFIG[service];
  const embedUrl = hw.external_url ? (meta.extractEmbedUrl(hw.external_url) ?? DEFAULT_EXTERNAL_URLS[service]) : DEFAULT_EXTERNAL_URLS[service];
  const { ref, isFullscreen, toggle } = useFullscreenToggle<HTMLDivElement>();

  return (
    <GlassCard className="mb-4 p-0 overflow-hidden">
      <div
        ref={ref}
        className="relative"
        style={{ aspectRatio: isFullscreen ? undefined : "16 / 9", height: isFullscreen ? "100%" : undefined }}
      >
        <button
          onClick={toggle}
          className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-md backdrop-blur transition hover:bg-white"
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {isFullscreen ? dx.exitFullscreen : dx.fullscreen}
        </button>
        <iframe
          src={embedUrl}
          title={meta.name}
          className="h-full w-full border-none"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-presentation"
          allow="accelerometer; autoplay; camera; encrypted-media; fullscreen; gyroscope; microphone; clipboard-read; clipboard-write"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </GlassCard>
  );
}

export function HomeworkDetailView({ hw }: { hw: HomeworkWithSubmission }) {
  const router = useRouter();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const [resubmitMode, setResubmitMode] = useState(false);
  const subj = hw.group.subject;
  const style = getSubjectStyle(subj);

  const dueLabel = hw.due_date
    ? new Date(hw.due_date).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Tashkent",
      })
    : null;

  // Programming homework → dedicated two-column pseudo-IDE page.
  if (hw.content_type === "programming") {
    return <ProgrammingIDE hw={hw} />;
  }

  // Bundle homework → subtask accordion + own submit flow.
  if (hw.content_type === "bundle") {
    return <BundleSolver hw={hw} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-5 flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft size={16} />
        {d.common.back}
      </button>

      {/* Header */}
      <GlassCard className="mb-4 p-5">
        <div className="flex items-start gap-4">
          <SubjectIcon subject={subj} size={48} />
          <div className="min-w-0 flex-1">
            <div
              className="mb-1 text-xs font-semibold uppercase tracking-wider"
              style={{ color: style.color }}
            >
              {style.label} · {hw.group.name}
            </div>
            <h1 className="mb-2 text-xl font-bold text-slate-800">{hw.title}</h1>
            {dueLabel && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-medium">{d.homework.detailDeadline}:</span>
                {dueLabel}
              </div>
            )}
          </div>
        </div>

        {hw.description && (
          <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-700">
            {hw.description}
          </p>
        )}
      </GlassCard>

      {/* Teacher attachment (new storage-backed) */}
      {hw.attachment_storage_path && <TeacherAttachmentCard hw={hw} />}

      {/* Legacy jsonb attachments */}
      {!hw.attachment_storage_path && hw.attachments.length > 0 && (
        <GlassCard className="mb-4 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            {d.homework.detailAttachments}
          </p>
          <div className="flex flex-col gap-2">
            {hw.attachments.map((att, i) => (
              <LegacyAttachmentItem key={i} name={att.name} path={att.url} />
            ))}
          </div>
        </GlassCard>
      )}

      {isExternalService(hw.content_type) && <ExternalServiceCard hw={hw} />}

      {/* Submission or Test */}
      {hw.content_type === "test" ? (
        <TestPlayer hw={hw} />
      ) : hw.submission && !resubmitMode ? (
        <SubmissionBlock hw={hw} onResubmit={() => setResubmitMode(true)} />
      ) : (
        <SubmitForm hw={hw} onSuccess={() => setResubmitMode(false)} />
      )}
    </div>
  );
}
