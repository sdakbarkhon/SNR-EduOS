"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Trash2, Calendar, Check, Download, Pencil, ChevronDown, FileText } from "lucide-react";
import {
  getDictionary, getSubjectStyle, deleteProject, gradeProjectSubmission, getProjectAttachmentUrl,
  type Locale, type ProjectWithStages, type ProjectSubmissionWithStudent,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { SubjectIcon, useLocale } from "@/components";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { cn } from "@/lib/cn";

type Student = { id: string; full_name: string; avatar_url: string | null };

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function TeacherProjectDetailView({
  project, teacherId, submissions: initialSubs, students,
}: {
  project: ProjectWithStages & { group: { name: string; subject: string } };
  teacherId: string;
  submissions: ProjectSubmissionWithStudent[];
  students: Student[];
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.teacher.projects;
  const router = useRouter();
  const db = createClient();
  const style = getSubjectStyle(project.subject);

  const [subs, setSubs] = useState(initialSubs);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [grades, setGrades] = useState<Record<string, { grade: string; comment: string; saving: boolean }>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);

  const subByStudent = new Map(subs.map((s) => [s.student_id, s]));
  const totalStages = project.stages.length;

  function gradeState(subId: string, sub: ProjectSubmissionWithStudent | undefined) {
    return grades[subId] ?? { grade: sub?.grade?.toString() ?? "", comment: sub?.teacher_comment ?? "", saving: false };
  }

  async function saveGrade(sub: ProjectSubmissionWithStudent) {
    const g = gradeState(sub.id, sub);
    const n = parseInt(g.grade);
    if (isNaN(n) || n < 1 || n > 5) return;
    setGrades((p) => ({ ...p, [sub.id]: { ...gradeState(sub.id, sub), saving: true } }));
    try {
      await gradeProjectSubmission(db, { submissionId: sub.id, teacherId, grade: n, comment: g.comment });
      setSubs((p) => p.map((x) => (x.id === sub.id ? { ...x, grade: n, teacher_comment: g.comment || null } : x)));
      setEditingId(null);
    } finally {
      setGrades((p) => ({ ...p, [sub.id]: { ...gradeState(sub.id, sub), saving: false } }));
    }
  }

  async function handleDelete() {
    await deleteProject(db, project.id).catch(() => null);
    router.push("/teacher/projects");
  }

  async function downloadAttachment(path: string, name: string) {
    const url = await getProjectAttachmentUrl(db, path, name).catch(() => null);
    if (url) window.open(url, "_blank");
  }

  function statusChip(sub: ProjectSubmissionWithStudent | undefined) {
    if (!sub) return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">{t.notStarted}</span>;
    if (sub.grade != null) return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">{t.gradedLabel}: {sub.grade}/5</span>;
    if (sub.is_submitted) return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">{t.awaiting}</span>;
    return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">{t.inWork}</span>;
  }

  const due = project.deadline ? new Date(project.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tashkent" }) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/teacher/projects" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-blue-600">
        <ChevronLeft size={16} /> {t.title}
      </Link>

      {/* Header */}
      <section className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `${style.color}1a` }}>
              <SubjectIcon subject={project.subject} size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: style.color }}>{style.label} · {project.group.name}</p>
              <h1 className="text-xl font-bold text-brand-ink">{project.title}</h1>
              {due && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Calendar size={13} /> {t.deadline}: {due}</p>}
            </div>
          </div>
          <button onClick={() => setDeleteOpen(true)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500" title={d.common.cancel}>
            <Trash2 size={17} />
          </button>
        </div>
        {project.description && <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-700">{project.description}</p>}
      </section>

      {/* Stages (read-only) */}
      <section className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur-xl">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-500">{t.stagesBlock}</h2>
        {totalStages === 0 ? <p className="text-sm text-slate-400">{t.noStages}</p> : (
          <ol className="space-y-2">
            {project.stages.map((s, i) => (
              <li key={s.id} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[12px] font-bold text-blue-700">{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-brand-ink">{s.title}</p>
                  {s.description && <p className="text-[13px] text-slate-500">{s.description}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Students */}
      <section className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur-xl">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-gray-500">{t.studentsBlock}</h2>
        <div className="space-y-2">
          {students.map((st) => {
            const sub = subByStudent.get(st.id);
            const completed = sub ? sub.progress.filter((p) => p.is_completed).length : 0;
            const pct = totalStages > 0 ? Math.round((completed / totalStages) * 100) : 0;
            const isOpen = openId === st.id;
            const isGraded = sub?.grade != null;
            const isEditing = editingId === st.id;
            const g = sub ? gradeState(sub.id, sub) : null;
            return (
              <div key={st.id} className="rounded-[14px] border border-slate-100 bg-white/60">
                <div className="flex items-center gap-3 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[12px] font-bold text-blue-600">{initials(st.full_name)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-brand-ink">{st.full_name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-slate-400">{completed}/{totalStages}</span>
                    </div>
                  </div>
                  {statusChip(sub)}
                  {sub && (
                    <button onClick={() => setOpenId(isOpen ? null : st.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                      <ChevronDown size={16} className={cn("transition-transform", isOpen && "rotate-180")} />
                    </button>
                  )}
                </div>

                {isOpen && sub && (
                  <div className="space-y-3 border-t border-slate-100 p-3">
                    {/* stages with checks + notes + files */}
                    {project.stages.map((stage) => {
                      const prog = sub.progress.find((p) => p.stage_id === stage.id);
                      const files = sub.attachments.filter((a) => a.stage_id === stage.id);
                      return (
                        <div key={stage.id} className="rounded-xl bg-slate-50 p-2.5">
                          <div className="flex items-center gap-2">
                            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border-2", prog?.is_completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300")}>
                              {prog?.is_completed && <Check size={12} strokeWidth={3} />}
                            </span>
                            <span className="text-[13px] font-semibold text-brand-ink">{stage.title}</span>
                          </div>
                          {prog?.student_notes && <p className="mt-1.5 pl-7 text-[13px] text-slate-600">{prog.student_notes}</p>}
                          {files.map((f) => (
                            <button key={f.id} onClick={() => downloadAttachment(f.storage_path, f.original_filename)}
                              className="mt-1.5 ml-7 flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:underline">
                              <FileText size={13} /> {f.original_filename} <Download size={11} />
                            </button>
                          ))}
                        </div>
                      );
                    })}
                    {/* general files */}
                    {sub.attachments.filter((a) => !a.stage_id).length > 0 && (
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <p className="mb-1 text-[12px] font-semibold text-slate-500">{t.files}</p>
                        {sub.attachments.filter((a) => !a.stage_id).map((f) => (
                          <button key={f.id} onClick={() => downloadAttachment(f.storage_path, f.original_filename)}
                            className="flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:underline">
                            <FileText size={13} /> {f.original_filename} <Download size={11} />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Grade */}
                    {isGraded && !isEditing ? (
                      <div className="flex items-center justify-between rounded-xl bg-emerald-50/60 px-3 py-2">
                        <div>
                          <p className="text-[13px] font-semibold text-emerald-700">{t.gradedLabel}: {sub.grade}/5</p>
                          {sub.teacher_comment && <p className="text-[12px] text-slate-500">{sub.teacher_comment}</p>}
                        </div>
                        <button onClick={() => setEditingId(st.id)} className="flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:underline"><Pencil size={12} /> Редактировать</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input type="number" min={1} max={5} placeholder="1–5" value={g?.grade ?? ""}
                          onChange={(e) => setGrades((p) => ({ ...p, [sub.id]: { ...gradeState(sub.id, sub), grade: e.target.value } }))}
                          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] focus:outline-none focus:border-blue-500" />
                        <input type="text" placeholder={t.commentLabel} value={g?.comment ?? ""}
                          onChange={(e) => setGrades((p) => ({ ...p, [sub.id]: { ...gradeState(sub.id, sub), comment: e.target.value } }))}
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] focus:outline-none focus:border-blue-500" />
                        <button onClick={() => saveGrade(sub)} disabled={g?.saving}
                          className="rounded-lg bg-brand-blue px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50 hover:brightness-110">
                          {g?.saving ? "…" : t.gradeBtn}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t.deleteConfirm}
        variant="danger"
        confirmText="Удалить"
        cancelText={d.common.cancel}
      />
    </div>
  );
}
