"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText, Paperclip, Send } from "lucide-react";
import {
  getDictionary,
  getSubjectStyle,
  submitHomework,
  uploadHomeworkFile,
  getHomeworkFileUrl,
  type HomeworkWithSubmission,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { GlassCard, SubjectIcon, useLocale } from "@/components";
import { TestPlayer } from "./TestPlayer";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function AttachmentItem({
  name,
  path,
}: {
  name: string;
  path: string;
}) {
  const sb = createClient();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const url = await getHomeworkFileUrl(sb, path);
      window.open(url, "_blank", "noreferrer");
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

function SubmissionBlock({ hw }: { hw: HomeworkWithSubmission }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const sub = hw.submission!;
  return (
    <GlassCard className="p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
        {d.homework.detailYourSubmission}
      </p>
      <div className="mb-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
        {sub.answer_text ?? (
          <span className="italic text-slate-400">{d.homework.noFile}</span>
        )}
      </div>
      {sub.file_url && (
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
    </GlassCard>
  );
}

function SubmitForm({ hw }: { hw: HomeworkWithSubmission }) {
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
      setErrMsg(`Файл больше 10 МБ`);
      e.target.value = "";
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
      const student = await sb.from("students").select("id").single();
      if (student.error) throw student.error;
      const studentId = student.data.id;

      let filePath: string | null = null;
      if (file) {
        filePath = await uploadHomeworkFile(sb, {
          studentId,
          homeworkId: hw.id,
          fileName: file.name,
          blob: file,
        });
      }

      await submitHomework(sb, {
        homework_id: hw.id,
        student_id: studentId,
        ...(text.trim() ? { answer_text: text.trim() } : {}),
        ...(filePath ? { file_url: filePath } : {}),
        status: "submitted",
      });

      setStatus("success");
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

        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="*/*"
            onChange={handleFileChange}
            className="hidden"
            id="hw-file-upload"
          />
          <label
            htmlFor="hw-file-upload"
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm text-slate-500 transition hover:border-brand-blue hover:text-brand-blue"
          >
            <Paperclip size={14} />
            {file ? file.name : d.homework.attachFile}
          </label>
          {file && (
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="text-xs text-slate-400 hover:text-red-500"
            >
              ✕
            </button>
          )}
        </div>

        {errMsg && (
          <p className="text-xs text-red-500">{errMsg}</p>
        )}
        {status === "error" && (
          <p className="text-xs text-red-500">{d.homework.formError}</p>
        )}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-md transition disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg,#1D6FF5 0%,#0B3EDB 100%)",
          }}
        >
          <Send size={14} />
          {status === "submitting" ? d.homework.formSubmitting : d.homework.send}
        </button>
      </form>
    </GlassCard>
  );
}

export function HomeworkDetailView({ hw }: { hw: HomeworkWithSubmission }) {
  const router = useRouter();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const subj = hw.group.subject;
  const style = getSubjectStyle(subj);

  const dueLabel = hw.due_date
    ? new Date(hw.due_date).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

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
              {subj} · {hw.group.name}
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

      {/* Teacher attachments */}
      {hw.attachments.length > 0 && (
        <GlassCard className="mb-4 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            {d.homework.detailAttachments}
          </p>
          <div className="flex flex-col gap-2">
            {hw.attachments.map((att, i) => (
              <AttachmentItem key={i} name={att.name} path={att.url} />
            ))}
          </div>
        </GlassCard>
      )}

      {/* Submission or Test */}
      {hw.content_type === "test" ? (
        <TestPlayer hw={hw} />
      ) : hw.submission ? (
        <SubmissionBlock hw={hw} />
      ) : (
        <SubmitForm hw={hw} />
      )}
    </div>
  );
}
