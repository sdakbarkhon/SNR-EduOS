"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Check, Clock, Upload, Trash2, FileText, Download, Play, Loader2, CalendarDays,
} from "lucide-react";
import {
  getDictionary, getSubjectStyle, startProject, toggleStageCompletion,
  uploadProjectAttachment, deleteProjectAttachment, getProjectAttachmentUrl, submitProject,
  type Locale, type ProjectWithStages, type ProjectSubmission, type ProjectStageProgress, type ProjectAttachment,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { SubjectIcon, useLocale } from "@/components";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { cn } from "@/lib/cn";

export function ProjectDetailView({
  studentId, project, initialSubmission, initialProgress, initialAttachments,
}: {
  studentId: string;
  project: ProjectWithStages & { group: { name: string; subject: string } };
  initialSubmission: ProjectSubmission | null;
  initialProgress: ProjectStageProgress[];
  initialAttachments: ProjectAttachment[];
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.projects;
  const router = useRouter();
  const db = createClient();
  const style = getSubjectStyle(project.subject);

  const [submission, setSubmission] = useState(initialSubmission);
  const [progress, setProgress] = useState<ProjectStageProgress[]>(initialProgress);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>(initialAttachments);
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const p of initialProgress) if (p.student_notes) m[p.stage_id] = p.student_notes;
    return m;
  });
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const readOnly = !!submission?.is_submitted;
  const totalStages = project.stages.length;
  const completedCount = progress.filter((p) => p.is_completed).length;
  const allDone = totalStages > 0 && project.stages.every((s) => progress.find((p) => p.stage_id === s.id)?.is_completed);

  const due = project.deadline ? new Date(project.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tashkent" }) : null;
  const graded = submission?.grade != null;

  function progFor(stageId: string) { return progress.find((p) => p.stage_id === stageId); }

  async function handleStart() {
    setStarting(true);
    try {
      const sub = await startProject(db, project.id, studentId);
      setSubmission(sub);
    } catch { /* noop */ } finally { setStarting(false); }
  }

  async function toggleStage(stageId: string) {
    if (!submission || readOnly || busy) return;
    const current = progFor(stageId);
    const next = !current?.is_completed;
    setBusy(true);
    try {
      await toggleStageCompletion(db, submission.id, stageId, next, notes[stageId] ?? null);
      setProgress((p) => {
        const others = p.filter((x) => x.stage_id !== stageId);
        return [...others, { id: current?.id ?? stageId, submission_id: submission.id, stage_id: stageId, is_completed: next, completed_at: next ? new Date().toISOString() : null, student_notes: notes[stageId] ?? null }];
      });
    } catch { /* noop */ } finally { setBusy(false); }
  }

  async function saveNotes(stageId: string) {
    if (!submission || readOnly) return;
    const current = progFor(stageId);
    await toggleStageCompletion(db, submission.id, stageId, current?.is_completed ?? false, notes[stageId] ?? null).catch(() => null);
  }

  async function uploadFile(stageId: string | null, file: File) {
    if (!submission || readOnly) return;
    setBusy(true);
    try {
      const att = await uploadProjectAttachment(db, { studentId, projectId: project.id, submissionId: submission.id, stageId, file });
      setAttachments((a) => [...a, att]);
    } catch { /* noop */ } finally { setBusy(false); }
  }

  async function removeFile(att: ProjectAttachment) {
    if (readOnly) return;
    await deleteProjectAttachment(db, att.id, att.storage_path).catch(() => null);
    setAttachments((a) => a.filter((x) => x.id !== att.id));
  }

  async function download(att: ProjectAttachment) {
    const url = await getProjectAttachmentUrl(db, att.storage_path, att.original_filename).catch(() => null);
    if (url) window.open(url, "_blank");
  }

  async function handleSubmit() {
    if (!submission) return;
    await submitProject(db, submission.id).catch(() => null);
    setSubmission((s) => (s ? { ...s, is_submitted: true, submitted_at: new Date().toISOString() } : s));
  }

  function FileRow({ att }: { att: ProjectAttachment }) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white/70 px-3 py-2">
        <FileText size={14} className="shrink-0 text-blue-600" />
        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700">{att.original_filename}</span>
        <button onClick={() => download(att)} className="rounded p-1 text-slate-400 hover:text-blue-600"><Download size={14} /></button>
        {!readOnly && <button onClick={() => removeFile(att)} className="rounded p-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 md:px-8">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-blue-600">
        <ChevronLeft size={16} /> {t.title}
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `${style.color}1a` }}>
            <SubjectIcon subject={project.subject} size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: style.color }}>{style.label} · {project.group.name}</p>
            <h1 className="text-xl font-bold text-slate-900">{project.title}</h1>
            {due && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><CalendarDays size={13} /> {t.deadline}: {due}</p>}
          </div>
        </div>
        {project.description && <p className="mt-4 whitespace-pre-wrap border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-700">{project.description}</p>}
      </div>

      {/* Not started → big start button */}
      {!submission ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/70 bg-white/60 py-16 text-center backdrop-blur-xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600"><Play size={28} className="fill-blue-600" /></div>
          <button onClick={handleStart} disabled={starting}
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3 text-sm font-bold text-white shadow-md transition disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)" }}>
            {starting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} {t.start}
          </button>
        </div>
      ) : (
        <>
          {/* Stages stepper */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">{t.stagesTitle}</h2>
            {project.stages.map((stage, i) => {
              const prog = progFor(stage.id);
              const done = !!prog?.is_completed;
              const files = attachments.filter((a) => a.stage_id === stage.id);
              return (
                <div key={stage.id} className={cn("rounded-2xl border p-5 shadow-sm backdrop-blur-xl transition-colors", done ? "border-emerald-200 bg-emerald-50/50" : "border-white/70 bg-white/70")}>
                  <div className="flex items-start gap-3">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold", done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-slate-400")}>
                      {done ? <Check size={16} strokeWidth={3} /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] font-bold text-slate-800">{stage.title}</h3>
                      {stage.description && <p className="mt-0.5 text-[13px] text-slate-500">{stage.description}</p>}
                    </div>
                    <button onClick={() => toggleStage(stage.id)} disabled={readOnly || busy}
                      className={cn("shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-60",
                        done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600")}>
                      {done ? <><Check size={12} className="mr-1 inline" />{t.done}</> : t.markDone}
                    </button>
                  </div>

                  {/* Notes */}
                  <textarea
                    value={notes[stage.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [stage.id]: e.target.value }))}
                    onBlur={() => saveNotes(stage.id)}
                    disabled={readOnly}
                    placeholder={t.notesPlaceholder}
                    rows={2}
                    className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none disabled:bg-slate-50"
                  />

                  {/* Files */}
                  <div className="mt-2 space-y-1.5">
                    {files.map((f) => <FileRow key={f.id} att={f} />)}
                    {!readOnly && (
                      <>
                        <input ref={(el) => { fileRefs.current[stage.id] = el; }} type="file" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(stage.id, f); e.target.value = ""; }} />
                        <button onClick={() => fileRefs.current[stage.id]?.click()} disabled={busy}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-2 text-[12px] font-medium text-slate-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50">
                          <Upload size={13} /> {t.attachStage}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* General files */}
          <div className="rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-gray-500">{t.generalFiles}</h2>
            <div className="space-y-1.5">
              {attachments.filter((a) => !a.stage_id).map((f) => <FileRow key={f.id} att={f} />)}
              {!readOnly && (
                <>
                  <input ref={(el) => { fileRefs.current.__general = el; }} type="file" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(null, f); e.target.value = ""; }} />
                  <button onClick={() => fileRefs.current.__general?.click()} disabled={busy}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-2 text-[12px] font-medium text-slate-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50">
                    <Upload size={13} /> {t.attachGeneral}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Footer state */}
          {graded ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
              <p className="text-3xl font-black text-emerald-600">{t.gradedTitle.replace("{grade}", String(submission!.grade))}</p>
              {submission!.teacher_comment && <p className="mt-2 text-sm text-slate-600">{submission!.teacher_comment}</p>}
            </div>
          ) : submission!.is_submitted ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-yellow-200 bg-yellow-50/60 p-8 text-center">
              <Clock className="h-9 w-9 text-yellow-500" />
              <p className="text-sm font-bold text-yellow-700">{t.submittedTitle}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
              <p className="mb-3 text-center text-sm font-semibold text-slate-600">
                {t.progressLabel.replace("{done}", String(completedCount)).replace("{total}", String(totalStages))}
              </p>
              <button onClick={() => setSubmitOpen(true)} disabled={!allDone}
                className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}>
                {t.submitBtn}
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onConfirm={handleSubmit}
        title={t.submitConfirmTitle}
        message={t.submitConfirmMsg}
        variant="warning"
        confirmText={t.submitBtn}
        cancelText={d.common.cancel}
      />
    </div>
  );
}
